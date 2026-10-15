/**
 * AI Gesture Runner 3D - ApiClient
 * Production REST API client connecting frontend to Django REST Framework + Neon PostgreSQL.
 * Handles JWT Bearer authentication, automatic token refresh, idempotency, offline queueing, and safe fallbacks.
 */

import { ENVIRONMENT } from '../config/environment.js';
import { Storage } from './StorageService.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function extractErrorMessage(data, fallback = 'Request failed') {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.detail && typeof data.detail === 'string') return data.detail;
  if (data.message && typeof data.message === 'string') return data.message;
  const firstVal = Object.values(data)[0];
  if (Array.isArray(firstVal) && firstVal.length > 0) {
    return String(firstVal[0]);
  }
  if (typeof firstVal === 'string') return firstVal;
  return fallback;
}

export class ApiClientClass {
  constructor() {
    this.baseUrl = ENVIRONMENT.API.BASE_URL.replace(/\/$/, '');
    this.endpoints = ENVIRONMENT.API.ENDPOINTS;
    this.isRefreshing = false;
    this.refreshSubscribers = [];
  }

  // --- Token Management ---

  getAccessToken() {
    return Storage.getItem('JWT_ACCESS_TOKEN', null);
  }

  getRefreshToken() {
    return Storage.getItem('JWT_REFRESH_TOKEN', null);
  }

  setTokens(tokens) {
    if (!tokens) return;
    if (tokens.access) {
      Storage.setItem('JWT_ACCESS_TOKEN', tokens.access);
    }
    if (tokens.refresh) {
      Storage.setItem('JWT_REFRESH_TOKEN', tokens.refresh);
    }
  }

  clearTokens() {
    Storage.removeItem('JWT_ACCESS_TOKEN');
    Storage.removeItem('JWT_REFRESH_TOKEN');
  }

  isAuthenticated() {
    return Boolean(this.getAccessToken());
  }

  // --- Network Request Infrastructure with Auto-Refresh ---

  async request(endpoint, options = {}, requiresAuth = false) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    if (requiresAuth) {
      const token = this.getAccessToken();
      if (!token) {
        return { ok: false, status: 401, error: 'Authentication required' };
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Handle 401 Unauthorized for authenticated endpoints (Token Expired)
      if (response.status === 401 && requiresAuth) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry the request with the fresh token
          headers['Authorization'] = `Bearer ${this.getAccessToken()}`;
          const retryResponse = await fetch(url, { ...options, headers });
          const data = await retryResponse.json().catch(() => ({}));
          return { ok: retryResponse.ok, status: retryResponse.status, data };
        } else {
          this.clearTokens();
          GlobalEvents.emit(EVENTS.AUTH_STATE_CHANGED, { isAuthenticated: false, user: null });
          return { ok: false, status: 401, error: 'Session expired. Please log in again.' };
        }
      }

