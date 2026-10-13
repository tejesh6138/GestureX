/**
 * AI Gesture Runner 3D - CameraController
 * Polished Third-Person Chase Camera:
 * - Smooth damped lateral following with controlled banking tilt during lane shifts
 * - Decoupled vertical tracking: character visibly leaps upward during jumps rather than camera elevating
 * - Subtle running stride bobbing and landing compression response
 * - Dynamic speed-responsive FOV interpolation (gradual widening at higher speeds)
 * - Lower-middle character framing with expansive view of upcoming tracks and obstacles
 * - Responsive FOV adaptation for narrow portrait mobile screens
 */

import * as THREE from 'three';
import { GAME_CONFIG } from '../core/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

export class CameraController {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.CAMERA.BASE_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      280
    );

    this.currentX = 0;
    this.currentY = GAME_CONFIG.CAMERA.OFFSET_Y;
    this.shakeIntensity = 0;
    this.totalTime = 0;
    this.landingDip = 0;
    this.previousPlayerY = 0;
  }

  shake(amount = 0.4) {
    this.shakeIntensity = Math.max(this.shakeIntensity, amount);
  }

  update(playerPos, speed = 22.0, dt = 0.016) {
    this.totalTime += dt;

    // Detect landing impact (player was in air and just hit ground)
    if (this.previousPlayerY > 0.1 && playerPos.y <= 0.02) {
      this.landingDip = 0.12; // Gentle cushion downward
    }
    this.previousPlayerY = playerPos.y;

    if (this.landingDip > 0.001) {
      this.landingDip = MathUtils.damp(this.landingDip, 0, 10.0, dt);
    }

    // 1. Smoothly follow player lateral X (damped follow prevents abrupt snaps)
    this.currentX = MathUtils.damp(this.currentX, playerPos.x, 8.5, dt);

    // 2. Controlled vertical tracking:
    // Subway Surfers chase camera does NOT track the full jump height 1:1.
    // Instead, it absorbs ~25% of the jump height so the player visibly jumps UP into the frame!
    const isGround = playerPos.y <= 0.05;
    // Subtle running stride bounce only while on ground
    const strideCadence = Math.max(12, speed) * 0.42;
    const strideBob = isGround ? Math.sin(this.totalTime * strideCadence * 2) * 0.03 : 0;

    const targetCamY = GAME_CONFIG.CAMERA.OFFSET_Y + playerPos.y * 0.28 + strideBob - this.landingDip;
    this.currentY = MathUtils.damp(this.currentY, targetCamY, isGround ? 9.0 : 6.0, dt);

    // 3. Screen shake calculation
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeIntensity > 0.01) {
      shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = MathUtils.damp(this.shakeIntensity, 0, 4.0, dt);
    }

    // 4. Position camera behind and slightly above player
    const camZ = playerPos.z + GAME_CONFIG.CAMERA.OFFSET_Z;
    this.camera.position.set(
      this.currentX + GAME_CONFIG.CAMERA.OFFSET_X + shakeX,
      this.currentY + shakeY,
      camZ
    );

    // 5. Look ahead down the railway horizon
    const lookTargetX = this.currentX * 0.85;
    const lookTargetY = playerPos.y * 0.18 + GAME_CONFIG.CAMERA.LOOK_AHEAD_Y;
    const lookTargetZ = playerPos.z + GAME_CONFIG.CAMERA.LOOK_AHEAD_Z;
    this.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);

    // 6. Camera banking tilt on lane change (subtle roll)
    const lateralDelta = playerPos.x - this.currentX;
    const tilt = MathUtils.clamp(-lateralDelta * GAME_CONFIG.CAMERA.TILT_ANGLE, -0.06, 0.06);
    this.camera.rotation.z = tilt;

    // 7. Dynamic speed FOV interpolation (gradually widens with speed)
    const baseFov = this.getBaseFov();
    const speedRatio = MathUtils.clamp(
      (speed - GAME_CONFIG.PLAYER.INITIAL_SPEED) /
      (GAME_CONFIG.PLAYER.MAX_SPEED - GAME_CONFIG.PLAYER.INITIAL_SPEED),
      0,
      1
    );
    const maxFovBonus = this.camera.aspect < 1.0 ? 10 : 12; // Moderate expansion
    const targetFov = baseFov + speedRatio * maxFovBonus;

    this.camera.fov = MathUtils.damp(this.camera.fov, targetFov, 3.2, dt);
    this.camera.updateProjectionMatrix();
  }

  getBaseFov() {
    // When aspect ratio is narrow (< 1.0, e.g. portrait mobile screens), expand vertical FOV
    // so horizontal track coverage (all 3 lanes) is preserved without cropping.
    if (this.camera.aspect < 1.0) {
      const hTargetDeg = 68;
      const vFovRad = 2 * Math.atan(Math.tan((hTargetDeg * Math.PI) / 360) / this.camera.aspect);
      return MathUtils.clamp((vFovRad * 180) / Math.PI, 60, 84);
    }
    return GAME_CONFIG.CAMERA.BASE_FOV;
  }

  resize(width, height) {
    const w = width || window.innerWidth;
    const h = height || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.fov = this.getBaseFov();
    this.camera.updateProjectionMatrix();
  }
}
