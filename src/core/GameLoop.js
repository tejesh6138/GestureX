/**
 * AI Gesture Runner 3D - GameLoop
 * High-precision RAF loop with clamped delta time and decoupled AI inference frequency.
 */

import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';

export class GameLoop {
  constructor() {
    this.isRunning = false;
    this.lastTime = 0;
    this.totalTime = 0;
    this.perfMonitor = new PerformanceMonitor();

    this.updateCallback = null;
    this.renderCallback = null;
    this.inferenceCallback = null;

    // AI inference throttling (30 FPS max)
    this.lastInferenceTime = 0;
    this.inferenceIntervalMs = 1000 / 30;

    this.rafId = null;
    this.handleVisibility = this.handleVisibility.bind(this);
  }

  setCallbacks({ onUpdate, onRender, onInference }) {
    this.updateCallback = onUpdate;
    this.renderCallback = onRender;
    this.inferenceCallback = onInference;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.tick = this.tick.bind(this);
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  handleVisibility() {
    if (document.hidden) {
      this.lastTime = performance.now();
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
    this.perfMonitor.updateFrame();

    // 1. Decoupled AI Computer-Vision Inference Tick
    if (this.inferenceCallback && currentTime - this.lastInferenceTime >= this.inferenceIntervalMs) {
      const inferenceStart = performance.now();
      this.inferenceCallback(currentTime);
      this.perfMonitor.recordInference(inferenceStart);
      this.lastInferenceTime = currentTime;
    }

    // 2. Gameplay Physics & Logic Update
    if (this.updateCallback) {
      this.updateCallback(dt, this.totalTime);
    }

    // 3. WebGL Render Update
    if (this.renderCallback) {
      this.renderCallback();
    }

    this.rafId = requestAnimationFrame(this.tick);
  }
}
