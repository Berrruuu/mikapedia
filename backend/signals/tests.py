from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from mt5.models import MT5Account, Trade
from signals.models import Signal


class SignalDetailEndpointTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='tester',
            email='tester@example.com',
            password='secret123',
            role='admin',
            status='active',
        )

    def test_retrieve_signal_from_previous_day(self):
        signal = Signal.objects.create(
            symbol='OANDA:XAUUSD',
            pair='XAUUSD',
            direction='BUY',
            timeframe='15',
            strategy_name='Fibonacci Strategy',
            fib_entry=0.5,
            take_profit=2412.4,
            stop_loss=2394.2,
            fib_0236=2394.2,
            fib_0500=2402.7,
            fib_0618=2408.4,
            fib_tp=2412.4,
            issued_at=timezone.localtime().time().replace(second=0, microsecond=0),
            session_date=timezone.localdate() - timedelta(days=1),
            max_entry_time=(timezone.localtime() + timedelta(minutes=10)).time().replace(second=0, microsecond=0),
            expires_at=timezone.now() + timedelta(minutes=15),
            status='Pending',
        )

        self.client.force_authenticate(self.user)
        response = self.client.get(f'/api/signals/{signal.id}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['id'], signal.id)

    def test_signal_detail_includes_related_mt5_trades(self):
        signal = Signal.objects.create(
            symbol='OANDA:XAUUSD',
            pair='XAUUSD',
            direction='BUY',
            timeframe='15',
            strategy_name='Fibonacci Strategy',
            fib_entry=0.5,
            take_profit=2412.4,
            stop_loss=2394.2,
            fib_0236=2394.2,
            fib_0500=2402.7,
            fib_0618=2408.4,
            fib_tp=2412.4,
            issued_at=timezone.localtime().time().replace(second=0, microsecond=0),
            session_date=timezone.localdate(),
            max_entry_time=(timezone.localtime() + timedelta(minutes=10)).time().replace(second=0, microsecond=0),
            expires_at=timezone.now() + timedelta(minutes=15),
            status='Pending',
        )
        account = MT5Account.objects.create(
            user=self.user,
            login=100001,
            password_encrypted='secret',
            server='ICMarkets-Live01',
            broker='ICMarkets',
        )
        Trade.objects.create(
            account=account,
            user=self.user,
            signal=signal,
            ticket=9001,
            symbol='XAUUSD',
            direction='BUY',
            order_type='buy_limit',
            volume=0.1,
            entry_price=2400.0,
            stop_loss=2390.0,
            take_profit=2410.0,
            status='pending',
        )

        self.client.force_authenticate(self.user)
        response = self.client.get(f'/api/signals/{signal.id}/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()['data']
        self.assertEqual(payload['mt5Summary']['totalTrades'], 1)
        self.assertEqual(payload['mt5Summary']['pending'], 1)
        self.assertEqual(payload['mt5Summary']['trades'][0]['ticket'], 9001)
