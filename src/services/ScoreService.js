/**
 * AI Gesture Runner 3D - ScoreService
 * Manages run persistence, personal bests, coin totals, history, and leaderboard interfaces.
 * Designed with clean normalized structures for future Django REST Framework + PostgreSQL integration.
 */

import { Storage } from './StorageService.js';
import { ApiClient } from './ApiClient.js';

export class ScoreService {
  constructor() {
    this.personalBest = Storage.getItem('PERSONAL_BEST', {
      score: 0,
      coinsCollected: 0,
      distanceTravelled: 0,
      durationSeconds: 0,
      highestSpeed: 0,
      completedAt: null
    });

    this.runHistory = Storage.getItem('RUN_HISTORY', []);
    this.totalCoins = Storage.getItem('TOTAL_COINS', 0);
    this.highestRunCoins = Storage.getItem('HIGHEST_RUN_COINS', 0);
    this.gamesPlayed = Storage.getItem('GAMES_PLAYED', 0);
  }

  saveRun(runResult) {
    if (!runResult || typeof runResult.score !== 'number') {
      console.warn('[ScoreService] Invalid run result provided:', runResult);
      return {
        isNewHighScore: false,
        isNewCoinRecord: false,
        personalBest: this.personalBest,
        highestRunCoins: this.highestRunCoins,
        totalCoins: this.totalCoins,
        runResult: null
      };
    }

    const completedAt = runResult.completedAt || new Date().toISOString();
    const formattedResult = {
      score: Math.floor(runResult.score),
      coinsCollected: Math.floor(runResult.coinsCollected || 0),
      distanceTravelled: Math.floor(runResult.distanceTravelled || 0),
      durationSeconds: Math.floor(runResult.durationSeconds || 0),
      highestSpeed: Number((runResult.highestSpeed || 0).toFixed(1)),
      difficulty: runResult.difficulty || 'MEDIUM',
      completedAt
    };

    // 1. Update aggregate lifetime metrics
    this.gamesPlayed += 1;
    this.totalCoins += formattedResult.coinsCollected;
    Storage.setItem('GAMES_PLAYED', this.gamesPlayed);
    Storage.setItem('TOTAL_COINS', this.totalCoins);

    // 2. Check Highest Single-Run Coin Record
    let isNewCoinRecord = false;
    if (formattedResult.coinsCollected > this.highestRunCoins) {
      this.highestRunCoins = formattedResult.coinsCollected;
      Storage.setItem('HIGHEST_RUN_COINS', this.highestRunCoins);
      isNewCoinRecord = true;
    }

    // 3. Save to run history (keep last 20 runs for local leaderboard)
    this.runHistory.unshift(formattedResult);
    if (this.runHistory.length > 25) {
      this.runHistory = this.runHistory.slice(0, 25);
    }
    Storage.setItem('RUN_HISTORY', this.runHistory);

    // 4. Check Personal Best Score
    let isNewHighScore = false;
    if (formattedResult.score > (this.personalBest.score || 0)) {
      this.personalBest = {
        ...formattedResult,
        highestRunCoins: this.highestRunCoins
      };
      Storage.setItem('PERSONAL_BEST', this.personalBest);
      isNewHighScore = true;
    }

    // 5. Attempt remote sync if DRF cloud backend is configured
    ApiClient.submitScore(formattedResult).catch(() => {
      // Graceful offline fallback
    });

    return {
      isNewHighScore,
      isNewCoinRecord,
      personalBest: this.personalBest,
      highestRunCoins: this.highestRunCoins,
      totalCoins: this.totalCoins,
      runResult: formattedResult
    };
  }

  getPersonalBest() {
    return {
      ...this.personalBest,
      highestRunCoins: this.highestRunCoins
    };
  }

  getRunHistory() {
    return [...this.runHistory];
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
   * Format matches future Django REST Framework serializer response:
   * [ { rank, playerId, displayName, bestScore, coinsCollected, totalCoins, bestDistance, rankingMetric, date } ]
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
    return ApiClient.fetchLeaderboard();
  }
}

export const Score = new ScoreService();
