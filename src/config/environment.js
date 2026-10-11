/**
 * AI Gesture Runner 3D - Environment Configuration
 * Modular architecture prepared for future REST API and cloud services.
 */

export const ENVIRONMENT = {
  APP_NAME: 'GestureX',
  APP_VERSION: '1.0.0',
  ENV: import.meta.env?.MODE || 'development',
  DEBUG_MODE: false,

  // Future backend API configuration (Disabled for initial frontend-only deployment)
  API: {
    ENABLED: false,
    BASE_URL: 'https://api.gesturerunner3d.example.com/v1',
    TIMEOUT_MS: 5000,
    ENDPOINTS: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
      SCORES: '/scores',
      LEADERBOARD: '/scores/leaderboard',
      ACHIEVEMENTS: '/achievements'
    }
  },

  // MediaPipe AI settings
  AI: {
    // Priority: local public folder first, fallback to Google CDN
    MODEL_PATH: './models/hand_landmarker.task',
    MODEL_FALLBACK_URL: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    WASM_PATH: './wasm',
    WASM_FALLBACK_URL: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm',
    NUM_HANDS: 1,
    MIN_HAND_DETECTION_CONFIDENCE: 0.6,
    MIN_HAND_PRESENCE_CONFIDENCE: 0.6,
    MIN_TRACKING_CONFIDENCE: 0.6,
    TARGET_INFERENCE_FPS: 30 // Decoupled from 60fps render loop to preserve mobile/laptop CPU
  },

  STORAGE_KEY_PREFIX: 'AGR3D_V1_'
};
