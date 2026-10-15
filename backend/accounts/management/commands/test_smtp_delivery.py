"""
Django Management Command: test_smtp_delivery
Safely verifies SMTP connectivity, TLS handshake, credentials authentication,
and end-to-end email dispatch to an explicitly configured recipient without leaking secrets.
Reports structured categories:
- missing_configuration
- connection_failed
- tls_failed
- authentication_failed
- send_failed
- success
"""

import smtplib
import socket
from django.conf import settings
from django.core.management.base import BaseCommand
from django.core.mail import send_mail


def mask_email(email: str) -> str:
    """Mask email for safe console display, e.g. g***h@gmail.com"""
    if not email or '@' not in email:
        return '***'
    user_part, domain = email.split('@', 1)
    if len(user_part) <= 2:
        masked_user = user_part[0] + '***'
    else:
        masked_user = user_part[0] + '***' + user_part[-1]
    return f"{masked_user}@{domain}"


class Command(BaseCommand):
    help = "Test real Gmail SMTP connection, authentication, and email delivery."

    def add_arguments(self, parser):
        parser.add_argument(
            '--recipient',
            type=str,
            default='',
            help='Explicit recipient email address to receive a real test message.'
        )

    def handle(self, *args, **options):
        self.stdout.write("=" * 60)
        self.stdout.write("GestureX SMTP Delivery Diagnostic Tool")
        self.stdout.write("=" * 60)

        host = getattr(settings, 'EMAIL_HOST', '')
        port = getattr(settings, 'EMAIL_PORT', 587)
        user = getattr(settings, 'EMAIL_HOST_USER', '')
        password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
        use_tls = getattr(settings, 'EMAIL_USE_TLS', True)
        use_ssl = getattr(settings, 'EMAIL_USE_SSL', False)
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '')
        timeout = getattr(settings, 'EMAIL_TIMEOUT', 10)

        self.stdout.write(f"SMTP Host:       {host}")
        self.stdout.write(f"SMTP Port:       {port}")
        self.stdout.write(f"TLS Enabled:     {use_tls}")
        self.stdout.write(f"SSL Enabled:     {use_ssl}")
        self.stdout.write(f"Sender Email:    {from_email}")
        self.stdout.write(f"SMTP User:       {mask_email(user)}")
        self.stdout.write(f"Password Set:    {'Yes (' + str(len(password)) + ' chars)' if password else 'NO (EMPTY)'}")
        self.stdout.write(f"Timeout:         {timeout}s")
        self.stdout.write("-" * 60)

        # 1. Configuration check
        if not user or not password or not host:
            self.stderr.write(self.style.ERROR(
                "[CATEGORY: missing_configuration]\n"
                "Required SMTP environment variables (EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_HOST) are missing!"
            ))
            return

        # 2. Network / TCP Reachability check
        self.stdout.write(f"[1/4] Checking TCP connection to {host}:{port}...")
        try:
            sock = socket.create_connection((host, port), timeout=timeout)
            sock.close()
            self.stdout.write(self.style.SUCCESS("      [OK] TCP socket connection established successfully."))
        except Exception as e:
            self.stderr.write(self.style.ERROR(
                f"[CATEGORY: connection_failed]\n"
                f"      TCP connection failed: {e}\n"
                f"      Diagnosis: The server cannot reach {host} on port {port}. Check firewall or outbound internet access."
            ))
            return

        # 3. TLS Greeting & Handshake
        self.stdout.write(f"[2/4] Testing SMTP greeting and TLS negotiation...")
        smtp_conn = None
        try:
            if use_ssl:
                smtp_conn = smtplib.SMTP_SSL(host, port, timeout=timeout)
            else:
                smtp_conn = smtplib.SMTP(host, port, timeout=timeout)
                smtp_conn.ehlo()
                if use_tls:
                    smtp_conn.starttls()
                    smtp_conn.ehlo()
            self.stdout.write(self.style.SUCCESS("      [OK] SMTP greeting and TLS handshake completed."))
        except Exception as e:
            self.stderr.write(self.style.ERROR(
                f"[CATEGORY: tls_failed]\n"
                f"      TLS handshake failed: {e}"
            ))
            if smtp_conn:
                try: smtp_conn.close()
                except: pass
            return

        # 4. Authentication check
        self.stdout.write(f"[3/4] Authenticating with user {mask_email(user)}...")
        try:
            smtp_conn.login(user, password)
            self.stdout.write(self.style.SUCCESS("      [OK] SMTP Authentication SUCCESSFUL! Credentials accepted."))
        except (smtplib.SMTPAuthenticationError, smtplib.SMTPServerDisconnected) as e:
            err_details = str(e)
            if hasattr(e, 'smtp_error'):
                err_details = e.smtp_error.decode('utf-8', errors='replace') if isinstance(e.smtp_error, bytes) else str(e.smtp_error)

            self.stderr.write(self.style.ERROR(
                f"[CATEGORY: authentication_failed]\n"
                f"      SMTP Authentication Rejected: {err_details}\n\n"
                f"      ROOT CAUSE:\n"
                f"      Google rejected the App Password (535 BadCredentials). This occurs when:\n"
                f"      1. 2-Step Verification on the Google account was recently turned off or reset.\n"
                f"      2. The App Password was revoked or deleted in the Google security settings.\n"
                f"      3. The 16 characters in backend/.env have a typo or belong to another account.\n\n"
                f"      RESOLUTION STEPS:\n"
                f"      1. Visit: https://myaccount.google.com/apppasswords\n"
                f"      2. Sign in as '{user}'.\n"
                f"      3. Generate a new App Password named 'GestureX'.\n"
                f"      4. Copy the new 16-character code into backend/.env:\n"
                f"         EMAIL_HOST_PASSWORD=xxxx xxxx xxxx xxxx\n"
                f"      5. Re-run this command: python manage.py test_smtp_delivery"
            ))
            return
        except Exception as e:
            self.stderr.write(self.style.ERROR(
                f"[CATEGORY: authentication_failed]\n"
                f"      Unexpected authentication error: {type(e).__name__}: {e}"
            ))
            return
        finally:
            if smtp_conn:
                try: smtp_conn.quit()
                except: pass

        # 5. Live email dispatch check
        recipient = options.get('recipient')
        if not recipient:
            self.stdout.write(
                "[4/4] Skipping live message send (no --recipient provided).\n"
                "      To send an actual test message, run:\n"
                "      python manage.py test_smtp_delivery --recipient your_test_email@example.com"
            )
            self.stdout.write("=" * 60)
            self.stdout.write(self.style.SUCCESS("[CATEGORY: success] SMTP configuration & authentication verified!"))
            return

        self.stdout.write(f"[4/4] Sending real test email to {recipient}...")
        try:
            send_mail(
                subject="[GestureX] SMTP Live Delivery Test",
                message=(
                    "Congratulations! Your GestureX SMTP email dispatch system is operational.\n\n"
                    "This test confirms that real 6-digit OTP verification codes will be successfully delivered to players' inboxes."
                ),
                from_email=from_email,
                recipient_list=[recipient],
                fail_silently=False
            )
            self.stdout.write(self.style.SUCCESS(f"      [OK] Real email successfully dispatched to {recipient}!"))
            self.stdout.write("=" * 60)
            self.stdout.write(self.style.SUCCESS("[CATEGORY: success] End-to-End SMTP delivery verified!"))
        except Exception as e:
            self.stderr.write(self.style.ERROR(
                f"[CATEGORY: send_failed]\n"
                f"      Failed to deliver email: {type(e).__name__}: {e}"
            ))
