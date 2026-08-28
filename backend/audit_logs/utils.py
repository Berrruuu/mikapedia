import threading
from typing import Any, Optional

from django.contrib.contenttypes.models import ContentType
from django.forms.models import model_to_dict
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID


def _sanitize_value(v):
    if v is None:
        return None
    if isinstance(v, (str, int, float, bool)):
        return v
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, UUID):
        return str(v)
    if isinstance(v, dict):
        return {k: _sanitize_value(val) for k, val in v.items()}
    if isinstance(v, (list, tuple, set)):
        return [_sanitize_value(x) for x in v]
    # fallback for model instances
    try:
        if hasattr(v, '__dict__'):
            return _sanitize_value(model_to_dict(v))
    except Exception:
        pass
    try:
        return str(v)
    except Exception:
        return None

from .models import AuditLog
from django.db import connection

_thread_local = threading.local()


def set_current_request(request):
    _thread_local.request = request


def get_current_request():
    return getattr(_thread_local, 'request', None)


def _get_target_fields(target) -> tuple[Optional[ContentType], Optional[str]]:
    if target is None:
        return None, None
    try:
        ct = ContentType.objects.get_for_model(target)
        pk = getattr(target, 'pk', None)
        # Only return target_object_id when PK is a UUID (model uses UUIDField)
        if pk is None:
            return ct, None
        try:
            # validate UUID-like
            if isinstance(pk, UUID):
                return ct, str(pk)
            UUID(str(pk))
            return ct, str(pk)
        except Exception:
            return ct, None
    except Exception:
        return None, None


def create_audit(
    actor=None,
    action: str = '',
    category: str = 'system',
    severity: str = 'info',
    request=None,
    target: Any = None,
    before: Any = None,
    after: Any = None,
    metadata: Optional[dict] = None,
):
    """Create an AuditLog entry.

    - `actor`: User instance or None
    - `request`: Django request (optional) to extract IP and user-agent
    - `target`: model instance related to this action
    - `before` / `after`: serializable snapshots (dict or model instances)
    - `metadata`: extra JSON data
    """
    req = request or get_current_request()
    ip = None
    ua = None
    if req is not None:
        ip = req.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or req.META.get('REMOTE_ADDR')
        ua = req.META.get('HTTP_USER_AGENT')

    actor_label = 'system'
    if actor is not None:
        try:
            actor_label = getattr(actor, 'get_full_name', lambda: None)() or getattr(actor, 'email', str(actor))
        except Exception:
            actor_label = str(actor)
    elif req is not None and getattr(req, 'user', None) and req.user.is_authenticated:
        actor = req.user
        actor_label = getattr(req.user, 'get_full_name', lambda: None)() or getattr(req.user, 'email', str(req.user))

    target_ct, target_pk = _get_target_fields(target)

    payload = metadata.copy() if metadata else {}
    if ua:
        payload.setdefault('user_agent', ua)
    if before is not None:
        raw_before = (model_to_dict(before) if hasattr(before, '__dict__') else before)
        payload['before'] = _sanitize_value(raw_before)
    if after is not None:
        raw_after = (model_to_dict(after) if hasattr(after, '__dict__') else after)
        payload['after'] = _sanitize_value(raw_after)
    # sanitize any other metadata values
    payload = _sanitize_value(payload)

    try:
        # if the audit_logs table doesn't exist yet (during migrations), skip
        try:
            tables = connection.introspection.table_names()
        except Exception:
            tables = []
        if AuditLog._meta.db_table not in tables:
            return

        # ensure the `metadata` column exists on the existing table; if not, skip
        col_names = []
        try:
            with connection.cursor() as cursor:
                try:
                    desc = connection.introspection.get_table_description(cursor, AuditLog._meta.db_table)
                    if desc:
                        if hasattr(desc[0], 'name'):
                            col_names = [c.name for c in desc]
                        else:
                            col_names = [r[1] for r in desc]
                except Exception:
                    # fallback for sqlite
                    try:
                        cursor.execute(f"PRAGMA table_info('{AuditLog._meta.db_table}')")
                        rows = cursor.fetchall()
                        col_names = [r[1] for r in rows]
                    except Exception:
                        col_names = []
        except Exception:
            col_names = []

        if 'metadata' not in col_names:
            return

        AuditLog.objects.create(
            actor=actor if getattr(actor, 'is_authenticated', False) else None,
            actor_label=actor_label,
            action=action,
            category=category,
            severity=severity,
            ip_address=ip,
            metadata=payload,
            target_content_type=target_ct,
            target_object_id=target_pk,
        )
    except Exception:
        # Never raise from audit logging — best-effort only
        return
