/**
 * AI Gesture Runner 3D - ScoreService
 * Manages run persistence, personal bests, coin totals, history, and leaderboard interfaces.
 * Provides strict user-scoped isolation for authenticated accounts and separate guest mode storage.
 */

import { Storage } from './StorageService.js';
import { ApiClient } from './ApiClient.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';

export class ScoreService {
  constructor() {
    this.activeUserId = null;
    this.submittedRunIds = new Set();
    this.lastSubmitPromise = null;

    // Check if an authenticated user profile already exists
    const storedUser = Storage.getItem('CURRENT_USER_PROFILE', null);
    if (storedUser && (storedUser.id || storedUser.username) && ApiClient.isAuthenticated()) {
      this.initUserState(storedUser);
    } else {
      this.initGuestState();
    }

    // Subscribe to auth state transitions
    if (typeof GlobalEvents !== 'undefined' && GlobalEvents.on) {
      GlobalEvents.on(EVENTS.AUTH_STATE_CHANGED, ({ isAuthenticated, user }) => {
        if (isAuthenticated && user) {
          this.setActiveUser(user);
        } else {
          this.setActiveUser(null);
        }
      });
    }
  }

  getStorageKey(key) {
    if (this.activeUserId) {
      return `AGR3D_V1_USER_${this.activeUserId}_${key}`;
    }
    return `AGR3D_V1_GUEST_${key}`;
  }

  initGuestState() {
    this.activeUserId = null;
    const defaultPB = {
      score: 0,
      coinsCollected: 0,
      distanceTravelled: 0,
      durationSeconds: 0,
      highestSpeed: 0,
      difficulty: 'MEDIUM',
      completedAt: null,
      isCloudConfirmed: false
    };

    // Load guest state, falling back to legacy keys for compatibility
    this.personalBest = Storage.getItem('AGR3D_V1_GUEST_PB', null)
      || Storage.getItem('PERSONAL_BEST', defaultPB);

    this.runHistory = Storage.getItem('AGR3D_V1_GUEST_HISTORY', null)
      || Storage.getItem('RUN_HISTORY', []);

    this.totalCoins = Storage.getItem('AGR3D_V1_GUEST_TOTAL_COINS', null)
      ?? Storage.getItem('TOTAL_COINS', 0);

    this.highestRunCoins = Storage.getItem('AGR3D_V1_GUEST_HIGHEST_RUN_COINS', null)
      ?? Storage.getItem('HIGHEST_RUN_COINS', 0);

    this.gamesPlayed = Storage.getItem('AGR3D_V1_GUEST_GAMES_PLAYED', null)
      ?? Storage.getItem('GAMES_PLAYED', 0);
  }

  initUserState(user) {
    this.activeUserId = user.id || user.username;
    const defaultPB = {
      score: 0,
      coinsCollected: 0,
      distanceTravelled: 0,
      durationSeconds: 0,
      highestSpeed: 0,
      difficulty: 'MEDIUM',
      completedAt: null,
      isCloudConfirmed: false
    };

    // Load user's isolated local cache
    this.personalBest = Storage.getItem(this.getStorageKey('PB'), defaultPB);
    this.runHistory = Storage.getItem(this.getStorageKey('HISTORY'), []);
    this.totalCoins = Storage.getItem(this.getStorageKey('TOTAL_COINS'), 0);
    this.highestRunCoins = Storage.getItem(this.getStorageKey('HIGHEST_RUN_COINS'), 0);
    this.gamesPlayed = Storage.getItem(this.getStorageKey('GAMES_PLAYED'), 0);

    // Synchronize authoritative cloud stats from Neon PostgreSQL
    this.syncCloudCareerStats().catch(() => {});
  }

  setActiveUser(user) {
    if (user) {
      this.initUserState(user);
    } else {
      this.initGuestState();
    }
    if (typeof GlobalEvents !== 'undefined' && GlobalEvents.emit) {
      GlobalEvents.emit('PERSONAL_BEST_UPDATED', this.getPersonalBest());
    }
  }

