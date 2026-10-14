import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """
    Custom user model for GestureX.
    Uses email as a mandatory unique field and tracks email verification status.
    """
    email = models.EmailField(
        unique=True,
        db_index=True,
        help_text="Primary email address used for OTP verification and recovery."
    )
    is_email_verified = models.BooleanField(
        default=False,
        help_text="Designates whether the user's email was verified via OTP."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    REQUIRED_FIELDS = ['email']

    class Meta:
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['email'], name='user_email_idx'),
            models.Index(fields=['username'], name='user_username_idx'),
        ]

    def __str__(self):
        return f"{self.username} <{self.email}>"


class UserProfile(models.Model):
    """
    User game preferences, cosmetic settings, and presentation fields.
    """
    DIFFICULTY_CHOICES = [
        ('EASY', 'Easy'),
        ('MEDIUM', 'Medium'),
        ('HARD', 'Hard'),
        ('EXPERT', 'Expert'),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile'
    )
    display_name = models.CharField(
        max_length=50,
        blank=True,
        help_text="Public alias displayed on leaderboard. Defaults to username."
    )
    avatar_color = models.CharField(
        max_length=16,
        default='#00f0ff',
        help_text="Hex color code for player UI avatar."
    )
    preferred_difficulty = models.CharField(
        max_length=20,
        choices=DIFFICULTY_CHOICES,
        default='MEDIUM'
    )
    sound_enabled = models.BooleanField(default=True)
    music_enabled = models.BooleanField(default=True)
    sfx_volume = models.FloatField(default=0.8)
    music_volume = models.FloatField(default=0.6)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def get_display_name(self):
        return self.display_name.strip() if self.display_name else self.user.username

    def __str__(self):
        return f"Profile of {self.user.username}"


class EmailVerificationOTP(models.Model):
    """
    Secure single-use OTP record for Email Verification and Password Reset.
    Stores cryptographic hash of the OTP code with expiration and attempt limiting.
    """
    PURPOSE_REGISTRATION = 'REGISTRATION'
    PURPOSE_PASSWORD_RESET = 'PASSWORD_RESET'

    PURPOSE_CHOICES = [
        (PURPOSE_REGISTRATION, 'Registration Verification'),
        (PURPOSE_PASSWORD_RESET, 'Password Reset'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='verification_otps',
        null=True,
        blank=True
    )
    email = models.EmailField(db_index=True)
    otp_hash = models.CharField(
        max_length=128,
        help_text="SHA-256 hash of the 6-digit verification code."
    )
    purpose = models.CharField(
        max_length=24,
        choices=PURPOSE_CHOICES,
        default=PURPOSE_REGISTRATION
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveIntegerField(default=0)
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'purpose', 'is_used'], name='otp_lookup_idx'),
            models.Index(fields=['expires_at'], name='otp_expiry_idx'),
        ]

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"OTP for {self.email} ({self.purpose}) - Used: {self.is_used}"
