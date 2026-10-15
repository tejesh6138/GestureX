/**
 * AI Gesture Runner 3D - MenuScreen
 * Cyberpunk animated landing menu with 3 Selectable Difficulty Modes (EASY, MEDIUM, FAST),
 * camera status indicator, personal best summary, and User Authentication pill.
 */

import { Score } from '../services/ScoreService.js';
import { Camera } from '../gesture/CameraService.js';
import { Sound } from '../services/SoundService.js';
import { DIFFICULTY_MODES, DIFFICULTY_CONFIG } from '../core/GameConfig.js';
import { Storage } from '../services/StorageService.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';
import { AuthService } from '../services/AuthService.js';
import { AuthModal } from './AuthModal.js';
import { ApiClient } from '../services/ApiClient.js';

export class MenuScreen {
  constructor(container, onAction) {
    this.container = container;
    this.onAction = onAction;
    this.element = null;
    this.authModal = new AuthModal(container);

    const savedMode = Storage.getItem('GAME_DIFFICULTY', DIFFICULTY_MODES.MEDIUM);
    this.selectedDifficulty = DIFFICULTY_CONFIG[savedMode] ? savedMode : DIFFICULTY_MODES.MEDIUM;

    this.build();
    this.setupAuthSync();
  }

  build() {
    this.element = document.createElement('div');
    this.element.id = 'menu-screen';
    this.element.className = 'screen-overlay menu-overlay';

    const pb = Score.getPersonalBest();

    this.element.innerHTML = `
      <!-- User Account / Login Pill Button -->
      <button id="btn-account" class="menu-account-btn" title="Player Account">
        <span class="account-dot-guest" id="account-status-dot"></span>
        <span id="account-username-label">GUEST / LOGIN</span>
      </button>

      <div class="menu-content glass-card">
        <div class="logo-wrapper">
          <div class="logo-sub">TOUCH-FREE COMPUTER VISION</div>
          <h1 class="logo-title brand-logo"><span class="brand-gesture">Gesture</span><span class="brand-x">X</span></h1>
          <div class="logo-tagline">3D Railway Runner Controlled Entirely by Real-Time AI Hand Gestures</div>
        </div>

        <div class="pb-badge">
          <span class="pb-label">🏆 PERSONAL BEST</span>
          <span id="menu-pb-score" class="pb-score">${(pb.score || 0).toLocaleString()} PTS</span>
          <span id="menu-pb-distance" class="pb-distance">${pb.distanceTravelled || 0} m</span>
          <span class="pb-coins">🪙 <span id="menu-pb-coins">${(pb.coinsCollected || 0).toLocaleString()}</span></span>
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
    this.updateAccountStatus();
  }

  setupAuthSync() {
    GlobalEvents.on(EVENTS.AUTH_STATE_CHANGED, ({ isAuthenticated, user }) => {
      this.updateAccountStatus();
      this.renderPersonalBest();
    });

    GlobalEvents.on('PERSONAL_BEST_UPDATED', (pb) => {
      this.renderPersonalBest(pb);
    });

    GlobalEvents.on('OPEN_AUTH_MODAL', ({ view } = {}) => {
      this.authModal.show(view || 'LOGIN');
    });
  }

  renderPersonalBest(pb) {
    if (!pb) pb = Score.getPersonalBest();
    const pbScore = this.element.querySelector('#menu-pb-score');
    const pbDistance = this.element.querySelector('#menu-pb-distance');
    const pbCoins = this.element.querySelector('#menu-pb-coins');
    if (pbScore) pbScore.textContent = `${(pb.score || 0).toLocaleString()} PTS`;
    if (pbDistance) pbDistance.textContent = `${Math.floor(pb.distanceTravelled || 0)} m`;
    if (pbCoins) pbCoins.textContent = (pb.coinsCollected || 0).toLocaleString();
  }

  updateAccountStatus() {
    const dot = this.element.querySelector('#account-status-dot');
    const label = this.element.querySelector('#account-username-label');
    if (!dot || !label) return;

    if (AuthService.isLoggedIn()) {
      const user = AuthService.getUser();
      const displayName = user?.profile?.display_name || user?.username || 'Runner';
      dot.className = 'account-dot-logged';
      label.textContent = `⚡ ${displayName}`;
    } else {
      dot.className = 'account-dot-guest';
      label.textContent = '👤 GUEST / LOGIN';
    }
  }

  bindEvents() {
    // Account Modal trigger
    this.element.querySelector('#btn-account').onclick = () => {
      Sound.playClick();
      this.authModal.show();
    };

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
    this.updateAccountStatus();
    this.renderPersonalBest();

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
