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


# Import models (moved to top to avoid NameError)
def _get_models():
    """Lazy import to avoid circular dependencies"""
    from signals.models import Signal
    from mt5.models import MT5Account, Trade
    from compliance.models import ComplianceResult
    from compliance.services import ComplianceService
    return Signal, MT5Account, Trade, ComplianceResult, ComplianceService


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
            
            # Determine primary trade: only use if not already linked to another compliance result
            primary_trade = None
            if all_signal_trades:
                first_trade = all_signal_trades[0]
                # Check if this trade is already linked to a compliance result from another signal
                try:
                    existing_result = ComplianceResult.objects.exclude(signal=signal).get(trade=first_trade)
                    # Trade is already linked to another signal - don't re-link
                    primary_trade = None
                except ComplianceResult.DoesNotExist:
                    # Safe to use this trade
                    primary_trade = first_trade
            
            result, _ = ComplianceResult.objects.update_or_create(
                user=user,
                signal=signal,
                defaults={
                    'trader_profile': getattr(user, 'trader_profile', None),
                    'trade': primary_trade,
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

    # ── Step 3: Detect rogue trades (positions without matching signal) ───────
    rogue_count = _detect_rogue_trades(account, today, active_signals)
    if rogue_count > 0:
        logger.warning('Detected %d rogue trade(s) for user %s', rogue_count, user.email)

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


def _detect_rogue_trades(account, today, active_signals) -> int:
    """
    Detect positions opened without following any active signal (rogue/unauthorized trades).
    
    Logic:
    1. Get all positions from this account
    2. Get all trades that ARE linked to signals (legitimate)
    3. Find positions that are NOT in the legitimate list (rogue)
    4. For each rogue position:
       - Create Trade record without signal
       - Create ComplianceResult with "unauthorized_trade" violation
       - Send notification to trader
       - Issue SOPWarning
    
    Returns: number of rogue trades detected
    """
    from mt5.models import Trade
    from compliance.models import ComplianceResult
    from compliance.services import ComplianceService
    
    user = account.user
    
    # Get all positions from this account (today's positions)
    positions = list(account.positions.all())
    
    if not positions:
        return 0  # no positions, nothing to check
    
    # Get all trades that ARE linked to signals (these are legitimate)
    matched_tickets = set(Trade.objects.filter(
        account=account,
        signal__isnull=False,
    ).values_list('ticket', flat=True))
    
    # Find rogue positions (not linked to any signal)
    rogue_positions = [p for p in positions if p.ticket not in matched_tickets]
    
    if not rogue_positions:
        return 0  # all positions are matched, all good
    
    # For each rogue position, check if it's truly unauthorized
    # or just opened before signal was created (edge case)
    rogue_count = 0
    
    for pos in rogue_positions:
        # Skip if we already created a rogue trade compliance for this ticket
        existing_rogue = ComplianceResult.objects.filter(
            user=user,
            trade__ticket=pos.ticket,
            signal__isnull=True,  # rogue trades have no signal
        ).first()
        
        if existing_rogue:
            continue  # already marked as rogue
        
        # Create Trade record without signal (rogue trade marker)
        trade, created = Trade.objects.get_or_create(
            account=account,
            ticket=pos.ticket,
            defaults={
                'user': user,
                'signal': None,  # no signal = rogue
                'symbol': pos.symbol,
                'direction': pos.type,
                'order_type': 'market',  # assume market if not specified
                'volume': pos.volume,
                'entry_price': pos.price_open,
                'stop_loss': pos.sl,
                'take_profit': pos.tp,
                'open_time': pos.time_open,
                'status': 'open',
                'pnl': pos.profit,
            }
        )
        
        if not created:
            # Trade already exists without signal, just update it
            trade.status = 'open'
            trade.pnl = pos.profit
            trade.save(update_fields=['status', 'pnl'])
        
        # Create ComplianceResult with "unauthorized_trade" violation
        result, _ = ComplianceResult.objects.update_or_create(
            user=user,
            trade=trade,
            defaults={
                'signal': None,  # no signal
                'trader_profile': getattr(user, 'trader_profile', None),
                'status': 'Unauthorized Trade',
                'score': 0,
                'actual_direction': pos.type,
                'actual_entry': float(pos.price_open) if pos.price_open else None,
                'actual_entry_time': ComplianceService()._coerce_time(pos.time_open),
                'coaching_note': (
                    f'Trader membuka posisi {pos.symbol} {pos.type} @ {pos.price_open} '
                    f'tanpa ada signal yang match. Entry diluar SOP. '
                    f'Pastikan hanya entry sesuai signal dari TradingView.'
                ),
                'violations': ['unauthorized_trade'],
                'entry_count': 0,
                'entry1_ticket': None,
                'entry2_ticket': None,
                'entry3_ticket': None,
            }
        )
        
        # Send notification to trader
        try:
            from notifications.models import Notification
            Notification.objects.create(
                recipient=user,
                type='compliance',
                level='danger',
                title=f'⚠️ Entry Tanpa Signal — {pos.symbol}',
                body=(
                    f'Kamu membuka posisi {pos.symbol} {pos.type} @ {pos.price_open} '
                    f'tanpa mengikuti signal apapun. Ini melanggar SOP. '
                    f'Pastikan hanya entry sesuai signal dari TradingView.'
                ),
            )
        except Exception:
            logger.exception('Failed to send rogue trade notification to %s', user.email)
        
        # Issue SOPWarning
        try:
            from compliance.models import SOPWarning
            from datetime import timedelta
            
            # Count recent warnings (last 30 days)
            cutoff = timezone.now() - timedelta(days=30)
            recent_count = SOPWarning.objects.filter(user=user, created_at__gte=cutoff).count()
            severity = 'danger' if recent_count >= 3 else 'warning'
            
            SOPWarning.objects.create(
                user=user,
                compliance_result=result,
                violation_type='unauthorized_trade',
                severity=severity,
                message=f'Entry tanpa signal: {pos.symbol} {pos.type} @ {pos.price_open}',
            )
        except Exception:
            logger.exception('Failed to create SOPWarning for rogue trade')
        
        # Update user compliance scores
        try:
            ComplianceService()._recalculate_user_scores(user)
        except Exception:
            logger.exception('Failed to recalculate scores for user %s', user.email)
        
        rogue_count += 1
        logger.warning(
            'Rogue trade detected: user=%s symbol=%s direction=%s entry=%.2f ticket=%s',
            user.email, pos.symbol, pos.type, pos.price_open, pos.ticket
        )
    
    return rogue_count
