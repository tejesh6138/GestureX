/**
 * AI Gesture Runner 3D - MediaPipeService
 * Robust loader and runner for @mediapipe/tasks-vision HandLandmarker.
 * Implements 4-tier GPU/CPU & local/CDN fallback, strictly monotonic timestamps,
 * concurrency locks, and video frame validation.
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { ENVIRONMENT } from '../config/environment.js';

export const MEDIAPIPE_STATES = {
  UNINITIALIZED: 'UNINITIALIZED',
  LOADING_WASM: 'LOADING_WASM',
  LOADING_MODEL: 'LOADING_MODEL',
  READY: 'READY',
  ERROR: 'ERROR'
};

export class MediaPipeService {
  constructor() {
    this.handLandmarker = null;
    this.isLoaded = false;
    this.isLoading = false;
    this.state = MEDIAPIPE_STATES.UNINITIALIZED;
    this.activeDelegate = 'GPU';
    this.lastVideoTime = -1;
    this.lastTimestampMs = 0;
    this.isDetecting = false;
    this.lastResult = null;
    this.lastError = null;

    // Performance metrics
    this.inferenceCount = 0;
    this.lastInferenceTime = 0;
    this.lastInferenceDurationMs = 0;
    this.inferenceFps = 0;
    this.fpsCounter = 0;
    this.fpsLastCalc = performance.now();
  }

  async init() {
    if (this.isLoaded && this.handLandmarker) return true;
    if (this.isLoading) {
      // Return ongoing promise or wait
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (!this.isLoading) {
            clearInterval(interval);
            resolve(this.isLoaded);
          }
        }, 100);
      });
    }

    this.isLoading = true;
    this.state = MEDIAPIPE_STATES.LOADING_WASM;

    try {
      console.log('[MediaPipeService] Initializing FilesetResolver for vision tasks...');

      const localWasmUrl = typeof window !== 'undefined'
        ? new URL('wasm', window.location.href).href
        : ENVIRONMENT.AI.WASM_PATH;

      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks(localWasmUrl);
        console.log('[MediaPipeService] Local WASM fileset resolved successfully.');
      } catch (localWasmErr) {
        console.warn('[MediaPipeService] Local WASM load failed, falling back to CDN:', localWasmErr);
        vision = await FilesetResolver.forVisionTasks(ENVIRONMENT.AI.WASM_FALLBACK_URL);
        console.log('[MediaPipeService] CDN WASM fileset resolved successfully.');
      }

      this.state = MEDIAPIPE_STATES.LOADING_MODEL;
      console.log('[MediaPipeService] Loading HandLandmarker model...');

      const localModelUrl = typeof window !== 'undefined'
        ? new URL('models/hand_landmarker.task', window.location.href).href
        : ENVIRONMENT.AI.MODEL_PATH;

      const modelCandidates = [
        { path: localModelUrl, delegate: 'GPU', name: 'Local Model (GPU)' },
        { path: localModelUrl, delegate: 'CPU', name: 'Local Model (CPU)' },
        { path: ENVIRONMENT.AI.MODEL_FALLBACK_URL, delegate: 'GPU', name: 'CDN Model (GPU)' },
        { path: ENVIRONMENT.AI.MODEL_FALLBACK_URL, delegate: 'CPU', name: 'CDN Model (CPU)' }
      ];

      let landmarker = null;
      let lastErr = null;

      for (const candidate of modelCandidates) {
        try {
          console.log(`[MediaPipeService] Attempting to initialize ${candidate.name}...`);
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: candidate.path,
              delegate: candidate.delegate
            },
            runningMode: 'VIDEO',
            numHands: ENVIRONMENT.AI.NUM_HANDS || 1,
            minHandDetectionConfidence: ENVIRONMENT.AI.MIN_HAND_DETECTION_CONFIDENCE || 0.6,
            minHandPresenceConfidence: ENVIRONMENT.AI.MIN_HAND_PRESENCE_CONFIDENCE || 0.6,
            minTrackingConfidence: ENVIRONMENT.AI.MIN_TRACKING_CONFIDENCE || 0.6
          });

          this.activeDelegate = candidate.delegate;
          console.log(`[MediaPipeService] Successfully initialized HandLandmarker with ${candidate.name}!`);
          break;
        } catch (candidateErr) {
          console.warn(`[MediaPipeService] Failed with ${candidate.name}:`, candidateErr);
          lastErr = candidateErr;
        }
      }

      if (!landmarker) {
        throw new Error(`Failed to load HandLandmarker model across all local and CDN candidates: ${lastErr?.message}`);
      }

      this.handLandmarker = landmarker;
      this.isLoaded = true;
      this.isLoading = false;
      this.state = MEDIAPIPE_STATES.READY;
      this.lastError = null;
      return true;
    } catch (err) {
      this.isLoading = false;
      this.isLoaded = false;
      this.state = MEDIAPIPE_STATES.ERROR;
      this.lastError = err.message;
      console.error('[MediaPipeService] Fatal HandLandmarker initialization error:', err);
      throw err;
    }
  }

  /**
   * Runs synchronous hand landmark inference on the current decoded video frame.
   * Guarantees strictly monotonic timestamps and avoids concurrent execution.
   */
  detect(videoElement, timestampMs) {
    if (!this.isLoaded || !this.handLandmarker || !videoElement) {
      return null;
    }

    // Verify video element has decoded frames and valid non-zero dimensions
    if (
      videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      videoElement.videoWidth === 0 ||
      videoElement.videoHeight === 0
    ) {
      return null;
    }

    // Prevent re-entrancy / overlapping execution
    if (this.isDetecting) {
      return this.lastResult;
    }

    // Skip redundant inference if video frame hasn't advanced
    if (videoElement.currentTime === this.lastVideoTime && this.lastResult) {
      return this.lastResult;
    }

    this.isDetecting = true;
    const startInference = performance.now();

    try {
      this.lastVideoTime = videoElement.currentTime;

      // MediaPipe requires strictly increasing timestamps: ts > lastTimestampMs
      let ts = typeof timestampMs === 'number' && !isNaN(timestampMs) ? timestampMs : performance.now();
      if (ts <= this.lastTimestampMs) {
        ts = this.lastTimestampMs + 1;
      }
      this.lastTimestampMs = ts;

      const result = this.handLandmarker.detectForVideo(videoElement, ts);
      this.lastResult = result;
      this.lastInferenceTime = performance.now();
      this.lastInferenceDurationMs = this.lastInferenceTime - startInference;
      this.inferenceCount++;

      // Update FPS calculation
      this.fpsCounter++;
      const timeSinceCalc = this.lastInferenceTime - this.fpsLastCalc;
      if (timeSinceCalc >= 1000) {
        this.inferenceFps = Math.round((this.fpsCounter * 1000) / timeSinceCalc);
        this.fpsCounter = 0;
        this.fpsLastCalc = this.lastInferenceTime;
      }

      this.isDetecting = false;
      return result;
    } catch (err) {
      this.isDetecting = false;
      this.lastError = err.message;
      // Do not log every frame to avoid console spam, but record diagnostic error
      if (this.inferenceCount % 60 === 0) {
        console.warn('[MediaPipeService] Inference frame warning:', err);
      }
      return null;
    }
  }

  getDiagnostics() {
    return {
      state: this.state,
      isLoaded: this.isLoaded,
      activeDelegate: this.activeDelegate,
      inferenceCount: this.inferenceCount,
      lastDurationMs: Number(this.lastInferenceDurationMs.toFixed(1)),
      fps: this.inferenceFps,
      hasLandmarker: !!this.handLandmarker,
      lastError: this.lastError
    };
  }

  close() {
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close();
      } catch (e) {}
      this.handLandmarker = null;
      this.isLoaded = false;
      this.state = MEDIAPIPE_STATES.UNINITIALIZED;
    }
  }
}

export const MediaPipe = new MediaPipeService();
