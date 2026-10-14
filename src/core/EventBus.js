/**
 * AI Gesture Runner 3D - EventBus
 * Decoupled pub/sub event bus with error isolation.
 */

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(callback);
    return () => this.off(eventName, callback);
  }

  once(eventName, callback) {
    const wrapper = (payload) => {
      this.off(eventName, wrapper);
      callback(payload);
    };
    return this.on(eventName, wrapper);
  }

  off(eventName, callback) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).delete(callback);
      if (this.listeners.get(eventName).size === 0) {
        this.listeners.delete(eventName);
      }
    }
  }

  emit(eventName, payload) {
    if (!this.listeners.has(eventName)) return;
    const callbacks = Array.from(this.listeners.get(eventName));
    for (const cb of callbacks) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[EventBus] Error in listener for event "${eventName}":`, err);
      }
    }
  }

  clear() {
    this.listeners.clear();
  }
}

export const GlobalEvents = new EventBus();

// Standard event dictionary
export const EVENTS = {
  // State Machine
  STATE_CHANGED: 'STATE_CHANGED',
  
  // Gestures
  GESTURE_RECOGNIZED: 'GESTURE_RECOGNIZED',
  GESTURE_RAW_DATA: 'GESTURE_RAW_DATA',
  TRACKING_LOST: 'TRACKING_LOST',
  TRACKING_RECOVERED: 'TRACKING_RECOVERED',
  CAMERA_READY: 'CAMERA_READY',
  CAMERA_ERROR: 'CAMERA_ERROR',

  // Gameplay
  PLAYER_JUMP: 'PLAYER_JUMP',
  PLAYER_SLIDE: 'PLAYER_SLIDE',
  PLAYER_MOVE_LANE: 'PLAYER_MOVE_LANE',
  PLAYER_COLLISION: 'PLAYER_COLLISION',
  COIN_COLLECTED: 'COIN_COLLECTED',
  FLOATING_NOTICE: 'FLOATING_NOTICE',
  POWERUP_COLLECTED: 'POWERUP_COLLECTED',
  POWERUP_EXPIRED: 'POWERUP_EXPIRED',
  SPEED_CHANGED: 'SPEED_CHANGED',
  DISTANCE_UPDATED: 'DISTANCE_UPDATED',
  SCORE_UPDATED: 'SCORE_UPDATED',
  GAME_OVER: 'GAME_OVER',
  ACHIEVEMENT_UNLOCKED: 'ACHIEVEMENT_UNLOCKED',
  PAUSE_REQUESTED: 'PAUSE_REQUESTED',
  RESUME_REQUESTED: 'RESUME_REQUESTED',

  // Audio & Settings
  SOUND_PLAY_SFX: 'SOUND_PLAY_SFX',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',

  // Authentication & Cloud Sync
  AUTH_STATE_CHANGED: 'AUTH_STATE_CHANGED'
};
