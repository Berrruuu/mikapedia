from django.urls import path
from .views import MonitoringView

urlpatterns = [
    path('', MonitoringView.as_view(), name='monitoring-status'),
]
