/**
 * AI Gesture Runner 3D - ScoreManager
 * Calculates real-time distance, current run coin tally, score metrics, and final run statistics.
 * Maintains strict separation between distance, score, and coin counts.
 */

import { GAME_CONFIG } from '../core/GameConfig.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';
import { Score } from '../services/ScoreService.js';
import { Achievements } from '../services/AchievementService.js';

export class ScoreManager {
  constructor() {
    this.score = 0;
    this.distance = 0;
    this.currentRunCoins = 0; // State 1: Coins collected in current run
    this.highestSpeed = GAME_CONFIG.PLAYER.INITIAL_SPEED;
    this.runStartTime = 0;
    this.isRunActive = false;

    this.bindEvents();
  }

  bindEvents() {
    GlobalEvents.on(EVENTS.COIN_COLLECTED, () => {
      this.currentRunCoins += 1;
      this.score += GAME_CONFIG.SCORING.POINTS_PER_COIN;
      GlobalEvents.emit(EVENTS.SCORE_UPDATED, {
        score: this.score,
        coins: this.currentRunCoins,
        distance: this.distance
      });
    });

    GlobalEvents.on(EVENTS.SPEED_CHANGED, ({ speed }) => {
      if (speed > this.highestSpeed) {
        this.highestSpeed = speed;
      }
    });
  }

  startRun() {
    this.score = 0;
    this.distance = 0;
    this.currentRunCoins = 0;
    this.highestSpeed = GAME_CONFIG.PLAYER.INITIAL_SPEED;
    this.runStartTime = performance.now();
    this.isRunActive = true;

    GlobalEvents.emit(EVENTS.SCORE_UPDATED, {
      score: this.score,
      coins: this.currentRunCoins,
      distance: this.distance
    });
  }

  update(currentDistance) {
    if (!this.isRunActive) return;

    this.distance = currentDistance;
    this.score = this.distance * GAME_CONFIG.SCORING.POINTS_PER_METER +
                 this.currentRunCoins * GAME_CONFIG.SCORING.POINTS_PER_COIN;

    GlobalEvents.emit(EVENTS.DISTANCE_UPDATED, { distance: this.distance });
    GlobalEvents.emit(EVENTS.SCORE_UPDATED, {
      score: this.score,
      coins: this.currentRunCoins,
      distance: this.distance
    });
  }

  finalizeRun(difficulty = 'MEDIUM') {
    // Save the completed run exactly once
    if (!this.isRunActive) return null;
    this.isRunActive = false;

    const durationSeconds = Math.max(1, (performance.now() - this.runStartTime) / 1000);
    const runResult = {
      score: Math.floor(this.score),
      coinsCollected: this.currentRunCoins,
      distanceTravelled: Math.floor(this.distance),
      durationSeconds: Math.floor(durationSeconds),
      highestSpeed: Number(this.highestSpeed.toFixed(1)),
      difficulty,
      completedAt: new Date().toISOString()
    };

    // Save run to persistent storage abstraction
    const saved = Score.saveRun(runResult);

    // Check newly unlocked achievements for this run
    const newlyUnlocked = Achievements.checkRunAchievements(
      runResult,
      saved.totalCoins,
      saved.highestRunCoins
    );

    return {
      runResult,
      isNewHighScore: saved.isNewHighScore,
      isNewCoinRecord: saved.isNewCoinRecord,
      personalBest: saved.personalBest,
      highestRunCoins: saved.highestRunCoins,
      totalCoins: saved.totalCoins,
      newlyUnlockedAchievements: newlyUnlocked
    };
  }

  getCoins() {
    return this.currentRunCoins;
  }

  getScore() {
    return this.score;
  }

  getDistance() {
    return this.distance;
  }

  reset() {
    this.score = 0;
    this.distance = 0;
    this.currentRunCoins = 0;
    this.highestSpeed = GAME_CONFIG.PLAYER.INITIAL_SPEED;
    this.isRunActive = false;
  }
}
