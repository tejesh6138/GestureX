from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from .models import EmailVerificationOTP
from .services import hash_otp, issue_otp

User = get_user_model()


class AccountsAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/v1/auth/register/'
        self.verify_url = '/api/v1/auth/verify-email/'
        self.resend_url = '/api/v1/auth/resend-otp/'
        self.login_url = '/api/v1/auth/login/'
        self.logout_url = '/api/v1/auth/logout/'
        self.profile_url = '/api/v1/users/me/'
        self.reset_request_url = '/api/v1/auth/password-reset/request/'
        self.reset_confirm_url = '/api/v1/auth/password-reset/confirm/'

    def test_registration_creates_pending_user_and_sends_otp(self):
        payload = {
            'username': 'neon_runner',
            'email': 'neon_runner@gesturex.test',
            'password': 'StrongPassword!2026',
        }
        response = self.client.post(self.register_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('Verification OTP sent', response.data['message'])

        user = User.objects.get(username='neon_runner')
        self.assertFalse(user.is_email_verified)
        self.assertFalse(user.is_active)

        # Check mail was sent
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('GestureX', mail.outbox[0].subject)

        # Check OTP record created
        otp_record = EmailVerificationOTP.objects.filter(email='neon_runner@gesturex.test').first()
        self.assertIsNotNone(otp_record)
        self.assertFalse(otp_record.is_used)

    def test_duplicate_registration_rejected(self):
        User.objects.create_user(
            username='existing_user',
            email='existing@gesturex.test',
            password='Password123!',
            is_email_verified=True,
            is_active=True
        )

        # Duplicate username
        res1 = self.client.post(self.register_url, {
            'username': 'existing_user',
            'email': 'another@gesturex.test',
            'password': 'Password123!',
        })
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # Duplicate email
        res2 = self.client.post(self.register_url, {
            'username': 'unique_user',
            'email': 'existing@gesturex.test',
            'password': 'Password123!',
        })
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_email_verification_activates_account_and_issues_tokens(self):
        user = User.objects.create_user(
            username='verify_user',
            email='verify@gesturex.test',
            password='Password123!',
            is_email_verified=False,
            is_active=False
        )
        raw_code = "123456"
        EmailVerificationOTP.objects.create(
            user=user,
            email=user.email,
            otp_hash=hash_otp(raw_code),
            purpose=EmailVerificationOTP.PURPOSE_REGISTRATION,
            expires_at=timezone.now() + timedelta(minutes=5),
            is_used=False
        )

        res = self.client.post(self.verify_url, {
            'email': user.email,
            'otp': raw_code
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', res.data)
        self.assertIn('access', res.data['tokens'])
        self.assertIn('refresh', res.data['tokens'])

        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)
        self.assertTrue(user.is_active)

    def test_invalid_and_expired_otp_rejected(self):
        user = User.objects.create_user(
            username='otp_test_user',
            email='otp_test@gesturex.test',
            password='Password123!',
            is_email_verified=False,
            is_active=False
        )
        # 1. Invalid code
        EmailVerificationOTP.objects.create(
            user=user,
            email=user.email,
            otp_hash=hash_otp("999999"),
            purpose=EmailVerificationOTP.PURPOSE_REGISTRATION,
            expires_at=timezone.now() + timedelta(minutes=5),
            is_used=False
        )
        res_bad = self.client.post(self.verify_url, {
            'email': user.email,
            'otp': '000000'
        })
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Expired code
        EmailVerificationOTP.objects.create(
            user=user,
            email=user.email,
            otp_hash=hash_otp("888888"),
            purpose=EmailVerificationOTP.PURPOSE_REGISTRATION,
            expires_at=timezone.now() - timedelta(minutes=1),
            is_used=False
        )
        res_expired = self.client.post(self.verify_url, {
            'email': user.email,
            'otp': '888888'
        })
        self.assertEqual(res_expired.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_requires_verified_email(self):
        User.objects.create_user(
            username='unverified_runner',
            email='unverified@gesturex.test',
            password='Password123!',
            is_email_verified=False,
            is_active=False
        )
        res = self.client.post(self.login_url, {
            'username': 'unverified_runner',
            'password': 'Password123!'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Verify account
        verified_user = User.objects.create_user(
            username='active_runner',
            email='active@gesturex.test',
            password='Password123!',
            is_email_verified=True,
            is_active=True
        )
        res_ok = self.client.post(self.login_url, {
            'username': 'active_runner',
            'password': 'Password123!'
        })
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', res_ok.data)

    def test_authenticated_profile_and_logout(self):
        user = User.objects.create_user(
            username='profile_runner',
            email='profile@gesturex.test',
            password='Password123!',
            is_email_verified=True,
            is_active=True
        )
        login_res = self.client.post(self.login_url, {
            'username': 'profile_runner',
            'password': 'Password123!'
        })
        token = login_res.data['tokens']['access']
        refresh = login_res.data['tokens']['refresh']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Profile fetch
        prof_res = self.client.get(self.profile_url)
        self.assertEqual(prof_res.status_code, status.HTTP_200_OK)
        self.assertEqual(prof_res.data['username'], 'profile_runner')

        # Profile update
        patch_res = self.client.patch(self.profile_url, {
            'display_name': 'Neon_Ghost',
            'preferred_difficulty': 'HARD',
            'sound_enabled': False,
        })
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['profile']['display_name'], 'Neon_Ghost')
        self.assertEqual(patch_res.data['profile']['preferred_difficulty'], 'HARD')

        # Logout with refresh token blacklist
        logout_res = self.client.post(self.logout_url, {'refresh': refresh})
        self.assertEqual(logout_res.status_code, status.HTTP_200_OK)
