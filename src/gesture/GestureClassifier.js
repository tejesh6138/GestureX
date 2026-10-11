/**
 * AI Gesture Runner 3D - GestureClassifier
 * Classifies kinematic hand poses into discrete gameplay intents:
 * - GESTURE 1 (MOVE_LEFT): Index Finger only extended, slanted LEFT
 * - GESTURE 2 (MOVE_RIGHT): Index Finger only extended, slanted RIGHT
 * - GESTURE 3 (JUMP): Index + Middle Fingers extended upward (Peace/V sign)
 * - GESTURE 4 (SLIDE): Closed Fist (all 4 fingers folded)
 * - GESTURE 5 (PAUSE): Full Open Palm (all 5 fingers extended, held steadily)
 * - GESTURE 6 (RESUME): Index + Middle + Ring Fingers extended upward (3 fingers, held steadily)
 */

import { GAME_CONFIG } from '../core/GameConfig.js';

export class GestureClassifier {
  constructor() {
    this.palmHoldStart = null;
    this.threeFingerHoldStart = null;
    this.palmFrames = 0;
    this.threeFingerFrames = 0;
    this.history = [];
    this.historyMax = 3;
    this.currentStableGesture = 'NEUTRAL';
  }

  classify(handData) {
    if (!handData) {
      this.reset();
      return { gesture: 'NONE', confidence: 0 };
    }

    const raw = this.classifyRaw(handData);

    // Temporal consensus filtering
    this.history.push(raw.gesture);
    if (this.history.length > this.historyMax) {
      this.history.shift();
    }

    const last = this.history[this.history.length - 1];
    const prev = this.history.length >= 2 ? this.history[this.history.length - 2] : null;

    // Fast gameplay gestures require 2 consecutive frames to prevent single-frame glitches
    if (['MOVE_LEFT', 'MOVE_RIGHT', 'JUMP', 'SLIDE'].includes(last)) {
      if (last === prev) {
        this.currentStableGesture = last;
      }
    } else {
      this.currentStableGesture = last;
    }

    return {
      gesture: this.currentStableGesture,
      confidence: raw.confidence,
      details: raw.details
    };
  }

  classifyRaw(handData) {
    const {
      isOpenPalm,
      isFist,
      isIndexOnly,
      indexSlant,
      isIndexSlantedLeft,
      isIndexSlantedRight,
      isTwoFingers,
      isThreeFingers,
      timestamp,
      palmCenter
    } = handData;

    const pauseHoldRequired = GAME_CONFIG.GESTURES.HOLD_PAUSE_MS || 260;
    const resumeHoldRequired = GAME_CONFIG.GESTURES.HOLD_RESUME_MS || 300;

    // 1. GESTURE 5 — PAUSE: Full Open Palm held steadily
    if (isOpenPalm) {
      this.palmFrames++;
      if (!this.palmHoldStart) {
        this.palmHoldStart = timestamp;
      }
      const holdDuration = timestamp - this.palmHoldStart;

      // Reset competing pose
      this.threeFingerHoldStart = null;
      this.threeFingerFrames = 0;

      if (holdDuration >= pauseHoldRequired && this.palmFrames >= 3) {
        return {
          gesture: 'PAUSE',
          confidence: 0.98,
          details: { holdDuration, frames: this.palmFrames, pose: 'OPEN_PALM' }
        };
      }

      return {
        gesture: 'HOLDING_PAUSE',
        confidence: 0.88,
        details: { holdDuration, pose: 'HOLDING_OPEN_PALM' }
      };
    } else {
      this.palmHoldStart = null;
      this.palmFrames = 0;
    }

    // 2. GESTURE 6 — RESUME: Index, Middle, and Ring fingers extended upward (3 fingers)
    if (isThreeFingers) {
      this.threeFingerFrames++;
      if (!this.threeFingerHoldStart) {
        this.threeFingerHoldStart = timestamp;
      }
      const holdDuration = timestamp - this.threeFingerHoldStart;

      // Reset competing pose
      this.palmHoldStart = null;
      this.palmFrames = 0;

      if (holdDuration >= resumeHoldRequired && this.threeFingerFrames >= 3) {
        return {
          gesture: 'RESUME',
          confidence: 0.98,
          details: { holdDuration, frames: this.threeFingerFrames, pose: 'THREE_FINGERS' }
        };
      }

      return {
        gesture: 'HOLDING_RESUME',
        confidence: 0.88,
        details: { holdDuration, pose: 'HOLDING_THREE_FINGERS' }
      };
    } else {
      this.threeFingerHoldStart = null;
      this.threeFingerFrames = 0;
    }

    // 3. GESTURE 3 — JUMP: Index + Middle Fingers extended upward (Peace/V sign)
    if (isTwoFingers) {
      return {
        gesture: 'JUMP',
        confidence: 0.96,
        details: { pose: 'PEACE_TWO_FINGERS' }
      };
    }

    // 4. GESTURE 4 — SLIDE: Closed Fist
    if (isFist) {
      return {
        gesture: 'SLIDE',
        confidence: 0.95,
        details: { pose: 'CLOSED_FIST' }
      };
    }

    // 5. GESTURE 1 & 2 — MOVE LEFT / MOVE RIGHT: Index finger only extended with slant direction
    if (isIndexOnly) {
      if (isIndexSlantedLeft) {
        return {
          gesture: 'MOVE_LEFT',
          confidence: 0.95,
          details: { slant: indexSlant, pose: 'INDEX_SLANTED_LEFT' }
        };
      }

      if (isIndexSlantedRight) {
        return {
          gesture: 'MOVE_RIGHT',
          confidence: 0.95,
          details: { slant: indexSlant, pose: 'INDEX_SLANTED_RIGHT' }
        };
      }

      // Index finger extended straight up (resting between left/right)
      return {
        gesture: 'NEUTRAL',
        confidence: 0.9,
        details: { slant: indexSlant, pose: 'INDEX_UPRIGHT' }
      };
    }

    // 6. Default resting / transitioning pose
    return {
      gesture: 'NEUTRAL',
      confidence: 0.85,
      details: { x: palmCenter.x, y: palmCenter.y }
    };
  }

  resetHoldTimers() {
    this.palmHoldStart = null;
    this.threeFingerHoldStart = null;
    this.palmFrames = 0;
    this.threeFingerFrames = 0;
  }

  reset() {
    this.resetHoldTimers();
    this.history = [];
    this.currentStableGesture = 'NEUTRAL';
  }
}

export const Classifier = new GestureClassifier();
