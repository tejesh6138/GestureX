import logging
from django.db import transaction
from django.utils import timezone
from .models import GameRun, UserStats, Achievement, UserAchievement

logger = logging.getLogger(__name__)

DEFAULT_ACHIEVEMENTS = [
    {
        'slug': 'first_flight',
        'name': 'First Flight',
        'description': 'Complete your very first cyber run in GestureX.',
        'icon': 'rocket',
        'criterion_type': 'RUNS_TOTAL',
        'criterion_threshold': 1,
    },
    {
        'slug': 'cyber_initiate',
        'name': 'Cyber Initiate',
        'description': 'Score 1,000 points in a single run.',
        'icon': 'award',
        'criterion_type': 'SCORE',
        'criterion_threshold': 1000,
    },
    {
        'slug': 'neon_veteran',
        'name': 'Neon Veteran',
        'description': 'Score 5,000 points in a single run.',
        'icon': 'zap',
        'criterion_type': 'SCORE',
        'criterion_threshold': 5000,
    },
    {
        'slug': 'grid_legend',
        'name': 'Grid Legend',
        'description': 'Score 10,000 points in a single run.',
        'icon': 'crown',
        'criterion_type': 'SCORE',
        'criterion_threshold': 10000,
    },
    {
        'slug': 'coin_collector',
        'name': 'Coin Collector',
        'description': 'Collect 50 coins in a single run.',
        'icon': 'coin',
        'criterion_type': 'COINS_RUN',
        'criterion_threshold': 50,
    },
    {
        'slug': 'digital_tycoon',
        'name': 'Digital Tycoon',
        'description': 'Collect 200 coins in a single run.',
        'icon': 'diamond',
        'criterion_type': 'COINS_RUN',
        'criterion_threshold': 200,
    },
    {
        'slug': 'vault_master',
        'name': 'Vault Master',
        'description': 'Accumulate 500 total coins across all career runs.',
        'icon': 'vault',
        'criterion_type': 'COINS_TOTAL',
        'criterion_threshold': 500,
    },
    {
        'slug': 'endurance_runner',
        'name': 'Endurance Runner',
        'description': 'Complete 10 total runs on the grid.',
        'icon': 'activity',
        'criterion_type': 'RUNS_TOTAL',
        'criterion_threshold': 10,
    },
    {
        'slug': 'marathon_runner',
        'name': 'Marathon Runner',
        'description': 'Traverse over 1,500 meters in a single run.',
        'icon': 'map-pin',
        'criterion_type': 'DISTANCE',
        'criterion_threshold': 1500,
    },
]


def seed_default_achievements():
    """
    Ensure the core game achievement definitions exist in the database.
    """
    for ach_data in DEFAULT_ACHIEVEMENTS:
        Achievement.objects.get_or_create(
            slug=ach_data['slug'],
            defaults=ach_data
        )


def evaluate_achievements(user, run: GameRun, stats: UserStats):
    """
    Check if the user has qualified for any new achievements.
    Returns list of newly unlocked UserAchievement instances.
    """
    seed_default_achievements()

    # Get slugs already unlocked
    unlocked_slugs = set(
        UserAchievement.objects.filter(user=user).values_list('achievement_id', flat=True)
    )

    eligible_achievements = Achievement.objects.exclude(slug__in=unlocked_slugs)
    newly_unlocked = []

    for ach in eligible_achievements:
        is_earned = False

        if ach.criterion_type == 'SCORE' and run.score >= ach.criterion_threshold:
            is_earned = True
        elif ach.criterion_type == 'COINS_RUN' and run.coins >= ach.criterion_threshold:
            is_earned = True
        elif ach.criterion_type == 'COINS_TOTAL' and stats.total_coins >= ach.criterion_threshold:
            is_earned = True
        elif ach.criterion_type == 'RUNS_TOTAL' and stats.total_runs >= ach.criterion_threshold:
            is_earned = True
        elif ach.criterion_type == 'DISTANCE' and run.distance >= ach.criterion_threshold:
            is_earned = True

        if is_earned:
            ua, created = UserAchievement.objects.get_or_create(
                user=user,
                achievement=ach
            )
            if created:
                newly_unlocked.append(ua)

    return newly_unlocked


def record_game_run(user, data: dict):
    """
    Persist a completed run idempotently and update user career stats atomically.
    Returns tuple: (game_run, user_stats, newly_unlocked_achievements, is_duplicate)
    """
    run_id = data['run_id']

    # 1. Check idempotency: If this run UUID has already been saved for this user, return existing record
    existing_run = GameRun.objects.filter(run_id=run_id, user=user).first()
    if existing_run:
        stats = UserStats.objects.get(user=user)
        return existing_run, stats, [], True

    # 2. Transactionally save run and update stats
    with transaction.atomic():
        run = GameRun.objects.create(
            run_id=run_id,
            user=user,
            score=data['score'],
            coins=data['coins'],
            distance=data.get('distance', 0.0),
            duration_seconds=data.get('duration_seconds', 0.0),
            difficulty=data.get('difficulty', 'MEDIUM'),
            status=data.get('status', 'COMPLETED'),
            client_timestamp=data.get('client_timestamp'),
        )

        stats, _ = UserStats.objects.select_for_update().get_or_create(user=user)
        stats.total_runs += 1
        stats.total_coins += run.coins
        stats.total_distance += run.distance
        stats.last_played_at = timezone.now()

        if run.score > stats.highest_score:
            stats.highest_score = run.score

        if run.coins > stats.best_coins_single_run:
            stats.best_coins_single_run = run.coins

        if run.distance > stats.best_distance:
            stats.best_distance = run.distance

        stats.save()

        # 3. Evaluate gamification achievements
        unlocked = evaluate_achievements(user=user, run=run, stats=stats)

    return run, stats, unlocked, False
