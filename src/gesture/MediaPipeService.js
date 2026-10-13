/**
 * AI Gesture Runner 3D - MediaPipeService
 * Robust loader and runner for @mediapipe/tasks-vision HandLandmarker.
 * Implements 4-tier GPU/CPU & local/CDN fallback, strictly monotonic timestamps,
 * concurrency locks, and video frame validation.
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { ENVIRONMENT } from '../config/environment.js';

function resolveAssetUrl(relativePath) {
  if (typeof window === 'undefined') return relativePath;
  try {
    const base = document.querySelector('base')?.getAttribute('href') || (import.meta.env?.BASE_URL || '/');
    const u = new URL(relativePath, new URL(base, window.location.href));
    return u.href;
  } catch (e) {
    return `/${relativePath.replace(/^\.?\//, '')}`;
  }
}

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
    this.initPromise = null;
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
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.isLoading = true;
      this.state = MEDIAPIPE_STATES.LOADING_WASM;

      try {
        console.log('[MediaPipeService] Resolving FilesetResolver for vision tasks...');

        const localWasmUrl = resolveAssetUrl('wasm/').replace(/\/?$/, '/');
        const wasmCandidates = [
          { url: localWasmUrl, name: 'Local WASM (/wasm/)' },
          { url: resolveAssetUrl('wasm').replace(/\/?$/, '/'), name: 'Local Relative WASM' },
          { url: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm', name: 'CDN WASM (latest)' },
          { url: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm', name: 'CDN WASM (1.1.0)' }
        ];

        let vision = null;
        let wasmError = null;

        for (const wasmSource of wasmCandidates) {
          try {
            console.log(`[MediaPipeService] Attempting vision fileset from ${wasmSource.name}...`);
            vision = await FilesetResolver.forVisionTasks(wasmSource.url);
            console.log(`[MediaPipeService] Vision fileset successfully loaded from ${wasmSource.name}`);
            break;
          } catch (e) {
            console.warn(`[MediaPipeService] FilesetResolver failed with ${wasmSource.name}:`, e.message || e);
            wasmError = e;
          }
        }

        if (!vision) {
          throw new Error(`Failed to initialize MediaPipe WASM runtime: ${wasmError?.message || 'WASM files unavailable'}`);
        }

        this.state = MEDIAPIPE_STATES.LOADING_MODEL;
        console.log('[MediaPipeService] Loading HandLandmarker model...');

        const localModelUrl = resolveAssetUrl('models/hand_landmarker.task');
        const cdnModelUrl = ENVIRONMENT.AI.MODEL_FALLBACK_URL;

        const modelCandidates = [
          { path: localModelUrl, delegate: 'GPU', name: 'Local Model (GPU)' },
          { path: localModelUrl, delegate: 'CPU', name: 'Local Model (CPU)' },
          { path: cdnModelUrl, delegate: 'GPU', name: 'CDN Model (GPU)' },
          { path: cdnModelUrl, delegate: 'CPU', name: 'CDN Model (CPU)' }
        ];

        let landmarker = null;
        let lastErr = null;

        for (const candidate of modelCandidates) {
          try {
            console.log(`[MediaPipeService] Initializing ${candidate.name}...`);
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
            console.log(`[MediaPipeService] Successfully loaded HandLandmarker using ${candidate.name}!`);
            break;
          } catch (candidateErr) {
            console.warn(`[MediaPipeService] Candidate ${candidate.name} failed:`, candidateErr.message || candidateErr);
            lastErr = candidateErr;
          }
        }

        if (!landmarker) {
          throw new Error(`Could not load HandLandmarker model: ${lastErr?.message || 'All model delegates failed'}`);
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
        this.initPromise = null; // Clear so user can retry
        this.state = MEDIAPIPE_STATES.ERROR;
        this.lastError = err.message || 'AI Model initialization failed';
        console.error('[MediaPipeService] HandLandmarker initialization error:', err);
        throw err;
      }
    })();

    return this.initPromise;
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
      return this.lastResult ? { ...this.lastResult, isFresh: false } : null;
    }

    // Skip redundant inference if video frame hasn't advanced
    if (videoElement.currentTime === this.lastVideoTime && this.lastResult) {
      return { ...this.lastResult, isFresh: false };
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

      // Responsive rolling FPS calculation (500ms window for prompt metric updates)
      this.fpsCounter++;
      const timeSinceCalc = this.lastInferenceTime - this.fpsLastCalc;
      if (timeSinceCalc >= 500) {
        this.inferenceFps = Math.round((this.fpsCounter * 1000) / timeSinceCalc);
        this.fpsCounter = 0;
        this.fpsLastCalc = this.lastInferenceTime;
      }

      this.isDetecting = false;
      return {
        ...result,
        isFresh: true,
        durationMs: this.lastInferenceDurationMs
      };
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
      this.initPromise = null;
      this.state = MEDIAPIPE_STATES.UNINITIALIZED;
    }
  }
}

export const MediaPipe = new MediaPipeService();
