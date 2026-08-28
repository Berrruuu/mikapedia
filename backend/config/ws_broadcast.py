"""
Synchronous helpers to broadcast WebSocket messages from Django views/signals.
Uses async_to_sync so they can be called from sync code.
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _send(group: str, msg_type: str, data: dict):
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        async_to_sync(layer.group_send)(group, {'type': msg_type, 'data': data})
    except Exception:
        pass  # Never break the main request if WS fails


# ── Public broadcast helpers ─────────────────────────────────────────────────

def broadcast_signal(signal_data: dict):
    """Push new/updated signal to all users"""
    _send('broadcast', 'signal_update', signal_data)


def broadcast_notification(notification_data: dict):
    """Push notification to all connected users"""
    _send('broadcast', 'notification', notification_data)
    _send('admin_room', 'notification', notification_data)


def broadcast_dashboard_stats(stats: dict):
    """Push fresh KPIs to admin room"""
    _send('admin_room', 'dashboard_stats', stats)


def broadcast_attendance(attendance_data: dict):
    """Push attendance update — admin room + specific trader"""
    _send('admin_room', 'attendance_update', attendance_data)
    user_id = attendance_data.get('user', {}).get('id')
    if user_id:
        _send(f'trader_{user_id}', 'attendance_update', attendance_data)


def broadcast_mt5(user_id: str, account_data: dict):
    """Push MT5 update — admin room + specific trader"""
    _send('admin_room', 'mt5_update', account_data)
    _send(f'trader_{user_id}', 'mt5_update', account_data)


def broadcast_compliance(compliance_data: dict):
    """Push compliance update — admin room"""
    _send('admin_room', 'compliance_update', compliance_data)
    user_id = compliance_data.get('user', {}).get('id')
    if user_id:
        _send(f'trader_{user_id}', 'compliance_update', compliance_data)
