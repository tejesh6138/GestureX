/**
 * AI Gesture Runner 3D - CameraController
 * Dynamic third-person camera with speed-responsive FOV, lane banking tilt, and screen shake.
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
      250
    );

    this.currentX = 0;
    this.shakeIntensity = 0;
  }

  shake(amount = 0.4) {
    this.shakeIntensity = amount;
  }

  update(playerPos, speed, dt) {
    // 1. Smoothly follow player lateral X
    this.currentX = MathUtils.lerp(this.currentX, playerPos.x, 1 - Math.exp(-8.0 * dt));

    // 2. Camera Shake calculation
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeIntensity > 0.01) {
      shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 1.5);
    }

    // 3. Position camera behind and above player
    this.camera.position.set(
      this.currentX + GAME_CONFIG.CAMERA.OFFSET_X + shakeX,
      playerPos.y + GAME_CONFIG.CAMERA.OFFSET_Y + shakeY,
      playerPos.z + GAME_CONFIG.CAMERA.OFFSET_Z
    );

    // 4. Look ahead towards horizon
    this.camera.lookAt(
      this.currentX,
      playerPos.y + GAME_CONFIG.CAMERA.LOOK_AHEAD_Y,
      playerPos.z + GAME_CONFIG.CAMERA.LOOK_AHEAD_Z
    );

    // 5. Dynamic FOV based on aspect ratio and gameplay speed
    const baseFov = this.getBaseFov();
    const speedRatio = (speed - GAME_CONFIG.PLAYER.INITIAL_SPEED) /
      (GAME_CONFIG.PLAYER.MAX_SPEED - GAME_CONFIG.PLAYER.INITIAL_SPEED);
    const targetFov = baseFov + MathUtils.clamp(speedRatio, 0, 1) *
      (GAME_CONFIG.CAMERA.MAX_FOV - GAME_CONFIG.CAMERA.BASE_FOV);

    this.camera.fov = MathUtils.lerp(this.camera.fov, targetFov, 0.05);
    this.camera.updateProjectionMatrix();

    // 6. Camera banking tilt on lane change
    const lateralDelta = playerPos.x - this.currentX;
    this.camera.rotation.z = -lateralDelta * GAME_CONFIG.CAMERA.TILT_ANGLE;
  }

  getBaseFov() {
    // When aspect ratio is narrow (< 1.0, e.g. portrait mobile screens), expand vertical FOV
    // so horizontal track coverage (all 3 lanes) is preserved without cropping.
    if (this.camera.aspect < 1.0) {
      const hTargetDeg = 68;
      const vFovRad = 2 * Math.atan(Math.tan((hTargetDeg * Math.PI) / 360) / this.camera.aspect);
      return MathUtils.clamp((vFovRad * 180) / Math.PI, 60, 86);
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
