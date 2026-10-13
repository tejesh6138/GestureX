/**
 * AI Gesture Runner 3D - High-Precision Performance Monitor
 * Measures actual rendered frames, smoothed FPS, frame-time spikes,
 * WebGL draw calls, and decoupled AI inference metrics.
 */

export class PerformanceMonitor {
  constructor() {
    // Frame Timing & FPS
    this.currentFps = 60;
    this.smoothedFps = 60;
    this.frameTimeMs = 16.6;
    this.smoothedFrameTimeMs = 16.6;
    this.lastFrameTimestamp = performance.now();
    this.frameCount = 0;
    this.windowFrameCount = 0;
    this.windowStartTime = performance.now();
    this.longFramesCount = 0;
    this.spikeCount = 0;
    this.recentFrameTimes = [];

    // AI Computer-Vision Inference Metrics
    this.inferenceDurationMs = 0;
    this.avgInferenceDurationMs = 0;
    this.inferenceTimes = [];
    this.inferenceCallCount = 0;
    this.inferenceFps = 0;
    this.lastInferenceCalcTime = performance.now();
    this.inferenceCountWindow = 0;

    // Gesture Action Latency
    this.actionLatencyMs = 0;
    this.avgActionLatencyMs = 0;
    this.actionLatencyTimes = [];

    // WebGL / Three.js Renderer Workload
    this.drawCalls = 0;
    this.triangles = 0;

    // Adaptive Performance Evaluation State
    this.sustainedDropTimeMs = 0;
    this.sustainedHighTimeMs = 0;
    this.qualityTier = 'HIGH'; // 'HIGH', 'BALANCED', 'PERFORMANCE'
    this.isLowPerformance = false;
  }

  /**
   * Called once per rendered animation frame.
   * @param {number} now - High-precision performance timestamp.
   * @param {THREE.WebGLRenderer} [renderer] - Optional renderer to sample draw calls.
   */
  updateFrame(now = performance.now(), renderer = null) {
    const delta = now - this.lastFrameTimestamp;
    this.lastFrameTimestamp = now;

    // Ignore invalid or paused delta transitions (e.g. background tab return)
    if (delta <= 0 || delta > 500) {
      return;
    }

    this.frameTimeMs = delta;
    this.frameCount++;
    this.windowFrameCount++;

    // Rolling frame-time history for 95th-percentile (p95) metric
    this.recentFrameTimes.push(delta);
    if (this.recentFrameTimes.length > 60) {
      this.recentFrameTimes.shift();
    }

    // Exponential Moving Average (EMA) for smooth, stable FPS readout
    const alpha = 0.12;
    this.smoothedFrameTimeMs = this.smoothedFrameTimeMs * (1 - alpha) + delta * alpha;
    this.currentFps = Math.min(240, Math.max(1, Math.round(1000 / delta)));
    this.smoothedFps = Math.min(240, Math.max(1, Math.round(1000 / this.smoothedFrameTimeMs)));

    // Track frame spikes (> 33.3ms implies sub-30 FPS dropped frame)
    if (delta > 33.3) {
      this.longFramesCount++;
    }
    if (delta > 45.0) {
      this.spikeCount++;
    }

    // Rolling 250ms evaluation window for rapid response to severe drops
    const windowElapsed = now - this.windowStartTime;
    if (windowElapsed >= 250) {
      // 25.0ms is the frame-time budget for 40 FPS target
      // Severe drop: frame times > 35ms (sub-28 FPS, e.g. 12-20 FPS range)
      if (this.smoothedFrameTimeMs > 35.0 || this.smoothedFps < 28) {
        this.sustainedDropTimeMs += windowElapsed * 2.0; // Accelerate emergency response
        this.sustainedHighTimeMs = 0;
      } else if (this.smoothedFrameTimeMs > 25.0 || this.smoothedFps < 38) {
        // Sustained sub-40 FPS: frame time exceeds 25.0ms budget
        this.sustainedDropTimeMs += windowElapsed;
        this.sustainedHighTimeMs = 0;
      } else if (this.smoothedFrameTimeMs <= 18.0 && this.smoothedFps >= 55) {
        // High stability: frame time <= 18ms (>= 55 FPS)
        this.sustainedHighTimeMs += windowElapsed;
        this.sustainedDropTimeMs = 0;
      } else {
        this.sustainedDropTimeMs = Math.max(0, this.sustainedDropTimeMs - windowElapsed * 0.5);
        this.sustainedHighTimeMs = Math.max(0, this.sustainedHighTimeMs - windowElapsed * 0.5);
      }

      this.isLowPerformance = this.smoothedFrameTimeMs > 25.0 || this.sustainedDropTimeMs > 800;

      this.windowFrameCount = 0;
      this.windowStartTime = now;
    }

    // Capture WebGL draw calls & geometry complexity when renderer is available
    if (renderer && renderer.info && renderer.info.render) {
      this.drawCalls = renderer.info.render.calls;
      this.triangles = renderer.info.render.triangles;
    }
  }

