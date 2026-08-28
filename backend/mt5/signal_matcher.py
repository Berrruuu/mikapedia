"""
MT5 Signal Matcher
==================
After every MT5 account sync, this module auto-matches open positions
and closed deals to active signals, then updates:
  - Signal.status
  - ComplianceResult per trader per signal
  - Trade.signal FK

Matching logic:
  1. Find signals from today that are still Pending/Waiting
  2. For each synced position/deal on this account:
     - Same symbol/pair
     - Same direction (BUY/SELL)
     - Entry price within the signal's entry zone (fib_0236 ↔ fib_0618)
     - Open time within signal's issued_at → max_entry_time window
  3. Classify as: Executed, Late, Wrong Direction, Missed
"""

import logging
from datetime import datetime, timedelta, timezone as dt_tz
from typing import Optional

from django.utils import timezone

logger = logging.getLogger('mt5.signal_matcher')


def _normalize_symbol(symbol: str) -> str:
    """Strip broker prefix: OANDA:XAUUSD → XAUUSD"""
    return symbol.split(':')[-1].upper().strip()


def _price_in_entry_zone(price: float, signal) -> bool:
    """Check if entry price is within the fib entry zone."""
    entries = [v for v in [signal.fib_0236, signal.fib_0500, signal.fib_0618] if v]
    if not entries:
        return True  # no entry zone defined — accept any

    low  = min(entries)
    high = max(entries)
    # Allow ±0.5% tolerance
    tolerance = (high - low) * 0.5 + (high * 0.005)
    return (low - tolerance) <= price <= (high + tolerance)


def _classify_trade(position_or_deal: dict, signal, account_user) -> dict:
    """
    Returns a dict with:
      status: Executed | Late | Wrong Direction | Missed
      score:  0-100
      actual_direction, actual_entry, actual_entry_time
    """
    direction   = position_or_deal.get('type') or position_or_deal.get('direction', '')
    entry_price = float(position_or_deal.get('price_open') or position_or_deal.get('price') or 0)
    time_raw    = position_or_deal.get('time_open') or position_or_deal.get('time')

    # Parse entry time
    entry_time = None
    if time_raw:
        try:
            if isinstance(time_raw, str):
                entry_dt = datetime.fromisoformat(time_raw.replace('Z', '+00:00'))
            else:
                entry_dt = time_raw
            # Convert to local time
            entry_dt = entry_dt.astimezone(timezone.get_current_timezone())
            entry_time = entry_dt.time().replace(second=0, microsecond=0)
        except Exception:
            pass

    # Check direction
    if direction.upper() != signal.direction.upper():
        return {
            'status': 'Wrong Direction',
            'score': 0,
            'actual_direction': direction.upper(),
            'actual_entry': entry_price,
            'actual_entry_time': entry_time,
        }

    # Check timing
    is_late = False
    if entry_time and signal.max_entry_time:
        if entry_time > signal.max_entry_time:
            is_late = True

    # Check entry price zone
    in_zone = _price_in_entry_zone(entry_price, signal)

    # Calculate score
    score = 100
    if is_late:
        score -= 30
    if not in_zone:
        score -= 20

    status = 'Late' if is_late else 'Executed'

    return {
        'status': status,
        'score': max(0, score),
        'actual_direction': direction.upper(),
        'actual_entry': entry_price,
        'actual_entry_time': entry_time,
    }


