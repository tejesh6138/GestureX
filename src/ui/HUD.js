/**
 * AI Gesture Runner 3D - HUD
 * In-game heads-up display with live score, distance, coin counter, speed,
 * difficulty mode badge, points-only holographic skeleton PIP preview,
 * power-up timers, and gesture feedback indicators.
 */

import { MathUtils } from '../utils/MathUtils.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';

export class HUD {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.scoreVal = null;
    this.distanceVal = null;
    this.coinsVal = null;
    this.coinsContainer = null;
    this.speedVal = null;
    this.diffVal = null;
    this.pipCanvas = null;
    this.activeGestureTag = null;
    this.trackingLossBanner = null;
    this.powerUpBar = null;
    this.floatingContainer = null;
    this.prevCoins = 0;

    this.build();
    this.bindEvents();
  }

  build() {
    this.element = document.createElement('div');
    this.element.id = 'hud';
    this.element.className = 'hud-container hidden';

    this.element.innerHTML = `
      <!-- Top HUD Stats -->
      <div class="hud-top">
        <div class="stat-card score-card">
          <span class="stat-label">SCORE</span>
          <span id="hud-score" class="stat-value">0</span>
        </div>

        <div class="stat-card distance-card">
          <span class="stat-label">DISTANCE</span>
          <span id="hud-distance" class="stat-value">0 m</span>
        </div>

        <div class="stat-card coins-card" id="hud-coins-card">
          <span class="stat-label">COINS</span>
          <span class="stat-value-coin">
            <span class="coin-icon">🪙</span>
            <span id="hud-coins">0</span>
          </span>
          <div id="hud-coin-floating-container" class="coin-floating-container"></div>
        </div>

        <div class="stat-card speed-card">
          <span class="stat-label">SPEED</span>
          <span id="hud-speed" class="stat-value">22.0 m/s</span>
        </div>

        <div class="stat-card mode-card">
          <span class="stat-label">MODE</span>
          <span id="hud-difficulty" class="stat-value highlight">⚡ MEDIUM</span>
        </div>
      </div>

      <!-- Active Power-Up Timers Bar -->
      <div id="hud-powerups" class="hud-powerups"></div>

      <!-- Top-Right Points-Only Holographic Skeleton Display -->
      <div class="hud-pip-wrapper">
        <canvas id="pip-canvas" width="160" height="120" class="pip-canvas"></canvas>
        <div id="hud-gesture-badge" class="gesture-badge">NEUTRAL</div>
      </div>

      <!-- Tracking Lost Warning Alert -->
      <div id="tracking-loss-banner" class="tracking-loss-banner hidden">
        ⚠️ HAND OUT OF VIEW — REPOSITION HAND TO RESUME
      </div>

      <!-- Live Gesture Feed Indicator in Bottom Left -->
      <div class="hud-gesture-feedback">
        <div class="feedback-icon" id="fb-left">👈 LEFT (INDEX)</div>
        <div class="feedback-icon" id="fb-jump">✌️ JUMP (PEACE)</div>
        <div class="feedback-icon" id="fb-slide">✊ SLIDE (FIST)</div>
        <div class="feedback-icon" id="fb-right">👉 RIGHT (INDEX)</div>
        <div class="feedback-icon" id="fb-pause">✋ PAUSE (PALM)</div>
        <div class="feedback-icon" id="fb-resume">🤟 RESUME (3-FINGER)</div>
      </div>
    `;

    this.container.appendChild(this.element);

    this.scoreVal = this.element.querySelector('#hud-score');
    this.distanceVal = this.element.querySelector('#hud-distance');
    this.coinsVal = this.element.querySelector('#hud-coins');
    this.coinsContainer = this.element.querySelector('#hud-coins-card');
    this.floatingContainer = this.element.querySelector('#hud-coin-floating-container');
    this.speedVal = this.element.querySelector('#hud-speed');
    this.diffVal = this.element.querySelector('#hud-difficulty');
    this.pipCanvas = this.element.querySelector('#pip-canvas');
    this.activeGestureTag = this.element.querySelector('#hud-gesture-badge');
    this.trackingLossBanner = this.element.querySelector('#tracking-loss-banner');
    this.powerUpBar = this.element.querySelector('#hud-powerups');
  }

  bindEvents() {
    GlobalEvents.on(EVENTS.FLOATING_NOTICE, ({ text }) => {
      this.spawnFloatingNotice(text);
    });

    GlobalEvents.on('DIFFICULTY_CHANGED', ({ mode }) => {
      this.updateDifficulty(mode);
    });
  }

  show() {
    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
  }

  updateScore(score) {
    if (this.scoreVal) {
      this.scoreVal.textContent = MathUtils.formatNumber(score);
    }
  }

  updateDistance(meters) {
    if (this.distanceVal) {
      this.distanceVal.textContent = MathUtils.formatDistance(meters);
    }
  }

  updateCoins(coins) {
    if (!this.coinsVal) return;

    if (coins > this.prevCoins) {
      this.coinsVal.classList.remove('coin-pop');
      void this.coinsVal.offsetWidth;
      this.coinsVal.classList.add('coin-pop');
    }

    this.prevCoins = coins;
    this.coinsVal.textContent = MathUtils.formatNumber(coins);
  }

  spawnFloatingNotice(text = '+1') {
    if (!this.floatingContainer) return;

    const floatEl = document.createElement('div');
    floatEl.className = 'floating-coin-item';
    floatEl.textContent = text;
    this.floatingContainer.appendChild(floatEl);

    setTimeout(() => {
      if (floatEl.parentNode) {
        floatEl.parentNode.removeChild(floatEl);
      }
    }, 700);
  }

  updateSpeed(speed) {
    if (this.speedVal) {
      this.speedVal.textContent = `${speed.toFixed(1)} m/s`;
    }
  }

  updateDifficulty(mode) {
    if (this.diffVal) {
      const iconMap = { EASY: '🌱', MEDIUM: '⚡', FAST: '🔥' };
      this.diffVal.textContent = `${iconMap[mode] || '⚡'} ${mode}`;
    }
  }

  setGestureBadge(gesture) {
    if (this.activeGestureTag) {
      let label = gesture;
      if (gesture === 'PAUSE' || gesture === 'HOLDING_PAUSE') label = '✋ PAUSE';
      else if (gesture === 'RESUME' || gesture === 'HOLDING_RESUME') label = '🤟 RESUME';
      else if (gesture === 'SLIDE') label = '✊ SLIDE';
      else if (gesture === 'JUMP') label = '✌️ JUMP';
      else if (gesture === 'MOVE_LEFT') label = '👈 LEFT';
      else if (gesture === 'MOVE_RIGHT') label = '👉 RIGHT';
      else if (gesture === 'NEUTRAL') label = 'HAND DETECTED';

      this.activeGestureTag.textContent = label;
      this.activeGestureTag.className = `gesture-badge badge-${gesture.toLowerCase()}`;
    }

    // Flash corresponding gesture feedback icon
    const iconMap = {
      'MOVE_LEFT': 'fb-left',
      'MOVE_RIGHT': 'fb-right',
      'JUMP': 'fb-jump',
      'SLIDE': 'fb-slide',
      'PAUSE': 'fb-pause',
      'HOLDING_PAUSE': 'fb-pause',
      'RESUME': 'fb-resume',
      'HOLDING_RESUME': 'fb-resume'
    };

    ['fb-left', 'fb-right', 'fb-jump', 'fb-slide', 'fb-pause', 'fb-resume'].forEach((id) => {
      const el = this.element.querySelector(`#${id}`);
      if (el) el.classList.remove('active');
    });

    const activeId = iconMap[gesture];
    if (activeId) {
      const activeEl = this.element.querySelector(`#${activeId}`);
      if (activeEl) activeEl.classList.add('active');
    }
  }

  setTrackingLost(isLost) {
    if (this.trackingLossBanner) {
      if (isLost) {
        this.trackingLossBanner.classList.remove('hidden');
        if (this.activeGestureTag) {
          this.activeGestureTag.textContent = 'TRACKING LOST';
          this.activeGestureTag.className = 'gesture-badge badge-lost';
        }
      } else {
        this.trackingLossBanner.classList.add('hidden');
      }
    }
  }

  updatePowerUps(powerUps) {
    if (!this.powerUpBar) return;
    this.powerUpBar.innerHTML = '';

    if (powerUps.MAGNET > 0) {
      this.powerUpBar.innerHTML += `
        <div class="powerup-chip chip-magnet">
          <span>🧲 MAGNET</span>
          <span class="timer">${powerUps.MAGNET.toFixed(1)}s</span>
        </div>
      `;
    }
    if (powerUps.SHIELD) {
      this.powerUpBar.innerHTML += `
        <div class="powerup-chip chip-shield">
          <span>🛡️ SHIELD</span>
          <span class="timer">ACTIVE</span>
        </div>
      `;
    }
    if (powerUps.BOOST > 0) {
      this.powerUpBar.innerHTML += `
        <div class="powerup-chip chip-boost">
          <span>⚡ BOOST</span>
          <span class="timer">${powerUps.BOOST.toFixed(1)}s</span>
        </div>
      `;
    }
  }

  getPipCanvas() {
    return this.pipCanvas;
  }
}
