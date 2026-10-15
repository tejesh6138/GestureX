import uuid
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from .models import GameRun, UserStats, Achievement, UserAchievement

User = get_user_model()


class GameBackendTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='runner_alpha',
            email='alpha@gesturex.test',
            password='TestPassword123!',
            is_email_verified=True,
            is_active=True
        )
        self.user2 = User.objects.create_user(
            username='runner_beta',
            email='beta@gesturex.test',
            password='TestPassword123!',
            is_email_verified=True,
            is_active=True
        )
        # Authenticate as user1 by default
        self.client.force_authenticate(user=self.user1)

    def test_health_check_endpoint(self):
        res = self.client.get('/api/v1/health/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'healthy')
        self.assertTrue(res.data['database']['connected'])

    def test_unauthenticated_run_submission_rejected(self):
        anon_client = APIClient()
        res = anon_client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 500,
            'coins': 20,
        })
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_submit_run_updates_stats_and_awards_achievements(self):
        run_uuid = str(uuid.uuid4())
        payload = {
            'run_id': run_uuid,
            'score': 1200,
            'coins': 60,
            'distance': 400.0,
            'duration_seconds': 45.0,
            'difficulty': 'MEDIUM',
            'status': 'COMPLETED',
        }
        res = self.client.post('/api/v1/game-runs/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertFalse(res.data['is_duplicate'])
        self.assertEqual(res.data['run']['score'], 1200)

        # Verify stats updated
        stats = UserStats.objects.get(user=self.user1)
        self.assertEqual(stats.highest_score, 1200)
        self.assertEqual(stats.total_runs, 1)
        self.assertEqual(stats.total_coins, 60)
        self.assertEqual(stats.best_coins_single_run, 60)

        # Verify unlocked achievements
        unlocked = [a['slug'] for a in res.data['newly_unlocked_achievements']]
        self.assertIn('first_flight', unlocked)
        self.assertIn('cyber_initiate', unlocked)
        self.assertIn('coin_collector', unlocked)

    def test_idempotent_duplicate_run_submission(self):
        run_uuid = str(uuid.uuid4())
        payload = {
            'run_id': run_uuid,
            'score': 800,
            'coins': 30,
            'distance': 250.0,
            'duration_seconds': 30.0,
        }

        # 1st Submission
        res1 = self.client.post('/api/v1/game-runs/', payload)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        self.assertFalse(res1.data['is_duplicate'])

        # 2nd Submission with same UUID (e.g. client network retry)
        res2 = self.client.post('/api/v1/game-runs/', payload)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertTrue(res2.data['is_duplicate'])

        # Total runs in DB for this run_id must still be exactly 1
        self.assertEqual(GameRun.objects.filter(run_id=run_uuid).count(), 1)
        stats = UserStats.objects.get(user=self.user1)
        self.assertEqual(stats.total_runs, 1)
        self.assertEqual(stats.total_coins, 30)

    def test_leaderboard_ordering_and_user_rank(self):
        # User 1 submits run with score 1500
        self.client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 1500,
            'coins': 50,
            'duration_seconds': 60.0,
        })

        # Switch to User 2 and submit run with score 3000
        self.client.force_authenticate(user=self.user2)
        self.client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 3000,
            'coins': 80,
            'duration_seconds': 90.0,
        })

        # Check Global Leaderboard
        lb_res = self.client.get('/api/v1/leaderboard/')
        self.assertEqual(lb_res.status_code, status.HTTP_200_OK)
        entries = lb_res.data['leaderboard']
        self.assertGreaterEqual(len(entries), 2)
        self.assertEqual(entries[0]['username'], 'runner_beta')
        self.assertEqual(entries[0]['score'], 3000)
        self.assertEqual(entries[0]['rank'], 1)
        self.assertEqual(entries[1]['username'], 'runner_alpha')
        self.assertEqual(entries[1]['score'], 1500)
        self.assertEqual(entries[1]['rank'], 2)

        # Check User 2 rank endpoint
        rank_res2 = self.client.get('/api/v1/leaderboard/me/')
        self.assertEqual(rank_res2.status_code, status.HTTP_200_OK)
        self.assertEqual(rank_res2.data['global_rank'], 1)

        # Switch back to User 1 and check rank
        self.client.force_authenticate(user=self.user1)
        rank_res1 = self.client.get('/api/v1/leaderboard/me/')
        self.assertEqual(rank_res1.status_code, status.HTTP_200_OK)
        self.assertEqual(rank_res1.data['global_rank'], 2)

    def test_achievements_list_endpoint(self):
        res = self.client.get('/api/v1/achievements/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data['total_achievements'], 5)

    def test_leaderboard_deduplicates_multiple_runs_per_player(self):
        """
        Multiple runs by one player must produce exactly one leaderboard entry.
        Score, coins, distance, and difficulty must all come from the same best run.
        Historical runs must not be deleted.
        """
        # User 1 submits 3 runs: 120 pts, 850 pts (best), 420 pts
        self.client.force_authenticate(user=self.user1)
        self.client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 120,
            'coins': 15,
            'distance': 100.0,
            'difficulty': 'EASY',
            'duration_seconds': 20.0,
        })
        self.client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 850,
            'coins': 98,
            'distance': 520.0,
            'difficulty': 'FAST',
            'duration_seconds': 60.0,
        })
        self.client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 420,
            'coins': 40,
            'distance': 250.0,
            'difficulty': 'MEDIUM',
            'duration_seconds': 35.0,
        })

        # User 2 submits 2 runs: 50 pts, 300 pts
        self.client.force_authenticate(user=self.user2)
        self.client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 50,
            'coins': 5,
            'distance': 40.0,
            'difficulty': 'EASY',
            'duration_seconds': 10.0,
        })
        self.client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 300,
            'coins': 35,
            'distance': 200.0,
            'difficulty': 'MEDIUM',
            'duration_seconds': 30.0,
        })

        # Check leaderboard: Total entries must be exactly 2 (one per player)
        lb_res = self.client.get('/api/v1/leaderboard/')
        self.assertEqual(lb_res.status_code, status.HTTP_200_OK)
        entries = lb_res.data['leaderboard']
        self.assertEqual(len(entries), 2)
        self.assertEqual(lb_res.data['total_entries'], 2)

        # 1st entry: user1 with best run
        self.assertEqual(entries[0]['username'], 'runner_alpha')
        self.assertEqual(entries[0]['score'], 850)
        self.assertEqual(entries[0]['coins'], 98)
        self.assertEqual(entries[0]['distance'], 520.0)
        self.assertEqual(entries[0]['difficulty'], 'FAST')
        self.assertEqual(entries[0]['rank'], 1)

        # 2nd entry: user2 with best run
        self.assertEqual(entries[1]['username'], 'runner_beta')
        self.assertEqual(entries[1]['score'], 300)
        self.assertEqual(entries[1]['coins'], 35)
        self.assertEqual(entries[1]['distance'], 200.0)
        self.assertEqual(entries[1]['difficulty'], 'MEDIUM')
        self.assertEqual(entries[1]['rank'], 2)

        # Historical runs must all still exist in the database (5 total runs)
        self.assertEqual(GameRun.objects.filter(user=self.user1).count(), 3)
        self.assertEqual(GameRun.objects.filter(user=self.user2).count(), 2)
        self.assertEqual(GameRun.objects.count(), 5)

    def test_personal_best_endpoint_user_isolation(self):
        """
        UserStatsView (/api/v1/game-stats/me/) and UserLeaderboardRankView (/api/v1/leaderboard/me/)
        must strictly return the authenticated player's own best run metrics and never leak another player's data.
        """
        # User 1 has runs: 120, 850, 420
        self.client.force_authenticate(user=self.user1)
        self.client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 120,
            'coins': 15,
            'distance': 100.0,
            'duration_seconds': 20.0,
        })
        self.client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 850,
            'coins': 98,
            'distance': 520.0,
            'difficulty': 'FAST',
            'duration_seconds': 60.0,
        })
        self.client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 420,
            'coins': 40,
            'distance': 250.0,
            'duration_seconds': 35.0,
        })

        # User 1 stats check
        stats_res1 = self.client.get('/api/v1/game-stats/me/')
        self.assertEqual(stats_res1.status_code, status.HTTP_200_OK)
        self.assertEqual(stats_res1.data['highest_score'], 850)
        self.assertEqual(stats_res1.data['best_distance'], 520.0)
        self.assertEqual(stats_res1.data['best_run_coins'], 98)
        self.assertEqual(stats_res1.data['best_run_difficulty'], 'FAST')
        self.assertEqual(stats_res1.data['total_coins'], 15 + 98 + 40)
        self.assertEqual(stats_res1.data['global_rank'], 1)

        # User 2 has NO completed runs
        self.client.force_authenticate(user=self.user2)
        stats_res2 = self.client.get('/api/v1/game-stats/me/')
        self.assertEqual(stats_res2.status_code, status.HTTP_200_OK)
        self.assertEqual(stats_res2.data['highest_score'], 0)
        self.assertEqual(stats_res2.data['best_distance'], 0.0)
        self.assertEqual(stats_res2.data['best_run_coins'], 0)
        self.assertIsNone(stats_res2.data['global_rank'])

        # User 2 leaderboard/me check
        rank_res2 = self.client.get('/api/v1/leaderboard/me/')
        self.assertEqual(rank_res2.status_code, status.HTTP_200_OK)
        self.assertEqual(rank_res2.data['highest_score'], 0)
        self.assertIsNone(rank_res2.data['global_rank'])

    def test_leaderboard_pagination_and_tie_breaking(self):
        """
        Pagination must preserve unique players across pages.
        Tie breaking: score DESC, created_at ASC, username ASC.
        """
        # User 3
        user3 = User.objects.create_user(
            username='runner_gamma',
            email='gamma@gesturex.test',
            password='TestPassword123!',
            is_email_verified=True,
            is_active=True
        )

        # Alpha scores 1000 first
        self.client.force_authenticate(user=self.user1)
        self.client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 1000,
            'coins': 30,
            'duration_seconds': 50.0,
        })

        # Beta scores 1000 second (tied score)
        self.client.force_authenticate(user=self.user2)
        self.client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 1000,
            'coins': 40,
            'duration_seconds': 50.0,
        })

        # Gamma scores 500
        self.client.force_authenticate(user=user3)
        self.client.post('/api/v1/game-runs/', {
            'run_id': str(uuid.uuid4()),
            'score': 500,
            'coins': 20,
            'duration_seconds': 30.0,
        })

        # Page 1: limit=2, offset=0 -> runner_alpha (earlier 1000), runner_beta (later 1000)
        p1_res = self.client.get('/api/v1/leaderboard/?limit=2&offset=0')
        self.assertEqual(p1_res.status_code, status.HTTP_200_OK)
        p1_entries = p1_res.data['leaderboard']
        self.assertEqual(len(p1_entries), 2)
        self.assertEqual(p1_entries[0]['username'], 'runner_alpha')
        self.assertEqual(p1_entries[0]['rank'], 1)
        self.assertEqual(p1_entries[1]['username'], 'runner_beta')
        self.assertEqual(p1_entries[1]['rank'], 2)

        # Page 2: limit=2, offset=2 -> runner_gamma
        p2_res = self.client.get('/api/v1/leaderboard/?limit=2&offset=2')
        self.assertEqual(p2_res.status_code, status.HTTP_200_OK)
        p2_entries = p2_res.data['leaderboard']
        self.assertEqual(len(p2_entries), 1)
        self.assertEqual(p2_entries[0]['username'], 'runner_gamma')
        self.assertEqual(p2_entries[0]['rank'], 3)
