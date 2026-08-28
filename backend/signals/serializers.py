from rest_framework import serializers
from mt5.models import Trade
from .models import Signal


class SignalSerializer(serializers.ModelSerializer):
    """Full signal — matches frontend Signal interface + extended fields"""
    time = serializers.TimeField(source='issued_at', format='%H:%M', read_only=True)
    maxEntryTime = serializers.TimeField(source='max_entry_time', format='%H:%M', read_only=True)
    fibEntry = serializers.FloatField(source='fib_entry', read_only=True)
    takeProfit = serializers.FloatField(source='take_profit', read_only=True)
    stopLoss = serializers.FloatField(source='stop_loss', read_only=True)
    executionRate = serializers.FloatField(source='execution_rate', read_only=True)
    strategyName = serializers.CharField(source='strategy_name', read_only=True)
    expiresAt = serializers.DateTimeField(source='expires_at', allow_null=True, read_only=True)
    sessionDate = serializers.DateField(source='session_date', read_only=True)
    mt5Summary = serializers.SerializerMethodField()
    mt5Trades = serializers.SerializerMethodField()

    class Meta:
        model = Signal
        fields = [
            'id', 'symbol', 'pair', 'direction', 'timeframe', 'strategyName',
            'time', 'sessionDate', 'maxEntryTime', 'expiresAt',
            'fibEntry', 'takeProfit', 'stopLoss',
            'fib_0236', 'fib_0500', 'fib_0618', 'fib_tp',
            'status', 'executionRate',
            'created_at', 'mt5Summary', 'mt5Trades',
        ]

    def get_mt5Summary(self, obj):
        qs = Trade.objects.filter(signal=obj)
        return {
            'totalTrades': qs.count(),
            'pending': qs.filter(status='pending').count(),
            'open': qs.filter(status='open').count(),
            'closed': qs.filter(status='closed').count(),
            'cancelled': qs.filter(status='cancelled').count(),
        }

    def get_mt5Trades(self, obj):
        trades = Trade.objects.filter(signal=obj).select_related('account', 'account__user').order_by('-open_time', '-created_at')
        return [
            {
                'id': trade.id,
                'ticket': trade.ticket,
                'symbol': trade.symbol,
                'direction': trade.direction,
                'orderType': trade.order_type,
                'volume': float(trade.volume),
                'entryPrice': float(trade.entry_price),
                'stopLoss': float(trade.stop_loss) if trade.stop_loss is not None else None,
                'takeProfit': float(trade.take_profit) if trade.take_profit is not None else None,
                'status': trade.status,
                'openTime': trade.open_time.isoformat() if trade.open_time else None,
                'account': {
                    'id': trade.account_id,
                    'login': trade.account.login,
                    'accountNumber': trade.account.account_number,
                    'userName': trade.account.user.get_full_name() or trade.account.user.username,
                },
            }
            for trade in trades
        ]


class WebhookSignalSerializer(serializers.Serializer):
    """
    Validates incoming TradingView Pine Script alert payload.

    Pine Script alert message format (JSON):
    {
      "secret": "your-webhook-secret",
      "symbol": "OANDA:XAUUSD",
      "pair": "XAUUSD",
      "direction": "BUY",
      "timeframe": "15",
      "strategy": "Fibonacci Strategy v6",
      "fib_entry": 0.5,
      "take_profit": 2412.4,
      "stop_loss": 2394.2,
      "fib_0236": 2394.2,
      "fib_0500": 2402.7,
      "fib_0618": 2408.4,
      "fib_tp": 2412.4,
      "max_entry_minutes": 10,
      "expiry_minutes": 60
    }
    """
    secret = serializers.CharField(required=False, allow_blank=True)
    symbol = serializers.CharField(max_length=50)
    pair = serializers.CharField(max_length=30, required=False, allow_blank=True)
    direction = serializers.ChoiceField(choices=['BUY', 'SELL'])
    timeframe = serializers.CharField(max_length=10, default='15')
    strategy = serializers.CharField(max_length=100, default='Fibonacci Strategy', required=False)
    # Allow slightly longer but still reasonably sized timestamps from clients
    bar_time = serializers.CharField(max_length=64, required=False, allow_blank=True,
                                     help_text='Candle close time from TradingView e.g. "2026-07-24 20:45"')
    fib_entry = serializers.FloatField(default=0.5, required=False)
    take_profit = serializers.FloatField(required=False, allow_null=True, default=0.0)
    stop_loss = serializers.FloatField(required=False, allow_null=True, default=0.0)
    fib_0236 = serializers.FloatField(required=False, allow_null=True)
    fib_0500 = serializers.FloatField(required=False, allow_null=True)
    fib_0618 = serializers.FloatField(required=False, allow_null=True)
    fib_tp = serializers.FloatField(required=False, allow_null=True)
    max_entry_minutes = serializers.IntegerField(default=10)
    expiry_minutes = serializers.IntegerField(default=60, required=False)

    def to_internal_value(self, data):
        """
        Normalize field aliases from Pine Script before validation.
        Pine Script sends: signal, sl, tp, entry1/2/3
        Backend expects:   direction, stop_loss, take_profit, fib_0236/0500/0618
        """
        # Make a mutable copy
        data = dict(data)

        # Alias: signal → direction
        if 'signal' in data and 'direction' not in data:
            data['direction'] = data.pop('signal')

        # Alias: sl → stop_loss
        if 'sl' in data and 'stop_loss' not in data:
            data['stop_loss'] = data.pop('sl')

        # Alias: tp → take_profit
        if 'tp' in data and 'take_profit' not in data:
            data['take_profit'] = data.pop('tp')

        # Alias: entry1/2/3 → fib_0236/0500/0618
        if 'entry1' in data and 'fib_0236' not in data:
            data['fib_0236'] = data.pop('entry1')
        if 'entry2' in data and 'fib_0500' not in data:
            data['fib_0500'] = data.pop('entry2')
        if 'entry3' in data and 'fib_0618' not in data:
            data['fib_0618'] = data.pop('entry3')

        return super().to_internal_value(data)

    def validate(self, attrs):
        # Derive pair from symbol if not provided (strip broker prefix e.g. OANDA:XAUUSD → XAUUSD)
        if not attrs.get('pair'):
            symbol = attrs.get('symbol', '')
            attrs['pair'] = symbol.split(':')[-1] if ':' in symbol else symbol

        # Ensure pair is uppercase and max 20 chars
        attrs['pair'] = attrs['pair'].upper()[:20]

        return attrs
