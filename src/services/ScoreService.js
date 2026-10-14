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
      score: Math.max(0, Math.floor(runResult.score)),
      coinsCollected: Math.max(0, Math.floor(runResult.coinsCollected || 0)),
      distanceTravelled: Math.max(0, Math.floor(runResult.distanceTravelled || 0)),
      durationSeconds: Math.max(0, Math.floor(runResult.durationSeconds || 0)),
      highestSpeed: Number((runResult.highestSpeed || 0).toFixed(1)),
      difficulty: runResult.difficulty || 'MEDIUM',
      completedAt
    };

    // 1. Read previous stored records BEFORE updating any stored state
    const prevStoredPB = Storage.getItem('PERSONAL_BEST', null);
    const prevBestScore = (prevStoredPB && typeof prevStoredPB.score === 'number' && !isNaN(prevStoredPB.score))
      ? prevStoredPB.score
      : (typeof this.personalBest?.score === 'number' && !isNaN(this.personalBest.score) ? this.personalBest.score : 0);

    const prevStoredCoins = Storage.getItem('HIGHEST_RUN_COINS', null);
    const prevHighestCoins = (typeof prevStoredCoins === 'number' && !isNaN(prevStoredCoins))
      ? prevStoredCoins
      : (typeof this.highestRunCoins === 'number' && !isNaN(this.highestRunCoins) ? this.highestRunCoins : 0);

    const prevGamesPlayed = Storage.getItem('GAMES_PLAYED', 0) || this.gamesPlayed || 0;

    // 2. Determine Personal Best Score:
    // Only set isNewHighScore = true if final score is strictly greater than previous record (> prevBestScore),
    // and an actual prior record existed (prevBestScore > 0). First run establishes the initial baseline without false record praise.
    let isNewHighScore = false;
    if (prevBestScore > 0 && formattedResult.score > prevBestScore) {
      isNewHighScore = true;
    }

    // 3. Determine Single-Run Coin Record:
    // Only set isNewCoinRecord = true if coins collected is strictly greater than previous record (> prevHighestCoins),
    // and an actual prior coin record existed (prevHighestCoins > 0).
    let isNewCoinRecord = false;
    if (prevHighestCoins > 0 && formattedResult.coinsCollected > prevHighestCoins) {
      isNewCoinRecord = true;
    }

    // 4. Update Lifetime Metrics
    this.gamesPlayed = prevGamesPlayed + 1;
    this.totalCoins = (Storage.getItem('TOTAL_COINS', 0) || this.totalCoins || 0) + formattedResult.coinsCollected;
    Storage.setItem('GAMES_PLAYED', this.gamesPlayed);
    Storage.setItem('TOTAL_COINS', this.totalCoins);

    // 5. Update Highest Single-Run Coin Count (update if new record OR first run establishing baseline > 0)
    if (isNewCoinRecord || formattedResult.coinsCollected > this.highestRunCoins || (prevHighestCoins === 0 && formattedResult.coinsCollected > 0)) {
      this.highestRunCoins = Math.max(this.highestRunCoins, formattedResult.coinsCollected);
      Storage.setItem('HIGHEST_RUN_COINS', this.highestRunCoins);
    }

    // 6. Update Personal Best (update if new record OR first run establishing baseline > 0)
    if (isNewHighScore || formattedResult.score > (this.personalBest?.score || 0) || (prevBestScore === 0 && formattedResult.score > 0)) {
      this.personalBest = {
        ...formattedResult,
        highestRunCoins: this.highestRunCoins
      };
      Storage.setItem('PERSONAL_BEST', this.personalBest);
    }

    // 7. Save to run history
    this.runHistory = Storage.getItem('RUN_HISTORY', []) || [];
    this.runHistory.unshift(formattedResult);
    if (this.runHistory.length > 25) {
      this.runHistory = this.runHistory.slice(0, 25);
    }
    Storage.setItem('RUN_HISTORY', this.runHistory);

    // 8. Attempt remote sync if DRF backend is configured
    this.lastSubmitPromise = ApiClient.submitScore(formattedResult).catch((err) => ({
      ok: false,
      offline: true,
      error: err?.message || 'Sync error'
    }));

    return {
      isNewHighScore,
      isNewCoinRecord,
      personalBest: this.personalBest,
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
