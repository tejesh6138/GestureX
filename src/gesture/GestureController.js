/**
 * AI Gesture Runner 3D - GestureController
 * Orchestrates vision inference, temporal smoothing, debouncing, and tracking-loss detection.
 * Renders Points-Only Futuristic Holographic Hand (no camera video visible) in top-right HUD panel.
 */

import { Camera } from './CameraService.js';
import { MediaPipe } from './MediaPipeService.js';
import { HandTracker } from './HandTracker.js';
import { Classifier } from './GestureClassifier.js';
import { Calibration } from './GestureCalibration.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';
import { MathUtils } from '../utils/MathUtils.js';
import { GAME_CONFIG } from '../core/GameConfig.js';

export class GestureController {
  constructor() {
    this.tracker = new HandTracker();
    this.smoothedPalm = { x: 0.5, y: 0.5 };
    this.lastActionTime = 0;
    this.lastStateTransitionTime = 0;
    this.laneDebounceWaitReset = false;
    this.jumpDebounceWaitReset = false;
    this.slideDebounceWaitReset = false;
    this.lastTrackingTime = performance.now();
    this.isTrackingLost = true;
    this.activeGesture = 'NONE';
    this.pipCanvas = null;
    this.pipCtx = null;
    this.currentGameState = 'LOADING';
  }

  setGameState(state) {
    this.currentGameState = state;
    this.lastActionTime = performance.now();
    this.laneDebounceWaitReset = false;
    this.jumpDebounceWaitReset = false;
    this.slideDebounceWaitReset = false;
    Classifier.reset();
  }

  setPipCanvas(canvas) {
    this.pipCanvas = canvas;
    if (canvas) {
      this.pipCtx = canvas.getContext('2d');
    }
  }

  processFrame(timestampMs) {
    const video = Camera.getVideo();
    if (!video || !Camera.isReady) {
      this.drawPipPreview(null, null, 'CAMERA OFFLINE');
      return null;
    }

    const result = MediaPipe.detect(video, timestampMs);
    const now = performance.now();

    let rawLandmarks = null;
    let handCount = 0;
    if (result && result.landmarks && result.landmarks.length > 0) {
      handCount = result.landmarks.length;
      rawLandmarks = result.landmarks[0];
      this.lastTrackingTime = now;
      if (this.isTrackingLost) {
        this.isTrackingLost = false;
        GlobalEvents.emit(EVENTS.TRACKING_RECOVERED);
      }
    } else {
      // Tracking loss timeout (> 400ms without landmarks)
      if (!this.isTrackingLost && now - this.lastTrackingTime > 400) {
        this.isTrackingLost = true;
        this.activeGesture = 'NONE';
        Classifier.reset();
        this.laneDebounceWaitReset = false;
        this.jumpDebounceWaitReset = false;
        GlobalEvents.emit(EVENTS.TRACKING_LOST);
      }
    }

    if (!rawLandmarks) {
      this.drawPipPreview(null, null, 'NO HAND DETECTED');
      GlobalEvents.emit(EVENTS.GESTURE_RAW_DATA, { handData: null, classification: null, handCount: 0 });
      return null;
    }

    const handData = this.tracker.process(rawLandmarks);
    if (!handData) {
      this.drawPipPreview(null, null, 'NO HAND DETECTED');
      return null;
    }

    // Temporal smoothing on palm center
    const alpha = 0.38;
    this.smoothedPalm.x = MathUtils.lerp(this.smoothedPalm.x, handData.palmCenter.x, alpha);
    this.smoothedPalm.y = MathUtils.lerp(this.smoothedPalm.y, handData.palmCenter.y, alpha);
    handData.palmCenter = { ...this.smoothedPalm };

    // Calibration accumulation if active
    if (Calibration.isCalibrating) {
      Calibration.addSample(handData.palmCenter);
    }

    const classification = Classifier.classify(handData);
    this.activeGesture = classification.gesture;

    // Handle priority debouncing and dispatch actions
    this.handleActionDebounce(classification.gesture, now);

    // Draw Points-Only Holographic Skeleton Display
    this.drawPipPreview(handData, classification);

    GlobalEvents.emit(EVENTS.GESTURE_RAW_DATA, { handData, classification, handCount });
    return { handData, classification };
  }

