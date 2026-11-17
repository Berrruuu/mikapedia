from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIRequestFactory
from unittest.mock import patch

from .models import MT5Account, MT5Deal, MT5Order, MT5Position, Trade
from .services import MT5Service
from .views import ea_report


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
        open_trade = Trade.objects.create(
            account=self.account,
            user=self.user,
            ticket=4,
            symbol='EURUSD',
            direction='BUY',
            status='open',
        )
        pending_trade = Trade.objects.create(
            account=self.account,
            user=self.user,
            ticket=5,
            symbol='GBPUSD',
            direction='SELL',
            status='pending',
        )
        closed_trade = Trade.objects.create(
            account=self.account,
            user=self.user,
            ticket=6,
            symbol='USDJPY',
            direction='BUY',
            status='closed',
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
        open_trade.refresh_from_db()
        pending_trade.refresh_from_db()
        closed_trade.refresh_from_db()
        self.assertEqual(open_trade.status, 'closed')
        self.assertIsNotNone(open_trade.close_time)
        self.assertEqual(pending_trade.status, 'cancelled')
        self.assertIsNotNone(pending_trade.cancelled_at)
        self.assertEqual(closed_trade.status, 'closed')

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

    @override_settings(EA_INTEGRATION_TOKEN='test-ea-token')
    def test_ea_empty_snapshot_closes_stale_positions_and_cancels_orders(self):
        MT5Position.objects.create(
            account=self.account,
            ticket=10,
            symbol='EURUSD',
            type='BUY',
            volume=0.1,
            price_open=1.1,
        )
        MT5Order.objects.create(
            account=self.account,
            ticket=11,
            symbol='EURUSD',
            type='BUY LIMIT',
            volume=0.1,
            price_open=1.0,
        )
        open_trade = Trade.objects.create(
            account=self.account,
            user=self.user,
            ticket=10,
            symbol='EURUSD',
            direction='BUY',
            status='open',
        )
        pending_trade = Trade.objects.create(
            account=self.account,
            user=self.user,
            ticket=11,
            symbol='EURUSD',
            direction='BUY',
            status='pending',
        )
        request = APIRequestFactory().post(
            '/api/v1/mt5/ea-report/',
            {
                'token': 'test-ea-token',
                'login': self.account.login,
                'server': self.account.server,
                'positions': [],
                'pending_orders': [],
            },
            format='json',
        )

        response = ea_report(request)

        self.assertEqual(response.status_code, 200)
        self.account.refresh_from_db()
        open_trade.refresh_from_db()
        pending_trade.refresh_from_db()
        self.assertEqual(self.account.open_positions, 0)
        self.assertEqual(self.account.pending_orders, 0)
        self.assertEqual(self.account.positions.count(), 0)
        self.assertEqual(self.account.orders.count(), 0)
        self.assertEqual(open_trade.status, 'closed')
        self.assertIsNotNone(open_trade.close_time)
        self.assertEqual(pending_trade.status, 'cancelled')
        self.assertIsNotNone(pending_trade.cancelled_at)

    @patch('decouple.config', return_value=True)
    def test_manual_sync_reconciles_old_open_trade_records(self, _config):
        open_trade = Trade.objects.create(
            account=self.account,
            user=self.user,
            ticket=20,
            symbol='EURUSD',
            direction='BUY',
            status='open',
        )
        pending_trade = Trade.objects.create(
            account=self.account,
            user=self.user,
            ticket=21,
            symbol='EURUSD',
            direction='BUY',
            status='pending',
        )

        MT5Service().sync_account(self.account)

        open_trade.refresh_from_db()
        pending_trade.refresh_from_db()
        self.assertEqual(open_trade.status, 'closed')
        self.assertIsNotNone(open_trade.close_time)
        self.assertEqual(pending_trade.status, 'cancelled')
        self.assertIsNotNone(pending_trade.cancelled_at)
