from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, UserProfile, EmailVerificationOTP
from .services import issue_otp, verify_otp_code


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            'display_name',
            'avatar_color',
            'preferred_difficulty',
            'sound_enabled',
            'music_enabled',
            'sfx_volume',
            'music_volume',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'is_email_verified',
            'profile',
            'date_joined',
            'last_login',
        ]
        read_only_fields = ['id', 'is_email_verified', 'date_joined', 'last_login']


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, min_length=3)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_username(self, value):
        val = value.strip()
        if User.objects.filter(username__iexact=val).exists():
            raise serializers.ValidationError("A runner with this username already exists.")
        return val

    def validate_email(self, value):
        val = value.strip().lower()
        if User.objects.filter(email__iexact=val, is_email_verified=True).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return val

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        email = validated_data['email'].lower()
        username = validated_data['username']

        # If an unverified user with this email or username already exists, delete or re-use
        existing_user = User.objects.filter(email__iexact=email, is_email_verified=False).first()
        if existing_user:
            existing_user.username = username
            existing_user.set_password(validated_data['password'])
            existing_user.is_active = False
            existing_user.save()
            user = existing_user
        else:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=validated_data['password'],
                is_active=False,
                is_email_verified=False
            )

        # Generate and dispatch initial OTP via SMTP
        issue_otp(email=email, user=user, purpose=EmailVerificationOTP.PURPOSE_REGISTRATION)
        return user


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=10)

    def validate(self, attrs):
        email = attrs['email'].strip().lower()
        code = attrs['otp'].strip()

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({"email": "User account not found."})

        verify_otp_code(email=email, code=code, purpose=EmailVerificationOTP.PURPOSE_REGISTRATION)

        # Activate user
        user.is_email_verified = True
        user.is_active = True
        user.save(update_fields=['is_email_verified', 'is_active'])

        attrs['user'] = user
        return attrs


class ResendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise serializers.ValidationError("No account found associated with this email address.")
        if user.is_email_verified:
            raise serializers.ValidationError("This account is already verified. Please log in.")
        return email


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        username = attrs.get('username', '').strip()
        password = attrs.get('password', '')

        # Check if user exists by username or email
        user_candidate = User.objects.filter(username__iexact=username).first()
        if not user_candidate and '@' in username:
            user_candidate = User.objects.filter(email__iexact=username).first()

        if not user_candidate:
            raise serializers.ValidationError("Invalid credentials. Please check your username and password.")

        # Authenticate using real username
        user = authenticate(username=user_candidate.username, password=password)
        if not user:
            raise serializers.ValidationError("Invalid credentials. Please check your username and password.")

        if not user.is_email_verified or not user.is_active:
            raise serializers.ValidationError({
                "detail": "Email address has not been verified. Please verify your email with the OTP sent to your inbox.",
                "email_unverified": True,
                "email": user.email
            })

        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        # Security practice: don't reveal non-existence aggressively, but handle safely
        return email


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=10)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        email = attrs['email'].strip().lower()
        code = attrs['otp'].strip()

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({"email": "User account not found."})

        verify_otp_code(email=email, code=code, purpose=EmailVerificationOTP.PURPOSE_PASSWORD_RESET)
        attrs['user'] = user
        return attrs
