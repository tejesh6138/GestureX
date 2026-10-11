/**
 * AI Gesture Runner 3D - GameOverScreen
 * Game Over summary screen featuring complete run metrics:
 * Final score, run coins, distance, duration, personal best score,
 * highest single-run coin count, lifetime coins, and newly unlocked achievements.
 */

import { Sound } from '../services/SoundService.js';
import { MathUtils } from '../utils/MathUtils.js';

export class GameOverScreen {
  constructor(container, onAction) {
    this.container = container;
    this.onAction = onAction;
    this.element = null;

    this.build();
  }

  build() {
    this.element = document.createElement('div');
    this.element.id = 'game-over-screen';
    this.element.className = 'screen-overlay hidden';

    this.element.innerHTML = `
      <div class="game-over-content glass-card">
        <!-- New Record Celebrations -->
        <div id="new-high-score-banner" class="high-score-banner hidden">
          ⭐ NEW PERSONAL BEST SCORE! ⭐
        </div>
        <div id="new-coin-record-banner" class="coin-record-banner hidden">
          🪙 NEW SINGLE-RUN COIN RECORD! 🪙
        </div>

        <h2 class="game-over-title">RUN <span class="neon-danger">COMPLETED</span></h2>

        <!-- Main Run Metrics Grid -->
        <div class="results-grid">
          <div class="result-box main-highlight">
            <span class="res-label">FINAL SCORE</span>
            <span id="res-score" class="res-val highlight">0</span>
          </div>

          <div class="result-box coin-highlight">
            <span class="res-label">RUN COINS</span>
            <span class="res-val-coins">
              <span class="res-coin-icon">🪙</span>
              <span id="res-coins">0</span>
            </span>
          </div>

          <div class="result-box">
            <span class="res-label">DISTANCE</span>
            <span id="res-distance" class="res-val">0 m</span>
          </div>

          <div class="result-box">
            <span class="res-label">RUN DURATION</span>
            <span id="res-duration" class="res-val">0:00</span>
          </div>

          <div class="result-box">
            <span class="res-label">PERSONAL BEST SCORE</span>
            <span id="res-pb-score" class="res-val">0</span>
          </div>

          <div class="result-box">
            <span class="res-label">HIGHEST RUN COINS</span>
            <span class="res-val-coins">
              <span class="res-coin-icon">🪙</span>
              <span id="res-highest-coins">0</span>
            </span>
          </div>

          <div class="result-box">
            <span class="res-label">LIFETIME COINS</span>
            <span class="res-val-coins">
              <span class="res-coin-icon">🪙</span>
              <span id="res-lifetime-coins">0</span>
            </span>
          </div>

          <div class="result-box">
            <span class="res-label">TOP SPEED</span>
            <span id="res-speed" class="res-val">0.0 m/s</span>
          </div>

          <div class="result-box diff-highlight">
            <span class="res-label">DIFFICULTY</span>
            <span id="res-difficulty" class="res-val highlight">⚡ MEDIUM</span>
          </div>
        </div>

        <!-- Newly Unlocked Achievements in this Run -->
        <div id="unlocked-achievements-box" class="unlocked-achievements-box hidden">
          <h4 class="ach-unlock-title">✨ NEW ACHIEVEMENTS UNLOCKED!</h4>
          <div id="unlocked-achievements-list" class="unlocked-ach-list"></div>
        </div>

        <!-- Compact Action Buttons (Single Screen, No Scroll) -->
        <div class="game-over-actions">
          <button id="btn-over-retry" class="btn btn-primary btn-glow">
            ▶ PLAY AGAIN
          </button>
          <button id="btn-over-menu" class="btn btn-secondary">
            🏠 MAIN MENU
          </button>
          <button id="btn-over-achievements" class="btn btn-secondary">
            🏆 VIEW ACHIEVEMENTS
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);
    this.bindEvents();
  }

  bindEvents() {
    this.element.querySelector('#btn-over-retry').onclick = () => {
      Sound.playClick();
      this.onAction('RETRY');
    };

    this.element.querySelector('#btn-over-achievements').onclick = () => {
      Sound.playClick();
      this.onAction('RESULTS');
    };

    this.element.querySelector('#btn-over-menu').onclick = () => {
      Sound.playClick();
      this.onAction('MENU');
    };
  }

  show(runSummary) {
    if (!runSummary) return;

    const {
      runResult,
      isNewHighScore,
      isNewCoinRecord,
      personalBest,
      highestRunCoins,
      totalCoins,
      newlyUnlockedAchievements
    } = runSummary;

    // 1. Fill actual values from run
    this.animateNumber('#res-score', runResult.score);
    this.animateNumber('#res-coins', runResult.coinsCollected);
    this.element.querySelector('#res-distance').textContent = MathUtils.formatDistance(runResult.distanceTravelled);
    this.element.querySelector('#res-duration').textContent = MathUtils.formatTime(runResult.durationSeconds);
    this.element.querySelector('#res-speed').textContent = `${runResult.highestSpeed.toFixed(1)} m/s`;

    const diffEl = this.element.querySelector('#res-difficulty');
    if (diffEl) {
      const mode = runResult.difficulty || 'MEDIUM';
      const iconMap = { EASY: '🌱', MEDIUM: '⚡', FAST: '🔥' };
      diffEl.textContent = `${iconMap[mode] || '⚡'} ${mode}`;
    }

    // 2. Personal Best and Lifetime metrics
    const pbScore = personalBest ? personalBest.score : runResult.score;
    this.element.querySelector('#res-pb-score').textContent = MathUtils.formatNumber(pbScore);
    this.element.querySelector('#res-highest-coins').textContent = MathUtils.formatNumber(highestRunCoins || runResult.coinsCollected);
    this.element.querySelector('#res-lifetime-coins').textContent = MathUtils.formatNumber(totalCoins || runResult.coinsCollected);

    // 3. Banner notifications
    const scoreBanner = this.element.querySelector('#new-high-score-banner');
    if (isNewHighScore) {
      scoreBanner.classList.remove('hidden');
    } else {
      scoreBanner.classList.add('hidden');
    }

    const coinBanner = this.element.querySelector('#new-coin-record-banner');
    if (isNewCoinRecord) {
      coinBanner.classList.remove('hidden');
    } else {
      coinBanner.classList.add('hidden');
    }

    // 4. Newly unlocked achievements
    const achBox = this.element.querySelector('#unlocked-achievements-box');
    const achList = this.element.querySelector('#unlocked-achievements-list');
    achList.innerHTML = '';

    if (newlyUnlockedAchievements && newlyUnlockedAchievements.length > 0) {
      achBox.classList.remove('hidden');
      newlyUnlockedAchievements.forEach((ach) => {
        const item = document.createElement('div');
        item.className = 'new-ach-item';
        item.innerHTML = `
          <span class="new-ach-icon">${ach.icon}</span>
          <div class="new-ach-text">
            <strong>${ach.title}</strong>
            <small>${ach.desc}</small>
          </div>
        `;
        achList.appendChild(item);
      });
    } else {
      achBox.classList.add('hidden');
    }

    this.element.classList.remove('hidden');
  }

  animateNumber(selector, targetVal) {
    const el = this.element.querySelector(selector);
    if (!el) return;

    if (targetVal === 0) {
      el.textContent = '0';
      return;
    }

    const duration = 650;
    const start = performance.now();

    const update = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const current = Math.floor(progress * targetVal);
      el.textContent = MathUtils.formatNumber(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = MathUtils.formatNumber(targetVal);
      }
    };

    requestAnimationFrame(update);
  }

  hide() {
    this.element.classList.add('hidden');
  }
}
