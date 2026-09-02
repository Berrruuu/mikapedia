"""
Compliance Service
==================
Full SOP evaluation, score recalculation, warning issuance,
and notification dispatch.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Optional

from django.db import transaction
from django.utils import timezone

from compliance.models import ComplianceResult, SOPWarning
from compliance.violations import evaluate_three_positions, ViolationReport
from mt5.models import Trade
from signals.models import Signal
from users.models import TraderProfile

logger = logging.getLogger('compliance.service')

# Warning thresholds (violations in last 30 days)
WARNING_THRESHOLD = 3   # → 'warning' level notification
DANGER_THRESHOLD  = 5   # → 'danger' level notification + consider suspension


class ComplianceService:

    # ── Main entry: called by signal_matcher and Celery task ─────────────────

    def sync_trade_to_compliance(self, trade) -> Optional[ComplianceResult]:
        """Evaluate a trade (and all sibling trades for same signal) against its signal."""
        if not trade.signal_id or not trade.user_id:
            return None

        signal = Signal.objects.filter(pk=trade.signal_id).first()
        if not signal:
            return None

        trader_profile = self._get_profile(trade)

        # Collect ALL trades for this user+signal (there should be up to 3)
        from mt5.models import Trade
        all_trades = list(Trade.objects.filter(
            user=trade.user,
            signal=signal,
            status__in=['open', 'closed'],
        ))

        report = evaluate_three_positions(all_trades, signal)

        with transaction.atomic():
            result, _ = ComplianceResult.objects.update_or_create(
                user=trade.user,
                signal=signal,
                defaults={
                    'trader_profile': trader_profile,
                    'trade': trade,
                    'status': report.status,
                    'score': report.final_score,
                    'actual_direction': trade.direction,
                    'actual_entry': float(trade.entry_price) if trade.entry_price else None,
                    'actual_entry_time': self._coerce_time(trade.open_time),
                    'coaching_note': report.coaching_note,
                    'violations': [v.code for v in report.violations],
                    'entry_count': report.entry_count,
                    'entry1_ticket': report.entry1_ticket,
                    'entry2_ticket': report.entry2_ticket,
                    'entry3_ticket': report.entry3_ticket,
                },
            )

        self._post_evaluate(result, report)
        return result

    def create_missed_compliance(self, user, signal) -> ComplianceResult:
        """
        Mark a signal as Missed for a specific trader.
        Called only when trader did NOT place any orders at all.
        (If trader placed limit orders that weren't hit, that is NOT a violation.)
        """
        from mt5.models import Trade

        # Check if trader placed any limit orders for this signal
        placed_orders = Trade.objects.filter(
            user=user,
            signal=signal,
            order_type__in=['buy_limit', 'sell_limit', 'buy_stop', 'sell_stop'],
        ).exists()

        if placed_orders:
            # Trader placed limit orders — not a violation even if not hit
            # Mark as "Pending" with score 100, no violations
            with transaction.atomic():
                result, _ = ComplianceResult.objects.update_or_create(
                    user=user,
                    signal=signal,
                    defaults={
                        'trader_profile': getattr(user, 'trader_profile', None),
                        'trade': None,
                        'status': 'Pending',  # orders placed, awaiting fill
                        'score': 100,
                        'coaching_note': 'Order limit sudah dipasang dengan benar. Harga tidak menyentuh level entry.',
                        'violations': [],
                        'entry_count': 0,
                        'entry1_ticket': None,
                        'entry2_ticket': None,
                        'entry3_ticket': None,
                    },
                )
            return result

        # No orders placed at all → genuine missed signal
        report = evaluate_three_positions([], signal)
        trader_profile = getattr(user, 'trader_profile', None)

        with transaction.atomic():
            result, _ = ComplianceResult.objects.update_or_create(
                user=user,
                signal=signal,
                defaults={
                    'trader_profile': trader_profile,
                    'trade': None,
                    'status': 'Missed',
                    'score': 0,
                    'coaching_note': 'Trader tidak memasang order apapun untuk signal ini.',
                    'violations': ['missed_signal'],
                    'entry_count': 0,
                    'entry1_ticket': None,
                    'entry2_ticket': None,
                    'entry3_ticket': None,
                },
            )

        self._post_evaluate(result, report)
        return result

    # ── Post-evaluation: warnings + score recalc + notifications ─────────────

    def _post_evaluate(self, result: ComplianceResult, report: ViolationReport):
        """After saving a ComplianceResult, update user scores and issue warnings."""
        user = result.user

        # 1. Recalculate rolling compliance score on User
        self._recalculate_user_scores(user)

        # 2. Issue SOP warning if violations are severe
        if report.is_sop_violation():
            self._issue_warnings(user, result, report)

        # 3. Send notification to trader
        self._notify_trader(user, result, report)

    def _recalculate_user_scores(self, user):
        """Recalculate complianceScore, executionRate, etc. from last 30 days.
        
        Note: 'Pending' status means trader placed limit orders that weren't hit.
        These are NOT violations — only count records where trade was executed or missed.
        """
        from django.db.models import Avg, Count
        cutoff = timezone.now() - timedelta(days=30)

        # All records in window
        all_results = ComplianceResult.objects.filter(user=user, created_at__gte=cutoff)
        total = all_results.count()
        if total == 0:
            return

        # Only evaluate records where trader had to act (exclude "Pending" = order not hit)
        evaluated = all_results.exclude(status='Pending')
        eval_count = evaluated.count()

        if eval_count == 0:
            return

        avg_score    = evaluated.aggregate(Avg('score'))['score__avg'] or 0
        executed     = evaluated.filter(status__in=['Compliant', 'Partial', 'Late Entry']).count()
        late         = evaluated.filter(status='Late Entry').count()
        on_direction = evaluated.exclude(status='Wrong Direction').count()

        user.complianceScore  = round(avg_score, 1)
        user.executionRate    = round((executed / eval_count) * 100, 1)
        user.timingAccuracy   = round(((executed - late) / eval_count) * 100, 1) if eval_count else 0
        user.entryAccuracy    = round((on_direction / eval_count) * 100, 1)
        user.lateEntries      = late
        user.save(update_fields=[
            'complianceScore', 'executionRate', 'timingAccuracy',
            'entryAccuracy', 'lateEntries',
        ])
        logger.info('Updated scores for %s: compliance=%.1f execution=%.1f (evaluated %d/%d records)',
                    user.email, user.complianceScore, user.executionRate, eval_count, total)

    def _issue_warnings(self, user, result: ComplianceResult, report: ViolationReport):
        """Create SOPWarning record and escalate if threshold reached."""
        # Determine primary violation type
        if len(report.violations) == 1:
            vtype = report.violations[0].code
        else:
            vtype = 'multiple'

        # Count violations in last 30 days
        cutoff = timezone.now() - timedelta(days=30)
        recent_count = SOPWarning.objects.filter(user=user, created_at__gte=cutoff).count()
        severity = 'danger' if recent_count >= WARNING_THRESHOLD else 'warning'

        # Use get_or_create with unique key: (user, compliance_result, violation_type)
        warning, created = SOPWarning.objects.get_or_create(
            user=user,
            compliance_result=result,
            violation_type=vtype,
            defaults={
                'severity': severity,
                'message': report.coaching_note,
            }
        )

        if created:
            logger.warning('SOPWarning issued: user=%s type=%s severity=%s count=%d',
                           user.email, vtype, severity, recent_count + 1)

            # Escalate if danger threshold reached
            if recent_count + 1 >= DANGER_THRESHOLD:
                self._escalate_to_admin(user, recent_count + 1)
        else:
            # Warning already exists for this result, just update if needed
            if warning.severity != severity:
                warning.severity = severity
                warning.save(update_fields=['severity'])

    def _escalate_to_admin(self, user, violation_count: int):
        """Notify admin when a trader reaches the danger threshold."""
        try:
            from notifications.models import Notification
            Notification.objects.create(
                recipient=None,  # broadcast to all admins
                type='compliance',
                level='danger',
                title=f'⚠️ Pelanggaran Berulang: {user.get_full_name() or user.email}',
                body=(
                    f'{user.get_full_name() or user.email} telah melanggar SOP sebanyak '
                    f'{violation_count} kali dalam 30 hari terakhir. '
                    f'Compliance score saat ini: {user.complianceScore:.0f}/100.'
                ),
            )
        except Exception:
            logger.exception('Failed to escalate admin notification for %s', user.email)

    def _notify_trader(self, user, result: ComplianceResult, report: ViolationReport):
        """Send compliance notification directly to the trader."""
        try:
            from notifications.models import Notification

            if result.status == 'Compliant':
                Notification.objects.create(
                    recipient=user,
                    type='compliance',
                    level='success',
                    title=f'✅ Eksekusi Signal #{result.signal_id} Sesuai SOP',
                    body=f'Score: {result.score}/100. {report.coaching_note}',
                )
                return

            level = 'danger' if result.score < 40 else 'warning'
            violations_text = ', '.join(v.label for v in report.violations)

            Notification.objects.create(
                recipient=user,
                type='compliance',
                level=level,
                title=f'⚠️ Pelanggaran SOP — Signal #{result.signal_id} ({result.status})',
                body=(
                    f'Pelanggaran: {violations_text}. '
                    f'Score: {result.score}/100. '
                    f'{report.coaching_note}'
                ),
            )
        except Exception:
            logger.exception('Failed to notify trader %s for compliance result %s',
                             user.email, result.pk)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_profile(self, trade: Trade):
        try:
            return trade.user.trader_profile
        except Exception:
            return None

    def _coerce_time(self, value):
        if value is None:
            return None
        try:
            from datetime import datetime, time, timezone as dt_tz
            if isinstance(value, datetime):
                return value.astimezone(timezone.get_current_timezone()).time()
            if isinstance(value, str):
                dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                return dt.astimezone(timezone.get_current_timezone()).time()
            if isinstance(value, time):
                return value
        except Exception:
            pass
        return None

    # ── Bulk: called by Celery after signal expires ───────────────────────────

    def process_expired_signal(self, signal: Signal):
        """
        Called when a signal's max_entry_time has passed.
        Find all active traders who have no matching compliance record → mark Missed.
        """
        from users.models import User

        traders = User.objects.filter(role='trader', status='active')
        processed = 0

        for user in traders:
            existing = ComplianceResult.objects.filter(user=user, signal=signal).first()
            if existing:
                continue  # already evaluated

            # Check if they have a trade linked to this signal
            trade = Trade.objects.filter(user=user, signal=signal).first()
            if trade:
                self.sync_trade_to_compliance(trade)
            else:
                self.create_missed_compliance(user, signal)

            processed += 1

        logger.info('process_expired_signal: signal #%d → %d traders processed', signal.id, processed)
        return processed
