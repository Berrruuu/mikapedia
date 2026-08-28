from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

app_name = 'authentication'

urlpatterns = [
    path('login/',           views.login_view,           name='login'),
    path('logout/',          views.logout_view,           name='logout'),
    path('me/',              views.me_view,               name='me'),
    path('token/refresh/',   TokenRefreshView.as_view(),  name='token_refresh'),
    path('forgot-password/', views.forgot_password_view,  name='forgot_password'),
    path('reset-password/',  views.reset_password_view,   name='reset_password'),
    path('change-password/', views.change_password_view,  name='change_password'),
]
