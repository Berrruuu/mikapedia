from django.urls import path
from .views import admin_dashboard, trader_dashboard

urlpatterns = [
    path('admin/', admin_dashboard, name='admin-dashboard'),
    path('trader/', trader_dashboard, name='trader-dashboard'),
]
