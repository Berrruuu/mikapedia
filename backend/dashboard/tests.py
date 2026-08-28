from django.test import TestCase
from rest_framework.test import APIClient

from mt5.models import MT5Account
from users.models import User


class DashboardAdminTests(TestCase):
    def test_admin_dashboard_exposes_mt5_bridge_counts(self):
        admin = User.objects.create_user(email='admin@example.com', username='admin', password='secret', role='admin')
        trader = User.objects.create_user(email='trader@example.com', username='trader', password='secret', role='trader')

        MT5Account.objects.create(user=admin, login=1001, password_encrypted='x', server='test', account_number='1001', status='connected')
        MT5Account.objects.create(user=trader, login=1002, password_encrypted='x', server='test', account_number='1002', status='pending')

        client = APIClient()
        client.force_authenticate(admin)

        response = client.get('/api/dashboard/admin/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['data']['mt5Bridge']['connected'], 1)
        self.assertEqual(payload['data']['mt5Bridge']['total'], 2)