  /**
   * Records completed AI inference duration and calculates actual AI inference rate.
   * @param {number} startTime - performance.now() captured immediately prior to inference.
   */
  recordInference(startTime) {
    const now = performance.now();
    const duration = now - startTime;
    this.inferenceDurationMs = Number(duration.toFixed(1));

    this.inferenceTimes.push(duration);
    if (this.inferenceTimes.length > 20) {
      this.inferenceTimes.shift();
    }

    const sum = this.inferenceTimes.reduce((a, b) => a + b, 0);
    this.avgInferenceDurationMs = Number((sum / this.inferenceTimes.length).toFixed(1));

    this.inferenceCallCount++;
    this.inferenceCountWindow++;

    // Responsive 500ms window for prompt inference rate updates
    const inferenceElapsed = now - this.lastInferenceCalcTime;
    if (inferenceElapsed >= 500) {
      this.inferenceFps = Math.round((this.inferenceCountWindow * 1000) / inferenceElapsed);
      this.inferenceCountWindow = 0;
      this.lastInferenceCalcTime = now;
    }
  }

  /**
   * Records the latency from gesture detection consensus to gameplay event execution.
   * @param {number} latencyMs
   */
  recordActionLatency(latencyMs) {
    if (typeof latencyMs !== 'number' || isNaN(latencyMs)) return;
    this.actionLatencyMs = Number(latencyMs.toFixed(1));
    this.actionLatencyTimes.push(latencyMs);
    if (this.actionLatencyTimes.length > 20) {
      this.actionLatencyTimes.shift();
    }
    const sum = this.actionLatencyTimes.reduce((a, b) => a + b, 0);
    this.avgActionLatencyMs = Number((sum / this.actionLatencyTimes.length).toFixed(1));
  }

  getP95FrameTime() {
    if (!this.recentFrameTimes || this.recentFrameTimes.length === 0) {
      return Number(this.smoothedFrameTimeMs.toFixed(1));
    }
    const sorted = [...this.recentFrameTimes].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    return Number(sorted[idx].toFixed(1));
  }

  setQualityTier(tier) {
    this.qualityTier = tier;
  }

  /**
   * Suggests adaptive quality tier adjustments with hysteresis.
   * Prevents rapid oscillations while responding immediately to emergency 12-20 FPS drops.
   * @returns {'EMERGENCY_DOWNGRADE' | 'DOWNGRADE' | 'UPGRADE' | 'STABLE'}
   */
  getAdaptiveRecommendation() {
    // Critical 12-20 FPS recovery: if frame times > 35ms for >= 600ms, jump immediately to PERFORMANCE tier
    if (this.smoothedFrameTimeMs > 35.0 && this.sustainedDropTimeMs >= 600) {
      return 'EMERGENCY_DOWNGRADE';
    }

    // Standard downgrade: frame times exceeding 25ms budget for >= 1200ms
    if (this.sustainedDropTimeMs >= 1200) {
      return 'DOWNGRADE';
    }

    // Cautious upgrade: running smoothly at 55+ FPS (frame times <= 18ms) for >= 4.0s
    if (this.sustainedHighTimeMs >= 4000) {
      return 'UPGRADE';
    }

    return 'STABLE';
  }

  consumeRecommendation() {
    this.sustainedDropTimeMs = 0;
    this.sustainedHighTimeMs = 0;
  }

  getMetrics() {
    return {
      fps: this.smoothedFps,
      rawFps: this.currentFps,
      frameTimeMs: Number(this.smoothedFrameTimeMs.toFixed(1)),
      rawFrameTimeMs: Number(this.frameTimeMs.toFixed(1)),
      p95FrameTimeMs: this.getP95FrameTime(),
      longFramesCount: this.longFramesCount,
      spikeCount: this.spikeCount,
      inferenceDurationMs: this.inferenceDurationMs,
      avgInferenceMs: this.avgInferenceDurationMs,
      inferenceFps: this.inferenceFps,
      actionLatencyMs: this.actionLatencyMs,
      avgActionLatencyMs: this.avgActionLatencyMs,
      drawCalls: this.drawCalls,
      triangles: this.triangles,
      qualityTier: this.qualityTier,
      isLowPerformance: this.isLowPerformance
    };
  }

  reset() {
    this.frameCount = 0;
    this.longFramesCount = 0;
    this.spikeCount = 0;
    this.sustainedDropTimeMs = 0;
    this.sustainedHighTimeMs = 0;
  }
}
