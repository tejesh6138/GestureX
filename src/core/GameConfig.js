/**
 * AI Gesture Runner 3D - Game Physics & Balance Configuration
 */

export const DIFFICULTY_MODES = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  FAST: 'FAST'
};

export const DIFFICULTY_CONFIG = {
  EASY: {
    MODE: 'EASY',
    NAME: 'EASY',
    ICON: '🌱',
    TAGLINE: 'Beginner Friendly',
    DESCRIPTION: 'Gentle running pace, wider reaction windows, and simpler obstacle sequences.',
    INITIAL_SPEED: 16.0,
    MAX_SPEED: 30.0,
    ACCELERATION: 0.15,
    MIN_SPAWN_GAP: 36.0,
    MAX_SPAWN_GAP: 48.0,
    MOVING_TRAIN_SPEED: 8.0,
    ALLOW_MOVING_TRAIN_CHANCE: 0.12,
    COIN_SPAWN_PROBABILITY: 0.90,
    SPEED_PROGRESSION_RATE: 0.005
  },
  MEDIUM: {
    MODE: 'MEDIUM',
    NAME: 'MEDIUM',
    ICON: '⚡',
    TAGLINE: 'Balanced Arcade',
    DESCRIPTION: 'Standard arcade speed, dynamic obstacle combinations, and balanced coin trails.',
    INITIAL_SPEED: 22.0,
    MAX_SPEED: 44.0,
    ACCELERATION: 0.35,
    MIN_SPAWN_GAP: 24.0,
    MAX_SPAWN_GAP: 34.0,
    MOVING_TRAIN_SPEED: 12.0,
    ALLOW_MOVING_TRAIN_CHANCE: 0.35,
    COIN_SPAWN_PROBABILITY: 0.85,
    SPEED_PROGRESSION_RATE: 0.008
  },
  FAST: {
    MODE: 'FAST',
    NAME: 'FAST',
    ICON: '🔥',
    TAGLINE: 'Hyper Reflex',
    DESCRIPTION: 'High-speed adrenaline sprint with oncoming cyber-trains and rapid lane shifts.',
    INITIAL_SPEED: 30.0,
    MAX_SPEED: 54.0,
    ACCELERATION: 0.55,
    MIN_SPAWN_GAP: 18.0,
    MAX_SPAWN_GAP: 26.0,
    MOVING_TRAIN_SPEED: 16.0,
    ALLOW_MOVING_TRAIN_CHANCE: 0.55,
    COIN_SPAWN_PROBABILITY: 0.80,
    SPEED_PROGRESSION_RATE: 0.013
  }
};

export const GAME_CONFIG = {
  // Lane system
  LANES: {
    COUNT: 3,
    WIDTH: 2.6, // Distance between lane centers in meters
    LEFT_X: -2.6,
    CENTER_X: 0.0,
    RIGHT_X: 2.6,
    SWITCH_SPEED: 14.0 // Interpolation speed for smooth lane change
  },

  // Player movement & physics defaults
  PLAYER: {
    INITIAL_SPEED: 22.0,      // Default starting forward speed
    MAX_SPEED: 44.0,          // Default maximum forward speed
    ACCELERATION: 0.35,       // Forward acceleration
    JUMP_VELOCITY: 13.5,      // Initial vertical velocity for jump (m/s)
    GRAVITY: 34.0,            // Downward acceleration (m/s^2)
    SLIDE_DURATION: 0.75,     // Seconds character remains in slide state
    HEIGHT_NORMAL: 1.8,       // Normal player collision bounding height
    HEIGHT_SLIDING: 0.7,      // Reduced player collision bounding height during slide
    WIDTH_COLLISION: 0.9,     // Player collision bounding width
    INVULNERABLE_TIME: 1.5    // Invulnerability duration on recovery or powerup (s)
  },

  // Track & Environment
  TRACK: {
    CHUNK_LENGTH: 60.0,       // Length of each procedural track chunk
    ACTIVE_CHUNKS: 6,         // Total active chunks ahead
    DESPAWN_DISTANCE: 25.0,   // Distance behind player before chunk recycles
    OBSTACLE_START_DISTANCE: 40.0 // Distance from spawn before first obstacles appear
  },

  // Camera Settings
  CAMERA: {
    BASE_FOV: 60,
    MAX_FOV: 74,
    OFFSET_X: 0.0,
    OFFSET_Y: 3.2,
    OFFSET_Z: 5.6,
    LOOK_AHEAD_Y: 1.2,
    LOOK_AHEAD_Z: -12.0,
    TILT_ANGLE: 0.06
  },

  // Power-Ups
  POWER_UPS: {
    MAGNET_DURATION: 10.0,
    MAGNET_RADIUS: 14.0,
    MAGNET_PULL_SPEED: 28.0,
    SHIELD_DURATION: 15.0,
    BOOST_DURATION: 6.0,
    BOOST_MULTIPLIER: 1.45
  },

  // Coin Collection System
  COINS: {
    SPAWN_PROBABILITY: 0.85,
    COLLECTION_RADIUS: 1.35,
    ROTATION_SPEED: 4.2,
    VALUE: 1
  },

  // Obstacles & Hurdles
  OBSTACLES: {
    START_DISTANCE: 40.0,
    MIN_SPAWN_GAP: 24.0,
    MAX_SPAWN_GAP: 34.0,
    MOVING_TRAIN_SPEED: 12.0,
    WARNING_DISTANCE: 45.0
  },

  // Scoring
  SCORING: {
    POINTS_PER_METER: 1,
    POINTS_PER_COIN: 25,
    COMBO_RESET_TIME: 3.0
  },

  // Gesture Controls Calibration Defaults
  GESTURES: {
    NEUTRAL_DEADZONE_X: 0.12,   // Normalized X distance from center before lane change
    JUMP_THRESHOLD_Y: 0.28,     // Normalized Y upper boundary for jump trigger
    HOLD_PAUSE_MS: 260,         // Hold ring-finger pose for 260ms to trigger PAUSE
    HOLD_RESUME_MS: 300,        // Hold 3-finger pose (index+middle+ring) for 300ms to RESUME
    COOLDOWN_MS: 180,           // Cooldown between repeated discrete actions (180ms for responsive control)
    TRANSITION_COOLDOWN_MS: 450,// Cooldown between state transitions
    LANE_RESET_REQUIRED: true   // Player must return hand closer to neutral before next lane shift
  },

  // Difficulty configurations mapping
  DIFFICULTY: DIFFICULTY_CONFIG
};
