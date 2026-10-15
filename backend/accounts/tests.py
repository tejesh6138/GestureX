import smtplib
import socket
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
        self.token_refresh_url = '/api/v1/auth/token/refresh/'
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

    def test_registration_invalid_inputs(self):
        # 1. Invalid username (too short)
        res = self.client.post(self.register_url, {
            'username': 'ab',
            'email': 'valid@gesturex.test',
            'password': 'StrongPassword123!'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Invalid email format
        res = self.client.post(self.register_url, {
            'username': 'valid_user',
            'email': 'not-an-email',
            'password': 'StrongPassword123!'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Password too short (< 8 chars)
        res = self.client.post(self.register_url, {
            'username': 'valid_user2',
            'email': 'valid2@gesturex.test',
            'password': 'short'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

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

    @patch('accounts.services.send_mail')
    def test_smtp_auth_failure_reported_and_atomic_rollback(self, mock_send):
        mock_send.side_effect = smtplib.SMTPAuthenticationError(535, b'BadCredentials')

        payload = {
            'username': 'smtp_fail_user',
            'email': 'smtp_fail@gesturex.test',
            'password': 'StrongPassword123!'
        }
        res = self.client.post(self.register_url, payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        # Verify specific, safe diagnostic message
        self.assertIn('SMTP authentication rejected', str(res.data))

        # Crucial security verification: User record rolled back cleanly!
        self.assertFalse(User.objects.filter(username='smtp_fail_user').exists())

    @patch('accounts.services.send_mail')
    def test_smtp_recipient_refused_distinguished(self, mock_send):
        mock_send.side_effect = smtplib.SMTPRecipientsRefused({'bad@test.com': (550, b'User not found')})

        payload = {
            'username': 'recipient_fail_user',
            'email': 'recipient_fail@gesturex.test',
            'password': 'StrongPassword123!'
        }
        res = self.client.post(self.register_url, payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recipient email address was rejected', str(res.data))

    @patch('accounts.services.send_mail')
    def test_smtp_connection_failure_distinguished(self, mock_send):
        mock_send.side_effect = socket.timeout("timed out")

        payload = {
            'username': 'timeout_user',
            'email': 'timeout@gesturex.test',
            'password': 'StrongPassword123!'
        }
        res = self.client.post(self.register_url, payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Unable to connect to SMTP provider', str(res.data))

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

    def test_invalid_expired_and_reused_otp_rejected(self):
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

        # 3. Reused code
        used_otp = EmailVerificationOTP.objects.create(
            user=user,
            email=user.email,
            otp_hash=hash_otp("777777"),
            purpose=EmailVerificationOTP.PURPOSE_REGISTRATION,
            expires_at=timezone.now() + timedelta(minutes=5),
            is_used=True  # already consumed
        )
        res_reused = self.client.post(self.verify_url, {
            'email': user.email,
            'otp': '777777'
        })
        self.assertEqual(res_reused.status_code, status.HTTP_400_BAD_REQUEST)

    def test_otp_max_attempts_lockout(self):
        user = User.objects.create_user(
            username='lockout_user',
            email='lockout@gesturex.test',
            password='Password123!',
            is_email_verified=False,
            is_active=False
        )
        otp = EmailVerificationOTP.objects.create(
            user=user,
            email=user.email,
            otp_hash=hash_otp("112233"),
            purpose=EmailVerificationOTP.PURPOSE_REGISTRATION,
            expires_at=timezone.now() + timedelta(minutes=5),
            attempts=5,  # Exceeded
            is_used=False
        )
        res = self.client.post(self.verify_url, {
            'email': user.email,
            'otp': '112233'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Maximum verification attempts exceeded', str(res.data))

    def test_resend_cooldown_enforced(self):
        user = User.objects.create_user(
            username='cooldown_runner',
            email='cooldown@gesturex.test',
            password='Password123!',
            is_email_verified=False,
            is_active=False
        )
        # Create an OTP record created just 10 seconds ago (threshold is 60s)
        EmailVerificationOTP.objects.create(
            user=user,
            email=user.email,
            otp_hash=hash_otp("334455"),
            purpose=EmailVerificationOTP.PURPOSE_REGISTRATION,
            expires_at=timezone.now() + timedelta(minutes=5),
            created_at=timezone.now() - timedelta(seconds=10),
            is_used=False
        )
        res = self.client.post(self.resend_url, {'email': user.email})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('wait', str(res.data).lower())

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
        self.assertEqual(res.data.get('email_unverified'), True)

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

    def test_login_incorrect_password(self):
        User.objects.create_user(
            username='valid_user',
            email='valid@gesturex.test',
            password='CorrectPassword123!',
            is_email_verified=True,
            is_active=True
        )
        res = self.client.post(self.login_url, {
            'username': 'valid_user',
            'password': 'WrongPassword999!'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid credentials', str(res.data))

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

    def test_jwt_token_refresh(self):
        user = User.objects.create_user(
            username='refresh_runner',
            email='refresh@gesturex.test',
            password='Password123!',
            is_email_verified=True,
            is_active=True
        )
        login_res = self.client.post(self.login_url, {
            'username': 'refresh_runner',
            'password': 'Password123!'
        })
        refresh = login_res.data['tokens']['refresh']

        ref_res = self.client.post(self.token_refresh_url, {'refresh': refresh})
        self.assertEqual(ref_res.status_code, status.HTTP_200_OK)
        self.assertIn('access', ref_res.data)

    def test_unauthenticated_protected_endpoint_rejected(self):
        # Without Authorization header
        self.client.credentials()
        res = self.client.get(self.profile_url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
