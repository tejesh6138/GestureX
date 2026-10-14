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

// Mock fetch
globalThis.fetch = async (url, options = {}) => {
  if (url.includes('/auth/login/')) {
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
        leaderboard: [
          { rank: 1, username: 'grid_master', score: 9999, coins: 150, difficulty: 'FAST' }
        ]
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
    localStorage.clear();
    ApiClient.clearTokens();
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
});
