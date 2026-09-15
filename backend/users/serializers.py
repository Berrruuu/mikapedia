from rest_framework import serializers
from .models import TraderProfile, User


class UserSerializer(serializers.ModelSerializer):
    """Matches frontend AuthUser + extended trader profile"""
    name = serializers.SerializerMethodField()
    accountNumber = serializers.CharField(source='mt5_account_number', read_only=True, allow_null=True)
    employeeId = serializers.CharField(source='employee_id', allow_null=True, required=False)
    brokerServer = serializers.CharField(source='mt5_broker_server', required=False, allow_blank=True)
    brokerName = serializers.CharField(source='mt5_broker_name', required=False, allow_blank=True)
    tradingTimeframe = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'name', 'email', 'role', 'status', 'avatar',
            'employeeId', 'department', 'position', 'phone',
            'accountNumber', 'brokerServer', 'brokerName',
            'tradingTimeframe',
            'executionRate', 'complianceScore', 'entryAccuracy', 'timingAccuracy', 'lateEntries',
            'date_joined',
        ]
        read_only_fields = ['id', 'date_joined']

    def get_name(self, obj):
        return obj.full_name

    def get_tradingTimeframe(self, obj):
        profile = getattr(obj, 'trader_profile', None)
        return profile.allowed_timeframe if profile else '15'


class UserCreateSerializer(serializers.ModelSerializer):
    """Used by admin to create a new user"""
    password = serializers.CharField(write_only=True, min_length=8)
    employeeId = serializers.CharField(source='employee_id', required=False, allow_blank=True)
    brokerServer = serializers.CharField(source='mt5_broker_server', required=False, allow_blank=True)
    brokerName = serializers.CharField(source='mt5_broker_name', required=False, allow_blank=True)
    accountNumber = serializers.CharField(source='mt5_account_number', required=False, allow_blank=True)
    tradingTimeframe = serializers.ChoiceField(source='trader_timeframe', choices=[choice[0] for choice in TraderProfile.TIMEFRAME_CHOICES], required=False, default='15', write_only=True)

    class Meta:
        model = User
        fields = [
            'email', 'password', 'first_name', 'last_name', 'role', 'status',
            'employeeId', 'department', 'position', 'phone',
            'accountNumber', 'brokerServer', 'brokerName',
            'tradingTimeframe',
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        timeframe = validated_data.pop('trader_timeframe', '15')
        email = validated_data.get('email', '').strip().lower()
        
        # Set username to email before creating user
        validated_data['username'] = email
        validated_data['email'] = email  # Ensure email is lowercase
        
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        TraderProfile.objects.create(user=user, allowed_timeframe=timeframe)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Used for profile / admin edit"""
    employeeId = serializers.CharField(source='employee_id', required=False, allow_blank=True)
    brokerServer = serializers.CharField(source='mt5_broker_server', required=False, allow_blank=True)
    brokerName = serializers.CharField(source='mt5_broker_name', required=False, allow_blank=True)
    accountNumber = serializers.CharField(source='mt5_account_number', required=False, allow_blank=True, allow_null=True)
    tradingTimeframe = serializers.ChoiceField(source='trader_timeframe', choices=[choice[0] for choice in TraderProfile.TIMEFRAME_CHOICES], required=False)

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'phone', 'department', 'position',
            'role', 'status', 'employeeId', 'accountNumber', 'brokerServer', 'brokerName',
            'tradingTimeframe',
        ]

    def update(self, instance, validated_data):
        timeframe = validated_data.pop('trader_timeframe', None)
        user = super().update(instance, validated_data)
        if timeframe is not None and user.role == 'trader':
            profile, _ = TraderProfile.objects.get_or_create(user=user)
            profile.allowed_timeframe = timeframe
            profile.save(update_fields=['allowed_timeframe', 'updated_at'])
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
