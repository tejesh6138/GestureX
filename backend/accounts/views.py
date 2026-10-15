from django.contrib.auth import update_session_auth_hash
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from .models import User, EmailVerificationOTP
from .serializers import (
    UserSerializer,
    UserProfileSerializer,
    RegisterSerializer,
    VerifyEmailSerializer,
    ResendOTPSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from .services import issue_otp


def get_tokens_for_user(user):
    """Generate SimpleJWT access and refresh tokens for an authenticated user."""
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class RegisterView(APIView):
    """
    Register a new player account.
    Creates an inactive account and immediately dispatches a 6-digit OTP code to the email.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response({
            'message': 'Registration initiated. Verification OTP sent to your email address.',
            'email': user.email,
            'username': user.username,
        }, status=status.HTTP_201_CREATED)


class VerifyEmailView(APIView):
    """
    Verify email address using the 6-digit OTP code.
    Activates the user account and returns JWT authentication tokens.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'Email successfully verified. Welcome to GestureX!',
            'user': UserSerializer(user).data,
            'tokens': tokens,
        }, status=status.HTTP_200_OK)


class ResendOTPView(APIView):
    """
    Resend a fresh OTP verification code to an unverified email with cooldown protection.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        user = User.objects.filter(email=email).first()

        issue_otp(email=email, user=user, purpose=EmailVerificationOTP.PURPOSE_REGISTRATION)

        return Response({
            'message': 'A new verification code has been dispatched to your email.',
            'email': email,
        }, status=status.HTTP_200_OK)


class LoginView(APIView):
    """
    Standard username and password login.
    Returns SimpleJWT access and refresh tokens for verified active users.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            if 'email_unverified' in serializer.errors:
                email_raw = serializer.errors.get('email', [''])[0] if isinstance(serializer.errors.get('email'), list) else serializer.errors.get('email', '')
                detail_raw = serializer.errors.get('detail', [''])[0] if isinstance(serializer.errors.get('detail'), list) else serializer.errors.get('detail', '')
                return Response({
                    'detail': str(detail_raw),
                    'email_unverified': True,
                    'email': str(email_raw)
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data['user']

        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'Login successful.',
            'user': UserSerializer(user).data,
            'tokens': tokens,
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    Blacklist the refresh token to securely terminate the session.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'detail': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)
        except TokenError:
            return Response({'detail': 'Invalid or expired token.'}, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserView(APIView):
    """
    Retrieve or partially update the authenticated player's profile and account information.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        profile = request.user.profile
        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Check if username update was requested
        new_username = request.data.get('username')
        if new_username and new_username.strip() != request.user.username:
            new_val = new_username.strip()
            if User.objects.filter(username__iexact=new_val).exclude(id=request.user.id).exists():
                return Response({'username': 'This username is already taken.'}, status=status.HTTP_400_BAD_REQUEST)
            request.user.username = new_val
            request.user.save(update_fields=['username'])

        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    """
    Change password for authenticated runner.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'old_password': 'Incorrect current password.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data['new_password'])
        user.save()
        update_session_auth_hash(request, user)

        return Response({'message': 'Password updated successfully.'}, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    """
    Request an OTP verification code to reset a forgotten password.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email=email).first()
        if user:
            issue_otp(email=email, user=user, purpose=EmailVerificationOTP.PURPOSE_PASSWORD_RESET)

        # Always return identical response to prevent email enumeration
        return Response({
            'message': 'If an account exists with this email, a password reset code has been sent.',
            'email': email,
        }, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """
    Verify reset OTP code and set new password.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        new_password = serializer.validated_data['new_password']

        user.set_password(new_password)
        user.save()

        return Response({'message': 'Password has been reset successfully. You may now log in.'}, status=status.HTTP_200_OK)
