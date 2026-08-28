from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from users.serializers import UserSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT serializer that returns user data with tokens
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add user data to response (matching frontend AuthUser interface)
        user_serializer = UserSerializer(self.user)
        data['user'] = user_serializer.data
        
        return data


class LoginSerializer(serializers.Serializer):
    """
    Login serializer matching frontend login flow
    """
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    remember = serializers.BooleanField(default=False)
