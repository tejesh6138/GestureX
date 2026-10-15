/**
 * AI Gesture Runner 3D - ScoreManager
 * Calculates real-time distance, current run coin tally, score metrics, and final run statistics.
 * Maintains strict separation between distance, score, and coin counts.
 */

import { GAME_CONFIG } from '../core/GameConfig.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';
import { Score } from '../services/ScoreService.js';
import { Achievements } from '../services/AchievementService.js';

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

export class ScoreManager {
  constructor() {
    this.score = 0;
    this.distance = 0;
    this.currentRunCoins = 0; // State 1: Coins collected in current run
    this.highestSpeed = GAME_CONFIG.PLAYER.INITIAL_SPEED;
    this.runStartTime = 0;
    this.isRunActive = false;

    this.lastEmittedScoreFloor = -1;
    this.lastEmittedDistanceFloor = -1;
    this.lastEmitTime = 0;

    this.bindEvents();
  }

  bindEvents() {
    GlobalEvents.on(EVENTS.COIN_COLLECTED, () => {
      this.currentRunCoins += 1;
      this.score += GAME_CONFIG.SCORING.POINTS_PER_COIN;
      this.lastEmittedScoreFloor = Math.floor(this.score);
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
    this.lastEmittedScoreFloor = 0;
    this.lastEmittedDistanceFloor = 0;
    this.lastEmitTime = performance.now();

    GlobalEvents.emit(EVENTS.SCORE_UPDATED, {
      score: this.score,
      coins: this.currentRunCoins,
      distance: this.distance
    });
    GlobalEvents.emit(EVENTS.DISTANCE_UPDATED, { distance: this.distance });
  }

  update(currentDistance) {
    if (!this.isRunActive) return;

    this.distance = currentDistance;
    this.score = this.distance * GAME_CONFIG.SCORING.POINTS_PER_METER +
                 this.currentRunCoins * GAME_CONFIG.SCORING.POINTS_PER_COIN;

    const distFloor = Math.floor(this.distance);
    const scoreFloor = Math.floor(this.score);
    const now = performance.now();

    const distChanged = distFloor !== this.lastEmittedDistanceFloor;
    const scoreChanged = scoreFloor !== this.lastEmittedScoreFloor;
    const timeToEmit = (now - this.lastEmitTime) > 80;

    if (distChanged) {
      this.lastEmittedDistanceFloor = distFloor;
      GlobalEvents.emit(EVENTS.DISTANCE_UPDATED, { distance: this.distance });
    }

    if (scoreChanged || timeToEmit) {
      this.lastEmittedScoreFloor = scoreFloor;
      this.lastEmitTime = now;
      GlobalEvents.emit(EVENTS.SCORE_UPDATED, {
        score: this.score,
        coins: this.currentRunCoins,
        distance: this.distance
      });
    }
  }

  finalizeRun(difficulty = 'MEDIUM') {
    // Save the completed run exactly once
    if (!this.isRunActive) return null;
    this.isRunActive = false;

    const durationSeconds = Math.max(1, (performance.now() - this.runStartTime) / 1000);
    const runResult = {
      run_id: generateUUID(),
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
    this.lastEmittedScoreFloor = -1;
    this.lastEmittedDistanceFloor = -1;
    this.lastEmitTime = 0;
  }
}