  handleActionDebounce(gesture, now) {
    const cooldownMs = GAME_CONFIG.GESTURES.COOLDOWN_MS || 240;
    const transitionCooldown = GAME_CONFIG.GESTURES.TRANSITION_COOLDOWN_MS || 500;
    const canFireAction = now - this.lastActionTime > cooldownMs;
    const canFireTransition = now - this.lastStateTransitionTime > transitionCooldown;

    // Neutral resting pose clears debounce locks
    if (gesture === 'NEUTRAL') {
      this.laneDebounceWaitReset = false;
      this.jumpDebounceWaitReset = false;
      this.slideDebounceWaitReset = false;
      return;
    }

    // Holding poses suppress gameplay collisions/inputs while pose stabilizes
    if (gesture === 'HOLDING_PAUSE' || gesture === 'HOLDING_RESUME') {
      return;
    }

    // In TUTORIAL mode, emit recognition for verified checklist
    if (this.currentGameState === 'TUTORIAL') {
      if (['PAUSE', 'RESUME', 'JUMP', 'SLIDE', 'MOVE_LEFT', 'MOVE_RIGHT'].includes(gesture)) {
        GlobalEvents.emit(EVENTS.GESTURE_RECOGNIZED, { gesture });
      }
      return;
    }

    // PRIORITY 1: PAUSE GESTURE (Full Open Palm) - ONLY while RUNNING
    if (this.currentGameState === 'RUNNING') {
      if (gesture === 'PAUSE') {
        if (canFireTransition) {
          this.lastStateTransitionTime = now;
          this.lastActionTime = now;
          Classifier.reset();
          GlobalEvents.emit(EVENTS.PAUSE_REQUESTED);
          GlobalEvents.emit(EVENTS.GESTURE_RECOGNIZED, { gesture: 'PAUSE' });
        }
        return;
      }
    }

    // PRIORITY 2: RESUME GESTURE (3 Fingers) - ONLY while PAUSED
    if (this.currentGameState === 'PAUSED') {
      if (gesture === 'RESUME') {
        if (canFireTransition) {
          this.lastStateTransitionTime = now;
          this.lastActionTime = now;
          Classifier.reset();
          GlobalEvents.emit(EVENTS.RESUME_REQUESTED);
          GlobalEvents.emit(EVENTS.GESTURE_RECOGNIZED, { gesture: 'RESUME' });
        }
        return;
      }
      // Strictly ignore all gameplay actions while paused
      return;
    }

    // PRIORITY 3: GAMEPLAY GESTURES - ONLY while RUNNING
    if (this.currentGameState !== 'RUNNING') {
      return;
    }

    // Left / Right lane shifts (debounced: requires returning to neutral)
    if (gesture === 'MOVE_LEFT' || gesture === 'MOVE_RIGHT') {
      if (canFireAction && !this.laneDebounceWaitReset) {
        this.lastActionTime = now;
        this.laneDebounceWaitReset = true;
        GlobalEvents.emit(EVENTS.PLAYER_MOVE_LANE, { direction: gesture === 'MOVE_LEFT' ? -1 : 1 });
        GlobalEvents.emit(EVENTS.GESTURE_RECOGNIZED, { gesture });
      }
    }
    // Jump (debounced: requires returning to neutral)
    else if (gesture === 'JUMP') {
      if (canFireAction && !this.jumpDebounceWaitReset) {
        this.lastActionTime = now;
        this.jumpDebounceWaitReset = true;
        GlobalEvents.emit(EVENTS.PLAYER_JUMP);
        GlobalEvents.emit(EVENTS.GESTURE_RECOGNIZED, { gesture });
      }
    }
    // Slide (debounced: requires returning to neutral to prevent slide spam)
    else if (gesture === 'SLIDE') {
      if (canFireAction && !this.slideDebounceWaitReset) {
        this.lastActionTime = now;
        this.slideDebounceWaitReset = true;
        GlobalEvents.emit(EVENTS.PLAYER_SLIDE);
        GlobalEvents.emit(EVENTS.GESTURE_RECOGNIZED, { gesture });
      }
    }
  }

