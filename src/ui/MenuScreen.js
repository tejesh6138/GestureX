/**
 * AI Gesture Runner 3D - MenuScreen
 * Cyberpunk animated landing menu with 3 Selectable Difficulty Modes (EASY, MEDIUM, FAST),
 * camera status indicator, and personal best summary.
 */

import { Score } from '../services/ScoreService.js';
import { Camera } from '../gesture/CameraService.js';
import { Sound } from '../services/SoundService.js';
import { DIFFICULTY_MODES, DIFFICULTY_CONFIG } from '../core/GameConfig.js';
import { Storage } from '../services/StorageService.js';
import { GlobalEvents } from '../core/EventBus.js';

export class MenuScreen {
  constructor(container, onAction) {
    this.container = container;
    this.onAction = onAction;
    this.element = null;

    const savedMode = Storage.getItem('GAME_DIFFICULTY', DIFFICULTY_MODES.MEDIUM);
    this.selectedDifficulty = DIFFICULTY_CONFIG[savedMode] ? savedMode : DIFFICULTY_MODES.MEDIUM;

    this.build();
  }

  build() {
    this.element = document.createElement('div');
    this.element.id = 'menu-screen';
    this.element.className = 'screen-overlay menu-overlay';

    const pb = Score.getPersonalBest();

    this.element.innerHTML = `
      <div class="menu-content glass-card">
        <div class="logo-wrapper">
          <div class="logo-sub">TOUCH-FREE COMPUTER VISION</div>
          <h1 class="logo-title brand-logo"><span class="brand-gesture">Gesture</span><span class="brand-x">X</span></h1>
          <div class="logo-tagline">3D Railway Runner Controlled Entirely by Real-Time AI Hand Gestures</div>
        </div>

        <div class="pb-badge">
          <span class="pb-label">🏆 PERSONAL BEST</span>
          <span id="menu-pb-score" class="pb-score">${pb.score.toLocaleString()} PTS</span>
          <span class="pb-distance">${pb.distanceTravelled} m</span>
          <span class="pb-coins">🪙 <span id="menu-pb-coins">${Score.getTotalCoins().toLocaleString()}</span></span>
        </div>

        <!-- 3 Selectable Game Difficulty Modes -->
        <div class="difficulty-section">
          <div class="diff-header-label">SELECT DIFFICULTY MODE</div>
          <div class="difficulty-cards-grid">
            <div class="diff-card ${this.selectedDifficulty === 'EASY' ? 'selected' : ''}" data-mode="EASY" id="card-diff-easy">
              <div class="diff-icon">🌱</div>
              <div class="diff-title">EASY</div>
              <div class="diff-tag">Casual Run</div>
              <div class="diff-desc">Gentle running pace, wider reaction windows, and simpler obstacle sequences.</div>
            </div>

            <div class="diff-card ${this.selectedDifficulty === 'MEDIUM' ? 'selected' : ''}" data-mode="MEDIUM" id="card-diff-medium">
              <div class="diff-icon">⚡</div>
              <div class="diff-title">MEDIUM</div>
              <div class="diff-tag">Balanced</div>
              <div class="diff-desc">Standard arcade speed, dynamic obstacle combinations, and balanced coin trails.</div>
            </div>

            <div class="diff-card ${this.selectedDifficulty === 'FAST' ? 'selected' : ''}" data-mode="FAST" id="card-diff-fast">
              <div class="diff-icon">🔥</div>
              <div class="diff-title">FAST</div>
              <div class="diff-tag">Hyper Reflex</div>
              <div class="diff-desc">High-speed adrenaline sprint with oncoming cyber-trains and rapid lane shifts.</div>
            </div>
          </div>
        </div>

        <div class="menu-buttons">
          <button id="btn-start" class="btn btn-primary btn-glow">
            <span class="btn-icon">▶</span> START GAME
          </button>
          
          <div class="btn-grid">
            <button id="btn-camera" class="btn btn-secondary">
              <span class="btn-icon">📷</span> CAMERA SETUP
            </button>
            <button id="btn-tutorial" class="btn btn-secondary">
              <span class="btn-icon">🖐️</span> HOW TO PLAY
            </button>
            <button id="btn-stats" class="btn btn-secondary">
              <span class="btn-icon">🏆</span> ACHIEVEMENTS
            </button>
            <button id="btn-settings" class="btn btn-secondary">
              <span class="btn-icon">⚙️</span> SETTINGS
            </button>
          </div>
        </div>

        <div class="menu-footer">
          <div class="camera-status-pill" id="menu-cam-pill">
            <span class="status-dot ${Camera.isReady ? 'dot-active' : 'dot-idle'}"></span>
            <span id="menu-cam-status">${Camera.isReady ? 'Camera Active' : 'Camera Required'}</span>
          </div>
          <button id="btn-fullscreen" class="btn-icon-only" title="Toggle Fullscreen">⛶</button>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);
    this.bindEvents();
  }

  bindEvents() {
    // Difficulty card selection
    const cards = this.element.querySelectorAll('.diff-card');
    cards.forEach((card) => {
      card.onclick = () => {
        Sound.playClick();
        const mode = card.getAttribute('data-mode');
        this.selectedDifficulty = mode;
        Storage.setItem('GAME_DIFFICULTY', mode);

        cards.forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');

        GlobalEvents.emit('DIFFICULTY_CHANGED', { mode, config: DIFFICULTY_CONFIG[mode] });
      };
    });

    this.element.querySelector('#btn-start').onclick = () => {
      Sound.playClick();
      this.onAction('START');
    };

    this.element.querySelector('#btn-camera').onclick = () => {
      Sound.playClick();
      this.onAction('CAMERA_SETUP');
    };

    this.element.querySelector('#btn-tutorial').onclick = () => {
      Sound.playClick();
      this.onAction('TUTORIAL');
    };

    this.element.querySelector('#btn-stats').onclick = () => {
      Sound.playClick();
      this.onAction('RESULTS');
    };

    this.element.querySelector('#btn-settings').onclick = () => {
      Sound.playClick();
      this.onAction('SETTINGS');
    };

    this.element.querySelector('#btn-fullscreen').onclick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };
  }

  getSelectedDifficulty() {
    return this.selectedDifficulty;
  }

  show() {
    // Refresh PB and camera pill
    const pb = Score.getPersonalBest();
    const pbScore = this.element.querySelector('#menu-pb-score');
    const pbCoins = this.element.querySelector('#menu-pb-coins');
    if (pbScore) pbScore.textContent = `${pb.score.toLocaleString()} PTS`;
    if (pbCoins) pbCoins.textContent = Score.getTotalCoins().toLocaleString();

    const dot = this.element.querySelector('#menu-cam-pill .status-dot');
    const statusText = this.element.querySelector('#menu-cam-status');
    if (dot && statusText) {
      dot.className = `status-dot ${Camera.isReady ? 'dot-active' : 'dot-idle'}`;
      statusText.textContent = Camera.isReady ? 'Camera Active' : 'Camera Required';
    }

    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
  }
}
