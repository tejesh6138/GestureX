"""
gesturex_backend URL Configuration.
"""

from django.contrib import admin
from django.urls import path, include
from accounts.urls import auth_urlpatterns, user_urlpatterns

urlpatterns = [
    path('admin/', admin.site.urls),

    # Authentication & User Management API Endpoints
    path('api/v1/auth/', include(auth_urlpatterns)),
    path('api/v1/users/', include(user_urlpatterns)),

    # Game Persistence, Stats, Leaderboard & Achievements
    path('api/v1/', include('game.urls')),
]
