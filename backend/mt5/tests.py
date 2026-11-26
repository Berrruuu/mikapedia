from datetime import datetime, timedelta
from io import BytesIO

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework.test import APIRequestFactory, APITestCase, force_authenticate
from unittest.mock import patch

from .models import MT5Account, MT5Deal, MT5Order, MT5Position, Trade
from .services import MT5Service
from .views import MT5AccountViewSet, ea_report
from .journal import session_for


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

    @override_settings(EA_INTEGRATION_TOKEN='test-ea-token')
    def test_ea_report_upserts_deal_position_and_pip_metadata(self):
        payload = {
            'token': 'test-ea-token',
            'login': self.account.login,
            'server': self.account.server,
            'currency': 'EUR',
            'positions': [],
            'pending_orders': [],
            'deals': [{
                'ticket': 101,
                'order': 201,
                'position_id': 301,
                'symbol': 'EURUSD',
                'type': 'BUY',
                'entry': 'OUT',
                'volume': 0.1,
                'price': 1.102,
                'pip_size': 0.0001,
                'profit': 19.5,
                'swap': -0.2,
                'commission': -1,
                'time': '2026-07-27T19:00:00+07:00',
            }],
        }

        for profit in (19.5, 20.5):
            payload['deals'][0]['profit'] = profit
            request = APIRequestFactory().post(
                '/api/v1/mt5/ea-report/',
                payload,
                format='json',
            )
            response = ea_report(request)
            self.assertEqual(response.status_code, 200)

        deal = MT5Deal.objects.get(account=self.account, ticket=101)
        self.assertEqual(MT5Deal.objects.filter(account=self.account).count(), 1)
        self.assertEqual(deal.position_id, 301)
        self.assertEqual(deal.pip_size, 0.0001)
        self.assertEqual(deal.profit, 20.5)
        self.account.refresh_from_db()
        self.assertEqual(self.account.currency, 'EUR')

    def test_export_journal_uses_closed_mt5_positions_and_template_columns(self):
        close_time = timezone.make_aware(datetime(2026, 7, 27, 19, 0))
        MT5Deal.objects.create(
            account=self.account,
            ticket=100,
            order=200,
            position_id=300,
            symbol='EURUSD',
            type='BUY',
            entry='IN',
            volume=0.1,
            price=1.1,
            pip_size=0.0001,
            commission=-0.5,
            time=close_time - timedelta(minutes=5),
        )
        MT5Deal.objects.create(
            account=self.account,
            ticket=101,
            order=201,
            position_id=300,
            symbol='EURUSD',
            type='BUY',
            entry='OUT',
            volume=0.1,
            price=1.102,
            pip_size=0.0001,
            profit=19.5,
            swap=-0.2,
            commission=-0.5,
            time=close_time,
        )
        request = APIRequestFactory().get(
            f'/api/mt5/{self.account.pk}/export-journal/'
        )
        force_authenticate(request, user=self.user)
        response = MT5AccountViewSet.as_view(
            {'get': 'export_journal'}
        )(request, pk=self.account.pk)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        workbook = load_workbook(BytesIO(response.content), data_only=False)
        journal = workbook['0']
        self.assertEqual(
            [journal.cell(4, column).value for column in range(1, 7)],
            ['DATE', 'SESION', 'PROFIT/LOSS', 'PIPS', 'BALANCE', 'NET P/L'],
        )
        self.assertEqual(journal['D1'].value, 'EUR')
        self.assertEqual(journal['B5'].value, 'NEWYORK')
        self.assertEqual(journal['C5'].value, 'PROFIT')
        self.assertAlmostEqual(journal['D5'].value, 20)
        self.assertAlmostEqual(journal['F5'].value, 18.3)
        self.assertEqual(journal['E5'].value, '=$B$1+SUM($F$5:F5)')
        self.assertEqual(journal['G5'].value, 'TOTAL')
        self.assertEqual(journal['H5'].value, '=COUNTA(A5:A5)')
        self.assertEqual(journal['G6'].value, 'TP')
        self.assertEqual(journal['G11'].value, None)
        self.assertEqual(workbook['MT5 Deals'].max_row, 3)

    def test_session_boundaries_follow_m5_and_m15_timeframes(self):
        m5_10_05 = timezone.make_aware(datetime(2026, 7, 27, 10, 5))
        m5_10_06 = timezone.make_aware(datetime(2026, 7, 27, 10, 6))
        m5_23_05 = timezone.make_aware(datetime(2026, 7, 27, 23, 5))
        m5_23_06 = timezone.make_aware(datetime(2026, 7, 27, 23, 6))
        m15_10_15 = timezone.make_aware(datetime(2026, 7, 27, 10, 15))
        m15_10_16 = timezone.make_aware(datetime(2026, 7, 27, 10, 16))
        m15_23_15 = timezone.make_aware(datetime(2026, 7, 27, 23, 15))
        m15_23_16 = timezone.make_aware(datetime(2026, 7, 27, 23, 16))

        self.assertEqual(session_for(m5_10_05, '5'), 'ASIA')
        self.assertEqual(session_for(m5_10_06, '5'), 'LONDON')
        self.assertEqual(session_for(m5_23_05, '5'), 'NEWYORK')
        self.assertEqual(session_for(m5_23_06, '5'), 'MIDNIGHT')
        self.assertEqual(session_for(m15_10_15, '15'), 'ASIA')
        self.assertEqual(session_for(m15_10_16, '15'), 'LONDON')
        self.assertEqual(session_for(m15_23_15, '15'), 'NEWYORK')
        self.assertEqual(session_for(m15_23_16, '15'), 'MIDNIGHT')

    def test_export_history_csv_uses_saved_mt5_deals(self):
        MT5Deal.objects.create(
            account=self.account,
            ticket=901,
            order=902,
            position_id=903,
            symbol='EURUSD',
            type='SELL',
            entry='OUT',
            volume=0.2,
            price=1.09,
            profit=25,
            swap=-1,
            commission=-0.5,
            time=timezone.now(),
        )
        request = APIRequestFactory().get(
            f'/api/mt5/{self.account.pk}/export-history/'
        )
        force_authenticate(request, user=self.user)
        response = MT5AccountViewSet.as_view(
            {'get': 'export_history'}
        )(request, pk=self.account.pk)

        self.assertEqual(response.status_code, 200)
        rows = response.content.decode().splitlines()
        self.assertIn('Position ID', rows[0])
        self.assertIn('Deal Ticket', rows[0])
        self.assertIn('901,902,903,EURUSD,SELL,OUT,0.2,1.09,25.0,-1.0,-0.5,23.5', rows[1])

    def test_export_journal_explains_when_no_mt5_deals_are_saved(self):
        request = APIRequestFactory().get(
            f'/api/mt5/{self.account.pk}/export-journal/'
        )
        force_authenticate(request, user=self.user)
        response = MT5AccountViewSet.as_view(
            {'get': 'export_journal'}
        )(request, pk=self.account.pk)

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.data['success'])
        self.assertIn('EA MikapediaReporter', response.data['error']['message'])


class BacktestJournalApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='backtest-trader',
            email='backtest-trader@example.com',
            password='secret',
            role='trader',
        )
        self.other_user = user_model.objects.create_user(
            username='other-trader',
            email='other-trader@example.com',
            password='secret',
            role='trader',
        )
        self.client.force_authenticate(user=self.user)

    def create_journal(self):
        response = self.client.post(
            reverse('backtest-list'),
            {
                'name': 'EURUSD M15',
                'startingBalance': '1000.00',
                'symbol': 'EURUSD',
                'lotSize': '0.10',
                'pipValueUsdPerLot': '10.0000',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['currency'], 'USD')
        return response.data

    def create_trade(self, journal_id, day, pips, session='ASIA'):
        return self.client.post(
            reverse('backtest-trades', kwargs={'journal_id': journal_id}),
            {
                'tradeDate': f'2026-11-{day:02d}T10:00:00Z',
                'session': session,
                'pips': str(pips),
            },
            format='json',
        )

    def test_journal_returns_balance_drawdown_profit_and_loss_streak_metrics(self):
        journal = self.create_journal()
        journal_id = journal['id']
        self.assertEqual(self.create_trade(journal_id, 1, '-100').status_code, 201)
        self.assertEqual(self.create_trade(journal_id, 2, '-25').status_code, 201)
        self.assertEqual(self.create_trade(journal_id, 3, '50').status_code, 201)
        self.assertEqual(self.create_trade(journal_id, 4, '-75').status_code, 201)

        response = self.client.get(
            reverse('backtest-detail', kwargs={'journal_id': journal_id})
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['metrics']['grossProfit'], 50.0)
        self.assertEqual(response.data['metrics']['grossLoss'], 200.0)
        self.assertEqual(response.data['metrics']['netProfit'], -150.0)
        self.assertEqual(response.data['metrics']['maxDrawdown'], 150.0)
        self.assertEqual(response.data['metrics']['maxDrawdownPercent'], 15.0)
        self.assertEqual(response.data['metrics']['maxConsecutiveLosses'], 2)
        self.assertEqual(
            [trade['balance'] for trade in response.data['trades']],
            ['900.00', '875.00', '925.00', '850.00'],
        )
        self.assertEqual(
            [trade['netPl'] for trade in response.data['trades']],
            ['-100.00', '-25.00', '50.00', '-75.00'],
        )

    def test_journal_and_trades_are_private_to_their_owner(self):
        journal = self.create_journal()
        journal_id = journal['id']
        self.create_trade(journal_id, 1, '10')

        self.client.force_authenticate(user=self.other_user)
        response = self.client.get(
            reverse('backtest-detail', kwargs={'journal_id': journal_id})
        )

        self.assertEqual(response.status_code, 404)
        list_response = self.client.get(reverse('backtest-list'))
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data['results'], [])

    def test_trade_rejects_unknown_session(self):
        journal = self.create_journal()
        response = self.client.post(
            reverse('backtest-trades', kwargs={'journal_id': journal['id']}),
            {
                'tradeDate': '2026-11-01T10:00:00Z',
                'session': 'TOKYO',
                'pips': '10.00',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
