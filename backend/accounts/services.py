import hashlib
import logging
import secrets
from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import EmailVerificationOTP, User

logger = logging.getLogger(__name__)


def generate_secure_otp() -> str:
    """
    Generate an unpredictable 6-digit numeric OTP using Python's secrets module.
    """
    return f"{secrets.randbelow(900000) + 100000:06d}"


def hash_otp(code: str) -> str:
    """
    Hash the OTP with SHA-256 before database persistence to prevent leak in logs or DB backups.
    """
    return hashlib.sha256(code.strip().encode('utf-8')).hexdigest()


def send_otp_email(email: str, code: str, purpose: str = EmailVerificationOTP.PURPOSE_REGISTRATION) -> bool:
    """
    Deliver the OTP to the recipient email via configured SMTP backend.
    Includes rich Cyberpunk / Neon themed HTML markup and plain-text fallback.
    """
    subject = "[GestureX] Verify Your Runner Account"
    title_text = "Verify Your Account"
    action_text = "Use the 6-digit security code below to complete your registration for GestureX AI Gesture Runner 3D:"

    if purpose == EmailVerificationOTP.PURPOSE_PASSWORD_RESET:
        subject = "[GestureX] Password Reset Verification Code"
        title_text = "Password Reset Request"
        action_text = "A password reset request was received for your GestureX account. Enter the verification code below:"

    plain_message = (
        f"GestureX Cyber Security Verification\n\n"
        f"{title_text}\n"
        f"{action_text}\n\n"
        f"YOUR VERIFICATION CODE: {code}\n\n"
        f"This code will expire in {settings.OTP_EXPIRY_MINUTES} minutes.\n"
        f"If you did not request this verification code, please ignore this email.\n"
    )

    html_message = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{
          background-color: #0b0e14;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #e2e8f0;
          margin: 0;
          padding: 24px;
        }}
        .container {{
          max-width: 540px;
          margin: 0 auto;
          background: #151b26;
          border: 1px solid #00f0ff;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 0 30px rgba(0, 240, 255, 0.2);
        }}
        .brand {{
          text-align: center;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: 3px;
          color: #00f0ff;
          text-transform: uppercase;
          margin-bottom: 24px;
        }}
        .brand span {{
          color: #ff0077;
        }}
        .title {{
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #ffffff;
        }}
        .content {{
          font-size: 15px;
          line-height: 1.6;
          color: #94a3b8;
          margin-bottom: 28px;
        }}
        .otp-box {{
          background: #0b0e14;
          border: 2px dashed #00f0ff;
          border-radius: 8px;
          padding: 18px;
          text-align: center;
          font-size: 34px;
          font-weight: 800;
          letter-spacing: 8px;
          color: #00f0ff;
          margin: 20px 0;
          text-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
        }}
        .footer {{
          font-size: 12px;
          color: #64748b;
          border-top: 1px solid #1e293b;
          padding-top: 16px;
          margin-top: 24px;
          text-align: center;
        }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="brand">GESTURE<span>X</span></div>
        <div class="title">{title_text}</div>
        <div class="content">{action_text}</div>
        <div class="otp-box">{code}</div>
        <div class="content" style="font-size: 13px;">
          * This security code is valid for <strong>{settings.OTP_EXPIRY_MINUTES} minutes</strong>.<br>
          * Never share this code with anyone.
        </div>
        <div class="footer">
          GestureX AI Gesture Runner 3D &bull; Real-time Computer Vision Gaming<br>
          Automated security dispatch. Please do not reply directly to this email.
        </div>
      </div>
    </body>
    </html>
    """

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            html_message=html_message,
            fail_silently=False,
        )
        return True
    except Exception as e:
        logger.error(f"Failed to deliver OTP email to {email}: {e}")
        raise ValidationError(f"Email delivery failed: Unable to connect to SMTP provider. Please check email address.")


def issue_otp(email: str, user: User = None, purpose: str = EmailVerificationOTP.PURPOSE_REGISTRATION) -> EmailVerificationOTP:
    """
    Generate, hash, and persist a new OTP record while invalidating existing active codes for the email.
    Enforces cooldown to mitigate email flood attacks.
    """
    # Enforce resend cooldown
    recent_otp = EmailVerificationOTP.objects.filter(
        email=email,
        purpose=purpose,
        is_used=False
    ).order_by('-created_at').first()

    if recent_otp:
        cooldown_threshold = recent_otp.created_at + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)
        if timezone.now() < cooldown_threshold:
            remaining_seconds = int((cooldown_threshold - timezone.now()).total_seconds())
            raise ValidationError({
                "detail": f"Please wait {remaining_seconds} seconds before requesting a new verification code.",
                "cooldown_remaining": remaining_seconds
            })

    # Invalidate previous unused codes
    EmailVerificationOTP.objects.filter(
        email=email,
        purpose=purpose,
        is_used=False
    ).update(is_used=True)

    # Generate new secure code
    raw_code = generate_secure_otp()
    hashed = hash_otp(raw_code)

    otp_record = EmailVerificationOTP.objects.create(
        user=user,
        email=email,
        otp_hash=hashed,
        purpose=purpose,
        expires_at=timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
        attempts=0,
        is_used=False
    )

    # Deliver OTP via configured SMTP provider
    send_otp_email(email=email, code=raw_code, purpose=purpose)

    return otp_record


def verify_otp_code(email: str, code: str, purpose: str = EmailVerificationOTP.PURPOSE_REGISTRATION) -> EmailVerificationOTP:
    """
    Validate provided OTP code against stored hash, enforcing expiration and attempt thresholds.
    """
    otp_record = EmailVerificationOTP.objects.filter(
        email=email,
        purpose=purpose,
        is_used=False
    ).order_by('-created_at').first()

    if not otp_record:
        raise ValidationError({"otp": "No active verification code found for this email. Please request a new code."})

    if otp_record.is_expired():
        otp_record.is_used = True
        otp_record.save(update_fields=['is_used'])
        raise ValidationError({"otp": "Verification code has expired. Please request a new code."})

    if otp_record.attempts >= settings.OTP_MAX_ATTEMPTS:
        otp_record.is_used = True
        otp_record.save(update_fields=['is_used'])
        raise ValidationError({"otp": "Maximum verification attempts exceeded. Please request a new code."})

    entered_hash = hash_otp(code)
    if not secrets.compare_digest(otp_record.otp_hash, entered_hash):
        otp_record.attempts += 1
        otp_record.save(update_fields=['attempts'])
        remaining = settings.OTP_MAX_ATTEMPTS - otp_record.attempts
        raise ValidationError({"otp": f"Invalid verification code. {remaining} attempt(s) remaining."})

    # Code is valid; consume it
    otp_record.is_used = True
    otp_record.save(update_fields=['is_used'])
    return otp_record
