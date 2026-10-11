/**
 * AI Gesture Runner 3D - CameraSetupScreen
 * Explicit camera permissions, live preview mirror, hand detection diagnostics,
 * calibration, and 100% on-device privacy guarantee.
 */

import { Camera, CAMERA_STATES } from '../gesture/CameraService.js';
import { MediaPipe, MEDIAPIPE_STATES } from '../gesture/MediaPipeService.js';
import { Gestures } from '../gesture/GestureController.js';
import { Calibration } from '../gesture/GestureCalibration.js';
import { Sound } from '../services/SoundService.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';

export class CameraSetupScreen {
  constructor(container, onAction) {
    this.container = container;
    this.onAction = onAction;
    this.element = null;
    this.previewCanvas = null;
    this.previewCtx = null;
    this.animId = null;

    this.latestHandData = null;
    this.latestClassification = null;
    this.lastHandSeenTime = 0;

    this.build();
    this.bindGlobalEvents();
  }

  build() {
    this.element = document.createElement('div');
    this.element.id = 'camera-setup-screen';
    this.element.className = 'screen-overlay hidden';

    this.element.innerHTML = `
      <div class="setup-content glass-card">
        <h2 class="section-title">CAMERA & <span class="neon-accent">AI SETUP</span></h2>
        <p class="section-desc">
          GestureX uses real-time computer vision to track your hand touch-free.
          Please grant camera permission and place your hand in view to calibrate.
        </p>

        <div class="setup-grid">
          <!-- Left: Live Video Mirror Canvas -->
          <div class="camera-preview-container">
            <canvas id="setup-preview-canvas" width="480" height="360" class="setup-canvas"></canvas>
            <div id="setup-status-overlay" class="setup-status-overlay">
              <span id="setup-hand-indicator">WAITING FOR CAMERA</span>
            </div>
          </div>

          <!-- Right: Diagnostic Checklist & Instructions -->
          <div class="setup-diagnostics">
            <div class="diag-item" id="diag-camera">
              <span class="diag-icon">⚪</span>
              <span class="diag-text">Camera: <strong id="diag-cam-val">Pending Permission</strong></span>
            </div>

            <div class="diag-item" id="diag-model">
              <span class="diag-icon">⚪</span>
              <span class="diag-text">AI Model: <strong id="diag-model-val">Uninitialized</strong></span>
            </div>

            <div class="diag-item" id="diag-hand">
              <span class="diag-icon">⚪</span>
              <span class="diag-text">Hand Tracking: <strong id="diag-hand-val">Camera Offline</strong></span>
            </div>

            <div class="diag-item" id="diag-fps">
              <span class="diag-icon">⚪</span>
              <span class="diag-text">Inference Engine: <strong id="diag-fps-val">-- FPS</strong></span>
            </div>

            <div class="guidance-box">
              <h4>💡 Positioning Tips:</h4>
              <ul>
                <li>Hold hand 1.5 to 2.5 feet from camera.</li>
                <li>Keep entire hand and wrist visible in frame.</li>
                <li>Ensure sufficient room lighting.</li>
              </ul>
            </div>

            <div class="privacy-note">
              🔒 <strong>100% Local Privacy:</strong> Computer vision runs entirely on-device using WebAssembly.
              Zero video footage or images are stored or transmitted.
            </div>
          </div>
        </div>

        <div class="setup-actions">
          <button id="btn-enable-cam" class="btn btn-primary">
            📷 ENABLE CAMERA
          </button>
          <button id="btn-start-calibrated" class="btn btn-primary btn-glow" disabled>
            🖐️ CONTINUE TO TUTORIAL
          </button>
          <button id="btn-setup-back" class="btn btn-secondary">
            ⬅ BACK TO MENU
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);

    this.previewCanvas = this.element.querySelector('#setup-preview-canvas');
    this.previewCtx = this.previewCanvas.getContext('2d');

    this.bindEvents();
  }

  bindGlobalEvents() {
    GlobalEvents.on(EVENTS.GESTURE_RAW_DATA, ({ handData, classification }) => {
      if (handData) {
        this.latestHandData = handData;
        this.latestClassification = classification;
        this.lastHandSeenTime = performance.now();
      } else {
        if (performance.now() - this.lastHandSeenTime > 400) {
          this.latestHandData = null;
          this.latestClassification = null;
        }
      }
    });

    GlobalEvents.on(EVENTS.TRACKING_LOST, () => {
      this.latestHandData = null;
      this.latestClassification = null;
    });
  }

  bindEvents() {
    this.element.querySelector('#btn-enable-cam').onclick = async () => {
      Sound.playClick();
      await this.initCameraAndModel();
    };

    this.element.querySelector('#btn-start-calibrated').onclick = () => {
      Sound.playClick();
      Calibration.finishCalibration();
      this.stopPreviewLoop();
      this.onAction('TUTORIAL');
    };

    this.element.querySelector('#btn-setup-back').onclick = () => {
      Sound.playClick();
      this.stopPreviewLoop();
      this.onAction('BACK');
    };
  }

  async initCameraAndModel() {
    const btnEnable = this.element.querySelector('#btn-enable-cam');
    btnEnable.disabled = true;
    btnEnable.textContent = 'REQUESTING CAMERA...';

    const camVal = this.element.querySelector('#diag-cam-val');
    const modelVal = this.element.querySelector('#diag-model-val');
    const diagCam = this.element.querySelector('#diag-camera .diag-icon');
    const diagModel = this.element.querySelector('#diag-model .diag-icon');
    const indicator = this.element.querySelector('#setup-hand-indicator');

    indicator.textContent = '📷 REQUESTING CAMERA PERMISSION...';

    // 1. Initialize Camera
    const camResult = await Camera.requestCamera();
    if (camResult.success) {
      const vid = Camera.getVideo();
      const resText = vid ? ` (${vid.videoWidth}x${vid.videoHeight})` : '';
      camVal.textContent = `Ready${resText}`;
      diagCam.textContent = '🟢';
      btnEnable.textContent = 'WEBCAM CONNECTED';
    } else {
      camVal.textContent = camResult.message || 'Error';
      diagCam.textContent = '🔴';
      btnEnable.disabled = false;
      btnEnable.textContent = 'RETRY CAMERA';
      indicator.textContent = '❌ CAMERA ERROR: ' + camResult.message;
      return;
    }

    // 2. Initialize MediaPipe Model
    try {
      modelVal.textContent = 'Loading AI model...';
      indicator.textContent = '🤖 LOADING MEDIAPIPE MODEL...';
      await MediaPipe.init();
      const delegate = MediaPipe.activeDelegate.toUpperCase();
      modelVal.textContent = `Ready (${delegate})`;
      diagModel.textContent = '🟢';
      indicator.textContent = '👀 HOLD HAND IN FRONT OF CAMERA';
    } catch (e) {
      modelVal.textContent = 'Model Load Failed';
      diagModel.textContent = '🔴';
      indicator.textContent = '❌ AI MODEL LOAD FAILED';
      console.error('[CameraSetupScreen] MediaPipe init error:', e);
      return;
    }

    // Start calibration mode and preview rendering loop
    Calibration.startCalibration();
    this.startPreviewLoop();
  }

  startPreviewLoop() {
    this.stopPreviewLoop();

    const loop = () => {
      const video = Camera.getVideo();
      const ctx = this.previewCtx;
      const w = this.previewCanvas.width;
      const h = this.previewCanvas.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Clean Light-Theme Sky Canvas (Points-Only Display)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);

      // Soft sky-blue grid lines
      ctx.strokeStyle = 'rgba(0, 139, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let gx = 40; gx < w; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
      }
      for (let gy = 40; gy < h; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      }

      // Draw calibration guide lines
      const nx = Calibration.neutralX * w;
      const deadzone = Calibration.deadzoneX * w;
      const jumpY = Calibration.jumpYThreshold * h;

      ctx.strokeStyle = 'rgba(0, 139, 255, 0.35)';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(nx - deadzone, 0, deadzone * 2, h);

      ctx.strokeStyle = 'rgba(255, 122, 92, 0.5)';
      ctx.beginPath();
      ctx.moveTo(0, jumpY);
      ctx.lineTo(w, jumpY);
      ctx.stroke();
      ctx.setLineDash([]);

      const now = performance.now();
      const hasHand = this.latestHandData && (now - this.lastHandSeenTime < 350);

      const handVal = this.element.querySelector('#diag-hand-val');
      const diagHand = this.element.querySelector('#diag-hand .diag-icon');
      const fpsVal = this.element.querySelector('#diag-fps-val');
      const diagFps = this.element.querySelector('#diag-fps .diag-icon');
      const indicator = this.element.querySelector('#setup-hand-indicator');
      const btnStart = this.element.querySelector('#btn-start-calibrated');

      // Update inference stats
      fpsVal.textContent = `${MediaPipe.inferenceFps} FPS (${MediaPipe.lastInferenceDurationMs.toFixed(0)}ms)`;
      diagFps.textContent = MediaPipe.inferenceFps > 15 ? '🟢' : '🟡';

      if (hasHand) {
        const gestureName = this.latestClassification ? this.latestClassification.gesture : 'NEUTRAL';
        handVal.textContent = `Tracking Active (${gestureName})`;
        diagHand.textContent = '🟢';
        indicator.textContent = `✅ HAND LOCKED: ${gestureName}`;
        indicator.className = 'setup-status-overlay status-locked';
        btnStart.disabled = false;

        // Draw skeleton overlay
        const pts = this.latestHandData.points;
        const connections = [
          [0, 1], [1, 2], [2, 3], [3, 4],
          [0, 5], [5, 6], [6, 7], [7, 8],
          [5, 9], [9, 10], [10, 11], [11, 12],
          [9, 13], [13, 14], [14, 15], [15, 16],
          [13, 17], [17, 18], [18, 19], [19, 20],
          [0, 17]
        ];

        ctx.strokeStyle = '#008BFF';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        connections.forEach(([i, j]) => {
          ctx.beginPath();
          ctx.moveTo(pts[i].x * w, pts[i].y * h);
          ctx.lineTo(pts[j].x * w, pts[j].y * h);
          ctx.stroke();
        });

        // Draw landmark nodes
        ctx.fillStyle = '#8E7DFF';
        pts.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 4.5, 0, Math.PI * 2);
          ctx.fill();
        });

        // Highlight extended fingertips
        if (this.latestHandData.indexExtended) {
          ctx.fillStyle = '#FFD34E';
          ctx.beginPath();
          ctx.arc(pts[8].x * w, pts[8].y * h, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FF7A5C';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        if (this.latestHandData.middleExtended) {
          ctx.fillStyle = '#FFD34E';
          ctx.beginPath();
          ctx.arc(pts[12].x * w, pts[12].y * h, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FF7A5C';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Draw palm center
        ctx.fillStyle = '#008BFF';
        ctx.beginPath();
        ctx.arc(this.latestHandData.palmCenter.x * w, this.latestHandData.palmCenter.y * h, 6, 0, Math.PI * 2);
        ctx.fill();
        } else {
          handVal.textContent = 'Searching (Keep hand in frame)';
          diagHand.textContent = '🟡';
          indicator.textContent = '👀 HOLD HAND IN FRONT OF CAMERA';
          indicator.className = 'setup-status-overlay status-waiting';
          btnStart.disabled = true;
        }

      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
  }

  stopPreviewLoop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  show() {
    this.element.classList.remove('hidden');
    if (Camera.isReady && MediaPipe.isLoaded) {
      this.element.querySelector('#btn-enable-cam').textContent = 'WEBCAM CONNECTED';
      this.element.querySelector('#btn-enable-cam').disabled = true;
      this.element.querySelector('#diag-cam-val').textContent = 'Ready';
      this.element.querySelector('#diag-camera .diag-icon').textContent = '🟢';
      this.element.querySelector('#diag-model-val').textContent = `Ready (${MediaPipe.activeDelegate.toUpperCase()})`;
      this.element.querySelector('#diag-model .diag-icon').textContent = '🟢';
      Calibration.startCalibration();
      this.startPreviewLoop();
    }
  }

  hide() {
    this.stopPreviewLoop();
    this.element.classList.add('hidden');
  }
}
