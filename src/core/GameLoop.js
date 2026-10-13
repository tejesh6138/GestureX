/**
 * AI Gesture Runner 3D - GameLoop
 * High-precision RAF loop with clamped delta time and decoupled AI inference frequency.
 */

import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';
import { Camera } from '../gesture/CameraService.js';

export class GameLoop {
  constructor() {
    this.isRunning = false;
    this.lastTime = 0;
    this.totalTime = 0;
    this.perfMonitor = new PerformanceMonitor();

    this.updateCallback = null;
    this.renderCallback = null;
    this.inferenceCallback = null;

    // AI inference target interval (16.6ms = 60 FPS target on capable hardware)
    this.lastInferenceTime = 0;
    this.inferenceIntervalMs = 1000 / 60;

    this.renderer = null;
    this.rafId = null;
    this.inferenceTimerId = null;
    this.videoCallbackId = null;
    this.trackedVideoElement = null;
    this.isInferenceRunning = false;
    this.handleVisibility = this.handleVisibility.bind(this);
  }

  setCallbacks({ onUpdate, onRender, onInference }) {
    this.updateCallback = onUpdate;
    this.renderCallback = onRender;
    this.inferenceCallback = onInference;
  }

  setRenderer(renderer) {
    this.renderer = renderer;
  }

  setInferenceInterval(ms) {
    this.inferenceIntervalMs = Math.max(12, ms);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.tick = this.tick.bind(this);
    this.rafId = requestAnimationFrame(this.tick);

    // Launch autonomous decoupled AI inference loop
    this.startInferenceScheduler();
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.inferenceTimerId) {
      clearTimeout(this.inferenceTimerId);
      this.inferenceTimerId = null;
    }
    if (this.videoCallbackId && this.trackedVideoElement && typeof this.trackedVideoElement.cancelVideoFrameCallback === 'function') {
      try {
        this.trackedVideoElement.cancelVideoFrameCallback(this.videoCallbackId);
      } catch (e) {}
      this.videoCallbackId = null;
    }
    this.trackedVideoElement = null;
    this.isInferenceRunning = false;
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  handleVisibility() {
    if (document.hidden) {
      this.lastTime = performance.now();
      if (this.inferenceTimerId) {
        clearTimeout(this.inferenceTimerId);
        this.inferenceTimerId = null;
      }
      if (this.videoCallbackId && this.trackedVideoElement && typeof this.trackedVideoElement.cancelVideoFrameCallback === 'function') {
        try {
          this.trackedVideoElement.cancelVideoFrameCallback(this.videoCallbackId);
        } catch (e) {}
        this.videoCallbackId = null;
      }
    } else if (this.isRunning) {
      this.lastTime = performance.now();
      this.startInferenceScheduler();
    }
  }

  /**
   * Autonomous decoupled AI Computer-Vision scheduler.
   * Runs independently of requestAnimationFrame so rendering is never blocked
   * or stalled by MediaPipe's neural-network execution.
   */
  startInferenceScheduler(videoElement = null) {
    if (this.inferenceTimerId) {
      clearTimeout(this.inferenceTimerId);
      this.inferenceTimerId = null;
    }
    if (this.videoCallbackId && this.trackedVideoElement && typeof this.trackedVideoElement.cancelVideoFrameCallback === 'function') {
      try {
        this.trackedVideoElement.cancelVideoFrameCallback(this.videoCallbackId);
      } catch (e) {}
      this.videoCallbackId = null;
    }

    const video = videoElement || (Camera?.getVideo ? Camera.getVideo() : null);

    // If browser supports requestVideoFrameCallback on decoded video stream,
    // synchronize inference directly with new incoming camera frames with zero wasted duplicate polls!
    if (video && typeof video.requestVideoFrameCallback === 'function' && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.trackedVideoElement = video;
      const onVideoFrame = (now) => {
        if (!this.isRunning || document.hidden) return;

        // Adaptive inference pacing: guarantees render loop is never starved by slow CPU inference
        const minGap = Math.max(this.inferenceIntervalMs - 2, (this.lastInferenceDuration || 0) * 0.75);
        const elapsed = now - this.lastInferenceTime;
        if (elapsed >= minGap) {
          this.runInferenceStep();
        }

        if (this.isRunning && !document.hidden && this.trackedVideoElement) {
          this.videoCallbackId = this.trackedVideoElement.requestVideoFrameCallback(onVideoFrame);
        }
      };

      this.videoCallbackId = video.requestVideoFrameCallback(onVideoFrame);
    } else {
      // High-resolution decoupled timer loop for maximum cross-browser compatibility
      const scheduleNext = () => {
        if (!this.isRunning || document.hidden) return;

        const now = performance.now();
        const minGap = Math.max(this.inferenceIntervalMs, (this.lastInferenceDuration || 0) * 0.85);
        const elapsed = now - this.lastInferenceTime;
        const delay = Math.max(4, minGap - elapsed);

        this.inferenceTimerId = setTimeout(() => {
          if (!this.isRunning || document.hidden) return;
          this.runInferenceStep();
          scheduleNext();
        }, delay);
      };

      scheduleNext();
    }
  }

  runInferenceStep() {
    if (this.isInferenceRunning || !this.inferenceCallback) return;
    this.isInferenceRunning = true;
    const startTime = performance.now();
    let result = null;

    try {
      result = this.inferenceCallback(startTime);
    } catch (err) {
      console.warn('[GameLoop] Inference step warning:', err);
    } finally {
      const endTime = performance.now();
      this.lastInferenceDuration = endTime - startTime;
      this.lastInferenceTime = endTime;
      this.isInferenceRunning = false;
      // Record inference metrics ONLY if a new frame was actually processed by the neural net
      if (result && result.isFresh) {
        this.perfMonitor.recordInference(startTime);
      }
    }
  }

  tick(currentTime) {
    if (!this.isRunning) return;

    let dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp delta time to avoid large physics steps when tab unfocuses
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) dt = 0.016;

    this.totalTime += dt;

    // 1. Authoritative Gameplay Physics & Logic Simulation
    if (this.updateCallback) {
      this.updateCallback(dt, this.totalTime);
    }

    // 2. High-Refresh WebGL Render Pass (unimpeded by MediaPipe inference)
    if (this.renderCallback) {
      this.renderCallback();
    }

    // 3. Update performance monitor with real frame timestamp and WebGL renderer draw calls
    this.perfMonitor.updateFrame(currentTime, this.renderer);

    this.rafId = requestAnimationFrame(this.tick);
  }
}
