from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    VerifyEmailView,
    ResendOTPView,
    LoginView,
    LogoutView,
    CurrentUserView,
    ChangePasswordView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
)

auth_urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('verify-email/', VerifyEmailView.as_view(), name='auth-verify-email'),
    path('resend-otp/', ResendOTPView.as_view(), name='auth-resend-otp'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='auth-password-reset-request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
]

user_urlpatterns = [
    path('me/', CurrentUserView.as_view(), name='user-me'),
    path('me/change-password/', ChangePasswordView.as_view(), name='user-change-password'),
]