      let data = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json().catch(() => ({}));
      }

      return {
        ok: response.ok,
        status: response.status,
        data,
        error: !response.ok ? extractErrorMessage(data) : null
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        offline: true,
        error: err.message || 'Network connection failed'
      };
    }
  }

  async refreshToken() {
    const refresh = this.getRefreshToken();
    if (!refresh) return false;

    try {
      const res = await fetch(`${this.baseUrl}${this.endpoints.TOKEN_REFRESH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ refresh })
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (data.access) {
        this.setTokens({ access: data.access, refresh: data.refresh || refresh });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // --- Authentication Endpoints ---

  async register(username, email, password) {
    return this.request(this.endpoints.REGISTER, {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
  }

  async verifyEmail(email, otp) {
    const res = await this.request(this.endpoints.VERIFY_EMAIL, {
      method: 'POST',
      body: JSON.stringify({ email, otp })
    });
    if (res.ok && res.data.tokens) {
      this.setTokens(res.data.tokens);
    }
    return res;
  }

  async resendOTP(email) {
    return this.request(this.endpoints.RESEND_OTP, {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async login(username, password) {
    const res = await this.request(this.endpoints.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.ok && res.data.tokens) {
      this.setTokens(res.data.tokens);
    }
    return res;
  }

  async logout() {
    const refresh = this.getRefreshToken();
    if (refresh) {
      await this.request(this.endpoints.LOGOUT, {
        method: 'POST',
        body: JSON.stringify({ refresh })
      }, true).catch(() => {});
    }
    this.clearTokens();
    return { ok: true };
  }

  async requestPasswordReset(email) {
    return this.request(this.endpoints.PASSWORD_RESET_REQUEST, {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async confirmPasswordReset(email, otp, newPassword) {
    return this.request(this.endpoints.PASSWORD_RESET_CONFIRM, {
      method: 'POST',
      body: JSON.stringify({ email, otp, new_password: newPassword })
    });
  }

  // --- User Account Endpoints ---

  async getCurrentUser() {
    return this.request(this.endpoints.CURRENT_USER, { method: 'GET' }, true);
  }

  async updateProfile(profileData) {
    return this.request(this.endpoints.CURRENT_USER, {
      method: 'PATCH',
      body: JSON.stringify(profileData)
    }, true);
  }

  async changePassword(oldPassword, newPassword) {
    return this.request(this.endpoints.CHANGE_PASSWORD, {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
    }, true);
  }

  // --- Game Persistence & Score Synchronization ---

  async submitScore(runResult) {
    // If not authenticated, keep purely in local mode
    if (!this.isAuthenticated()) {
      return {
        ok: false,
        guest: true,
        message: 'Guest mode: Score saved in local storage. Log in to rank globally on Neon Cloud.'
      };
    }

    const runId = runResult.run_id || generateUUID();
    const payload = {
      run_id: runId,
      score: Math.max(0, Math.floor(runResult.score || 0)),
      coins: Math.max(0, Math.floor(runResult.coinsCollected || runResult.coins || 0)),
      distance: Number((runResult.distanceTravelled || runResult.distance || 0).toFixed(1)),
      duration_seconds: Number((runResult.durationSeconds || runResult.duration || 0).toFixed(1)),
      difficulty: runResult.difficulty || 'MEDIUM',
      status: runResult.status || 'COMPLETED',
      client_timestamp: runResult.completedAt || new Date().toISOString()
    };

    const res = await this.request(this.endpoints.GAME_RUNS, {
      method: 'POST',
      body: JSON.stringify(payload)
    }, true);

    if (res.ok) {
      // Successfully persisted to Neon PostgreSQL!
      // Attempt to flush any previously failed offline runs
      this.flushPendingRuns().catch(() => {});
      return {
        ok: true,
        savedToCloud: true,
        isDuplicate: res.data.is_duplicate,
        data: res.data
      };
    } else if (res.offline) {
      // Enqueue locally for automatic synchronization upon reconnection
      this.enqueuePendingRun(payload);
      return {
        ok: false,
        offline: true,
        savedLocally: true,
        message: 'Network offline: Score queued locally. Will sync with Neon Cloud when online.'
      };
    }

    return res;
  }

  enqueuePendingRun(payload) {
    const queue = Storage.getItem('PENDING_RUNS_QUEUE', []);
    // Prevent duplicate entries in queue
    if (!queue.some((item) => item.run_id === payload.run_id)) {
      queue.push(payload);
      Storage.setItem('PENDING_RUNS_QUEUE', queue);
    }
  }

  async flushPendingRuns() {
    if (!this.isAuthenticated()) return;
    const queue = Storage.getItem('PENDING_RUNS_QUEUE', []);
    if (!queue || queue.length === 0) return;

    const remaining = [];
    for (const item of queue) {
      try {
        const res = await this.request(this.endpoints.GAME_RUNS, {
          method: 'POST',
          body: JSON.stringify(item)
        }, true);
        if (!res.ok && res.offline) {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }
    Storage.setItem('PENDING_RUNS_QUEUE', remaining);
  }

  // --- Leaderboard & Stats Endpoints ---

  async fetchLeaderboard(limit = 50, mode = 'players') {
    const query = `?limit=${limit}&mode=${mode}`;
    return this.request(`${this.endpoints.LEADERBOARD}${query}`, { method: 'GET' }, false);
  }

  async fetchUserRank() {
    return this.request(this.endpoints.LEADERBOARD_ME, { method: 'GET' }, true);
  }

  async fetchCareerStats() {
    return this.request(this.endpoints.GAME_STATS_ME, { method: 'GET' }, true);
  }

  async fetchAchievements() {
    const requiresAuth = this.isAuthenticated();
    return this.request(this.endpoints.ACHIEVEMENTS, { method: 'GET' }, requiresAuth);
  }

  async checkHealth() {
    return this.request(this.endpoints.HEALTH, { method: 'GET' }, false);
  }
}

export const ApiClient = new ApiClientClass();
