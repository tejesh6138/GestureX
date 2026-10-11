/**
 * AI Gesture Runner 3D - DifficultyManager
 * Manages active difficulty modes (EASY, MEDIUM, FAST), progressive speed acceleration,
 * and passes mode configuration to obstacles and track systems.
 */

import { GAME_CONFIG, DIFFICULTY_MODES, DIFFICULTY_CONFIG } from '../core/GameConfig.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';
import { Storage } from '../services/StorageService.js';

export class DifficultyManager {
  constructor(playerController, powerUpManager) {
    this.controller = playerController;
    this.powerUps = powerUpManager;

    const savedMode = Storage.getItem('GAME_DIFFICULTY', DIFFICULTY_MODES.MEDIUM);
    this.currentMode = DIFFICULTY_CONFIG[savedMode] ? savedMode : DIFFICULTY_MODES.MEDIUM;
  }

  setMode(mode) {
    if (DIFFICULTY_CONFIG[mode]) {
      this.currentMode = mode;
      Storage.setItem('GAME_DIFFICULTY', mode);
      if (this.controller) {
        this.controller.speed = this.getConfig().INITIAL_SPEED;
      }
      GlobalEvents.emit('DIFFICULTY_CHANGED', { mode, config: this.getConfig() });
    }
  }

  getMode() {
    return this.currentMode;
  }

  getConfig() {
    return DIFFICULTY_CONFIG[this.currentMode] || DIFFICULTY_CONFIG.MEDIUM;
  }

  update(distance, dt) {
    if (this.controller.isDead) return;

    const cfg = this.getConfig();

    // Progressive speed acceleration over distance based on active difficulty mode
    const speedRange = cfg.MAX_SPEED - cfg.INITIAL_SPEED;
    const accelSpeed = cfg.INITIAL_SPEED + Math.min(
      speedRange,
      distance * cfg.SPEED_PROGRESSION_RATE
    );

    let currentSpeed = accelSpeed;
    if (this.powerUps && this.powerUps.hasBoost()) {
      currentSpeed *= GAME_CONFIG.POWER_UPS.BOOST_MULTIPLIER;
    }

    this.controller.speed = currentSpeed;
    GlobalEvents.emit(EVENTS.SPEED_CHANGED, { speed: currentSpeed });
  }

  reset() {
    const cfg = this.getConfig();
    if (this.controller) {
      this.controller.speed = cfg.INITIAL_SPEED;
    }
  }
}
