/**
 * AI Gesture Runner 3D - DiagnosticPanel
 * Compact, collapsible real-time diagnostic panel displaying actual computer-vision
 * pipeline metrics, camera states, hardware acceleration delegate, and gesture status.
 */

import { Camera } from '../gesture/CameraService.js';
import { MediaPipe } from '../gesture/MediaPipeService.js';
import { Gestures } from '../gesture/GestureController.js';

export class DiagnosticPanel {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.isExpanded = false;
    this.timerId = null;

    this.build();
    this.startUpdater();
  }

  build() {
    this.element = document.createElement('div');
    this.element.id = 'ai-diagnostic-panel';
    this.element.className = 'diag-panel-collapsed';

    this.element.innerHTML = `
      <div class="diag-panel-header" id="diag-toggle-btn">
        <span class="diag-pulse-dot">🟢</span>
        <span class="diag-header-title">AI DIAGNOSTICS</span>
        <span class="diag-toggle-icon" id="diag-toggle-icon">▲</span>
      </div>

      <div class="diag-panel-body" id="diag-panel-body" style="display: none;">
        <table class="diag-table">
          <tbody>
            <tr>
              <td>Camera State</td>
              <td id="diag-stat-cam-state">STOPPED</td>
            </tr>
            <tr>
              <td>Video Resolution</td>
              <td id="diag-stat-cam-res">-- x --</td>
            </tr>
            <tr>
              <td>MediaPipe Model</td>
              <td id="diag-stat-model-state">UNINITIALIZED</td>
            </tr>
            <tr>
              <td>Model Delegate</td>
              <td id="diag-stat-delegate">--</td>
            </tr>
            <tr>
              <td>Hand Detected</td>
              <td id="diag-stat-hand-detected"><span class="diag-tag-no">NO</span></td>
            </tr>
            <tr>
              <td>Hands In View</td>
              <td id="diag-stat-hand-count">0</td>
            </tr>
            <tr>
              <td>Active Gesture</td>
              <td id="diag-stat-gesture" class="neon-text">NONE</td>
            </tr>
            <tr>
              <td>Inference Speed</td>
              <td id="diag-stat-speed">-- ms</td>
            </tr>
            <tr>
              <td>Inference Rate</td>
              <td id="diag-stat-fps">-- FPS</td>
            </tr>
            <tr>
              <td>Pipeline Error</td>
              <td id="diag-stat-error" class="diag-error-cell">None</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    this.container.appendChild(this.element);

    this.element.querySelector('#diag-toggle-btn').onclick = () => {
      this.toggle();
    };
  }

  toggle() {
    this.isExpanded = !this.isExpanded;
    const body = this.element.querySelector('#diag-panel-body');
    const icon = this.element.querySelector('#diag-toggle-icon');

    if (this.isExpanded) {
      this.element.className = 'diag-panel-expanded';
      body.style.display = 'block';
      icon.textContent = '▼';
    } else {
      this.element.className = 'diag-panel-collapsed';
      body.style.display = 'none';
      icon.textContent = '▲';
    }
  }

  startUpdater() {
    this.timerId = setInterval(() => {
      this.updateStats();
    }, 250);
  }

  updateStats() {
    if (!this.element) return;

    const camDiag = Camera.getDiagnostics();
    const mpDiag = MediaPipe.getDiagnostics();
    const gestDiag = Gestures.getDiagnostics();

    // 1. Camera state & resolution
    const elCamState = this.element.querySelector('#diag-stat-cam-state');
    const elCamRes = this.element.querySelector('#diag-stat-cam-res');
    if (elCamState) elCamState.textContent = camDiag.state;
    if (elCamRes) {
      elCamRes.textContent = camDiag.videoWidth > 0
        ? `${camDiag.videoWidth} x ${camDiag.videoHeight}`
        : 'Offline';
    }

    // 2. Model state & delegate
    const elModelState = this.element.querySelector('#diag-stat-model-state');
    const elDelegate = this.element.querySelector('#diag-stat-delegate');
    if (elModelState) elModelState.textContent = mpDiag.state;
    if (elDelegate) elDelegate.textContent = mpDiag.activeDelegate ? mpDiag.activeDelegate.toUpperCase() : 'None';

    // 3. Hand detection & count
    const hasHand = !gestDiag.isTrackingLost && gestDiag.activeGesture !== 'NONE';
    const elHandDet = this.element.querySelector('#diag-stat-hand-detected');
    const elHandCount = this.element.querySelector('#diag-stat-hand-count');
    if (elHandDet) {
      elHandDet.innerHTML = hasHand
        ? '<span class="diag-tag-yes">YES (Active)</span>'
        : '<span class="diag-tag-no">NO</span>';
    }
    if (elHandCount) {
      elHandCount.textContent = hasHand ? '1 Hand' : '0';
    }

    // 4. Gesture
    const elGesture = this.element.querySelector('#diag-stat-gesture');
    if (elGesture) elGesture.textContent = gestDiag.activeGesture || 'NONE';

    // 5. Speed & FPS
    const elSpeed = this.element.querySelector('#diag-stat-speed');
    const elFps = this.element.querySelector('#diag-stat-fps');
    if (elSpeed) elSpeed.textContent = mpDiag.lastDurationMs > 0 ? `${mpDiag.lastDurationMs} ms` : '--';
    if (elFps) elFps.textContent = `${mpDiag.fps} FPS`;

    // 6. Error status
    const elError = this.element.querySelector('#diag-stat-error');
    const lastErr = camDiag.lastError || mpDiag.lastError;
    if (elError) {
      if (lastErr) {
        elError.textContent = lastErr.length > 32 ? lastErr.slice(0, 32) + '...' : lastErr;
        elError.className = 'diag-error-cell diag-has-error';
      } else {
        elError.textContent = 'None';
        elError.className = 'diag-error-cell';
      }
    }
  }

  destroy() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
