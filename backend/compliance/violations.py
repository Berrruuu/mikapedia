"""
SOP Violation Engine
====================
Evaluates a trader's execution against:
  1. Signal's TP/SL/entry prices from TradingView
  2. SOP parameters from SystemSettings (admin-configured)

SOP: Trader WAJIB membuka 3 posisi per signal:
  - Posisi 1 di Fib 0.236
  - Posisi 2 di Fib 0.500
  - Posisi 3 di Fib 0.618
  Semua dengan SL di Fib 0.786 dan TP di Fib -0.27

Score deductions per violation:
  missed_signal          -100  (tidak entry sama sekali)
  incomplete_entries     -15   per posisi yang kurang (max -45 untuk 3 missing)
  wrong_direction        -60   (arah berlawanan signal)
  late_entry             -25   (entry setelah max_entry_time)
  no_stop_loss           -20   per posisi (applied to all positions)
  no_take_profit         -20   per posisi
  wrong_stop_loss        -10   (SL tidak sesuai level signal)
  wrong_lot_size         -15   (lot > max dari settings)
  entry_out_of_zone      -10   per posisi
"""

from dataclasses import dataclass, field
from typing import List, Optional
import logging

logger = logging.getLogger('compliance.violations')


def _get_sop_settings():
    """Load SOP settings from SystemSettings."""
    try:
        from app_settings.models import SystemSettings
        return SystemSettings.get()
    except Exception:
        return None


def _is_near_level(price: float, target: float, tolerance_pct: float = 0.003) -> bool:
    """Check if price is within tolerance% of a target level."""
    if not target or target == 0:
        return False
    return abs(price - target) / target <= tolerance_pct


@dataclass
class Violation:
    code: str
    label: str
    deduction: int
    note: str


@dataclass
class ViolationReport:
    violations: List[Violation] = field(default_factory=list)
    base_score: int = 100
    entry_count: int = 0      # how many of the 3 positions were opened
    entry1_ticket: Optional[int] = None  # ticket at fib 0.236
    entry2_ticket: Optional[int] = None  # ticket at fib 0.500
    entry3_ticket: Optional[int] = None  # ticket at fib 0.618

    @property
    def total_deduction(self) -> int:
        return sum(v.deduction for v in self.violations)

    @property
    def final_score(self) -> int:
        return max(0, self.base_score - self.total_deduction)

    @property
    def status(self) -> str:
        if not self.violations:
            return 'Compliant'
        codes = {v.code for v in self.violations}
        if 'missed_signal' in codes:
            return 'Missed'
        if 'wrong_direction' in codes:
            return 'Wrong Direction'
        if 'late_entry' in codes:
            return 'Late Entry'
        return 'Partial'

    @property
    def coaching_note(self) -> str:
        if not self.violations:
            return f'Eksekusi sesuai SOP. Semua {self.entry_count}/3 posisi terbuka dengan benar.'
        return ' | '.join(v.note for v in self.violations)

    def is_sop_violation(self) -> bool:
        severe_codes = {'missed_signal', 'wrong_direction', 'no_stop_loss', 'no_take_profit', 'incomplete_entries'}
        return bool({v.code for v in self.violations} & severe_codes)


