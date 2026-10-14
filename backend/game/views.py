from django.db import connection
from django.db.models import Count, Q
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import GameRun, UserStats, Achievement, UserAchievement
from .serializers import (
    GameRunSerializer,
    SubmitGameRunSerializer,
    UserStatsSerializer,
    LeaderboardEntrySerializer,
    AchievementSerializer,
)
from .services import record_game_run, seed_default_achievements


class HealthCheckView(APIView):
    """
    Public healthcheck endpoint for Render zero-downtime deployments and monitoring.
    Verifies database connectivity without leaking credentials.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        db_ok = True
        engine = connection.settings_dict.get('ENGINE', '')
        is_neon = 'postgresql' in engine

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()
        except Exception:
            db_ok = False

        status_code = status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response({
            'status': 'healthy' if db_ok else 'degraded',
            'database': {
                'connected': db_ok,
                'engine': 'Neon PostgreSQL' if is_neon else 'SQLite (Dev/Test)',
                'ssl_required': is_neon,
            },
            'service': 'GestureX Backend REST API',
            'version': '1.0.0',
        }, status=status_code)


class SubmitGameRunView(APIView):
    """
    Submit completed game run data asynchronously, or list historical runs for the authenticated user.
    Enforces server-side authentication, idempotency, career stats recalculation, and badge awards.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        runs = GameRun.objects.filter(user=request.user).order_by('-created_at')[:50]
        serializer = GameRunSerializer(runs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = SubmitGameRunSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        run, stats, unlocked, is_duplicate = record_game_run(
            user=request.user,
            data=serializer.validated_data
        )

        unlocked_serialized = [
            {
                'slug': ua.achievement.slug,
                'name': ua.achievement.name,
                'description': ua.achievement.description,
                'icon': ua.achievement.icon,
                'unlocked_at': ua.unlocked_at,
            }
            for ua in unlocked
        ]

        return Response({
            'message': 'Run already recorded (idempotent)' if is_duplicate else 'Run recorded successfully.',
            'is_duplicate': is_duplicate,
            'run': GameRunSerializer(run).data,
            'stats': UserStatsSerializer(stats).data,
            'newly_unlocked_achievements': unlocked_serialized,
        }, status=status.HTTP_200_OK if is_duplicate else status.HTTP_201_CREATED)



class GameRunListView(generics.ListAPIView):
    """
    List historical runs completed by the authenticated user with pagination.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = GameRunSerializer

    def get_queryset(self):
        return GameRun.objects.filter(user=self.request.user).order_by('-created_at')


class GameRunDetailView(generics.RetrieveAPIView):
    """
    Retrieve single game run details owned by the authenticated runner.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = GameRunSerializer

    def get_queryset(self):
        return GameRun.objects.filter(user=self.request.user)


class UserStatsView(APIView):
    """
    Retrieve career statistics and global rank for the authenticated player.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        stats, _ = UserStats.objects.get_or_create(user=request.user)

        # Compute rank: number of users with higher highest_score + 1
        rank = None
        if stats.highest_score > 0:
            rank = UserStats.objects.filter(highest_score__gt=stats.highest_score).count() + 1

        data = UserStatsSerializer(stats).data
        data['global_rank'] = rank
        return Response(data, status=status.HTTP_200_OK)


class LeaderboardView(APIView):
    """
    Retrieve global high score leaderboard.
    Query parameters:
      - limit: number of entries (default 50, max 100)
      - mode: 'runs' (top individual runs) or 'players' (top career players)
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            limit = min(int(request.query_params.get('limit', 50)), 100)
        except (ValueError, TypeError):
            limit = 50

        mode = request.query_params.get('mode', 'runs')
        results = []

        if mode == 'players':
            # Highest score per player
            top_players = UserStats.objects.filter(highest_score__gt=0).select_related(
                'user', 'user__profile'
            ).order_by('-highest_score', 'updated_at')[:limit]

            for idx, stat in enumerate(top_players, start=1):
                display = stat.user.profile.get_display_name() if hasattr(stat.user, 'profile') else stat.user.username
                results.append({
                    'rank': idx,
                    'username': stat.user.username,
                    'display_name': display,
                    'score': stat.highest_score,
                    'coins': stat.best_coins_single_run,
                    'difficulty': getattr(stat.user.profile, 'preferred_difficulty', 'MEDIUM') if hasattr(stat.user, 'profile') else 'MEDIUM',
                    'created_at': stat.updated_at,
                })
        else:
            # Top individual runs
            top_runs = GameRun.objects.select_related(
                'user', 'user__profile'
            ).order_by('-score', 'created_at')[:limit]

            for idx, run in enumerate(top_runs, start=1):
                display = run.user.profile.get_display_name() if hasattr(run.user, 'profile') else run.user.username
                results.append({
                    'rank': idx,
                    'username': run.user.username,
                    'display_name': display,
                    'score': run.score,
                    'coins': run.coins,
                    'difficulty': run.difficulty,
                    'created_at': run.created_at,
                })

        serializer = LeaderboardEntrySerializer(results, many=True)
        return Response({
            'mode': mode,
            'total_entries': len(results),
            'leaderboard': serializer.data,
        }, status=status.HTTP_200_OK)


class UserLeaderboardRankView(APIView):
    """
    Retrieve current authenticated user's best run, career score, and global leaderboard placement.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        stats, _ = UserStats.objects.get_or_create(user=request.user)
        best_run = GameRun.objects.filter(user=request.user).order_by('-score').first()

        rank = None
        if stats.highest_score > 0:
            rank = UserStats.objects.filter(highest_score__gt=stats.highest_score).count() + 1

        total_players = UserStats.objects.filter(highest_score__gt=0).count()

        return Response({
            'username': request.user.username,
            'display_name': request.user.profile.get_display_name(),
            'highest_score': stats.highest_score,
            'best_coins': stats.best_coins_single_run,
            'global_rank': rank,
            'total_ranked_players': total_players,
            'best_run': GameRunSerializer(best_run).data if best_run else None,
        }, status=status.HTTP_200_OK)


class AchievementListView(APIView):
    """
    List all system achievements. If user is authenticated, includes unlock status and timestamp.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        seed_default_achievements()
        achievements = Achievement.objects.all().order_by('criterion_threshold')

        user_unlocks = {}
        if request.user.is_authenticated:
            unlock_records = UserAchievement.objects.filter(user=request.user)
            user_unlocks = {ua.achievement_id: ua.unlocked_at for ua in unlock_records}

        payload = []
        for ach in achievements:
            is_unlocked = ach.slug in user_unlocks
            payload.append({
                'slug': ach.slug,
                'name': ach.name,
                'description': ach.description,
                'icon': ach.icon,
                'criterion_type': ach.criterion_type,
                'criterion_threshold': ach.criterion_threshold,
                'is_unlocked': is_unlocked,
                'unlocked_at': user_unlocks.get(ach.slug),
            })

        return Response({
            'total_achievements': len(payload),
            'unlocked_count': len(user_unlocks) if request.user.is_authenticated else 0,
            'achievements': payload,
        }, status=status.HTTP_200_OK)
