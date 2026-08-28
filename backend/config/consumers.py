"""
WebSocket Consumers for MIKAPEDIA TOMS

Channel groups:
  - broadcast          : all authenticated users (signals, notifications)
  - admin_room         : admin-only (dashboard stats, attendance, compliance)
  - trader_{user_id}   : per-trader (MT5 positions, own attendance)
"""

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)


class MikapediaConsumer(AsyncWebsocketConsumer):
    """
    Single WebSocket endpoint: ws://localhost:8000/ws/live/
    Auth via JWT token in query string: ?token=<access_token>
    """

    async def connect(self):
        # Authenticate via token in query string
        user = await self._authenticate()
        if user is None:
            await self.close(code=4001)
            return

        self.user = user
        self.user_id = str(user.id)
        self.role = user.role

        # Always join broadcast group
        await self.channel_layer.group_add('broadcast', self.channel_name)

        # Role-based groups
        if self.role == 'admin':
            await self.channel_layer.group_add('admin_room', self.channel_name)
        else:
            await self.channel_layer.group_add(f'trader_{self.user_id}', self.channel_name)

        await self.accept()
        logger.info(f"WS connected: {user.email} [{self.role}]")

        # Send initial connection ack
        await self.send(json.dumps({
            'type': 'connection_established',
            'user_id': self.user_id,
            'role': self.role,
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'user'):
            await self.channel_layer.group_discard('broadcast', self.channel_name)
            if self.role == 'admin':
                await self.channel_layer.group_discard('admin_room', self.channel_name)
            else:
                await self.channel_layer.group_discard(f'trader_{self.user_id}', self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        """Handle messages from client (ping/pong, subscription requests)"""
        if not text_data:
            return
        try:
            data = json.loads(text_data)
            msg_type = data.get('type')
            if msg_type == 'ping':
                await self.send(json.dumps({'type': 'pong'}))
        except (json.JSONDecodeError, KeyError):
            pass

    # ── Event handlers (called by group_send) ─────────────────────────────────

    async def signal_update(self, event):
        """New/updated TradingView signal"""
        await self.send(json.dumps({'type': 'signal_update', 'data': event['data']}))

    async def mt5_update(self, event):
        """MT5 position/account update"""
        await self.send(json.dumps({'type': 'mt5_update', 'data': event['data']}))

    async def attendance_update(self, event):
        """Attendance record created/validated"""
        await self.send(json.dumps({'type': 'attendance_update', 'data': event['data']}))

    async def notification(self, event):
        """New notification"""
        await self.send(json.dumps({'type': 'notification', 'data': event['data']}))

    async def dashboard_stats(self, event):
        """Dashboard KPI refresh"""
        await self.send(json.dumps({'type': 'dashboard_stats', 'data': event['data']}))

    async def compliance_update(self, event):
        """Compliance record updated"""
        await self.send(json.dumps({'type': 'compliance_update', 'data': event['data']}))

    # ── Auth ──────────────────────────────────────────────────────────────────

    async def _authenticate(self):
        scope = self.scope
        query_string = scope.get('query_string', b'').decode()
        params = dict(p.split('=') for p in query_string.split('&') if '=' in p)
        token = params.get('token', '')
        if not token:
            return None
        return await self._get_user_from_token(token)

    @database_sync_to_async
    def _get_user_from_token(self, token: str):
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from rest_framework_simplejwt.exceptions import TokenError
            from users.models import User
            validated = AccessToken(token)
            user_id = validated.get('user_id')
            return User.objects.get(id=user_id)
        except Exception:
            return None
