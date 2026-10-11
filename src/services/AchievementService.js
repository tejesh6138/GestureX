/**
 * AI Gesture Runner 3D - AchievementService
 * Tracks and persists unlocked achievements and emits unlock notifications.
 */

import { Storage } from './StorageService.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';
import { Sound } from './SoundService.js';

export const ACHIEVEMENTS_LIST = [
  { id: 'GESTURE_VIRTUOSO', title: 'Hands of Cyberpunk', desc: 'Complete gesture calibration and tutorial', icon: '🖐️' },
  { id: 'FIRST_RUN', title: 'First Steps', desc: 'Complete your first endless run', icon: '🚀' },
  { id: 'BRONZE_RUNNER', title: 'Cyber Commuter', desc: 'Travel 500 meters in a single run', icon: '⚡' },
  { id: 'SILVER_RUNNER', title: 'Neon Sprinter', desc: 'Travel 1,500 meters in a single run', icon: '🏆' },
  { id: 'GOLD_RUNNER', title: 'Quantum Strider', desc: 'Travel 3,000 meters in a single run', icon: '👑' },
  { id: 'COIN_ROOKIE', title: 'Pocket Change', desc: 'Collect 50 coins total', icon: '🪙' },
  { id: 'COIN_FEVER', title: 'Gold Rush', desc: 'Collect 50 coins in a single run', icon: '💰' },
  { id: 'COIN_MASTER', title: 'Bit Tycoon', desc: 'Collect 250 coins total', icon: '💎' },
  { id: 'SHIELD_HERO', title: 'Invulnerable', desc: 'Absorb an obstacle collision using a Shield', icon: '🛡️' }
];

export class AchievementService {
  constructor() {
    this.unlocked = new Set(Storage.getItem('UNLOCKED_ACHIEVEMENTS', []));
  }

  isUnlocked(id) {
    return this.unlocked.has(id);
  }

  getAllAchievements() {
    return ACHIEVEMENTS_LIST.map((ach) => ({
      ...ach,
      isUnlocked: this.unlocked.has(ach.id)
    }));
  }

  unlock(id) {
    if (this.unlocked.has(id)) return null;
    const ach = ACHIEVEMENTS_LIST.find((a) => a.id === id);
    if (!ach) return null;

    this.unlocked.add(id);
    Storage.setItem('UNLOCKED_ACHIEVEMENTS', Array.from(this.unlocked));

    Sound.playAchievement();
    GlobalEvents.emit(EVENTS.ACHIEVEMENT_UNLOCKED, ach);
    return ach;
  }

  checkRunAchievements(runResult, totalCoins, singleRunCoins = 0) {
    const newlyUnlocked = [];
    const testAndUnlock = (id, condition) => {
      if (condition && !this.isUnlocked(id)) {
        const ach = this.unlock(id);
        if (ach) newlyUnlocked.push(ach);
      }
    };

    testAndUnlock('FIRST_RUN', true);
    testAndUnlock('BRONZE_RUNNER', runResult.distanceTravelled >= 500);
    testAndUnlock('SILVER_RUNNER', runResult.distanceTravelled >= 1500);
    testAndUnlock('GOLD_RUNNER', runResult.distanceTravelled >= 3000);
    testAndUnlock('COIN_ROOKIE', totalCoins >= 50);
    testAndUnlock('COIN_FEVER', (runResult.coinsCollected || singleRunCoins) >= 50);
    testAndUnlock('COIN_MASTER', totalCoins >= 250);

    return newlyUnlocked;
  }
}

export const Achievements = new AchievementService();