  async syncCloudCareerStats() {
    if (!ApiClient.isAuthenticated()) return null;
    try {
      const res = await ApiClient.fetchCareerStats();
      if (res.ok && res.data && this.activeUserId) {
        const d = res.data;
        this.personalBest = {
          score: d.highest_score || 0,
          distanceTravelled: Math.floor(d.best_distance || 0),
          coinsCollected: d.best_run_coins || 0,
          difficulty: d.best_run_difficulty || (d.best_run ? d.best_run.difficulty : 'MEDIUM'),
          durationSeconds: d.best_run ? Math.floor(d.best_run.duration_seconds || 0) : 0,
          highestSpeed: this.personalBest?.highestSpeed || 0,
          completedAt: d.best_run ? d.best_run.created_at : null,
          isCloudConfirmed: true
        };
        this.totalCoins = d.total_coins || 0;
        this.highestRunCoins = d.best_coins_single_run || (d.best_run_coins || 0);
        this.gamesPlayed = d.total_runs || 0;

        // Persist confirmed cache
        Storage.setItem(this.getStorageKey('PB'), this.personalBest);
        Storage.setItem(this.getStorageKey('TOTAL_COINS'), this.totalCoins);
        Storage.setItem(this.getStorageKey('HIGHEST_RUN_COINS'), this.highestRunCoins);
        Storage.setItem(this.getStorageKey('GAMES_PLAYED'), this.gamesPlayed);

        if (typeof GlobalEvents !== 'undefined' && GlobalEvents.emit) {
          GlobalEvents.emit('PERSONAL_BEST_UPDATED', this.getPersonalBest());
        }
        return d;
      }
    } catch {}
    return null;
  }

  saveRun(runResult) {
    if (!runResult || typeof runResult.score !== 'number') {
      console.warn('[ScoreService] Invalid run result provided:', runResult);
      return {
        isNewHighScore: false,
        isNewCoinRecord: false,
        personalBest: this.getPersonalBest(),
        highestRunCoins: this.highestRunCoins,
        totalCoins: this.totalCoins,
        runResult: null
      };
    }

    const runId = runResult.run_id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `run_${Date.now()}_${Math.random()}`);
    const completedAt = runResult.completedAt || new Date().toISOString();
    const formattedResult = {
      run_id: runId,
      score: Math.max(0, Math.floor(runResult.score)),
      coinsCollected: Math.max(0, Math.floor(runResult.coinsCollected || 0)),
      distanceTravelled: Math.max(0, Math.floor(runResult.distanceTravelled || 0)),
      durationSeconds: Math.max(0, Math.floor(runResult.durationSeconds || 0)),
      highestSpeed: Number((runResult.highestSpeed || 0).toFixed(1)),
      difficulty: runResult.difficulty || 'MEDIUM',
      completedAt
    };

    // 1. Read previous stored records for this active account
    const prevBestScore = (typeof this.personalBest?.score === 'number' && !isNaN(this.personalBest.score))
      ? this.personalBest.score
      : 0;

    const prevHighestCoins = (typeof this.highestRunCoins === 'number' && !isNaN(this.highestRunCoins))
      ? this.highestRunCoins
      : 0;

    const prevGamesPlayed = this.gamesPlayed || 0;

    // 2. Determine Personal Best Score:
    // Only set isNewHighScore = true if final score strictly exceeds previous record (> prevBestScore),
    // and an actual prior record existed (prevBestScore > 0). First run establishes the initial baseline without false record praise.
    let isNewHighScore = false;
    if (prevBestScore > 0 && formattedResult.score > prevBestScore) {
      isNewHighScore = true;
    }

    // 3. Determine Single-Run Coin Record
    let isNewCoinRecord = false;
    if (prevHighestCoins > 0 && formattedResult.coinsCollected > prevHighestCoins) {
      isNewCoinRecord = true;
    }

    // 4. Update Lifetime Metrics
    this.gamesPlayed = prevGamesPlayed + 1;
    this.totalCoins = (this.totalCoins || 0) + formattedResult.coinsCollected;
    Storage.setItem(this.getStorageKey('GAMES_PLAYED'), this.gamesPlayed);
    Storage.setItem(this.getStorageKey('TOTAL_COINS'), this.totalCoins);

    // 5. Update Highest Single-Run Coin Count
    if (isNewCoinRecord || formattedResult.coinsCollected > this.highestRunCoins || (prevHighestCoins === 0 && formattedResult.coinsCollected > 0)) {
      this.highestRunCoins = Math.max(this.highestRunCoins, formattedResult.coinsCollected);
      Storage.setItem(this.getStorageKey('HIGHEST_RUN_COINS'), this.highestRunCoins);
    }

    // 6. Update Personal Best
    if (isNewHighScore || formattedResult.score > (this.personalBest?.score || 0) || (prevBestScore === 0 && formattedResult.score > 0)) {
      this.personalBest = {
        ...formattedResult,
        highestRunCoins: this.highestRunCoins,
        isCloudConfirmed: false
      };
      Storage.setItem(this.getStorageKey('PB'), this.personalBest);
    }

    // 7. Save to run history
    this.runHistory = this.runHistory || [];
    this.runHistory.unshift(formattedResult);
    if (this.runHistory.length > 25) {
      this.runHistory = this.runHistory.slice(0, 25);
    }
    Storage.setItem(this.getStorageKey('HISTORY'), this.runHistory);

