from celery import shared_task
from django.core.exceptions import ObjectDoesNotExist
from audit_logs.utils import create_audit


@shared_task(bind=True)
def handle_new_signal(self, signal_id: int, notif_id: int):
    """Background processing for newly created signals."""
    try:
        from signals.serializers import SignalSerializer
        from notifications.serializers import NotificationSerializer
        from signals.models import Signal
        from notifications.models import Notification
        from config.ws_broadcast import broadcast_signal, broadcast_notification

        signal = Signal.objects.get(id=signal_id)
        notif  = Notification.objects.get(id=notif_id)

        broadcast_signal(SignalSerializer(signal).data)
        broadcast_notification(NotificationSerializer(notif).data)
        try:
            create_audit(action='signal.broadcasted', category='signal', severity='info',
                         target=signal, metadata={'notif_id': notif.id})
        except Exception:
            pass
    except ObjectDoesNotExist:
        return
    except Exception:
        raise


@shared_task(bind=True)
def auto_update_signal_statuses(self):
    """
    Runs every 1 minute via Celery Beat.
    Auto-transitions signal statuses based on timing:

      issued_at  ──── +10 min ────── max_entry_time ──── +15 min ──── expires_at
         │               │                  │                  │
      Pending         Waiting ──────────── Late ──────────── Missed

    Rules:
      - 0 to max_entry_time   → keep as Pending/Waiting (live window)
      - max_entry_time passed → if any trader executed: Executed
                                else: stays as Waiting until expires_at
      - expires_at passed     → Missed (no one executed in time)

    Signal already Executed/Wrong Direction stays unchanged.
    """
    from django.utils import timezone
    from signals.models import Signal
    from config.ws_broadcast import broadcast_signal
    from signals.serializers import SignalSerializer
    import logging

    logger = logging.getLogger('signals.auto_update')

    now       = timezone.localtime()
    today     = now.date()
    now_time  = now.time()

    # Only process today's signals that are still open
    active = Signal.objects.filter(
        session_date=today,
        status__in=['Pending', 'Waiting'],
    )

    updated = 0
    for signal in active:
        new_status = None

        # Determine timeframe in minutes for candle expiry
        try:
            tf_minutes = int(signal.timeframe)
        except (ValueError, TypeError):
            tf_minutes = 15  # default

        # Window: issued_at → max_entry_time (10 min) → max_entry_time + tf_minutes (missed)
        if signal.max_entry_time and now_time > signal.max_entry_time:
            # Past max entry time — check if anyone executed
            from mt5.models import Trade
            executed = Trade.objects.filter(
                signal=signal,
                status__in=['open', 'closed'],
            ).exists()

            if executed:
                # At least one trader executed — signal is Executed
                new_status = 'Executed'
            elif signal.expires_at and now > signal.expires_at:
                # Past the full expiry window — Missed
                new_status = 'Missed'
            else:
                # In the "late zone" (max_entry_time passed but not yet expired)
                new_status = 'Waiting'  # keep as Waiting, compliance handles Late per-trader

        if new_status and new_status != signal.status:
            old_status = signal.status
            signal.status = new_status
            signal.save(update_fields=['status'])
            updated += 1
            logger.info('Signal #%d %s %s: %s → %s',
                        signal.id, signal.pair, signal.direction,
                        old_status, new_status)

            # Broadcast live status update
            try:
                broadcast_signal(SignalSerializer(signal).data)
            except Exception:
                pass

            # When signal expires as Missed, trigger compliance for all traders
            if new_status == 'Missed':
                try:
                    from compliance.tasks import process_compliance_for_signal
                    process_compliance_for_signal.delay(signal.id)
                except Exception:
                    pass

    if updated:
        logger.info('auto_update_signal_statuses: updated %d signals', updated)

    return updated
