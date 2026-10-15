from django.contrib.auth import get_user_model
from django.db import connection
from django.db.models import Count, Q, OuterRef, Subquery
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
    Guarantees user isolation and best-run consistency directly from database.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        stats, _ = UserStats.objects.get_or_create(user=request.user)
        User = get_user_model()

        # Authoritative best completed run strictly owned by the authenticated player
        best_run = GameRun.objects.filter(
            user=request.user,
            score__gt=0
        ).exclude(status='ABORTED').order_by('-score', 'created_at', 'id').first()

        # Compute global rank among all players with qualifying best runs
        rank = None
        if best_run and best_run.score > 0:
            best_run_subquery = GameRun.objects.filter(
                user=OuterRef('pk'),
                score__gt=0
            ).exclude(status='ABORTED').order_by('-score', 'created_at', 'id').values('id')[:1]

            best_run_ids = list(User.objects.filter(
                game_runs__score__gt=0
            ).exclude(game_runs__status='ABORTED').annotate(
                best_run_id=Subquery(best_run_subquery)
            ).values_list('best_run_id', flat=True).distinct())

            higher_count = GameRun.objects.filter(
                id__in=best_run_ids
            ).filter(
                Q(score__gt=best_run.score) |
                Q(score=best_run.score, created_at__lt=best_run.created_at) |
                Q(score=best_run.score, created_at=best_run.created_at, user__username__lt=request.user.username)
            ).count()
            rank = higher_count + 1

        data = UserStatsSerializer(stats).data
        data['global_rank'] = rank
        data['best_run'] = GameRunSerializer(best_run).data if best_run else None

        # Best-run consistency: score, distance, coins from that same best-scoring run
        if best_run:
            data['highest_score'] = best_run.score
            data['best_distance'] = best_run.distance
            data['best_run_coins'] = best_run.coins
            data['best_run_difficulty'] = best_run.difficulty
        else:
            data['highest_score'] = 0
            data['best_distance'] = 0.0
            data['best_run_coins'] = 0
            data['best_run_difficulty'] = 'MEDIUM'

        return Response(data, status=status.HTTP_200_OK)


class LeaderboardView(APIView):
    """
    Retrieve global high score leaderboard.
    Returns exactly one entry per player representing that player's single highest score,
    along with coins, distance, and difficulty associated with that same best run.
    Tie-breaking rule: score DESC, created_at ASC (earliest first), username ASC.
    Query parameters:
      - limit: number of entries per page (default 50, max 100)
      - offset: zero-based starting index for pagination (default 0)
      - mode: 'players' (default; one entry per player) or 'all_runs' (raw stream of all runs)
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            limit = min(max(int(request.query_params.get('limit', 50)), 1), 100)
        except (ValueError, TypeError):
            limit = 50

        try:
            offset = max(int(request.query_params.get('offset', 0)), 0)
        except (ValueError, TypeError):
            offset = 0

        mode = request.query_params.get('mode', 'players')

        if mode == 'all_runs':
            runs_qs = GameRun.objects.exclude(status='ABORTED').select_related(
                'user', 'user__profile'
            ).order_by('-score', 'created_at', 'user__username')
            total_count = runs_qs.count()
            selected_runs = runs_qs[offset:offset + limit]
        else:
            # Player-deduplicated leaderboard: exactly one entry per player
            User = get_user_model()
            best_run_subquery = GameRun.objects.filter(
                user=OuterRef('pk'),
                score__gt=0
            ).exclude(status='ABORTED').order_by('-score', 'created_at', 'id').values('id')[:1]

            best_run_ids = list(User.objects.filter(
                game_runs__score__gt=0
            ).exclude(game_runs__status='ABORTED').annotate(
                best_run_id=Subquery(best_run_subquery)
            ).values_list('best_run_id', flat=True).distinct())

            ranked_qs = GameRun.objects.filter(
                id__in=best_run_ids
            ).select_related(
                'user', 'user__profile'
            ).order_by('-score', 'created_at', 'user__username')

            total_count = ranked_qs.count()
            selected_runs = ranked_qs[offset:offset + limit]

        results = []
        for idx, run in enumerate(selected_runs, start=offset + 1):
            display = run.user.profile.get_display_name() if hasattr(run.user, 'profile') else run.user.username
            results.append({
                'rank': idx,
                'username': run.user.username,
                'display_name': display,
                'score': run.score,
                'coins': run.coins,
                'distance': run.distance,
                'difficulty': run.difficulty,
                'created_at': run.created_at,
            })

        serializer = LeaderboardEntrySerializer(results, many=True)
        return Response({
            'mode': 'players' if mode != 'all_runs' else 'all_runs',
            'total_entries': total_count,
            'limit': limit,
            'offset': offset,
            'leaderboard': serializer.data,
        }, status=status.HTTP_200_OK)


class UserLeaderboardRankView(APIView):
    """
    Retrieve current authenticated user's best run, career score, and global leaderboard placement.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        stats, _ = UserStats.objects.get_or_create(user=request.user)
        best_run = GameRun.objects.filter(
            user=request.user,
            score__gt=0
        ).exclude(status='ABORTED').order_by('-score', 'created_at', 'id').first()

        User = get_user_model()
        best_run_subquery = GameRun.objects.filter(
            user=OuterRef('pk'),
            score__gt=0
        ).exclude(status='ABORTED').order_by('-score', 'created_at', 'id').values('id')[:1]

        best_run_ids = list(User.objects.filter(
            game_runs__score__gt=0
        ).exclude(game_runs__status='ABORTED').annotate(
            best_run_id=Subquery(best_run_subquery)
        ).values_list('best_run_id', flat=True).distinct())

        rank = None
        if best_run and best_run.score > 0:
            higher_count = GameRun.objects.filter(
                id__in=best_run_ids
            ).filter(
                Q(score__gt=best_run.score) |
                Q(score=best_run.score, created_at__lt=best_run.created_at) |
                Q(score=best_run.score, created_at=best_run.created_at, user__username__lt=request.user.username)
            ).count()
            rank = higher_count + 1

        total_players = len(best_run_ids)

        return Response({
            'username': request.user.username,
            'display_name': request.user.profile.get_display_name() if hasattr(request.user, 'profile') else request.user.username,
            'highest_score': best_run.score if best_run else 0,
            'best_coins': best_run.coins if best_run else 0,
            'best_distance': best_run.distance if best_run else 0.0,
            'difficulty': best_run.difficulty if best_run else 'MEDIUM',
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
