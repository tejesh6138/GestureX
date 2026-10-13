/**
 * AI Gesture Runner 3D - HandTracker
 * Robust computer-vision kinematics tracker:
 * Extracts normalized hand kinematics, individual finger extension/folding,
 * palm center, slant angles, and velocities using relative geometry invariant to hand scale.
 */

import { MathUtils } from '../utils/MathUtils.js';

export class HandTracker {
  constructor() {
    this.history = [];
    this.historyMax = 8;
  }

  process(landmarks) {
    if (!landmarks || landmarks.length < 21) {
      return null;
    }

    // Mirror X coordinates for intuitive mirror camera behavior
    const points = landmarks.map((pt) => ({
      x: 1.0 - pt.x,
      y: pt.y,
      z: pt.z ?? 0
    }));

    const wrist = points[0];
    const thumbCmc = points[1];
    const thumbMcp = points[2];
    const thumbIp = points[3];
    const thumbTip = points[4];

    const indexMcp = points[5];
    const indexPip = points[6];
    const indexDip = points[7];
    const indexTip = points[8];

    const middleMcp = points[9];
    const middlePip = points[10];
    const middleDip = points[11];
    const middleTip = points[12];

    const ringMcp = points[13];
    const ringPip = points[14];
    const ringDip = points[15];
    const ringTip = points[16];

    const pinkyMcp = points[17];
    const pinkyPip = points[18];
    const pinkyDip = points[19];
    const pinkyTip = points[20];

    // Palm center = average of base knuckles + wrist
    const palmCenter = {
      x: (wrist.x + indexMcp.x + middleMcp.x + ringMcp.x + pinkyMcp.x) / 5,
      y: (wrist.y + indexMcp.y + middleMcp.y + ringMcp.y + pinkyMcp.y) / 5,
      z: (wrist.z + indexMcp.z + middleMcp.z + ringMcp.z + pinkyMcp.z) / 5
    };

    // Scale reference: distance between wrist and middle knuckle
    const handScale = Math.max(0.04, MathUtils.distance2D(wrist.x, wrist.y, middleMcp.x, middleMcp.y));

    // Calculate individual finger extension metrics using robust relative geometry
    const indexMetrics = this.getFingerMetrics(wrist, indexMcp, indexPip, indexDip, indexTip, palmCenter, handScale);
    const middleMetrics = this.getFingerMetrics(wrist, middleMcp, middlePip, middleDip, middleTip, palmCenter, handScale);
    const ringMetrics = this.getFingerMetrics(wrist, ringMcp, ringPip, ringDip, ringTip, palmCenter, handScale);
    const pinkyMetrics = this.getFingerMetrics(wrist, pinkyMcp, pinkyPip, pinkyDip, pinkyTip, palmCenter, handScale);

    // Thumb metrics
    const thumbDistToPalm = MathUtils.distance2D(thumbTip.x, thumbTip.y, palmCenter.x, palmCenter.y) / handScale;
    const thumbExtended = thumbDistToPalm > 1.0;
    const thumbFolded = thumbDistToPalm < 0.90;

    const avgTipDistanceToPalm = (
      indexMetrics.distPalmTip +
      middleMetrics.distPalmTip +
      ringMetrics.distPalmTip +
      pinkyMetrics.distPalmTip
    ) / 4;

    const extendedCount = (indexMetrics.isExtended ? 1 : 0) +
                          (middleMetrics.isExtended ? 1 : 0) +
                          (ringMetrics.isExtended ? 1 : 0) +
                          (pinkyMetrics.isExtended ? 1 : 0);

    // 1. OPEN PALM (Pause while running): All 4 main fingers extended + open thumb
    const isOpenPalm = indexMetrics.isExtended &&
                       middleMetrics.isExtended &&
                       ringMetrics.isExtended &&
                       pinkyMetrics.isExtended &&
                       (avgTipDistanceToPalm > 0.88 || thumbExtended);

    // 2. CLOSED FIST (Slide): All 4 fingers folded tight toward palm
    const isFist = (extendedCount === 0) &&
                   (indexMetrics.distPalmTip < 0.88 || indexMetrics.isFolded) &&
                   (middleMetrics.distPalmTip < 0.88 || middleMetrics.isFolded) &&
                   (ringMetrics.distPalmTip < 0.88 || ringMetrics.isFolded) &&
                   (pinkyMetrics.distPalmTip < 0.88 || pinkyMetrics.isFolded) &&
                   (avgTipDistanceToPalm < 0.84 || thumbFolded);

    // 3. INDEX ONLY (Directional Left / Right):
    // Index finger extended, while middle, ring, pinky are folded/curled
    const isIndexOnly = indexMetrics.isExtended &&
                        !middleMetrics.isExtended &&
                        !ringMetrics.isExtended &&
                        !pinkyMetrics.isExtended &&
                        (middleMetrics.distWristTip < indexMetrics.distWristTip * 0.85) &&
                        (ringMetrics.distWristTip < indexMetrics.distWristTip * 0.82) &&
                        (pinkyMetrics.distWristTip < indexMetrics.distWristTip * 0.82) &&
                        (indexTip.y < indexMcp.y + 0.12);

    // Palm orientation vector (wrist to middle knuckle)
    const palmVecX = middleMcp.x - wrist.x;
    const palmVecY = middleMcp.y - wrist.y;
    const palmLen = Math.hypot(palmVecX, palmVecY) || 1;
    // Perpendicular vector pointing to hand's local right (in mirrored space)
    const rightVecX = -palmVecY / palmLen;
    const rightVecY = palmVecX / palmLen;

    // Index finger displacement vector
    const indexVecX = indexTip.x - indexMcp.x;
    const indexVecY = indexTip.y - indexMcp.y;

    // Project index vector onto the local right axis, normalized by handScale
    const relativeSlant = (indexVecX * rightVecX + indexVecY * rightVecY) / handScale;
    const absoluteSlant = (indexTip.x - indexMcp.x) / handScale;
    // Balanced composite slant (invariant to hand rotation / tilt)
    const indexSlant = relativeSlant * 0.60 + absoluteSlant * 0.40;
    const indexSlantThreshold = 0.18;
    const isIndexSlantedLeft = isIndexOnly && (indexSlant < -indexSlantThreshold);
    const isIndexSlantedRight = isIndexOnly && (indexSlant > indexSlantThreshold);

    // 4. JUMP: INDEX + MIDDLE FINGERS EXTENDED upward (Peace/V sign), ring/pinky folded
    const isTwoFingers = indexMetrics.isExtended &&
                         middleMetrics.isExtended &&
                         !ringMetrics.isExtended &&
                         !pinkyMetrics.isExtended &&
                         (ringMetrics.distWristTip < middleMetrics.distWristTip * 0.85) &&
                         (pinkyMetrics.distWristTip < middleMetrics.distWristTip * 0.82) &&
                         (indexTip.y < indexMcp.y) &&
                         (middleTip.y < middleMcp.y);

    // 5. RESUME: INDEX + MIDDLE + RING FINGERS EXTENDED (3 fingers), thumb and pinky folded
    const isThreeFingers = indexMetrics.isExtended &&
                          middleMetrics.isExtended &&
                          ringMetrics.isExtended &&
                          !pinkyMetrics.isExtended &&
                          !thumbExtended &&
                          (pinkyMetrics.distWristTip < ringMetrics.distWristTip * 0.85) &&
                          (indexTip.y < indexMcp.y) &&
                          (middleTip.y < middleMcp.y);

    // Track motion velocity of palm center
    const now = performance.now();
    this.history.push({ time: now, y: palmCenter.y, x: palmCenter.x });
    if (this.history.length > this.historyMax) {
      this.history.shift();
    }

    let velocityY = 0;
    let velocityX = 0;
    if (this.history.length >= 2) {
      const oldest = this.history[0];
      const dt = (now - oldest.time) / 1000;
      if (dt > 0.03) {
        velocityY = (palmCenter.y - oldest.y) / dt;
        velocityX = (palmCenter.x - oldest.x) / dt;
      }
    }

    return {
      points,
      palmCenter,
      wrist,
      handScale,
      extendedCount,
      indexExtended: indexMetrics.isExtended,
      middleExtended: middleMetrics.isExtended,
      ringExtended: ringMetrics.isExtended,
      pinkyExtended: pinkyMetrics.isExtended,
      thumbExtended,
      isOpenPalm,
      isFist,
      isIndexOnly,
      indexSlant,
      isIndexSlantedLeft,
      isIndexSlantedRight,
      isTwoFingers,
      isThreeFingers,
      avgTipDistanceToPalm,
      velocityY,
      velocityX,
      timestamp: now
    };
  }

