from django.test import TestCase

from compliance.models import ComplianceResult
from mt5.models import MT5Account, MT5Deal, Trade
from mt5.repositories import MT5Repository
from signals.models import Signal
from users.models import User


class ComplianceSyncTests(TestCase):
    def test_syncing_mt5_deal_creates_compliance_record(self):
        user = User.objects.create_user(email='trader@example.com', username='trader', password='secret', role='trader')
        signal = Signal.objects.create(
            symbol='OANDA:XAUUSD',
            pair='XAUUSD',
            direction='BUY',
            timeframe='15',
            fib_entry=0.5,
            take_profit=2400,
            stop_loss=2390,
            issued_at='10:00:00',
            session_date='2026-01-01',
            max_entry_time='10:10:00',
            expires_at='2026-01-01 10:30:00',
            status='Pending',
        )
        account = MT5Account.objects.create(
            user=user,
            login=1001,
            password_encrypted='x',
            server='test',
            account_number='1001',
        )

        deal = MT5Deal.objects.create(
            account=account,
            ticket=9001,
            symbol='XAUUSD',
            type='BUY',
            volume=0.1,
            price=0.5,
            time='2026-01-01T10:05:00Z',
        )

        MT5Repository()._sync_trade_from_deal(account, deal)

        self.assertTrue(ComplianceResult.objects.filter(user=user, signal=signal).exists())
