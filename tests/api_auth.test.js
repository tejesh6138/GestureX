import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock browser global environment if missing
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

let mockFetchHandler = null;

// Mock fetch with configurable handler
globalThis.fetch = async (url, options = {}) => {
  if (mockFetchHandler) {
    const customRes = await mockFetchHandler(url, options);
    if (customRes) return customRes;
  }

  if (url.includes('/auth/register/')) {
    const body = JSON.parse(options.body || '{}');
    if (body.username === 'smtp_error_user') {
      return {
        ok: false,
        status: 400,
        headers: { get: () => 'application/json' },
        json: async () => [
          'Email delivery failed: SMTP authentication rejected. The mail server rejected the credentials (invalid or expired Gmail App Password). Please verify backend EMAIL_HOST_PASSWORD.'
        ]
      };
    }
    return {
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      json: async () => ({
        message: 'Registration initiated. Verification OTP sent to your email address.',
        email: body.email,
        username: body.username
      })
    };
  }

  if (url.includes('/auth/verify-email/')) {
    const body = JSON.parse(options.body || '{}');
    if (body.otp === '000000') {
      return {
        ok: false,
        status: 400,
        headers: { get: () => 'application/json' },
        json: async () => ({ otp: ['Invalid verification code. 4 attempt(s) remaining.'] })
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        message: 'Email successfully verified. Welcome to GestureX!',
        user: { id: 2, username: 'verified_runner', email: body.email },
        tokens: { access: 'verified-access-token', refresh: 'verified-refresh-token' }
      })
    };
  }

  if (url.includes('/auth/login/')) {
    const body = JSON.parse(options.body || '{}');
    if (body.username === 'unverified_runner') {
      return {
        ok: false,
        status: 400,
        headers: { get: () => 'application/json' },
        json: async () => ({
          detail: 'Email address has not been verified. Please verify your email with the OTP sent to your inbox.',
          email_unverified: true,
          email: 'unverified@gesturex.test'
        })
      };
    }
    if (body.password === 'WrongPassword!') {
      return {
        ok: false,
        status: 400,
        headers: { get: () => 'application/json' },
        json: async () => ({ detail: 'Invalid credentials. Please check your username and password.' })
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        tokens: { access: 'mock-access-token', refresh: 'mock-refresh-token' },
        user: { id: 1, username: 'cyber_tester', email: 'tester@gesturex.test' }
      })
    };
  }

  if (url.includes('/auth/token/refresh/')) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ access: 'new-refreshed-access-token' })
    };
  }

  if (url.includes('/game-runs/')) {
    const body = JSON.parse(options.body || '{}');
    return {
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      json: async () => ({
        message: 'Run recorded successfully.',
        is_duplicate: false,
        run: body,
        stats: { highest_score: body.score, total_runs: 1 }
      })
    };
  }

  if (url.includes('/leaderboard/')) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        mode: 'players',
        total_entries: 1,
        leaderboard: [
          { rank: 1, username: 'grid_master', score: 9999, coins: 150, difficulty: 'FAST' }
        ]
      })
    };
  }

  if (url.includes('/game-stats/me/')) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        highest_score: 850,
        best_distance: 520.0,
        best_run_coins: 98,
        best_run_difficulty: 'FAST',
        total_coins: 98,
        total_runs: 1,
        global_rank: 1
      })
    };
  }

  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({})
  };
};

import { ApiClient } from '../src/services/ApiClient.js';
import { AuthService } from '../src/services/AuthService.js';
import { Storage } from '../src/services/StorageService.js';
import { Score } from '../src/services/ScoreService.js';