  getFingerMetrics(wrist, mcp, pip, dip, tip, palmCenter, handScale) {
    const distWristTip = MathUtils.distance2D(wrist.x, wrist.y, tip.x, tip.y);
    const distWristPip = MathUtils.distance2D(wrist.x, wrist.y, pip.x, pip.y);
    const distWristMcp = MathUtils.distance2D(wrist.x, wrist.y, mcp.x, mcp.y);
    const distPalmTip = MathUtils.distance2D(palmCenter.x, palmCenter.y, tip.x, tip.y) / handScale;

    const directLength = MathUtils.distance2D(mcp.x, mcp.y, tip.x, tip.y);
    const segmentLength = (
      MathUtils.distance2D(mcp.x, mcp.y, pip.x, pip.y) +
      MathUtils.distance2D(pip.x, pip.y, dip.x, dip.y) +
      MathUtils.distance2D(dip.x, dip.y, tip.x, tip.y)
    );
    const straightness = directLength / Math.max(0.001, segmentLength);

    const isExtended = (distWristTip > distWristPip * 1.08) &&
                       (distWristTip > distWristMcp * 1.18) &&
                       (distPalmTip > 0.88) &&
                       (straightness > 0.70);

    const isFolded = (distPalmTip < 0.85) ||
                     (distWristTip <= distWristPip * 1.08) ||
                     (straightness < 0.65);

    return {
      distWristTip,
      distWristPip,
      distWristMcp,
      distPalmTip,
      straightness,
      isExtended,
      isFolded
    };
  }

  reset() {
    this.history = [];
  }
}
