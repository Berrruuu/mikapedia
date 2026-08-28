from rest_framework import serializers
from .models import SystemSettings


class SystemSettingsSerializer(serializers.ModelSerializer):
    companyName = serializers.CharField(source='company_name')
    logoUrl = serializers.URLField(source='logo_url')
    tvWebhookUrl = serializers.URLField(source='tv_webhook_url')
    mt5BridgeHost = serializers.CharField(source='mt5_bridge_host')
    telegramBotToken = serializers.CharField(source='telegram_bot_token')
    smtpHost = serializers.CharField(source='smtp_host')
    sessionOpenUtc = serializers.TimeField(source='session_open_utc')
    sessionCloseUtc = serializers.TimeField(source='session_close_utc')
    attendanceCutoff = serializers.TimeField(source='attendance_cutoff')
    officeGpsRadiusM = serializers.IntegerField(source='office_gps_radius_m')
    fibEntryA = serializers.FloatField(source='fib_entry_a')
    fibEntryB = serializers.FloatField(source='fib_entry_b')
    fibEntryC = serializers.FloatField(source='fib_entry_c')
    takeProfitFib = serializers.FloatField(source='take_profit_fib')
    maxEntryDelayMinutes = serializers.IntegerField(source='max_entry_delay_minutes')
    maxLotPerTrade = serializers.FloatField(source='max_lot_per_trade')
    autoRejectWrongDirection = serializers.BooleanField(source='auto_reject_wrong_direction')
    notifyOnMissedSignal = serializers.BooleanField(source='notify_on_missed_signal')

    class Meta:
        model = SystemSettings
        fields = [
            'companyName', 'timezone', 'logoUrl',
            'tvWebhookUrl', 'mt5BridgeHost', 'telegramBotToken', 'smtpHost',
            'sessionOpenUtc', 'sessionCloseUtc', 'attendanceCutoff', 'officeGpsRadiusM',
            'fibEntryA', 'fibEntryB', 'fibEntryC', 'takeProfitFib',
            'maxEntryDelayMinutes', 'maxLotPerTrade',
            'autoRejectWrongDirection', 'notifyOnMissedSignal',
        ]
