/**
 * AI Gesture Runner 3D - Performance Monitor
 * Tracks rendering FPS, AI inference latency, and enables dynamic quality throttling.
 */

export class PerformanceMonitor {
  constructor() {
    this.fps = 60;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];
    this.inferenceLatencyMs = 0;
    this.lastInferenceTime = performance.now();
    this.inferenceTimes = [];
    this.isLowPerformance = false;
  }

  updateFrame() {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastTime;

    if (elapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastTime = now;

      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > 5) this.fpsHistory.shift();

      // Check if performance is persistently low (< 26 FPS)
      const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
      this.isLowPerformance = avgFps < 26;
    }
  }

  recordInference(startTime) {
    const latency = performance.now() - startTime;
    this.inferenceLatencyMs = Math.round(latency);
    this.inferenceTimes.push(this.inferenceLatencyMs);
    if (this.inferenceTimes.length > 10) this.inferenceTimes.shift();
  }

  getMetrics() {
    const avgInference = this.inferenceTimes.length > 0
      ? Math.round(this.inferenceTimes.reduce((a, b) => a + b, 0) / this.inferenceTimes.length)
      : 0;

    return {
      fps: this.fps,
      inferenceLatencyMs: this.inferenceLatencyMs,
      avgInferenceMs: avgInference,
      isLowPerformance: this.isLowPerformance
    };
  }
}
