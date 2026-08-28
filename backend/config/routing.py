from django.urls import re_path
from config.consumers import MikapediaConsumer

websocket_urlpatterns = [
    re_path(r'^ws/live/$', MikapediaConsumer.as_asgi()),
]
