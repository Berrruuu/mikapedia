import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
User = get_user_model()
admin = User.objects.filter(role='admin').first()
if admin is None:
    admin = User(email='admin@example.com', username='admin@example.com', role='admin')
    admin.set_password('adminpass')
    admin.save()
refresh = RefreshToken.for_user(admin)
print('admin_id:', admin.id)
print('access:', str(refresh.access_token))
print('refresh:', str(refresh))