def evaluate_three_positions(trades: list, signal) -> ViolationReport:
    """
    Evaluate a group of trades (pending + open + closed) against a signal's 3-position SOP.

    Trade lifecycle per SOP:
      1. Trader pasang 3 LIMIT ORDERS dalam 5 menit
      2. Jika candle berikutnya tidak menyentuh harga → cancel semua (status='cancelled')
      3. Jika 1 order tersentuh → posisi open, 2 lainnya tetap pending sampai TP order 1 hit
      4. Setelah TP order 1 hit → cancel 2 order sisanya
      5. Jika 3 order semua tersentuh → semua jalan

    Args:
        trades: list of mt5.Trade instances (any status) for this signal from this trader
        signal: signals.Signal instance
    """
    report = ViolationReport()
    sop = _get_sop_settings()
    max_lot = float(sop.max_lot_per_trade if sop else 0.5)
    max_entry_delay = int(sop.max_entry_delay_minutes if sop else 5)

    # ── Rule 1: Missed Signal (no trades at all) ─────────────────────────────
    if not trades:
        report.violations.append(Violation(
            code='missed_signal',
            label='Signal Dilewati',
            deduction=100,
            note=f'Trader tidak membuka posisi apapun dalam {max_entry_delay} menit setelah signal.',
        ))
        report.entry_count = 0
        return report

    # Separate trades by status for context-aware evaluation
    open_trades      = [t for t in trades if getattr(t, 'status', '') == 'open']
    closed_trades    = [t for t in trades if getattr(t, 'status', '') == 'closed']
    cancelled_trades = [t for t in trades if getattr(t, 'status', '') == 'cancelled']
    pending_trades   = [t for t in trades if getattr(t, 'status', '') == 'pending']
    executed_trades  = open_trades + closed_trades

    # ── CASE: Trader pasang order tapi tidak terjemput ────────────────────────
    # Jika trader pasang limit order (pending/cancelled) tapi tidak ada yang
    # open/closed → harga tidak menyentuh level → ini BUKAN pelanggaran.
    # Trader sudah melakukan prosedur yang benar.
    placed_orders = pending_trades + cancelled_trades
    if placed_orders and not executed_trades:
        # Cek apakah semua order yang dipasang adalah limit order (bukan market)
        all_limit = all(
            getattr(t, 'order_type', 'market') in ('buy_limit', 'sell_limit', 'buy_stop', 'sell_stop')
            for t in placed_orders
        )
        if all_limit:
            # Semua order limit, tidak ada yang terjemput → Compliant (score 100)
            # Status: "Pending" karena order masih bisa terjemput, atau "Compliant"
            # jika sudah expired dan memang harga tidak sampai
            report.entry_count = 0  # tidak ada yang open, tapi bukan salah trader
            # No violations — trader sudah benar
            return report  # score = 100, status = Compliant
        # Jika ada market order → tetap evaluasi violation

    # ── TP-hit detection ─────────────────────────────────────────────────────
    # If a closed trade hit TP and remaining pending/limit orders were then
    # cancelled → this is LEGITIMATE (SOP-compliant), not a violation.
    tp_hit_detected = False
    for t in closed_trades:
        if t.take_profit and t.exit_price:
            exit_p = float(t.exit_price)
            tp_p   = float(t.take_profit)
            if signal.direction == 'BUY' and exit_p >= tp_p * 0.999:
                tp_hit_detected = True
                break
            elif signal.direction == 'SELL' and exit_p <= tp_p * 1.001:
                tp_hit_detected = True
                break

    # Legitimate if: TP was hit AND remaining orders were cancelled
    legitimate_cancellation = tp_hit_detected and len(cancelled_trades) > 0

    # ── Match trades to fib levels ───────────────────────────────────────────
    # Each trade is assigned to the nearest fib level
    fib_levels = [
        (signal.fib_0236, '0.236', 'entry1'),
        (signal.fib_0500, '0.500', 'entry2'),
        (signal.fib_0618, '0.618', 'entry3'),
    ]

    assigned: dict[str, object] = {}  # 'entry1'/'entry2'/'entry3' → trade
    unassigned = list(trades)

    for fib_price, fib_label, entry_key in fib_levels:
        if not fib_price or not unassigned:
            continue
        # Find the trade closest to this fib level
        best = min(unassigned, key=lambda t: abs(float(t.entry_price or 0) - fib_price), default=None)
        if best and _is_near_level(float(best.entry_price or 0), fib_price, tolerance_pct=0.005):
            assigned[entry_key] = best
            unassigned.remove(best)

    report.entry_count = len(assigned)
    report.entry1_ticket = getattr(assigned.get('entry1'), 'ticket', None)
    report.entry2_ticket = getattr(assigned.get('entry2'), 'ticket', None)
    report.entry3_ticket = getattr(assigned.get('entry3'), 'ticket', None)

    # ── Rule 2: Incomplete entries ───────────────────────────────────────────
    # Count only non-cancelled trades for the "opened" check
    active_trades = [t for t in trades if getattr(t, 'status', '') != 'cancelled']
    missing = 3 - report.entry_count

    # Special case: if all orders were cancelled (no positions opened) = missed
    all_cancelled = len(active_trades) == 0 and len(trades) > 0
    if all_cancelled:
        report.violations.append(Violation(
            code='missed_signal',
            label='Semua Order Dibatalkan Sebelum Tersentuh',
            deduction=100,
            note='Semua limit order dibatalkan sebelum harga menyentuh level entry. '
                 'Signal dianggap dilewati.',
        ))
        report.entry_count = 0
        return report

    if missing > 0 and not all_cancelled:
        # If TP was hit and remaining orders cancelled legitimately → no deduction
        if legitimate_cancellation:
            # Just note it, no penalty
            pass
        else:
            opened_labels = []
            missing_labels = []
            for fib_price, fib_label, entry_key in fib_levels:
                if entry_key in assigned:
                    opened_labels.append(f'Fib {fib_label}')
                else:
                    missing_labels.append(f'Fib {fib_label}')

            report.violations.append(Violation(
                code='incomplete_entries',
                label=f'Entry Kurang ({report.entry_count}/3)',
                deduction=15 * missing,
                note=f'SOP mengharuskan 3 posisi. Dibuka: {report.entry_count}/3. '
                     f'Level yang dibuka: {", ".join(opened_labels) or "tidak ada"}. '
                     f'Level yang belum: {", ".join(missing_labels)}. '
                     f'(Jika TP sudah tercapai, batalkan 2 order sisanya adalah benar.)',
            ))
    # ── Rule 3: Direction check (on all trades) ──────────────────────────────
    wrong_dir_trades = [t for t in trades if t.direction and t.direction.upper() != signal.direction.upper()]
    if wrong_dir_trades:
        report.violations.append(Violation(
            code='wrong_direction',
            label='Arah Salah',
            deduction=60,
            note=f'{len(wrong_dir_trades)} posisi berlawanan arah. '
                 f'Signal: {signal.direction}, trader buka: {wrong_dir_trades[0].direction}.',
        ))

    # ── Rule 3b: Order Type — must use LIMIT not MARKET ──────────────────────
    # SOP: trader harus pasang Buy Limit / Sell Limit, bukan Market Order
    market_trades = [
        t for t in trades
        if getattr(t, 'order_type', 'market') == 'market'
        and getattr(t, 'status', '') in ('open', 'closed')  # only executed trades
    ]
    if market_trades:
        report.violations.append(Violation(
            code='wrong_order_type',
            label=f'Pakai Market Order ({len(market_trades)} posisi)',
            deduction=20,
            note=f'{len(market_trades)} posisi dibuka dengan Market Order. '
                 f'SOP mengharuskan Buy/Sell Limit di level Fib yang ditentukan.',
        ))

    # ── Rule 4: Late Entry ───────────────────────────────────────────────────
    if signal.max_entry_time:
        try:
            from django.utils import timezone as tz
            late_trades = []
            for t in trades:
                if t.open_time:
                    local_time = t.open_time.astimezone(tz.get_current_timezone()).time().replace(second=0, microsecond=0)
                    if local_time > signal.max_entry_time:
                        late_trades.append(local_time)
            if late_trades:
                report.violations.append(Violation(
                    code='late_entry',
                    label='Entry Terlambat',
                    deduction=25,
                    note=f'{len(late_trades)} posisi dibuka setelah batas {signal.max_entry_time} '
                         f'(maks {max_entry_delay} menit).',
                ))
        except Exception:
            pass

    # ── Rule 5 & 6: No SL / No TP (check each trade) ─────────────────────────
    no_sl_count = sum(1 for t in trades if not t.stop_loss or float(t.stop_loss or 0) == 0)
    no_tp_count = sum(1 for t in trades if not t.take_profit or float(t.take_profit or 0) == 0)

    if no_sl_count > 0:
        report.violations.append(Violation(
            code='no_stop_loss',
            label=f'Stop Loss Tidak Dipasang ({no_sl_count} posisi)',
            deduction=min(20 * no_sl_count, 40),  # cap at 40
            note=f'{no_sl_count} dari {len(trades)} posisi tidak memiliki Stop Loss. '
                 f'SOP mengharuskan SL di Fib 0.786 = {signal.stop_loss}.',
        ))

    if no_tp_count > 0:
        report.violations.append(Violation(
            code='no_take_profit',
            label=f'Take Profit Tidak Dipasang ({no_tp_count} posisi)',
            deduction=min(20 * no_tp_count, 40),
            note=f'{no_tp_count} dari {len(trades)} posisi tidak memiliki Take Profit. '
                 f'SOP mengharuskan TP di Fib -0.27 = {signal.take_profit}.',
        ))

    # ── Rule 7: Wrong SL level ───────────────────────────────────────────────
    if signal.stop_loss and signal.stop_loss > 0:
        wrong_sl = [
            t for t in trades
            if t.stop_loss and float(t.stop_loss) > 0
            and not _is_near_level(float(t.stop_loss), signal.stop_loss, 0.20)
        ]
        if wrong_sl:
            report.violations.append(Violation(
                code='wrong_stop_loss',
                label='Stop Loss Tidak Sesuai Level Signal',
                deduction=10,
                note=f'{len(wrong_sl)} posisi dengan SL yang menyimpang >20% dari '
                     f'level signal ({signal.stop_loss:.2f}).',
            ))

    # ── Rule 8: Lot Size ─────────────────────────────────────────────────────
    over_lot = [t for t in trades if t.volume and float(t.volume) > max_lot]
    if over_lot:
        actual_lots = [float(t.volume) for t in over_lot]
        report.violations.append(Violation(
            code='wrong_lot_size',
            label=f'Lot Size Melebihi Batas ({len(over_lot)} posisi)',
            deduction=15,
            note=f'{len(over_lot)} posisi dengan lot {actual_lots} melebihi batas '
                 f'maksimum {max_lot} lot yang ditetapkan admin.',
        ))

    return report


def evaluate_trade(trade, signal, trader_profile=None) -> ViolationReport:
    """
    Single-trade wrapper around evaluate_three_positions.
    Used when only 1 trade is available (e.g. during real-time sync).
    The report will note missing entries if only 1 trade found.
    """
    if trade is None:
        return evaluate_three_positions([], signal)
    return evaluate_three_positions([trade], signal)