def match_account_to_signals(account) -> int:
    """
    Main entry point. Called after every MT5 sync for an account.
    Returns number of signals matched/updated.
    """
    from signals.models import Signal
    from mt5.models import MT5Position, MT5Deal, Trade
    from compliance.models import ComplianceResult

    user = account.user
    today = timezone.localdate()

    # ── Step 1: Evaluate any existing trades that have no ComplianceResult yet ──
    # This catches trades that were created but compliance wasn't evaluated
    unevaluated_trades = Trade.objects.filter(
        user=user,
        signal__session_date=today,
        signal__isnull=False,
    ).exclude(
        pk__in=ComplianceResult.objects.filter(user=user).values('trade_id')
    )

    for trade in unevaluated_trades:
        try:
            from compliance.services import ComplianceService
            ComplianceService().sync_trade_to_compliance(trade)
            logger.info('Evaluated unevaluated trade #%s for user %s', trade.ticket, user.email)
        except Exception:
            logger.exception('Failed to evaluate trade #%s', trade.ticket)

    # ── Step 2: Match new positions/deals from current sync ──────────────────
    # Get active signals for today (include Executed to catch re-evaluations)
    active_signals = Signal.objects.filter(
        session_date=today,
        status__in=['Pending', 'Waiting', 'Executed'],
    )

    if not active_signals.exists():
        _mark_missed_signals(user, Signal.objects.filter(
            session_date=today,
            status__in=['Pending', 'Waiting'],
        ))
        return unevaluated_trades.count()

    # Get this account's positions and recent deals
    positions = list(account.positions.values(
        'ticket', 'symbol', 'type', 'price_open', 'time_open', 'sl', 'tp', 'volume'
    ))
    # Deals from today only
    deals = list(account.deals.filter(
        time__date=today,
        entry='IN',  # only entry deals, not exit
    ).values(
        'ticket', 'order', 'symbol', 'type', 'price', 'time', 'volume'
    ))

    matched = 0

    for signal in active_signals:
        signal_pair = _normalize_symbol(signal.pair or signal.symbol)

        # Collect all matching positions for this signal
        matched_positions = [
            pos for pos in positions
            if _normalize_symbol(pos['symbol']) == signal_pair
        ]

        # Collect all matching deals for this signal
        matched_deals = [
            deal for deal in deals
            if _normalize_symbol(deal['symbol']) == signal_pair
        ]

        all_matching = matched_positions + matched_deals
        if not all_matching:
            continue

        # Create/update Trade records for each matching position/deal
        trade_objects = []
        for pos in matched_positions:
            time_open = None
            if pos.get('time_open'):
                try:
                    from datetime import datetime as _dt
                    time_open = _dt.fromisoformat(str(pos['time_open']).replace('Z', '+00:00'))
                except Exception:
                    pass

            trade, _ = Trade.objects.update_or_create(
                account=account,
                ticket=pos['ticket'],
                defaults={
                    'user': user,
                    'signal': signal,
                    'symbol': pos['symbol'],
                    'direction': pos['type'],
                    'volume': pos['volume'],
                    'entry_price': pos['price_open'],
                    'stop_loss': pos.get('sl'),
                    'take_profit': pos.get('tp'),
                    'open_time': time_open,
                    'status': 'open',
                    'pnl': pos.get('profit', 0),
                }
            )
            trade_objects.append(trade)

        for deal in matched_deals:
            time_deal = None
            if deal.get('time'):
                try:
                    from datetime import datetime as _dt
                    time_deal = _dt.fromisoformat(str(deal['time']).replace('Z', '+00:00'))
                except Exception:
                    pass

            trade, _ = Trade.objects.update_or_create(
                account=account,
                ticket=deal['ticket'],
                defaults={
                    'user': user,
                    'signal': signal,
                    'symbol': deal['symbol'],
                    'direction': deal['type'],
                    'volume': deal['volume'],
                    'entry_price': deal['price'],
                    'stop_loss': deal.get('sl'),
                    'take_profit': deal.get('tp'),
                    'open_time': time_deal,
                    'status': 'closed',
                    'pnl': deal.get('profit', 0),
                }
            )
            trade_objects.append(trade)

        # Full compliance evaluation with all positions (open + pending + cancelled)
        try:
            from compliance.services import ComplianceService
            from compliance.violations import evaluate_three_positions
            svc = ComplianceService()

            # Include ALL statuses — pending orders, open positions, cancelled orders
            all_signal_trades = list(Trade.objects.filter(
                user=user,
                signal=signal,
            ))
            report = evaluate_three_positions(all_signal_trades, signal)

            from compliance.models import ComplianceResult
            result, _ = ComplianceResult.objects.update_or_create(
                user=user,
                signal=signal,
                defaults={
                    'trader_profile': getattr(user, 'trader_profile', None),
                    'trade': all_signal_trades[0] if all_signal_trades else None,
                    'status': report.status,
                    'score': report.final_score,
                    'actual_direction': all_signal_trades[0].direction if all_signal_trades else None,
                    'actual_entry': float(all_signal_trades[0].entry_price) if all_signal_trades else None,
                    'actual_entry_time': svc._coerce_time(all_signal_trades[0].open_time) if all_signal_trades else None,
                    'coaching_note': report.coaching_note,
                    'violations': [v.code for v in report.violations],
                    'entry_count': report.entry_count,
                    'entry1_ticket': report.entry1_ticket,
                    'entry2_ticket': report.entry2_ticket,
                    'entry3_ticket': report.entry3_ticket,
                }
            )
            svc._post_evaluate(result, report)

            # Update signal status
            if signal.status in ('Pending', 'Waiting'):
                if report.entry_count > 0:
                    signal.status = 'Executed' if report.entry_count == 3 else 'Waiting'
                    signal.save(update_fields=['status'])

        except Exception:
            logger.exception('ComplianceService failed for signal #%s user %s', signal.id, user.email)
            continue

        matched += len(trade_objects)
        logger.info('Signal #%d: %d position(s) matched, entry_count=%d',
                    signal.id, len(trade_objects), len(all_matching))

    # Mark expired signals as Missed for this trader
    _mark_missed_signals(user, active_signals)

    return matched


def _mark_missed_signals(user, active_signals):
    """
    For signals that have passed max_entry_time with no compliance record
    for this user — check if they placed orders or truly ignored the signal.
    """
    now = timezone.localtime()
    current_time = now.time()

    for signal in active_signals:
        if signal.status not in ('Pending', 'Waiting'):
            continue
        if not signal.max_entry_time:
            continue
        if current_time <= signal.max_entry_time:
            continue  # still within entry window

        from compliance.models import ComplianceResult
        existing = ComplianceResult.objects.filter(user=user, signal=signal).first()
        if existing:
            continue

        # Use the service which checks if limit orders were placed
        try:
            from compliance.services import ComplianceService
            ComplianceService().create_missed_compliance(user, signal)
            logger.info('Signal #%s processed for user %s (missed or order not hit)', signal.id, user.email)
        except Exception:
            logger.exception('Failed to process missed compliance for signal #%s user %s', signal.id, user.email)
