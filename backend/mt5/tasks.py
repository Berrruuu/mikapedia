from celery import shared_task
from django.core.exceptions import ObjectDoesNotExist
from audit_logs.utils import create_audit


@shared_task(bind=True)
def sync_account_task(self, account_id: int):
    try:
        from mt5.models import MT5Account
        from mt5.services import MT5Service
        account = MT5Account.objects.get(id=account_id)
        svc = MT5Service()
        svc.sync_account(account)
        try:
            create_audit(action='mt5.sync', category='system', severity='info', target=account, metadata={'account_id': account_id})
        except Exception:
            pass
    except ObjectDoesNotExist:
        return
    except Exception:
        try:
            create_audit(action='mt5.sync_failed', category='system', severity='high', metadata={'account_id': account_id})
        except Exception:
            pass
        raise


@shared_task(bind=True)
def sync_all_accounts(self):
    try:
        from mt5.models import MT5Account
        from mt5.services import MT5Service
        svc = MT5Service()
        for acc in MT5Account.objects.all():
            try:
                svc.sync_account(acc)
            except Exception:
                try:
                    create_audit(action='mt5.sync_failed', category='system', severity='warning', target=acc)
                except Exception:
                    pass
                continue
    except Exception:
        try:
            create_audit(action='mt5.sync_all_failed', category='system', severity='high')
        except Exception:
            pass
        raise


@shared_task(bind=True)
def sync_connected_accounts(self):
    try:
        from mt5.models import MT5Account
        from mt5.services import MT5Service
        svc = MT5Service()
        for acc in MT5Account.objects.filter(status='connected'):
            try:
                svc.sync_account(acc)
            except Exception:
                try:
                    create_audit(action='mt5.sync_failed', category='system', severity='warning', target=acc)
                except Exception:
                    pass
                continue
    except Exception:
        try:
            create_audit(action='mt5.sync_connected_failed', category='system', severity='high')
        except Exception:
            pass
        raise
