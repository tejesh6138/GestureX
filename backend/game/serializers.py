from rest_framework import serializers
from .models import GameRun, UserStats, Achievement, UserAchievement


class GameRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameRun
        fields = [
            'id',
            'run_id',
            'score',
            'coins',
            'distance',
            'duration_seconds',
            'difficulty',
            'status',
            'client_timestamp',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class SubmitGameRunSerializer(serializers.Serializer):
    run_id = serializers.UUIDField(required=True)
    score = serializers.IntegerField(min_value=0, max_value=10000000)
    coins = serializers.IntegerField(min_value=0, max_value=1000000)
    distance = serializers.FloatField(min_value=0.0, default=0.0)
    duration_seconds = serializers.FloatField(min_value=0.0, default=0.0)
    difficulty = serializers.ChoiceField(choices=GameRun.DIFFICULTY_CHOICES, default='MEDIUM')
    status = serializers.ChoiceField(choices=GameRun.STATUS_CHOICES, default='COMPLETED')
    client_timestamp = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        # Basic sanity bounds check: impossible to get 1,000,000 points in 0 seconds
        score = attrs.get('score', 0)
        duration = attrs.get('duration_seconds', 0.0)
        if score > 5000 and duration > 0 and (score / duration) > 1500:
            raise serializers.ValidationError({
                "score": "Submitted score rate exceeds credible physics boundaries."
            })
        return attrs


class UserStatsSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    display_name = serializers.CharField(source='user.profile.get_display_name', read_only=True)

    class Meta:
        model = UserStats
        fields = [
            'username',
            'display_name',
            'highest_score',
            'total_runs',
            'total_coins',
            'best_coins_single_run',
            'total_distance',
            'best_distance',
            'last_played_at',
            'updated_at',
        ]
        read_only_fields = fields


class LeaderboardEntrySerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    username = serializers.CharField()
    display_name = serializers.CharField()
    score = serializers.IntegerField()
    coins = serializers.IntegerField()
    distance = serializers.FloatField(required=False, default=0.0)
    difficulty = serializers.CharField()
    created_at = serializers.DateTimeField()


class AchievementSerializer(serializers.ModelSerializer):
    is_unlocked = serializers.BooleanField(default=False)
    unlocked_at = serializers.DateTimeField(allow_null=True, default=None)

    class Meta:
        model = Achievement
        fields = [
            'slug',
            'name',
            'description',
            'icon',
            'criterion_type',
            'criterion_threshold',
            'is_unlocked',
            'unlocked_at',
        ]
