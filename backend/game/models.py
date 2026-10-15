import uuid
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models


class GameRun(models.Model):
    """
    Authoritative record of an individual completed game session.
    Features client-supplied UUID idempotency key to prevent double-submissions on retries.
    """
    DIFFICULTY_CHOICES = [
        ('EASY', 'Easy'),
        ('MEDIUM', 'Medium'),
        ('FAST', 'Fast'),
        ('HARD', 'Hard'),
        ('EXPERT', 'Expert'),
    ]

    STATUS_CHOICES = [
        ('COMPLETED', 'Completed'),
        ('CRASHED', 'Crashed / Collision'),
        ('ABORTED', 'Aborted by Player'),
    ]

    id = models.BigAutoField(primary_key=True)
    run_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        help_text="Client-generated UUID for idempotency on network retries."
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='game_runs'
    )
    score = models.IntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10000000)],
        db_index=True,
        help_text="Final distance-adjusted run score."
    )
    coins = models.IntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(1000000)],
        help_text="Gold coins collected during the run."
    )
    distance = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0)],
        help_text="Meters traversed in virtual 3D space."
    )
    duration_seconds = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0)],
        help_text="Active gameplay elapsed time in seconds."
    )
    difficulty = models.CharField(
        max_length=20,
        choices=DIFFICULTY_CHOICES,
        default='MEDIUM'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='COMPLETED'
    )
    client_timestamp = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp reported by client device when run concluded."
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True
    )

    class Meta:
        ordering = ['-score', '-created_at']
        indexes = [
            models.Index(fields=['user', '-score'], name='gamerun_user_score_idx'),
            models.Index(fields=['-score', 'created_at'], name='gamerun_leaderboard_idx'),
            models.Index(fields=['created_at'], name='gamerun_created_idx'),
        ]

    def __str__(self):
        return f"Run {self.run_id} - {self.user.username}: {self.score} pts ({self.coins} coins)"


class UserStats(models.Model):
    """
    Authoritative player career statistics derived transactionally from GameRuns.
    Maintains fast O(1) reads for profile screens and leaderboard summaries.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='game_stats'
    )
    highest_score = models.IntegerField(default=0, db_index=True)
    total_runs = models.PositiveIntegerField(default=0)
    total_coins = models.PositiveIntegerField(default=0)
    best_coins_single_run = models.PositiveIntegerField(default=0)
    total_distance = models.FloatField(default=0.0)
    best_distance = models.FloatField(default=0.0)
    last_played_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-highest_score']
        indexes = [
            models.Index(fields=['-highest_score'], name='userstats_score_idx'),
        ]

    def __str__(self):
        return f"Stats of {self.user.username} - High: {self.highest_score}, Total Runs: {self.total_runs}"


class Achievement(models.Model):
    """
    Gamification badges unlocked by achieving authoritative milestones.
    """
    CRITERION_CHOICES = [
        ('SCORE', 'Single Run Score Threshold'),
        ('COINS_RUN', 'Single Run Coins Threshold'),
        ('COINS_TOTAL', 'Lifetime Coins Collected'),
        ('RUNS_TOTAL', 'Total Completed Runs'),
        ('DISTANCE', 'Single Run Distance Threshold'),
    ]

    slug = models.SlugField(primary_key=True, max_length=50)
    name = models.CharField(max_length=100)
    description = models.TextField()
    icon = models.CharField(max_length=50, default='trophy')
    criterion_type = models.CharField(max_length=24, choices=CRITERION_CHOICES)
    criterion_threshold = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Achievement: {self.name} ({self.slug})"


class UserAchievement(models.Model):
    """
    Join table representing an unlocked badge earned by a player.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='unlocked_achievements'
    )
    achievement = models.ForeignKey(
        Achievement,
        on_delete=models.CASCADE,
        related_name='user_unlocks'
    )
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'achievement')
        ordering = ['-unlocked_at']
        indexes = [
            models.Index(fields=['user', '-unlocked_at'], name='user_achieve_idx'),
        ]

    def __str__(self):
        return f"{self.user.username} unlocked {self.achievement.slug} at {self.unlocked_at}"