describe('8. Frontend API Client & Auth Integration', () => {
  beforeEach(() => {
    mockFetchHandler = null;
    Storage.clearAllGameData();
    localStorage.clear();
    ApiClient.clearTokens();
    Score.setActiveUser(null);
    Score.submittedRunIds = new Set();
  });

  test('Token storage and authentication state detection', () => {
    assert.strictEqual(ApiClient.isAuthenticated(), false);

    ApiClient.setTokens({ access: 'test_token', refresh: 'test_refresh' });
    assert.strictEqual(ApiClient.isAuthenticated(), true);
    assert.strictEqual(ApiClient.getAccessToken(), 'test_token');
    assert.strictEqual(ApiClient.getRefreshToken(), 'test_refresh');

    ApiClient.clearTokens();
    assert.strictEqual(ApiClient.isAuthenticated(), false);
  });

  test('Guest mode protects against unauthorized cloud submissions', async () => {
    ApiClient.clearTokens();
    const result = await ApiClient.submitScore({ score: 500, coins: 20 });
    assert.strictEqual(result.guest, true);
    assert.match(result.message, /Guest mode/i);
  });

  test('Authenticated cloud score submission passes idempotency UUID', async () => {
    ApiClient.setTokens({ access: 'valid_access_token', refresh: 'valid_refresh' });
    const runResult = {
      score: 1500,
      coinsCollected: 45,
      distanceTravelled: 320,
      durationSeconds: 40,
      difficulty: 'MEDIUM'
    };

    const res = await ApiClient.submitScore(runResult);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.savedToCloud, true);
    assert.strictEqual(res.data.run.score, 1500);
    assert.ok(res.data.run.run_id);
  });

  test('Offline run queue persists runs locally for future reconnection', () => {
    const payload = {
      run_id: 'sample-uuid-1234',
      score: 800,
      coins: 30
    };
    ApiClient.enqueuePendingRun(payload);

    const queue = Storage.getItem('PENDING_RUNS_QUEUE', []);
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].run_id, 'sample-uuid-1234');

    // Duplicate enqueue does not duplicate
    ApiClient.enqueuePendingRun(payload);
    const queue2 = Storage.getItem('PENDING_RUNS_QUEUE', []);
    assert.strictEqual(queue2.length, 1);
  });

  test('Registration success dispatches OTP request to Django REST API', async () => {
    const res = await AuthService.register('new_cyber_runner', 'runner@gesturex.test', 'StrongPass123!');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.data.email, 'runner@gesturex.test');
    assert.match(res.data.message, /Verification OTP sent/i);
  });

  test('Registration SMTP authentication failure displays safe diagnostic message', async () => {
    const res = await AuthService.register('smtp_error_user', 'runner@gesturex.test', 'StrongPass123!');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.status, 400);
    assert.match(res.error, /SMTP authentication rejected/i);
  });

  test('OTP verification activates user and stores JWT access tokens', async () => {
    const res = await AuthService.verifyEmail('runner@gesturex.test', '123456');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(AuthService.isLoggedIn(), true);
    assert.strictEqual(ApiClient.getAccessToken(), 'verified-access-token');
    assert.strictEqual(AuthService.getUser().username, 'verified_runner');
  });

  test('Invalid OTP code verification returns error message', async () => {
    const res = await AuthService.verifyEmail('runner@gesturex.test', '000000');
    assert.strictEqual(res.ok, false);
    assert.match(res.error, /Invalid verification code/i);
  });

  test('Login with unverified email returns email_unverified flag', async () => {
    const res = await AuthService.login('unverified_runner', 'StrongPassword123!');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.data.email_unverified, true);
    assert.strictEqual(res.data.email, 'unverified@gesturex.test');
  });

  test('Login with incorrect password returns invalid credentials error', async () => {
    const res = await AuthService.login('valid_user', 'WrongPassword!');
    assert.strictEqual(res.ok, false);
    assert.match(res.error, /Invalid credentials/i);
  });

  test('AuthService login updates user state and stores profile', async () => {
    const res = await AuthService.login('cyber_tester', 'StrongPassword123!');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(AuthService.isLoggedIn(), true);
    assert.strictEqual(AuthService.getUser().username, 'cyber_tester');

    await AuthService.logout();
    assert.strictEqual(AuthService.isLoggedIn(), false);
    assert.strictEqual(AuthService.isGuestMode(), true);
  });

  test('ScoreService tracks and returns lastSubmitPromise', () => {
    const runResult = {
      score: 1200,
      coinsCollected: 35,
      distanceTravelled: 280,
      durationSeconds: 32,
      difficulty: 'MEDIUM'
    };
    Score.saveRun(runResult);
    const promise = Score.getLastSubmitPromise();
    assert.ok(promise);
    assert.strictEqual(typeof promise.then, 'function');
  });

  test('Personal best is strictly user-scoped and never leaks between accounts or guests', async () => {
    // 1. Guest plays and establishes 150 pts
    Score.setActiveUser(null);
    Score.saveRun({
      score: 150,
      coinsCollected: 10,
      distanceTravelled: 120,
      durationSeconds: 15,
      difficulty: 'EASY'
    });
    assert.strictEqual(Score.getPersonalBest().score, 150);

    // 2. User 'cyber_tester' logs in with confirmed cloud stats (850 pts, 520m, 98 coins)
    await AuthService.login('cyber_tester', 'StrongPassword123!');
    await Score.syncCloudCareerStats();

    const userPB = Score.getPersonalBest();
    assert.strictEqual(userPB.score, 850, 'Authenticated user must see their own highest score');
    assert.strictEqual(userPB.distanceTravelled, 520, 'Distance must match the best run');
    assert.strictEqual(userPB.coinsCollected, 98, 'Coins must match the best run');

    // 3. User logs out -> Must immediately clear account PB and restore Guest PB (150)
    await AuthService.logout();
    const guestPB = Score.getPersonalBest();
    assert.strictEqual(guestPB.score, 150, 'Logging out must restore guest records and never leak user PB');

    // 4. Different user with no runs logs in
    mockFetchHandler = async (url) => {
      if (url.includes('/game-stats/me/')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            highest_score: 0,
            best_distance: 0,
            best_run_coins: 0,
            best_run_difficulty: 'MEDIUM',
            total_coins: 0,
            total_runs: 0,
            global_rank: null
          })
        };
      }
      return null;
    };

    Score.setActiveUser({ id: 999, username: 'empty_user' });
    await Score.syncCloudCareerStats();

    const emptyUserPB = Score.getPersonalBest();
    assert.strictEqual(emptyUserPB.score, 0, 'User with no completed runs must see 0 PTS');
    assert.strictEqual(emptyUserPB.distanceTravelled, 0);
    assert.strictEqual(emptyUserPB.coinsCollected, 0);

    // Clean up
    Score.setActiveUser(null);
  });

  test('ApiClient fetchLeaderboard defaults to player-deduplicated mode', async () => {
    let capturedUrl = '';
    mockFetchHandler = async (url) => {
      if (url.includes('/leaderboard/')) {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            mode: 'players',
            total_entries: 1,
            leaderboard: [
              { rank: 1, username: 'best_runner', score: 850, coins: 98, difficulty: 'FAST' }
            ]
          })
        };
      }
      return null;
    };

    const res = await ApiClient.fetchLeaderboard();
    assert.strictEqual(res.ok, true);
    assert.match(capturedUrl, /mode=players/, 'Leaderboard API must default to mode=players');
    assert.strictEqual(res.data.leaderboard[0].username, 'best_runner');
  });

  test('ScoreService prevents duplicate submission with the same run_id', async () => {
    ApiClient.setTokens({ access: 'mock-access-token', refresh: 'mock-refresh-token' });
    Score.setActiveUser({ id: 1, username: 'test_runner' });

    let submitCount = 0;
    const testRunId = 'fixed-run-uuid-12345';
    mockFetchHandler = async (url, options) => {
      if (url.includes('/game-runs/')) {
        submitCount++;
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            message: 'Run recorded successfully.',
            is_duplicate: submitCount > 1,
            run: JSON.parse(options.body),
            stats: { highest_score: 500, total_runs: 1 }
          })
        };
      }
      return null;
    };

    const run = {
      run_id: testRunId,
      score: 500,
      coinsCollected: 20,
      distanceTravelled: 150,
      durationSeconds: 15,
      difficulty: 'MEDIUM'
    };

    Score.saveRun(run);
    await Score.getLastSubmitPromise();

    Score.saveRun(run); // Duplicate attempt (e.g. rapid click or repeated callback)
    await Score.getLastSubmitPromise();

    assert.strictEqual(submitCount, 1, 'Run with same run_id must only trigger one submission');
  });
});
