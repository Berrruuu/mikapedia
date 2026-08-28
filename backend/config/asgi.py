"""
ASGI config for MIKAPEDIA TOMS
Supports both HTTP (Django) and WebSocket (Channels)
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Initialize Django ASGI app early so models are ready
django_asgi_app = get_asgi_application()

from config.routing import websocket_urlpatterns  # noqa: E402 (must be after django setup)

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AllowedHostsOriginValidator(
        URLRouter(websocket_urlpatterns)
    ),
})
