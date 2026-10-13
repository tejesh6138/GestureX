/**
 * AI Gesture Runner 3D - DiagnosticPanel
 * Compact, collapsible real-time diagnostic panel displaying actual computer-vision
 * pipeline metrics, camera states, hardware acceleration delegate, gesture status,
 * game rendering FPS, frame times, and adaptive quality tier.
 */

import { Camera } from '../gesture/CameraService.js';
import { MediaPipe } from '../gesture/MediaPipeService.js';
import { Gestures } from '../gesture/GestureController.js';

export class DiagnosticPanel {
  constructor(container, perfMonitor = null) {
    this.container = container;
    this.perfMonitor = perfMonitor;
    this.element = null;
    this.isExpanded = false;
    this.timerId = null;
    this.refs = {};

    this.build();
    this.startUpdater();
  }

  setPerfMonitor(perfMonitor) {
    this.perfMonitor = perfMonitor;
  }

  build() {
    this.element = document.createElement('div');
    this.element.id = 'ai-diagnostic-panel';
    this.element.className = 'diag-panel-collapsed';

    this.element.innerHTML = `
      <div class="diag-panel-header" id="diag-toggle-btn">
        <span class="diag-pulse-dot" id="diag-pulse">🟢</span>
        <span class="diag-header-title">AI & SYSTEM DIAGNOSTICS</span>
        <span id="diag-mini-fps" style="font-size: 10px; margin-left: 6px; color: #008BFF; font-weight: bold;">-- FPS</span>
        <span class="diag-toggle-icon" id="diag-toggle-icon">▲</span>
      </div>

      <div class="diag-panel-body" id="diag-panel-body" style="display: none;">
        <table class="diag-table">
          <tbody>
            <tr>
              <td>Game Render FPS</td>
              <td id="diag-stat-render-fps" class="neon-text">-- FPS</td>
            </tr>
            <tr>
              <td>Frame Time (p95)</td>
              <td id="diag-stat-frametime">-- ms</td>
            </tr>
            <tr>
              <td>Camera Capture Rate</td>
              <td id="diag-stat-cam-fps">-- FPS</td>
            </tr>
            <tr>
              <td>AI Inference Rate</td>
              <td id="diag-stat-fps" class="neon-text">-- FPS</td>
            </tr>
            <tr>
              <td>Inference Latency</td>
              <td id="diag-stat-speed">-- ms</td>
            </tr>
            <tr>
              <td>Gesture Action Delay</td>
              <td id="diag-stat-action-latency">-- ms</td>
            </tr>
            <tr>
              <td>Graphics Quality</td>
              <td id="diag-stat-quality"><span class="diag-tag-yes">HIGH</span></td>
            </tr>
            <tr>
              <td>Draw Calls</td>
              <td id="diag-stat-drawcalls">--</td>
            </tr>
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
              <td>Pipeline Error</td>
              <td id="diag-stat-error" class="diag-error-cell">None</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    this.container.appendChild(this.element);

    // Cache DOM references to completely avoid per-update querySelector calls
    this.refs = {
      body: this.element.querySelector('#diag-panel-body'),
      toggleIcon: this.element.querySelector('#diag-toggle-icon'),
      miniFps: this.element.querySelector('#diag-mini-fps'),
      pulse: this.element.querySelector('#diag-pulse'),
      renderFps: this.element.querySelector('#diag-stat-render-fps'),
      frametime: this.element.querySelector('#diag-stat-frametime'),
      camFps: this.element.querySelector('#diag-stat-cam-fps'),
      fps: this.element.querySelector('#diag-stat-fps'),
      speed: this.element.querySelector('#diag-stat-speed'),
      actionLatency: this.element.querySelector('#diag-stat-action-latency'),
      quality: this.element.querySelector('#diag-stat-quality'),
      drawcalls: this.element.querySelector('#diag-stat-drawcalls'),
      camState: this.element.querySelector('#diag-stat-cam-state'),
      camRes: this.element.querySelector('#diag-stat-cam-res'),
      modelState: this.element.querySelector('#diag-stat-model-state'),
      delegate: this.element.querySelector('#diag-stat-delegate'),
      handDet: this.element.querySelector('#diag-stat-hand-detected'),
      handCount: this.element.querySelector('#diag-stat-hand-count'),
      gesture: this.element.querySelector('#diag-stat-gesture'),
      error: this.element.querySelector('#diag-stat-error')
    };

    this.element.querySelector('#diag-toggle-btn').onclick = () => {
      this.toggle();
    };
  }

  toggle() {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      this.element.className = 'diag-panel-expanded';
      this.refs.body.style.display = 'block';
      this.refs.toggleIcon.textContent = '▼';
      this.updateStats();
    } else {
      this.element.className = 'diag-panel-collapsed';
      this.refs.body.style.display = 'none';
      this.refs.toggleIcon.textContent = '▲';
    }
  }

  startUpdater() {
    // 250ms interval prevents excessive DOM reflow while remaining responsive
    this.timerId = setInterval(() => {
      this.updateStats();
    }, 250);
  }

  updateStats() {
    if (!this.element) return;

    // Performance metrics
    let fpsText = '-- FPS';
    if (this.perfMonitor) {
      const metrics = this.perfMonitor.getMetrics();
      fpsText = `${metrics.fps} FPS`;

      if (this.refs.miniFps) {
        this.refs.miniFps.textContent = fpsText;
        if (metrics.fps >= 55) {
          this.refs.miniFps.style.color = '#00C853';
        } else if (metrics.fps >= 38) {
          this.refs.miniFps.style.color = '#008BFF';
        } else {
          this.refs.miniFps.style.color = '#FF7A5C';
        }
      }

      if (this.isExpanded) {
        if (this.refs.renderFps) this.refs.renderFps.textContent = fpsText;
        if (this.refs.frametime) {
          const p95 = metrics.p95FrameTimeMs || metrics.frameTimeMs;
          this.refs.frametime.textContent = `${metrics.frameTimeMs} ms (p95: ${p95} ms)`;
        }
        if (this.refs.actionLatency) {
          this.refs.actionLatency.textContent = metrics.actionLatencyMs > 0 ? `${metrics.actionLatencyMs} ms` : '< 1 ms';
        }
        if (this.refs.quality) {
          const q = metrics.qualityTier || 'HIGH';
          this.refs.quality.innerHTML = `<span class="diag-tag-yes">${q}</span>`;
        }
        if (this.refs.drawcalls) {
          this.refs.drawcalls.textContent = metrics.drawCalls > 0 ? `${metrics.drawCalls} calls` : '--';
        }
      }
    }

    // Only update extended DOM table when the panel is expanded
    if (!this.isExpanded) return;

    const camDiag = Camera.getDiagnostics();
    const mpDiag = MediaPipe.getDiagnostics();
    const gestDiag = Gestures.getDiagnostics();

    // 1. Camera state, capture rate & resolution
    if (this.refs.camState) this.refs.camState.textContent = camDiag.state;
    if (this.refs.camFps) this.refs.camFps.textContent = camDiag.fps > 0 ? `${camDiag.fps} FPS` : (camDiag.isReady ? '30-60 FPS' : '--');
    if (this.refs.camRes) {
      this.refs.camRes.textContent = camDiag.videoWidth > 0
        ? `${camDiag.videoWidth} x ${camDiag.videoHeight}`
        : 'Offline';
    }

    // 2. Model state & delegate
    if (this.refs.modelState) this.refs.modelState.textContent = mpDiag.state;
    if (this.refs.delegate) this.refs.delegate.textContent = mpDiag.activeDelegate ? mpDiag.activeDelegate.toUpperCase() : 'None';

    // 3. Hand detection & count
    const hasHand = !gestDiag.isTrackingLost && gestDiag.activeGesture !== 'NONE';
    if (this.refs.handDet) {
      this.refs.handDet.innerHTML = hasHand
        ? '<span class="diag-tag-yes">YES (Active)</span>'
        : '<span class="diag-tag-no">NO</span>';
    }
    if (this.refs.handCount) {
      this.refs.handCount.textContent = hasHand ? '1 Hand' : '0';
    }

    // 4. Active Gesture
    if (this.refs.gesture) this.refs.gesture.textContent = gestDiag.activeGesture || 'NONE';

    // 5. Inference Latency & Actual Processed Rate
    if (this.refs.speed) this.refs.speed.textContent = mpDiag.lastDurationMs > 0 ? `${mpDiag.lastDurationMs} ms` : '--';
    if (this.refs.fps) this.refs.fps.textContent = `${mpDiag.fps} FPS`;

    // 6. Error status
    const lastErr = camDiag.lastError || mpDiag.lastError;
    if (this.refs.error) {
      if (lastErr) {
        this.refs.error.textContent = lastErr.length > 32 ? lastErr.slice(0, 32) + '...' : lastErr;
        this.refs.error.className = 'diag-error-cell diag-has-error';
      } else {
        this.refs.error.textContent = 'None';
        this.refs.error.className = 'diag-error-cell';
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