    // Mirror to legacy keys when in guest mode for backward compatibility with old tests
    if (!this.activeUserId) {
      Storage.setItem('PERSONAL_BEST', this.personalBest);
      Storage.setItem('TOTAL_COINS', this.totalCoins);
      Storage.setItem('HIGHEST_RUN_COINS', this.highestRunCoins);
      Storage.setItem('GAMES_PLAYED', this.gamesPlayed);
      Storage.setItem('RUN_HISTORY', this.runHistory);
    }

    // 8. Remote sync with idempotency check
    if (!this.submittedRunIds) this.submittedRunIds = new Set();
    if (this.submittedRunIds.has(runId)) {
      return {
        isNewHighScore,
        isNewCoinRecord,
        personalBest: this.getPersonalBest(),
        highestRunCoins: this.highestRunCoins,
        totalCoins: this.totalCoins,
        runResult: formattedResult
      };
    }

    this.submittedRunIds.add(runId);
    this.lastSubmitPromise = ApiClient.submitScore(formattedResult).then((res) => {
      if (res && res.savedToCloud && res.data) {
        if (res.data.stats) {
          const stats = res.data.stats;
          if (stats.highest_score && stats.highest_score >= (this.personalBest?.score || 0)) {
            this.personalBest.score = stats.highest_score;
          }
          if (typeof stats.best_distance === 'number') {
            this.personalBest.distanceTravelled = Math.floor(stats.best_distance);
          }
          if (typeof stats.best_run_coins === 'number') {
            this.personalBest.coinsCollected = stats.best_run_coins;
          }
          this.totalCoins = stats.total_coins ?? this.totalCoins;
          this.highestRunCoins = stats.best_coins_single_run ?? this.highestRunCoins;
        }
        this.personalBest.isCloudConfirmed = true;
        if (this.activeUserId) {
          Storage.setItem(this.getStorageKey('PB'), this.personalBest);
          Storage.setItem(this.getStorageKey('TOTAL_COINS'), this.totalCoins);
        }
        if (typeof GlobalEvents !== 'undefined' && GlobalEvents.emit) {
          GlobalEvents.emit('PERSONAL_BEST_UPDATED', this.getPersonalBest());
        }
      }
      return res;
    }).catch((err) => ({
      ok: false,
      offline: true,
      error: err?.message || 'Sync error'
    }));

    return {
      isNewHighScore,
      isNewCoinRecord,
      personalBest: this.getPersonalBest(),
      highestRunCoins: this.highestRunCoins,
      totalCoins: this.totalCoins,
      runResult: formattedResult
    };
  }

  getLastSubmitPromise() {
    return this.lastSubmitPromise;
  }

  getPersonalBest() {
    return {
      ...this.personalBest,
      highestRunCoins: this.highestRunCoins
    };
  }

  getRunHistory() {
    return [...(this.runHistory || [])];
  }

  getTotalCoins() {
    return this.totalCoins;
  }

  getHighestRunCoins() {
    return this.highestRunCoins;
  }

  getGamesPlayed() {
    return this.gamesPlayed;
  }

  /**
   * Generates normalized leaderboard records based on real local gameplay history.
   */
  getLocalLeaderboard(sortBy = 'score') {
    if (!this.runHistory || this.runHistory.length === 0) {
      if (this.personalBest && this.personalBest.score > 0) {
        return [{
          rank: 1,
          playerId: 'local-you',
          displayName: 'Player (You)',
          bestScore: this.personalBest.score,
          coinsCollected: this.personalBest.coinsCollected,
          totalCoins: this.totalCoins,
          bestDistance: this.personalBest.distanceTravelled,
          rankingMetric: 'score',
          date: this.personalBest.completedAt || new Date().toISOString()
        }];
      }
      return [];
    }

    // Clone and sort real local runs
    const sorted = [...this.runHistory].sort((a, b) => {
      if (sortBy === 'coins') {
        return b.coinsCollected - a.coinsCollected;
      }
      if (sortBy === 'distance') {
        return b.distanceTravelled - a.distanceTravelled;
      }
      return b.score - a.score; // Default: rank by score
    });

    return sorted.map((run, index) => ({
      rank: index + 1,
      playerId: 'local-you',
      displayName: index === 0 ? 'Player (Best)' : `Run #${sorted.length - index}`,
      bestScore: run.score,
      coinsCollected: run.coinsCollected,
      totalCoins: this.totalCoins,
      bestDistance: run.distanceTravelled,
      durationSeconds: run.durationSeconds,
      rankingMetric: sortBy,
      date: run.completedAt
    }));
  }

  async getGlobalLeaderboard() {
    return ApiClient.fetchLeaderboard(50, 'players');
  }
}

export const Score = new ScoreService();
