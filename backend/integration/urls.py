from django.urls import path
from . import views

app_name = 'integration'

urlpatterns = [
    path('ea-webhook/', views.ea_webhook, name='ea_webhook'),
]
