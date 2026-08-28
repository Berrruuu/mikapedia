import hashlib
import json
from django.conf import settings
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework import status
from common.response import success_response, error_response
from audit_logs.utils import create_audit
from .models import IntegrationReceipt


EA_TOKEN = getattr(settings, 'EA_INTEGRATION_TOKEN', '')


def _make_event_id(payload: dict) -> str:
    # Use provided event_id if present, else hash payload
    eid = payload.get('event_id') or payload.get('ticket') or None
    if eid:
        return str(eid)
    h = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    return h


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def ea_webhook(request):
    # Simple Bearer token auth
    auth = request.META.get('HTTP_AUTHORIZATION', '')
    if EA_TOKEN:
        if not auth.startswith('Bearer ') or auth.split(' ', 1)[1] != EA_TOKEN:
            return error_response('Unauthorized', status=status.HTTP_401_UNAUTHORIZED)

    payload = request.data if isinstance(request.data, dict) else {}
    source = payload.get('source', 'ea')
    event_id = _make_event_id(payload)

    # Idempotency: check receipt
    try:
        rec, created = IntegrationReceipt.objects.get_or_create(source=source, event_id=event_id, defaults={'payload': payload})
    except Exception:
        # DB may not be migrated; best-effort logging
        create_audit(request=request, action='integration.receipt_failed', category='integration', severity='warning', metadata={'event_id': event_id})
        rec = None

    if rec and rec.processed:
        return success_response({'detail': 'already_processed'})

    # Basic handling: if login present, trigger MT5 sync
    try:
        login = payload.get('login')
        if login:
            # import locally to avoid circular imports
            from mt5.models import MT5Account
            from mt5.tasks import sync_account_task
            acc = MT5Account.objects.filter(login=login).first()
            if acc:
                try:
                    sync_account_task.delay(acc.id)
                except Exception:
                    # fallback: try direct sync
                    try:
                        from mt5.services import MT5Service
                        svc = MT5Service()
                        svc.sync_account(acc)
                    except Exception:
                        pass

    except Exception as e:
        create_audit(request=request, action='integration.ea.error', category='integration', severity='high', metadata={'error': str(e)})

    # mark processed
    if rec:
        try:
            rec.processed = True
            rec.processed_at = timezone.now()
            rec.save(update_fields=['processed', 'processed_at'])
        except Exception:
            pass

    create_audit(request=request, action='integration.ea.received', category='integration', severity='info', metadata={'event_id': event_id, 'source': source})
    return success_response({'detail': 'ok'})
