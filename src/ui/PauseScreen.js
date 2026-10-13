/**
 * AI Gesture Runner 3D - PauseScreen
 * Soft pause overlay with 2-finger touch-free resume and menu navigation.
 */

import { Sound } from '../services/SoundService.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';

export class PauseScreen {
  constructor(container, onAction) {
    this.container = container;
    this.onAction = onAction;
    this.element = null;
    this.reasonText = null;
    this.resumeFeedbackEl = null;

    this.build();
    this.bindGestureResume();
  }

  build() {
    this.element = document.createElement('div');
    this.element.id = 'pause-screen';
    this.element.className = 'screen-overlay hidden';

    this.element.innerHTML = `
      <div class="pause-content glass-card">
        <div class="pause-header-badge">✋ OPEN-PALM PAUSE ACTIVE</div>
        <h2 class="section-title">GAME <span class="neon-accent">PAUSED</span></h2>
        <p id="pause-reason" class="pause-reason">Game paused by player.</p>

        <div class="gesture-hint-box resume-hint">
          <div class="hint-icon"><img src="./icons/gesture-resume.png" class="resume-icon-img" alt="Resume"></div>
          <div class="hint-text">
            <strong>Touch-Free Resume:</strong> Raise your <strong>Index, Middle, and Ring fingers</strong> upward (pinky folded) to resume gameplay touch-free!
          </div>
        </div>

        <div id="pause-resume-indicator" class="pause-resume-indicator hidden">
          ✅ 3-FINGER GESTURE RECOGNIZED — RESUMING...
        </div>

        <div class="pause-actions">
          <button id="btn-pause-resume" class="btn btn-primary btn-glow">
            ▶ RESUME RUN
          </button>
          <button id="btn-pause-restart" class="btn btn-secondary">
            🔄 RESTART
          </button>
          <button id="btn-pause-menu" class="btn btn-secondary">
            🏠 MAIN MENU
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);
    this.reasonText = this.element.querySelector('#pause-reason');
    this.resumeFeedbackEl = this.element.querySelector('#pause-resume-indicator');

    this.bindEvents();
  }

  bindEvents() {
    this.element.querySelector('#btn-pause-resume').onclick = () => {
      if (this.isResuming) return;
      this.isResuming = true;
      Sound.playClick();
      this.onAction('RESUME');
    };

    this.element.querySelector('#btn-pause-restart').onclick = () => {
      Sound.playClick();
      this.onAction('RESTART');
    };

    this.element.querySelector('#btn-pause-menu').onclick = () => {
      Sound.playClick();
      this.onAction('MENU');
    };
  }

  bindGestureResume() {
    GlobalEvents.on(EVENTS.RESUME_REQUESTED, () => {
      if (this.element && !this.element.classList.contains('hidden')) {
        this.triggerResume();
      }
    });

    GlobalEvents.on(EVENTS.GESTURE_RECOGNIZED, ({ gesture }) => {
      if (this.element && !this.element.classList.contains('hidden')) {
        if (gesture === 'RESUME') {
          this.triggerResume();
        }
      }
    });
  }

  triggerResume() {
    if (this.isResuming) return;
    this.isResuming = true;

    if (this.resumeFeedbackEl) {
      this.resumeFeedbackEl.classList.remove('hidden');
    }
    Sound.playPowerup();
    setTimeout(() => {
      this.isResuming = false;
      if (this.resumeFeedbackEl) {
        this.resumeFeedbackEl.classList.add('hidden');
      }
      this.onAction('RESUME');
    }, 280);
  }

  show(reason = 'Game paused by player.') {
    this.isResuming = false;
    if (this.reasonText) {
      this.reasonText.textContent = reason;
    }
    if (this.resumeFeedbackEl) {
      this.resumeFeedbackEl.classList.add('hidden');
    }
    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
  }
}
