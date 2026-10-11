/**
 * AI Gesture Runner 3D - TutorialScreen
 * Interactive gesture guide explaining 6 touch-free poses:
 * Left, Right, Jump, Slide, 1-Finger Pause, and 2-Finger Resume.
 * Includes live practice verification and camera visibility guidance.
 */

import { Sound } from '../services/SoundService.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';

export class TutorialScreen {
  constructor(container, onAction) {
    this.container = container;
    this.onAction = onAction;
    this.element = null;
    this.verifiedGestures = new Set();
    this.liveFeedbackTag = null;

    this.build();
    this.bindGlobalGestures();
  }

  build() {
    this.element = document.createElement('div');
    this.element.id = 'tutorial-screen';
    this.element.className = 'screen-overlay hidden';

    this.element.innerHTML = `
      <div class="tutorial-content glass-card">
        <h2 class="section-title">HOW TO PLAY: <span class="brand-gesture">Gesture</span><span class="brand-x">X</span></h2>
        <p class="section-desc">
          GestureX is 100% touch-free. Perform hand gestures in front of your camera to navigate, jump, slide, pause, and resume.
        </p>

        <!-- Live Detected Gesture Tracker Banner -->
        <div class="tutorial-live-banner">
          CURRENTLY DETECTED: <span id="tut-live-badge" class="tut-badge">SEARCHING FOR HAND...</span>
        </div>

        <div class="gesture-grid tutorial-six-grid">
          <!-- Card 1: Move Left -->
          <div class="gesture-card" id="card-MOVE_LEFT">
            <div class="gesture-icon">👈</div>
            <div class="gesture-title">MOVE LEFT</div>
            <div class="gesture-desc">Extend only your <strong>index finger</strong> and slant it toward the <strong>LEFT</strong> to shift lanes left.</div>
            <div class="gesture-status">Pending Test</div>
          </div>

          <!-- Card 2: Move Right -->
          <div class="gesture-card" id="card-MOVE_RIGHT">
            <div class="gesture-icon">👉</div>
            <div class="gesture-title">MOVE RIGHT</div>
            <div class="gesture-desc">Extend only your <strong>index finger</strong> and slant it toward the <strong>RIGHT</strong> to shift lanes right.</div>
            <div class="gesture-status">Pending Test</div>
          </div>

          <!-- Card 3: Jump -->
          <div class="gesture-card" id="card-JUMP">
            <div class="gesture-icon">✌️</div>
            <div class="gesture-title">PEACE JUMP</div>
            <div class="gesture-desc">Extend your <strong>index and middle fingers upward</strong> (Peace/V sign, ring and pinky folded) to leap over low hurdles.</div>
            <div class="gesture-status">Pending Test</div>
          </div>

          <!-- Card 4: Slide -->
          <div class="gesture-card" id="card-SLIDE">
            <div class="gesture-icon">✊</div>
            <div class="gesture-title">FIST SLIDE</div>
            <div class="gesture-desc">Make a tight <strong>closed fist</strong> (all four fingers folded) to crouch and slide beneath overhead gantries.</div>
            <div class="gesture-status">Pending Test</div>
          </div>

          <!-- Card 5: Pause (Full Open Palm) -->
          <div class="gesture-card" id="card-PAUSE">
            <div class="gesture-icon">✋</div>
            <div class="gesture-title">OPEN-PALM PAUSE</div>
            <div class="gesture-desc">Open your <strong>full palm</strong> (all five fingers extended) and hold it steadily while running to pause touch-free.</div>
            <div class="gesture-status">Pending Test</div>
          </div>

          <!-- Card 6: Resume (3 Fingers) -->
          <div class="gesture-card" id="card-RESUME">
            <div class="gesture-icon">🤟</div>
            <div class="gesture-title">THREE-FINGER RESUME</div>
            <div class="gesture-desc">Extend your <strong>index, middle, and ring fingers</strong> upward (pinky folded) while paused to resume the game.</div>
            <div class="gesture-status">Pending Test</div>
          </div>
        </div>

        <!-- Vision and Lighting Guidance -->
        <div class="guidance-box tutorial-guidance">
          <h4>💡 Camera & Lighting Tips for Best Accuracy:</h4>
          <ul>
            <li><strong>Keep hand in view:</strong> Keep your hand centered 1.5 to 2.5 feet from your webcam.</li>
            <li><strong>Adequate Lighting:</strong> Ensure your room is well lit. Avoid sitting directly with strong backlights (such as windows behind you).</li>
            <li><strong>Steady Poses:</strong> For Pause and Resume, hold the pose steadily for a brief moment until recognized.</li>
          </ul>
        </div>

        <div class="tutorial-actions">
          <button id="btn-tutorial-start" class="btn btn-primary btn-glow">
            🚀 READY TO RUN
          </button>
          <button id="btn-tutorial-back" class="btn btn-secondary">
            ⬅ BACK TO MENU
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);
    this.liveFeedbackTag = this.element.querySelector('#tut-live-badge');
    this.bindEvents();
  }

  bindEvents() {
    this.element.querySelector('#btn-tutorial-start').onclick = () => {
      Sound.playClick();
      this.onAction('START');
    };

    this.element.querySelector('#btn-tutorial-back').onclick = () => {
      Sound.playClick();
      this.onAction('BACK');
    };
  }

  bindGlobalGestures() {
    GlobalEvents.on(EVENTS.GESTURE_RECOGNIZED, ({ gesture }) => {
      if (this.element && !this.element.classList.contains('hidden')) {
        if (this.liveFeedbackTag) {
          this.liveFeedbackTag.textContent = gesture;
        }

        const card = this.element.querySelector(`#card-${gesture}`);
        if (card) {
          card.classList.add('verified');
          const status = card.querySelector('.gesture-status');
          if (status) status.textContent = '✅ RECOGNIZED!';
          this.verifiedGestures.add(gesture);
        }
      }
    });

    GlobalEvents.on(EVENTS.TRACKING_LOST, () => {
      if (this.element && !this.element.classList.contains('hidden') && this.liveFeedbackTag) {
        this.liveFeedbackTag.textContent = 'TRACKING LOST';
      }
    });
  }

  show() {
    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
  }
}
