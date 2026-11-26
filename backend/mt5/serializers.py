from decimal import Decimal

from rest_framework import serializers
from .backtest import calculate_trade_net_pl
from .models import (
    BacktestJournal, BacktestTrade, MT5Account, MT5Position, MT5Order, MT5Deal,
)
from users.serializers import UserSerializer


class BacktestJournalSerializer(serializers.ModelSerializer):
    startingBalance = serializers.DecimalField(
        source='starting_balance',
        max_digits=16,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )
    currency = serializers.CharField(read_only=True)
    symbol = serializers.CharField(max_length=20)
    lotSize = serializers.DecimalField(
        source='lot_size',
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )
    pipValueUsdPerLot = serializers.DecimalField(
        source='pip_value_usd_per_lot',
        max_digits=16,
        decimal_places=4,
        min_value=Decimal('0.0001'),
    )
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = BacktestJournal
        fields = [
            'id', 'name', 'startingBalance', 'currency', 'symbol', 'lotSize',
            'pipValueUsdPerLot', 'createdAt', 'updatedAt',
        ]

    def validate_symbol(self, value):
        return value.strip().upper()


class BacktestTradeSerializer(serializers.ModelSerializer):
    tradeDate = serializers.DateTimeField(source='trade_date')
    pips = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=True,
        allow_null=False,
    )
    netPl = serializers.DecimalField(
        source='net_pl',
        max_digits=16,
        decimal_places=2,
        read_only=True,
    )
    result = serializers.SerializerMethodField()

    class Meta:
        model = BacktestTrade
        fields = ['id', 'tradeDate', 'session', 'result', 'pips', 'netPl']
        read_only_fields = ['id', 'result']

    def get_result(self, obj):
        if obj.net_pl > 0:
            return 'PROFIT'
        if obj.net_pl < 0:
            return 'LOSS'
        return 'BREAKEVEN'

    def create(self, validated_data):
        journal = validated_data.pop('journal')
        if (
            journal.currency != 'USD'
            or not journal.symbol
            or journal.lot_size is None
            or journal.pip_value_usd_per_lot is None
        ):
            raise serializers.ValidationError({
                'pips': 'This journal needs a USD symbol, lot size, and pip value before adding trades.'
            })

        calculated_net_pl = calculate_trade_net_pl(
            validated_data['pips'],
            journal.lot_size,
            journal.pip_value_usd_per_lot,
        )
        try:
            validated_data['net_pl'] = serializers.DecimalField(
                max_digits=16,
                decimal_places=2,
            ).run_validation(calculated_net_pl)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({
                'pips': 'Calculated NET P/L is outside the supported range.'
            }) from exc
        return BacktestTrade.objects.create(journal=journal, **validated_data)


class MT5PositionSerializer(serializers.ModelSerializer):
    lotSize       = serializers.FloatField(source='volume')
    entryPrice    = serializers.FloatField(source='price_open')
    currentPrice  = serializers.FloatField(source='price_current')
    stopLoss      = serializers.FloatField(source='sl', allow_null=True)
    takeProfit    = serializers.FloatField(source='tp', allow_null=True)
    floatingPnl   = serializers.FloatField(source='profit')
    timeOpen      = serializers.DateTimeField(source='time_open', allow_null=True)

    class Meta:
        model = MT5Position
        fields = ['ticket', 'symbol', 'type', 'lotSize', 'entryPrice',
                  'currentPrice', 'stopLoss', 'takeProfit', 'floatingPnl',
                  'swap', 'comment', 'magic', 'timeOpen']


class MT5OrderSerializer(serializers.ModelSerializer):
    lotSize    = serializers.FloatField(source='volume')
    price      = serializers.FloatField(source='price_open')
    stopLoss   = serializers.FloatField(source='sl', allow_null=True)
    takeProfit = serializers.FloatField(source='tp', allow_null=True)
    timeSetup  = serializers.DateTimeField(source='time_setup', allow_null=True)

    class Meta:
        model = MT5Order
        fields = ['ticket', 'symbol', 'type', 'lotSize', 'price',
                  'stopLoss', 'takeProfit', 'comment', 'magic', 'timeSetup']


class MT5DealSerializer(serializers.ModelSerializer):
    class Meta:
        model = MT5Deal
        fields = ['ticket', 'order', 'position_id', 'symbol', 'type', 'entry',
                  'volume', 'price', 'pip_size', 'profit', 'swap', 'commission',
                  'comment', 'magic', 'time']


class MT5AccountSerializer(serializers.ModelSerializer):
    user          = UserSerializer(read_only=True)
    accountNumber = serializers.CharField(source='account_number', read_only=True)
    floatingPnl   = serializers.FloatField(source='floating_pnl')
    marginLevel   = serializers.FloatField(source='margin_level')
    freeMargin    = serializers.FloatField(source='free_margin')
    openPositions = serializers.IntegerField(source='open_positions')
    pendingOrders = serializers.IntegerField(source='pending_orders')
    lastSync      = serializers.DateTimeField(source='last_sync', allow_null=True)
    isDemo        = serializers.BooleanField(source='is_demo')
    errorMessage  = serializers.CharField(source='error_message', read_only=True)
    positions     = MT5PositionSerializer(many=True, read_only=True)
    orders        = MT5OrderSerializer(many=True, read_only=True)

    class Meta:
        model = MT5Account
        fields = [
            'id', 'user', 'login', 'accountNumber', 'server', 'broker',
            'status', 'isDemo', 'currency', 'leverage', 'company',
            'balance', 'equity', 'floatingPnl', 'margin', 'freeMargin',
            'marginLevel', 'drawdown', 'openPositions', 'pendingOrders',
            'lastSync', 'errorMessage', 'positions', 'orders',
        ]


class MT5CredentialsSerializer(serializers.Serializer):
    """Used to set/update MT5 credentials"""
    login    = serializers.IntegerField()
    password = serializers.CharField(write_only=True, min_length=1)
    server   = serializers.CharField(max_length=100)
    broker   = serializers.CharField(max_length=100, required=False, allow_blank=True)
