import time
import shutil
import os
from typing import Dict, Any

from django.conf import settings
from django.db import connection


def check_postgres() -> Dict[str, Any]:
    start = time.perf_counter()
    ok = False
    err = None
    try:
        with connection.cursor() as cur:
            cur.execute('SELECT 1')
            cur.fetchone()
        ok = True
    except Exception as e:
        err = str(e)
    latency = (time.perf_counter() - start) * 1000.0
    return {'ok': ok, 'latency_ms': latency, 'error': err}


def check_redis() -> Dict[str, Any]:
    start = time.perf_counter()
    ok = False
    err = None
    pong = None
    try:
        from django.conf import settings as django_settings
        from redis import Redis
        r = Redis.from_url(django_settings.REDIS_URL)
        pong = r.ping()
        ok = True
    except Exception as e:
        err = str(e)
    latency = (time.perf_counter() - start) * 1000.0
    return {'ok': ok, 'latency_ms': latency, 'pong': pong, 'error': err}


def check_celery() -> Dict[str, Any]:
    start = time.perf_counter()
    ok = False
    workers = []
    try:
        from backend.celery_app import app as celery_app
        insp = celery_app.control.inspect(timeout=1.0)
        pings = insp.ping() or {}
        workers = list(pings.keys())
        ok = True
    except Exception:
        workers = []
    latency = (time.perf_counter() - start) * 1000.0
    return {'ok': ok, 'latency_ms': latency, 'workers': workers}


def check_mt5() -> Dict[str, Any]:
    try:
        from mt5.manager import manager as mt5_manager
        sessions = getattr(mt5_manager, 'sessions', {})
        out = {str(k): mt5_manager.get_status(k) for k in sessions.keys()}
        return {'ok': True, 'sessions': out}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def check_webhook_status() -> Dict[str, Any]:
    try:
        from signals.models import Signal
        last = Signal.objects.filter().order_by('-created_at').first()
        if not last:
            return {'ok': False, 'last_signal': None}
        return {'ok': True, 'last_signal': last.created_at.isoformat(), 'id': str(last.id)}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def check_system_resources() -> Dict[str, Any]:
    # disk
    try:
        root = settings.BASE_DIR
    except Exception:
        root = os.getcwd()
    du = shutil.disk_usage(root)
    disk = {'total': du.total, 'used': du.used, 'free': du.free}

    # cpu/mem via psutil if available
    cpu = None
    mem = None
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.1)
        vm = psutil.virtual_memory()
        mem = {'total': vm.total, 'available': vm.available, 'used': vm.used, 'percent': vm.percent}
    except Exception:
        pass

    return {'disk': disk, 'cpu_percent': cpu, 'memory': mem}


def get_recent_audit(limit=50):
    try:
        from audit_logs.models import AuditLog
        qs = AuditLog.objects.order_by('-created_at')[:limit]
        return [
            {
                'id': str(a.id),
                'actor_label': a.actor_label,
                'action': a.action,
                'category': a.category,
                'severity': a.severity,
                'metadata': a.metadata,
                'ip_address': a.ip_address,
                'created_at': a.created_at.isoformat(),
            }
            for a in qs
        ]
    except Exception:
        return []


def collect_status() -> Dict[str, Any]:
    out = {}
    out['postgres'] = check_postgres()
    out['redis'] = check_redis()
    out['celery'] = check_celery()
    out['mt5'] = check_mt5()
    out['webhook'] = check_webhook_status()
    out['system'] = check_system_resources()
    out['recent_audit'] = get_recent_audit(50)
    return out
