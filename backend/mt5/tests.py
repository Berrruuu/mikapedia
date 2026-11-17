from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from unittest.mock import patch

from .models import MT5Account, MT5Deal, MT5Order, MT5Position
from .services import MT5Service


class MT5CredentialsTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='trader',
            email='trader@example.com',
            password='secret',
            role='trader',
        )
        self.account = MT5Account.objects.create(
            user=self.user,
            login=12345,
            password_encrypted='old-encrypted-password',
            server='OldBroker-Live',
            broker='OldBroker',
            account_number='12345',
            status='connected',
            last_sync=timezone.now(),
            balance=1500,
            equity=1400,
            floating_pnl=-100,
            margin=50,
            free_margin=1350,
            margin_level=2800,
            margin_call_level=50,
            drawdown=7,
            open_positions=1,
            pending_orders=1,
            currency='EUR',
            leverage=200,
            company='Old Broker Ltd',
            is_demo=True,
        )

    @patch('mt5.services.mt5_service.encrypt_password', return_value='new-encrypted-password')
    def test_changing_account_resets_old_snapshot(self, _encrypt_password):
        MT5Position.objects.create(
            account=self.account,
            ticket=1,
            symbol='EURUSD',
            type='BUY',
            volume=0.1,
            price_open=1.1,
        )
        MT5Order.objects.create(
            account=self.account,
            ticket=2,
            symbol='EURUSD',
            type='BUY LIMIT',
            volume=0.1,
            price_open=1.0,
        )
        MT5Deal.objects.create(
            account=self.account,
            ticket=3,
            symbol='EURUSD',
            type='BUY',
            entry='IN',
            volume=0.1,
            price=1.1,
        )

        updated = MT5Service().set_credentials(self.user, {
            'login': 67890,
            'password': 'new-password',
            'server': 'NewBroker-Live',
            'broker': 'NewBroker',
        })

        updated.refresh_from_db()
        self.assertEqual(updated.pk, self.account.pk)
        self.assertEqual(updated.login, 67890)
        self.assertEqual(updated.account_number, '67890')
        self.assertEqual(updated.server, 'NewBroker-Live')
        self.assertEqual(updated.broker, 'NewBroker')
        self.assertEqual(updated.status, 'pending')
        self.assertIsNone(updated.last_sync)
        self.assertEqual(updated.balance, 0)
        self.assertEqual(updated.equity, 0)
        self.assertEqual(updated.floating_pnl, 0)
        self.assertEqual(updated.open_positions, 0)
        self.assertEqual(updated.pending_orders, 0)
        self.assertEqual(updated.currency, 'USD')
        self.assertEqual(updated.leverage, 100)
        self.assertFalse(updated.is_demo)
        self.assertEqual(updated.company, '')
        self.assertEqual(updated.positions.count(), 0)
        self.assertEqual(updated.orders.count(), 0)
        self.assertEqual(updated.deals.count(), 0)

    @patch('mt5.services.mt5_service.encrypt_password', return_value='updated-encrypted-password')
    def test_updating_same_account_preserves_current_snapshot(self, _encrypt_password):
        MT5Position.objects.create(
            account=self.account,
            ticket=1,
            symbol='EURUSD',
            type='BUY',
            volume=0.1,
            price_open=1.1,
        )

        updated = MT5Service().set_credentials(self.user, {
            'login': 12345,
            'password': 'updated-password',
            'server': 'OldBroker-Live',
            'broker': 'OldBroker',
        })

        updated.refresh_from_db()
        self.assertEqual(updated.balance, 1500)
        self.assertEqual(updated.positions.count(), 1)
