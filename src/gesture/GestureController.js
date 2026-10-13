/**
 * AI Gesture Runner 3D - GestureController
 * Orchestrates vision inference, normalized interaction zone tracking,
 * boundary hysteresis, sustained-condition warnings, and debouncing.
 * Renders Points-Only Futuristic Digital Hand (no camera video visible) in top-right HUD panel.
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

    // Debouncing locks
    this.laneDebounceWaitReset = false;
    this.jumpDebounceWaitReset = false;
    this.slideDebounceWaitReset = false;
    this.fistReleaseTimer = 0;
    this.jumpReleaseTimer = 0;

    // Tracking & Range state
    this.lastTrackingTime = performance.now();
    this.isTrackingLost = true;
    this.isOutOfRange = false;
    this.outOfRangeStartTime = null;
    this.trackingLossStartTime = null;

    // Interaction zone boundaries with hysteresis
    this.ZONE_MARGIN = 0.05; // 5% border margin
    this.ZONE_HYSTERESIS = 0.03; // Recovery margin

    // Configurable sustained delays (ms)
    this.OUT_OF_RANGE_DELAY_MS = 750;   // Hand near edge must persist before warning
    this.TRACKING_LOSS_GRACE_MS = 850;   // Brief dropouts tolerated before warning
    this.AUTO_PAUSE_DELAY_MS = 1500;     // Sustained loss required before pausing run

    this.activeGesture = 'NONE';
    this.pipCanvas = null;
    this.pipCtx = null;
    this.currentGameState = 'LOADING';
    this.perfMonitor = null;

    // Pre-allocated screen points and cached skeleton graph to avoid GC churn in PIP render
    this.screenPts = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
    this.screenPalm = { x: 0, y: 0 };
    this.skeletonConnections = [
      [0, 1], [1, 2], [2, 3], [3, 4],          // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],          // Index
      [5, 9], [9, 10], [10, 11], [11, 12],     // Middle
      [9, 13], [13, 14], [14, 15], [15, 16],   // Ring
      [13, 17], [17, 18], [18, 19], [19, 20],  // Pinky
      [0, 17]                                  // Base
    ];
  }

  setGameState(state) {
    this.currentGameState = state;
    this.lastActionTime = performance.now();
    this.laneDebounceWaitReset = false;
    this.jumpDebounceWaitReset = false;
    this.slideDebounceWaitReset = false;
    this.fistReleaseTimer = 0;
    this.jumpReleaseTimer = 0;
    this.outOfRangeStartTime = null;
    this.trackingLossStartTime = null;
    Classifier.reset();
  }

  setPipCanvas(canvas) {
    this.pipCanvas = canvas;
    if (canvas) {
      this.pipCtx = canvas.getContext('2d');
    }
  }

  setPerfMonitor(perfMonitor) {
    this.perfMonitor = perfMonitor;
  }

  processFrame(timestampMs) {
    const video = Camera.getVideo();
    if (!video || !Camera.isReady) {
      this.drawPipPreview(null, null, 'CAMERA OFFLINE');
      return { isFresh: false };
    }

    const result = MediaPipe.detect(video, timestampMs);
    const now = performance.now();
    const isFresh = result ? (result.isFresh !== false) : false;

    let rawLandmarks = null;
    let handCount = 0;

    if (result && result.landmarks && result.landmarks.length > 0) {
      handCount = result.landmarks.length;
      rawLandmarks = result.landmarks[0];
      this.lastTrackingTime = now;
      this.trackingLossStartTime = null;

      if (this.isTrackingLost) {
        this.isTrackingLost = false;
        GlobalEvents.emit(EVENTS.TRACKING_RECOVERED);
      }
    } else {
      // Landmarks temporarily missing
      if (!this.trackingLossStartTime) {
        this.trackingLossStartTime = now;
      }

      const dropDuration = now - this.trackingLossStartTime;

      // Grace period: do not immediately flash warning for 1-2 dropped frames
      if (!this.isTrackingLost && dropDuration > this.TRACKING_LOSS_GRACE_MS) {
        this.isTrackingLost = true;
        this.activeGesture = 'NONE';
        Classifier.reset();
        this.laneDebounceWaitReset = false;
        this.jumpDebounceWaitReset = false;
        this.slideDebounceWaitReset = false;
        GlobalEvents.emit(EVENTS.TRACKING_LOST, { duration: dropDuration });
      }

      // Sustained loss (> 1500ms): trigger soft pause only when truly lost
      if (this.currentGameState === 'RUNNING' && dropDuration > this.AUTO_PAUSE_DELAY_MS) {
        GlobalEvents.emit(EVENTS.PAUSE_REQUESTED, { reason: 'Hand tracking lost. Re-center hand in view to resume.' });
      }
    }

    if (!rawLandmarks) {
      const status = this.isTrackingLost ? 'NO HAND DETECTED' : null;
      this.drawPipPreview(null, null, status);
      GlobalEvents.emit(EVENTS.GESTURE_RAW_DATA, { handData: null, classification: null, handCount: 0 });
      return { handData: null, classification: null, isFresh };
    }

    const handData = this.tracker.process(rawLandmarks);
    if (!handData) {
      this.drawPipPreview(null, null, 'NO HAND DETECTED');
      return null;
    }

    // Temporal smoothing on palm center
    const alpha = 0.36;
    this.smoothedPalm.x = MathUtils.lerp(this.smoothedPalm.x, handData.palmCenter.x, alpha);
    this.smoothedPalm.y = MathUtils.lerp(this.smoothedPalm.y, handData.palmCenter.y, alpha);
    handData.palmCenter = { ...this.smoothedPalm };

    // Range & Interaction Zone Validation with Boundary Hysteresis
    this.validateInteractionRange(handData.palmCenter, now);

    // Calibration accumulation if active
    if (Calibration.isCalibrating) {
      Calibration.addSample(handData.palmCenter);
    }

    const classification = Classifier.classify(handData);
    this.activeGesture = classification.gesture;

    // Track fist release for slide single-trigger guarantee
    if (!handData.isFist) {
      this.fistReleaseTimer += 0.033;
      if (this.fistReleaseTimer > 0.16) {
        this.slideDebounceWaitReset = false; // Fist released, can slide again
      }
    } else {
      this.fistReleaseTimer = 0;
    }

    // Track peace sign release for jump single-trigger guarantee
    if (!handData.isTwoFingers && this.activeGesture !== 'JUMP') {
      this.jumpReleaseTimer += 0.033;
      if (this.jumpReleaseTimer > 0.16) {
        this.jumpDebounceWaitReset = false; // Peace sign released, can jump again
      }
    } else {
      this.jumpReleaseTimer = 0;
    }

    // Handle priority debouncing and dispatch actions
    this.handleActionDebounce(classification.gesture, now, handData);

    // Draw Points-Only Holographic Skeleton Display
    this.drawPipPreview(handData, classification);

    GlobalEvents.emit(EVENTS.GESTURE_RAW_DATA, { handData, classification, handCount });
    return { handData, classification, isFresh };
  }

  /**
   * Validates whether the hand is inside the normalized interaction zone.
   * Employs boundary margins, hysteresis, and a sustained-time filter
   * to eliminate flashing "OUT OF RANGE" messages during normal movements.
   */
  validateInteractionRange(palm, now) {
    const minX = this.ZONE_MARGIN;
    const maxX = 1.0 - this.ZONE_MARGIN;
    const minY = this.ZONE_MARGIN;
    const maxY = 1.0 - this.ZONE_MARGIN;

    // Check if hand is near extreme boundary
    const isOutOfBounds = palm.x < minX || palm.x > maxX || palm.y < minY || palm.y > maxY;

    if (isOutOfBounds) {
      if (!this.outOfRangeStartTime) {
        this.outOfRangeStartTime = now;
      }
      // Require sustained condition before displaying warning
      if (now - this.outOfRangeStartTime > this.OUT_OF_RANGE_DELAY_MS) {
        if (!this.isOutOfRange) {
          this.isOutOfRange = true;
          GlobalEvents.emit('GESTURE_OUT_OF_RANGE', { isOut: true });
        }
      }
    } else {
      // Hysteresis recovery margin: easily returns to valid zone
      const recoverMinX = minX + this.ZONE_HYSTERESIS;
      const recoverMaxX = maxX - this.ZONE_HYSTERESIS;
      const recoverMinY = minY + this.ZONE_HYSTERESIS;
      const recoverMaxY = maxY - this.ZONE_HYSTERESIS;

      if (palm.x >= recoverMinX && palm.x <= recoverMaxX && palm.y >= recoverMinY && palm.y <= recoverMaxY) {
        this.outOfRangeStartTime = null;
        if (this.isOutOfRange) {
          this.isOutOfRange = false;
          GlobalEvents.emit('GESTURE_OUT_OF_RANGE', { isOut: false });
        }
      }
    }
  }

  handleActionDebounce(gesture, now, handData) {
    const cooldownMs = GAME_CONFIG.GESTURES.COOLDOWN_MS || 180;
    const transitionCooldown = GAME_CONFIG.GESTURES.TRANSITION_COOLDOWN_MS || 450;
    const canFireAction = now - this.lastActionTime > cooldownMs;
    const canFireTransition = now - this.lastStateTransitionTime > transitionCooldown;

    const recordLatency = () => {
      if (this.perfMonitor && typeof this.perfMonitor.recordActionLatency === 'function') {
        this.perfMonitor.recordActionLatency(performance.now() - now);
      }
    };

    // Neutral resting pose clears directional debounce locks
    if (gesture === 'NEUTRAL') {
      this.laneDebounceWaitReset = false;
      this.lastLaneDirection = null;
      this.jumpDebounceWaitReset = false;
      return;
    }

    // Holding poses suppress gameplay inputs while pose stabilizes
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
          GlobalEvents.emit(EVENTS.PAUSE_REQUESTED, { reason: 'Game paused via open-palm gesture (✋).' });
          GlobalEvents.emit(EVENTS.GESTURE_RECOGNIZED, { gesture: 'PAUSE' });
          recordLatency();
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
          recordLatency();
        }
        return;
      }
      return;
    }

    // PRIORITY 3: GAMEPLAY GESTURES - ONLY while RUNNING
    if (this.currentGameState !== 'RUNNING') {
      return;
    }

    // Left / Right lane shifts (debounced: requires returning toward center or opposite direction)
    if (gesture === 'MOVE_LEFT' || gesture === 'MOVE_RIGHT') {
      const isSwitchingDirection = this.lastLaneDirection && this.lastLaneDirection !== gesture;
      const effectiveCooldown = isSwitchingDirection ? 140 : cooldownMs;
      const canFireLane = now - this.lastActionTime > effectiveCooldown;

      if (canFireLane && (!this.laneDebounceWaitReset || isSwitchingDirection)) {
        this.lastActionTime = now;
        this.laneDebounceWaitReset = true;
        this.lastLaneDirection = gesture;
        GlobalEvents.emit(EVENTS.PLAYER_MOVE_LANE, { direction: gesture === 'MOVE_LEFT' ? -1 : 1 });
        GlobalEvents.emit(EVENTS.GESTURE_RECOGNIZED, { gesture });
        recordLatency();
      }
    }
    // Jump (Peace / V sign - debounced: triggers ONCE per gesture, strictly locked until peace sign is released)
    else if (gesture === 'JUMP') {
      if (canFireAction && !this.jumpDebounceWaitReset) {
        this.lastActionTime = now;
        this.jumpDebounceWaitReset = true; // Locked until hand explicitly releases peace sign
        this.jumpReleaseTimer = 0;
        GlobalEvents.emit(EVENTS.PLAYER_JUMP);
        GlobalEvents.emit(EVENTS.GESTURE_RECOGNIZED, { gesture });
        recordLatency();
      }
    }
    // Slide (Closed Fist: triggers ONCE per gesture, strictly locked until fist is released)
    else if (gesture === 'SLIDE') {
      if (canFireAction && !this.slideDebounceWaitReset) {
        this.lastActionTime = now;
        this.slideDebounceWaitReset = true; // Locked until hand explicitly releases fist
        this.fistReleaseTimer = 0;
        GlobalEvents.emit(EVENTS.PLAYER_SLIDE);
        GlobalEvents.emit(EVENTS.GESTURE_RECOGNIZED, { gesture });
        recordLatency();
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
      const statusText = overrideStatus || (this.isOutOfRange ? 'OUT OF RANGE' : 'NO HAND DETECTED');
      const isWarn = statusText.includes('LOST') || statusText.includes('NO HAND') || statusText.includes('OFFLINE') || statusText.includes('RANGE');
      const isPending = statusText.includes('LOADING') || statusText.includes('READY');

      ctx.fillStyle = isWarn ? 'rgba(255, 122, 92, 0.12)' : (isPending ? 'rgba(0, 139, 255, 0.12)' : 'rgba(241, 248, 255, 0.9)');
      ctx.fillRect(4, 4, w - 8, 16);
      ctx.fillStyle = isWarn ? '#FF7A5C' : '#008BFF';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(statusText, w / 2, 15);

      ctx.fillStyle = '#6B7280';
      ctx.font = '8px sans-serif';
      ctx.fillText(statusText.includes('RANGE') ? 'MOVE TO CENTER' : (statusText.includes('LOST') ? 'REPOSITION HAND' : 'HOLD HAND IN VIEW'), w / 2, h / 2 + 4);
      return;
    }

    // 2. Normalization & Auto-Fit of Hand Landmarks
    const pts = handData.points;
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    const len = pts.length;
    for (let i = 0; i < len; i++) {
      const p = pts[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const span = Math.max(maxX - minX, maxY - minY, 0.18);
    const fitScale = Math.min((w * 0.68) / span, (h * 0.68) / span);

    const halfW = w / 2;
    const halfH = h / 2 + 2;

    // Transform points directly into pre-allocated screen point buffer
    for (let i = 0; i < len; i++) {
      const p = pts[i];
      const sp = this.screenPts[i];
      sp.x = halfW + (p.x - cx) * fitScale;
      sp.y = halfH + (p.y - cy) * fitScale;
    }

    this.screenPalm.x = halfW + (handData.palmCenter.x - cx) * fitScale;
    this.screenPalm.y = halfH + (handData.palmCenter.y - cy) * fitScale;

    // 3. Subtle Sky Blue Glow Around Hand Center
    const palmScr = this.screenPalm;
    const grad = ctx.createRadialGradient(palmScr.x, palmScr.y, 2, palmScr.x, palmScr.y, 36);
    grad.addColorStop(0, 'rgba(0, 139, 255, 0.15)');
    grad.addColorStop(0.7, 'rgba(191, 231, 255, 0.12)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 4. Digital Skeleton Connections (21 Landmarks) - uses pre-cached connection graph
    ctx.save();
    ctx.strokeStyle = '#008BFF';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const conn = this.skeletonConnections;
    const connLen = conn.length;
    for (let k = 0; k < connLen; k++) {
      const [i, j] = conn[k];
      const p1 = this.screenPts[i];
      const p2 = this.screenPts[j];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Joint Landmark Dots
    ctx.save();
    ctx.fillStyle = '#8E7DFF';
    for (let i = 0; i < len; i++) {
      const sp = this.screenPts[i];
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
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
    for (let t = 0; t < tips.length; t++) {
      const { idx, ext } = tips[t];
      const sp = this.screenPts[idx];
      ctx.fillStyle = ext ? '#FFD34E' : '#008BFF';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, ext ? 3.8 : 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (ext) {
        ctx.strokeStyle = '#FF7A5C';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    ctx.restore();

    // 7. Palm Center Anchor Beacon
    ctx.fillStyle = '#008BFF';
    ctx.beginPath();
    ctx.arc(palmScr.x, palmScr.y, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // 8. Top Tracking Status: Sustained Out of Range warning or Clean Active Status
    if (this.isOutOfRange) {
      ctx.fillStyle = 'rgba(255, 122, 92, 0.15)';
      ctx.fillRect(4, 4, w - 8, 14);
      ctx.fillStyle = '#FF7A5C';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ OUT OF RANGE', w / 2, 14);
    } else {
      ctx.fillStyle = 'rgba(110, 194, 7, 0.15)';
      ctx.fillRect(4, 4, w - 8, 14);
      ctx.fillStyle = '#6EC207';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🟢 HAND IN RANGE', w / 2, 14);
    }

    // 9. Bottom Active Gesture Banner
    if (classification) {
      let label = classification.gesture;
      if (label === 'PAUSE' || label === 'HOLDING_PAUSE') label = '✋ PAUSE';
      else if (label === 'RESUME' || label === 'HOLDING_RESUME') label = 'RESUME (3-FINGER)';
      else if (label === 'SLIDE') label = '✊ SLIDE';
      else if (label === 'JUMP') label = '✌️ JUMP';
      else if (label === 'MOVE_LEFT') label = '👈 LEFT';
      else if (label === 'MOVE_RIGHT') label = '👉 RIGHT';
      else if (label === 'NEUTRAL') label = 'HAND READY';

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
      isOutOfRange: this.isOutOfRange,
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
    this.lastLaneDirection = null;
    this.jumpDebounceWaitReset = false;
    this.slideDebounceWaitReset = false;
    this.fistReleaseTimer = 0;
    this.jumpReleaseTimer = 0;
    this.activeGesture = 'NONE';
    this.isTrackingLost = true;
    this.isOutOfRange = false;
    this.outOfRangeStartTime = null;
    this.trackingLossStartTime = null;
  }
}

export const Gestures = new GestureController();
