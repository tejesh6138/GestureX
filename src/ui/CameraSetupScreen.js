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

export const SETUP_STATES = {
  CAMERA: {
    INITIALIZING: 'Initializing',
    READY: 'Ready',
    PERMISSION_DENIED: 'Permission Denied',
    UNAVAILABLE: 'Unavailable',
    DISCONNECTED: 'Disconnected'
  },
  MODEL: {
    NOT_LOADED: 'Not Loaded',
    LOADING: 'Loading',
    READY: 'Ready',
    LOAD_FAILED: 'Load Failed'
  },
  TRACKING: {
    WAITING: 'Waiting for Camera and Model',
    NO_HAND: 'No Hand Detected',
    HAND_DETECTED: 'Hand Detected',
    TRACKING_LOST: 'Tracking Lost'
  },
  INFERENCE: {
    INITIALIZING: 'Initializing',
    ACTIVE: 'Active',
    PAUSED: 'Paused',
    ERROR: 'Error'
  }
};

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

    // Logical state management
    this.cameraState = Camera.isReady ? SETUP_STATES.CAMERA.READY : SETUP_STATES.CAMERA.UNAVAILABLE;
    this.modelState = MediaPipe.isLoaded ? SETUP_STATES.MODEL.READY : SETUP_STATES.MODEL.NOT_LOADED;
    this.isInitializingCamera = false;
    this.isInitializingModel = false;
    this.modelErrorMessage = null;

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
          <!-- Left: Live Points-Only Digital Mirror Canvas -->
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
              <span class="diag-text">AI Model: <strong id="diag-model-val">Not Loaded</strong></span>
            </div>

            <div class="diag-item" id="diag-hand">
              <span class="diag-icon">⚪</span>
              <span class="diag-text">Hand Tracking: <strong id="diag-hand-val">Waiting for Camera and Model</strong></span>
            </div>

            <div class="diag-item" id="diag-fps">
              <span class="diag-icon">⚪</span>
              <span class="diag-text">Inference Engine: <strong id="diag-fps-val">-- FPS</strong></span>
            </div>

            <div id="setup-error-box" class="hidden" style="display: none; color: #dc2626; font-size: 0.85rem; background: #fee2e2; border: 1px solid #f87171; border-radius: 8px; padding: 8px 12px; margin-top: 10px; font-weight: 500;"></div>

            <div class="guidance-box">
              <h4>💡 Positioning Tips:</h4>
              <ul>
                <li>Hold hand 1.5 to 2.5 feet from camera.</li>
                <li>Keep entire hand and wrist visible in frame.</li>
                <li>Ensure sufficient room lighting without glare.</li>
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
          <button id="btn-retry-model" class="btn btn-secondary btn-glow hidden" style="display: none;">
            🔄 RETRY AI MODEL
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
    this.updateUI();
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

    GlobalEvents.on(EVENTS.CAMERA_READY, () => {
      this.cameraState = SETUP_STATES.CAMERA.READY;
      this.updateUI();
    });

    GlobalEvents.on(EVENTS.CAMERA_ERROR, ({ message }) => {
      if (Camera.state === CAMERA_STATES.PERMISSION_DENIED) {
        this.cameraState = SETUP_STATES.CAMERA.PERMISSION_DENIED;
      } else {
        this.cameraState = SETUP_STATES.CAMERA.UNAVAILABLE;
      }
      this.updateUI();
    });
  }

  bindEvents() {
    this.element.querySelector('#btn-enable-cam').onclick = async () => {
      Sound.playClick();
      await this.initCamera();
    };

    this.element.querySelector('#btn-retry-model').onclick = async () => {
      Sound.playClick();
      await this.initModel();
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

  async initCamera() {
    if (this.isInitializingCamera) return;
    this.isInitializingCamera = true;
    this.cameraState = SETUP_STATES.CAMERA.INITIALIZING;
    this.updateUI();

    const camResult = await Camera.requestCamera();
    this.isInitializingCamera = false;

    if (camResult.success) {
      this.cameraState = SETUP_STATES.CAMERA.READY;
      this.updateUI();

      // Start canvas preview immediately
      this.startPreviewLoop();

      // If model is not loaded yet, initiate model loading
      if (!MediaPipe.isLoaded && !this.isInitializingModel) {
        await this.initModel();
      }
    } else {
      if (Camera.state === CAMERA_STATES.PERMISSION_DENIED) {
        this.cameraState = SETUP_STATES.CAMERA.PERMISSION_DENIED;
      } else {
        this.cameraState = SETUP_STATES.CAMERA.UNAVAILABLE;
      }
      this.updateUI();
    }
  }

  async initModel() {
    if (this.isInitializingModel) return;
    this.isInitializingModel = true;
    this.modelState = SETUP_STATES.MODEL.LOADING;
    this.modelErrorMessage = null;
    this.updateUI();

    try {
      await MediaPipe.init();
      this.modelState = SETUP_STATES.MODEL.READY;
      this.modelErrorMessage = null;
    } catch (e) {
      console.error('[CameraSetupScreen] MediaPipe initialization error:', e);
      this.modelState = SETUP_STATES.MODEL.LOAD_FAILED;
      this.modelErrorMessage = e.message || 'MediaPipe model failed to load';
    } finally {
      this.isInitializingModel = false;
      this.updateUI();
      if (Camera.isReady) {
        this.startPreviewLoop();
      }
    }
  }

  updateUI() {
    if (!this.element) return;

    const camVal = this.element.querySelector('#diag-cam-val');
    const diagCam = this.element.querySelector('#diag-camera .diag-icon');
    const modelVal = this.element.querySelector('#diag-model-val');
    const diagModel = this.element.querySelector('#diag-model .diag-icon');
    const btnEnableCam = this.element.querySelector('#btn-enable-cam');
    const btnRetryModel = this.element.querySelector('#btn-retry-model');
    const indicator = this.element.querySelector('#setup-hand-indicator');

    // 1. Camera Diagnostic Row
    if (this.cameraState === SETUP_STATES.CAMERA.READY) {
      const vid = Camera.getVideo();
      const resText = vid && vid.videoWidth > 0 ? ` (${vid.videoWidth}×${vid.videoHeight})` : '';
      camVal.textContent = `Ready${resText}`;
      diagCam.textContent = '🟢';
      btnEnableCam.textContent = 'WEBCAM CONNECTED';
      btnEnableCam.disabled = true;
    } else if (this.cameraState === SETUP_STATES.CAMERA.INITIALIZING) {
      camVal.textContent = 'Initializing...';
      diagCam.textContent = '🟡';
      btnEnableCam.textContent = 'CONNECTING CAMERA...';
      btnEnableCam.disabled = true;
    } else if (this.cameraState === SETUP_STATES.CAMERA.PERMISSION_DENIED) {
      camVal.textContent = 'Permission Denied';
      diagCam.textContent = '🔴';
      btnEnableCam.textContent = 'RETRY CAMERA';
      btnEnableCam.disabled = false;
    } else if (this.cameraState === SETUP_STATES.CAMERA.DISCONNECTED) {
      camVal.textContent = 'Disconnected';
      diagCam.textContent = '🔴';
      btnEnableCam.textContent = 'RETRY CAMERA';
      btnEnableCam.disabled = false;
    } else {
      camVal.textContent = 'Pending Permission';
      diagCam.textContent = '⚪';
      btnEnableCam.textContent = '📷 ENABLE CAMERA';
      btnEnableCam.disabled = false;
    }

    // 2. AI Model Diagnostic Row
    if (this.modelState === SETUP_STATES.MODEL.READY) {
      const delegate = MediaPipe.activeDelegate ? MediaPipe.activeDelegate.toUpperCase() : 'GPU';
      modelVal.textContent = `Ready (${delegate})`;
      diagModel.textContent = '🟢';
      btnRetryModel.classList.add('hidden');
      btnRetryModel.style.display = 'none';
    } else if (this.modelState === SETUP_STATES.MODEL.LOADING) {
      modelVal.textContent = 'Loading AI model...';
      diagModel.textContent = '🟡';
      btnRetryModel.classList.remove('hidden');
      btnRetryModel.style.display = 'inline-flex';
      btnRetryModel.textContent = '⏳ LOADING MODEL...';
      btnRetryModel.disabled = true;
    } else if (this.modelState === SETUP_STATES.MODEL.LOAD_FAILED) {
      modelVal.textContent = 'Load Failed';
      diagModel.textContent = '🔴';
      btnRetryModel.classList.remove('hidden');
      btnRetryModel.style.display = 'inline-flex';
      btnRetryModel.textContent = '🔄 RETRY AI MODEL';
      btnRetryModel.disabled = false;
    } else {
      modelVal.textContent = 'Not Loaded';
      diagModel.textContent = '⚪';
      btnRetryModel.classList.add('hidden');
      btnRetryModel.style.display = 'none';
    }

    // Diagnostics Error Message Banner
    const errorBox = this.element.querySelector('#setup-error-box');
    if (errorBox) {
      if (this.modelState === SETUP_STATES.MODEL.LOAD_FAILED) {
        errorBox.textContent = `⚠️ AI Model Error: ${this.modelErrorMessage || 'Model initialization failed. Click Retry AI Model.'}`;
        errorBox.classList.remove('hidden');
        errorBox.style.display = 'block';
      } else if (this.cameraState === SETUP_STATES.CAMERA.PERMISSION_DENIED) {
        errorBox.textContent = '⚠️ Camera permission denied. Please allow camera access in your browser.';
        errorBox.classList.remove('hidden');
        errorBox.style.display = 'block';
      } else if (this.cameraState === SETUP_STATES.CAMERA.UNAVAILABLE) {
        errorBox.textContent = '⚠️ Camera unavailable or in use by another application. Click Retry Camera.';
        errorBox.classList.remove('hidden');
        errorBox.style.display = 'block';
      } else {
        errorBox.classList.add('hidden');
        errorBox.style.display = 'none';
        errorBox.textContent = '';
      }
    }

    // 3. Central Banner Status Text
    if (this.cameraState !== SETUP_STATES.CAMERA.READY) {
      if (this.cameraState === SETUP_STATES.CAMERA.INITIALIZING) {
        indicator.textContent = '📷 REQUESTING CAMERA PERMISSION...';
      } else if (this.cameraState === SETUP_STATES.CAMERA.PERMISSION_DENIED) {
        indicator.textContent = '❌ CAMERA PERMISSION DENIED — PLEASE ALLOW IN BROWSER';
      } else {
        indicator.textContent = 'WAITING FOR CAMERA PERMISSION';
      }
      indicator.className = 'setup-status-overlay status-waiting';
    } else if (this.modelState === SETUP_STATES.MODEL.LOADING) {
      indicator.textContent = '🤖 LOADING MEDIAPIPE MODEL...';
      indicator.className = 'setup-status-overlay status-waiting';
    } else if (this.modelState === SETUP_STATES.MODEL.LOAD_FAILED) {
      indicator.textContent = `❌ AI MODEL LOAD FAILED — CLICK RETRY AI MODEL`;
      indicator.className = 'setup-status-overlay status-waiting';
    } else if (this.modelState === SETUP_STATES.MODEL.READY) {
      indicator.textContent = '👀 HOLD HAND IN FRONT OF CAMERA (1.5 - 2.5 FT)';
      indicator.className = 'setup-status-overlay status-waiting';
    }
  }

  updateDiagnosticsRealtime(hasHand, now) {
    const handVal = this.element.querySelector('#diag-hand-val');
    const diagHand = this.element.querySelector('#diag-hand .diag-icon');
    const fpsVal = this.element.querySelector('#diag-fps-val');
    const diagFps = this.element.querySelector('#diag-fps .diag-icon');
    const indicator = this.element.querySelector('#setup-hand-indicator');
    const btnStart = this.element.querySelector('#btn-start-calibrated');

    const bothReady = this.cameraState === SETUP_STATES.CAMERA.READY && this.modelState === SETUP_STATES.MODEL.READY;

    // Inference Engine FPS
    if (this.modelState === SETUP_STATES.MODEL.LOAD_FAILED) {
      fpsVal.textContent = 'Error';
      diagFps.textContent = '🔴';
    } else if (bothReady) {
      const fps = MediaPipe.inferenceFps || 0;
      fpsVal.textContent = `${fps} FPS (${MediaPipe.lastInferenceDurationMs.toFixed(0)}ms)`;
      diagFps.textContent = fps > 15 ? '🟢' : '🟡';
    } else {
      fpsVal.textContent = this.modelState === SETUP_STATES.MODEL.LOADING ? 'Initializing...' : '-- FPS';
      diagFps.textContent = '⚪';
    }

    // Hand Tracking State & Tutorial Unlock
    if (!bothReady) {
      handVal.textContent = 'Waiting for Camera and Model';
      diagHand.textContent = '⚪';
      btnStart.disabled = true;
    } else {
      btnStart.disabled = false;
      if (hasHand) {
        const gestureName = this.latestClassification ? this.latestClassification.gesture : 'NEUTRAL';
        handVal.textContent = `Hand Detected (${gestureName})`;
        diagHand.textContent = '🟢';
        indicator.textContent = `✅ HAND DETECTED: ${gestureName}`;
        indicator.className = 'setup-status-overlay status-locked';
      } else {
        const recentlyLost = this.lastHandSeenTime > 0 && (now - this.lastHandSeenTime < 1400);
        if (recentlyLost) {
          handVal.textContent = 'Tracking Lost';
          diagHand.textContent = '🟠';
          indicator.textContent = '⚠️ TRACKING LOST — HOLD HAND IN VIEW';
          indicator.className = 'setup-status-overlay status-waiting';
        } else {
          handVal.textContent = 'No Hand Detected';
          diagHand.textContent = '⚪';
          indicator.textContent = '👀 HOLD HAND IN FRONT OF CAMERA (1.5 - 2.5 FT)';
          indicator.className = 'setup-status-overlay status-waiting';
        }
      }
    }
  }

  startPreviewLoop() {
    this.stopPreviewLoop();

    const loop = () => {
      // Render clean points-only futuristic digital display
      // (Inference is handled autonomously by the decoupled GameLoop scheduler)
      const ctx = this.previewCtx;
      const w = this.previewCanvas.width;
      const h = this.previewCanvas.height;

      ctx.clearRect(0, 0, w, h);

      // Light-theme Sky background
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

      // Calibration guide lines
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

      // Render 21 MediaPipe hand landmarks and bone structure
      if (hasHand) {
        const pts = this.latestHandData.points;
        const connections = [
          [0, 1], [1, 2], [2, 3], [3, 4],
          [0, 5], [5, 6], [6, 7], [7, 8],
          [5, 9], [9, 10], [10, 11], [11, 12],
          [9, 13], [13, 14], [14, 15], [15, 16],
          [13, 17], [17, 18], [18, 19], [19, 20],
          [0, 17]
        ];

        // Skeletal bones
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

        // Landmark joint nodes
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

        // Palm center node
        ctx.fillStyle = '#008BFF';
        ctx.beginPath();
        ctx.arc(this.latestHandData.palmCenter.x * w, this.latestHandData.palmCenter.y * h, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Update real-time text and status indicators
      this.updateDiagnosticsRealtime(hasHand, now);

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

    // Sync live camera and model states
    this.cameraState = Camera.isReady ? SETUP_STATES.CAMERA.READY : SETUP_STATES.CAMERA.UNAVAILABLE;
    this.modelState = MediaPipe.isLoaded ? SETUP_STATES.MODEL.READY : (
      MediaPipe.state === MEDIAPIPE_STATES.ERROR ? SETUP_STATES.MODEL.LOAD_FAILED : SETUP_STATES.MODEL.NOT_LOADED
    );

    this.updateUI();

    if (Camera.isReady) {
      Calibration.startCalibration();
      this.startPreviewLoop();
    }
  }

  hide() {
    this.stopPreviewLoop();
    this.element.classList.add('hidden');
  }
}
