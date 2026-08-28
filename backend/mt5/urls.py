from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MT5AccountViewSet, ea_report

router = DefaultRouter()
router.register(r'', MT5AccountViewSet, basename='mt5')

urlpatterns = [
    path('ea-report/', ea_report, name='ea-report'),
    path('', include(router.urls)),
]
