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
    this.renderedScoreStr = '';
    this.renderedDistanceStr = '';
    this.renderedSpeedStr = '';
    this.renderedDiffStr = '';
    this.currentGestureBadge = '';
    this.renderedPowerUpsKey = '';
    this.feedbackEls = {};
    this.currentActiveFeedbackId = null;

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
        <div id="hud-gesture-badge" class="gesture-badge">HAND READY</div>
        <div id="hud-tracking-alert" class="hud-tracking-alert hidden">⚠️ OUT OF RANGE</div>
      </div>

      <!-- Live Gesture Feed Indicator in Bottom Left -->
      <div class="hud-gesture-feedback">
        <div class="feedback-icon" id="fb-left">👈 LEFT (INDEX)</div>
        <div class="feedback-icon" id="fb-jump">✌️ JUMP (PEACE)</div>
        <div class="feedback-icon" id="fb-slide">✊ SLIDE (FIST)</div>
        <div class="feedback-icon" id="fb-right">👉 RIGHT (INDEX)</div>
        <div class="feedback-icon" id="fb-pause">✋ PAUSE (PALM)</div>
        <div class="feedback-icon" id="fb-resume"><img src="./icons/gesture-resume.png" class="resume-icon-inline" alt="Resume"> RESUME (3-FINGER)</div>
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
    this.trackingAlert = this.element.querySelector('#hud-tracking-alert');
    this.powerUpBar = this.element.querySelector('#hud-powerups');

    // Cache gesture feedback elements
    this.feedbackEls = {
      'fb-left': this.element.querySelector('#fb-left'),
      'fb-right': this.element.querySelector('#fb-right'),
      'fb-jump': this.element.querySelector('#fb-jump'),
      'fb-slide': this.element.querySelector('#fb-slide'),
      'fb-pause': this.element.querySelector('#fb-pause'),
      'fb-resume': this.element.querySelector('#fb-resume')
    };
  }

  bindEvents() {
    GlobalEvents.on(EVENTS.FLOATING_NOTICE, ({ text }) => {
      this.spawnFloatingNotice(text);
    });

    GlobalEvents.on('DIFFICULTY_CHANGED', ({ mode }) => {
      this.updateDifficulty(mode);
    });

    GlobalEvents.on('GESTURE_OUT_OF_RANGE', ({ isOut }) => {
      this.setOutOfRange(isOut);
    });
  }

  show() {
    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
  }

  updateScore(score) {
    if (!this.scoreVal) return;
    const str = MathUtils.formatNumber(score);
    if (this.renderedScoreStr !== str) {
      this.renderedScoreStr = str;
      this.scoreVal.textContent = str;
    }
  }

  updateDistance(meters) {
    if (!this.distanceVal) return;
    const str = MathUtils.formatDistance(meters);
    if (this.renderedDistanceStr !== str) {
      this.renderedDistanceStr = str;
      this.distanceVal.textContent = str;
    }
  }

  updateCoins(coins) {
    if (!this.coinsVal || this.prevCoins === coins) return;

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
    if (!this.speedVal) return;
    const rounded = speed.toFixed(1);
    if (this.renderedSpeedStr !== rounded) {
      this.renderedSpeedStr = rounded;
      this.speedVal.textContent = `${rounded} m/s`;
    }
  }

  updateDifficulty(mode) {
    if (!this.diffVal) return;
    if (this.renderedDiffStr !== mode) {
      this.renderedDiffStr = mode;
      const iconMap = { EASY: '🌱', MEDIUM: '⚡', FAST: '🔥' };
      this.diffVal.textContent = `${iconMap[mode] || '⚡'} ${mode}`;
    }
  }

  setGestureBadge(gesture) {
    if (this.activeGestureTag && this.currentGestureBadge !== gesture) {
      this.currentGestureBadge = gesture;
      let label = gesture;
      if (gesture === 'PAUSE' || gesture === 'HOLDING_PAUSE') label = '✋ PAUSE';
      else if (gesture === 'RESUME' || gesture === 'HOLDING_RESUME') label = '<img src="./icons/gesture-resume.png" class="resume-icon-inline" alt="Resume"> RESUME';
      else if (gesture === 'SLIDE') label = '✊ SLIDE';
      else if (gesture === 'JUMP') label = '✌️ JUMP';
      else if (gesture === 'MOVE_LEFT') label = '👈 LEFT';
      else if (gesture === 'MOVE_RIGHT') label = '👉 RIGHT';
      else if (gesture === 'NEUTRAL') label = 'HAND DETECTED';

      this.activeGestureTag.innerHTML = label;
      this.activeGestureTag.className = `gesture-badge badge-${gesture.toLowerCase()}`;
    }

    // Flash corresponding gesture feedback icon with cached DOM references
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

    const targetId = iconMap[gesture] || null;
    if (targetId !== this.currentActiveFeedbackId) {
      if (this.currentActiveFeedbackId && this.feedbackEls[this.currentActiveFeedbackId]) {
        this.feedbackEls[this.currentActiveFeedbackId].classList.remove('active');
      }
      if (targetId && this.feedbackEls[targetId]) {
        this.feedbackEls[targetId].classList.add('active');
      }
      this.currentActiveFeedbackId = targetId;
    }
  }

  setOutOfRange(isOut) {
    if (this.trackingAlert) {
      if (isOut) {
        this.trackingAlert.textContent = '⚠️ OUT OF RANGE';
        this.trackingAlert.classList.remove('hidden');
        if (this.activeGestureTag) {
          this.activeGestureTag.textContent = 'OUT OF RANGE';
          this.activeGestureTag.className = 'gesture-badge badge-lost';
        }
      } else {
        this.trackingAlert.classList.add('hidden');
      }
    }
  }

  setTrackingLost(isLost) {
    if (this.trackingAlert) {
      if (isLost) {
        this.trackingAlert.textContent = '⚠️ REPOSITION HAND';
        this.trackingAlert.classList.remove('hidden');
        if (this.activeGestureTag) {
          this.activeGestureTag.textContent = 'TRACKING LOST';
          this.activeGestureTag.className = 'gesture-badge badge-lost';
        }
      } else {
        this.trackingAlert.classList.add('hidden');
      }
    }
  }

  updatePowerUps(powerUps) {
    if (!this.powerUpBar) return;

    const magTime = powerUps.MAGNET > 0 ? powerUps.MAGNET.toFixed(1) : '0';
    const hasShield = powerUps.SHIELD ? '1' : '0';
    const boostTime = powerUps.BOOST > 0 ? powerUps.BOOST.toFixed(1) : '0';
    const key = `${magTime}_${hasShield}_${boostTime}`;

    if (this.renderedPowerUpsKey === key) return;
    this.renderedPowerUpsKey = key;

    if (magTime === '0' && hasShield === '0' && boostTime === '0') {
      this.powerUpBar.innerHTML = '';
      return;
    }

    let html = '';
    if (powerUps.MAGNET > 0) {
      html += `
        <div class="powerup-chip chip-magnet">
          <span>🧲 MAGNET</span>
          <span class="timer">${magTime}s</span>
        </div>
      `;
    }
    if (powerUps.SHIELD) {
      html += `
        <div class="powerup-chip chip-shield">
          <span>🛡️ SHIELD</span>
          <span class="timer">ACTIVE</span>
        </div>
      `;
    }
    if (powerUps.BOOST > 0) {
      html += `
        <div class="powerup-chip chip-boost">
          <span>⚡ BOOST</span>
          <span class="timer">${boostTime}s</span>
        </div>
      `;
    }

    this.powerUpBar.innerHTML = html;
  }

  getPipCanvas() {
    return this.pipCanvas;
  }
}
