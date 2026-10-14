/**
 * AI Gesture Runner 3D - Environment Configuration
 * Production configuration for Django REST Framework + Neon PostgreSQL + SMTP Email OTP backend.
 */

export const ENVIRONMENT = {
  APP_NAME: 'GestureX',
  APP_VERSION: '1.0.0',
  ENV: import.meta.env?.MODE || 'development',
  DEBUG_MODE: false,

  // Backend REST API Configuration (Django REST Framework + Neon PostgreSQL)
  API: {
    ENABLED: true,
    BASE_URL: import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
    TIMEOUT_MS: 10000,
    ENDPOINTS: {
      // Authentication & Verification
      REGISTER: '/auth/register/',
      VERIFY_EMAIL: '/auth/verify-email/',
      RESEND_OTP: '/auth/resend-otp/',
      LOGIN: '/auth/login/',
      LOGOUT: '/auth/logout/',
      TOKEN_REFRESH: '/auth/token/refresh/',
      PASSWORD_RESET_REQUEST: '/auth/password-reset/request/',
      PASSWORD_RESET_CONFIRM: '/auth/password-reset/confirm/',

      // User Profile & Settings
      CURRENT_USER: '/users/me/',
      CHANGE_PASSWORD: '/users/me/change-password/',

      // Authoritative Game Runs & Career Stats
      GAME_RUNS: '/game-runs/',
      GAME_STATS_ME: '/game-stats/me/',

      // Leaderboard
      LEADERBOARD: '/leaderboard/',
      LEADERBOARD_ME: '/leaderboard/me/',

      // Achievements & Gamification
      ACHIEVEMENTS: '/achievements/',
      ACHIEVEMENTS_ME: '/achievements/me/',

      // System Health
      HEALTH: '/health/'
    }
  },

  // MediaPipe AI settings
  AI: {
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
