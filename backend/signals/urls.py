from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SignalViewSet, tradingview_webhook, test_webhook

router = DefaultRouter()
router.register(r'', SignalViewSet, basename='signals')

urlpatterns = [
    path('webhook/', tradingview_webhook, name='tv-webhook'),
    path('test-webhook/', test_webhook, name='test-webhook'),
    path('', include(router.urls)),
]
