from django.urls import path
from .views import (
    SubmitGameRunView,
    GameRunListView,
    GameRunDetailView,
    UserStatsView,
    LeaderboardView,
    UserLeaderboardRankView,
    AchievementListView,
    HealthCheckView,
)

urlpatterns = [
    # Health Check
    path('health/', HealthCheckView.as_view(), name='health-check'),

    # Game Runs
    path('game-runs/', SubmitGameRunView.as_view(), name='game-run-submit'),
    path('game-runs/history/', GameRunListView.as_view(), name='game-run-history'),
    path('game-runs/<int:pk>/', GameRunDetailView.as_view(), name='game-run-detail'),

    # Player Career Stats
    path('game-stats/me/', UserStatsView.as_view(), name='game-stats-me'),

    # Leaderboard
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('leaderboard/me/', UserLeaderboardRankView.as_view(), name='leaderboard-me'),

    # Achievements
    path('achievements/', AchievementListView.as_view(), name='achievements-list'),
    path('achievements/me/', AchievementListView.as_view(), name='achievements-me'),
]
