from celery import shared_task
from .service import collect_status
from config.ws_broadcast import broadcast_dashboard_stats
from audit_logs.utils import create_audit


@shared_task(bind=True)
def collect_and_broadcast(self):
    try:
        status = collect_status()
        # Broadcast to admin room
        try:
            broadcast_dashboard_stats({'monitor': status})
        except Exception:
            pass
        # Audit that monitoring snapshot was taken
        try:
            create_audit(action='monitor.snapshot', category='system', severity='info', metadata={'summary': {'postgres_ok': status['postgres']['ok'], 'redis_ok': status['redis']['ok']}})
        except Exception:
            pass
        return status
    except Exception:
        try:
            create_audit(action='monitor.snapshot_failed', category='system', severity='high')
        except Exception:
            pass
        raise