  /**
   * Points-Only Futuristic Digital Hand Display:
   * Renders the 21 MediaPipe hand landmarks, joints, and skeletal lines
   * on a clean white / pale-blue background with NO live camera video visible.
   */
  drawPipPreview(handData, classification, overrideStatus = null) {
    if (!this.pipCanvas || !this.pipCtx) return;
    const ctx = this.pipCtx;
    const w = this.pipCanvas.width;
    const h = this.pipCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Clean Light-Theme Sky Panel Backdrop
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // Subtle soft sky-blue grid lines
    ctx.strokeStyle = 'rgba(0, 139, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Clean sky-blue border
    ctx.strokeStyle = '#DCE8F5';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    // If NO hand detected or status override:
    if (overrideStatus || !handData) {
      const statusText = overrideStatus || 'NO HAND DETECTED';
      const isWarn = statusText.includes('LOST') || statusText.includes('NO HAND') || statusText.includes('OFFLINE');
      const isPending = statusText.includes('LOADING') || statusText.includes('READY');

      ctx.fillStyle = isWarn ? 'rgba(255, 122, 92, 0.12)' : (isPending ? 'rgba(0, 139, 255, 0.12)' : 'rgba(241, 248, 255, 0.9)');
      ctx.fillRect(4, 4, w - 8, 16);
      ctx.fillStyle = isWarn ? '#FF7A5C' : '#008BFF';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(statusText, w / 2, 15);

      // Center Guidance
      ctx.fillStyle = '#6B7280';
      ctx.font = '8px sans-serif';
      ctx.fillText(statusText.includes('LOST') ? 'REPOSITION HAND' : 'HOLD HAND IN VIEW', w / 2, h / 2 + 4);
      return;
    }

    // 2. Normalization & Auto-Fit of Hand Landmarks
    const pts = handData.points;
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    pts.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const span = Math.max(maxX - minX, maxY - minY, 0.18);
    const fitScale = Math.min((w * 0.68) / span, (h * 0.68) / span);

    const toScreen = (p) => ({
      x: (w / 2) + (p.x - cx) * fitScale,
      y: (h / 2 + 2) + (p.y - cy) * fitScale
    });

    // 3. Subtle Sky Blue Glow Around Hand Center
    const palmScr = toScreen(handData.palmCenter);
    const grad = ctx.createRadialGradient(palmScr.x, palmScr.y, 2, palmScr.x, palmScr.y, 36);
    grad.addColorStop(0, 'rgba(0, 139, 255, 0.15)');
    grad.addColorStop(0.7, 'rgba(191, 231, 255, 0.12)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 4. Digital Skeleton Connections (21 Landmarks)
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],          // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],          // Index
      [5, 9], [9, 10], [10, 11], [11, 12],     // Middle
      [9, 13], [13, 14], [14, 15], [15, 16],   // Ring
      [13, 17], [17, 18], [18, 19], [19, 20],  // Pinky
      [0, 17]                                  // Base
    ];

    ctx.save();
    ctx.strokeStyle = '#008BFF';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    connections.forEach(([i, j]) => {
      const p1 = toScreen(pts[i]);
      const p2 = toScreen(pts[j]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });
    ctx.restore();

    // 5. Joint Landmark Dots
    ctx.save();
    ctx.fillStyle = '#8E7DFF';
    pts.forEach((pt) => {
      const sp = toScreen(pt);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // 6. Highlighted Fingertip Glows
    const tips = [
      { idx: 4, ext: handData.thumbExtended },
      { idx: 8, ext: handData.indexExtended },
      { idx: 12, ext: handData.middleExtended },
      { idx: 16, ext: handData.ringExtended },
      { idx: 20, ext: handData.pinkyExtended }
    ];

    ctx.save();
    tips.forEach(({ idx, ext }) => {
      const sp = toScreen(pts[idx]);
      ctx.fillStyle = ext ? '#FFD34E' : '#008BFF';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, ext ? 3.8 : 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (ext) {
        ctx.strokeStyle = '#FF7A5C';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    });
    ctx.restore();

    // 7. Palm Center Anchor Beacon
    ctx.fillStyle = '#008BFF';
    ctx.beginPath();
    ctx.arc(palmScr.x, palmScr.y, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // 8. Top Tracking Status: "HAND DETECTED"
    ctx.fillStyle = 'rgba(110, 194, 7, 0.15)';
    ctx.fillRect(4, 4, w - 8, 14);
    ctx.fillStyle = '#6EC207';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🟢 HAND DETECTED', w / 2, 14);

    // 9. Bottom Active Gesture Banner: LEFT, RIGHT, JUMP, SLIDE, PAUSE, RESUME
    if (classification) {
      let label = classification.gesture;
      if (label === 'PAUSE' || label === 'HOLDING_PAUSE') label = '✋ PAUSE';
      else if (label === 'RESUME' || label === 'HOLDING_RESUME') label = '🤟 RESUME';
      else if (label === 'SLIDE') label = '✊ SLIDE';
      else if (label === 'JUMP') label = '✌️ JUMP';
      else if (label === 'MOVE_LEFT') label = '👈 LEFT';
      else if (label === 'MOVE_RIGHT') label = '👉 RIGHT';
      else if (label === 'NEUTRAL') label = 'HAND DETECTED';

      ctx.fillStyle = 'rgba(241, 248, 255, 0.95)';
      ctx.fillRect(4, h - 17, w - 8, 14);
      ctx.strokeStyle = '#DCE8F5';
      ctx.strokeRect(4, h - 17, w - 8, 14);
      ctx.fillStyle = '#008BFF';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, w / 2, h - 7);
    }
  }

  getDiagnostics() {
    return {
      activeGesture: this.activeGesture,
      isTrackingLost: this.isTrackingLost,
      smoothedPalm: this.smoothedPalm,
      gameState: this.currentGameState,
      neutralX: Calibration.neutralX,
      neutralY: Calibration.neutralY,
      deadzoneX: Calibration.deadzoneX
    };
  }

  reset() {
    this.tracker.reset();
    Classifier.reset();
    this.laneDebounceWaitReset = false;
    this.jumpDebounceWaitReset = false;
    this.slideDebounceWaitReset = false;
    this.activeGesture = 'NONE';
    this.isTrackingLost = true;
  }
}

export const Gestures = new GestureController();
