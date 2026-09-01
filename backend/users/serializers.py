from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Matches frontend AuthUser + extended trader profile"""
    name = serializers.SerializerMethodField()
    accountNumber = serializers.CharField(source='mt5_account_number', read_only=True, allow_null=True)
    employeeId = serializers.CharField(source='employee_id', allow_null=True, required=False)
    brokerServer = serializers.CharField(source='mt5_broker_server', required=False, allow_blank=True)
    brokerName = serializers.CharField(source='mt5_broker_name', required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id', 'name', 'email', 'role', 'status', 'avatar',
            'employeeId', 'department', 'position', 'phone',
            'accountNumber', 'brokerServer', 'brokerName',
            'executionRate', 'complianceScore', 'entryAccuracy', 'timingAccuracy', 'lateEntries',
            'date_joined',
        ]
        read_only_fields = ['id', 'date_joined']

    def get_name(self, obj):
        return obj.full_name


class UserCreateSerializer(serializers.ModelSerializer):
    """Used by admin to create a new user"""
    password = serializers.CharField(write_only=True, min_length=8)
    employeeId = serializers.CharField(source='employee_id', required=False, allow_blank=True)
    brokerServer = serializers.CharField(source='mt5_broker_server', required=False, allow_blank=True)
    brokerName = serializers.CharField(source='mt5_broker_name', required=False, allow_blank=True)
    accountNumber = serializers.CharField(source='mt5_account_number', required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'email', 'password', 'first_name', 'last_name', 'role', 'status',
            'employeeId', 'department', 'position', 'phone',
            'accountNumber', 'brokerServer', 'brokerName',
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        email = validated_data.get('email', '').strip().lower()
        
        # Set username to email before creating user
        validated_data['username'] = email
        validated_data['email'] = email  # Ensure email is lowercase
        
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Used for profile / admin edit"""
    employeeId = serializers.CharField(source='employee_id', required=False, allow_blank=True)
    brokerServer = serializers.CharField(source='mt5_broker_server', required=False, allow_blank=True)
    brokerName = serializers.CharField(source='mt5_broker_name', required=False, allow_blank=True)
    accountNumber = serializers.CharField(source='mt5_account_number', required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'phone', 'department', 'position',
            'role', 'status', 'employeeId', 'accountNumber', 'brokerServer', 'brokerName',
        ]


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
