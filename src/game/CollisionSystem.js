/**
 * AI Gesture Runner 3D - CollisionSystem
 * High-performance 3D AABB intersection testing with spatial pruning
 * and zero per-frame object allocations.
 */

import { OBSTACLE_TYPES } from './ObstacleManager.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';
import { Sound } from '../services/SoundService.js';

export class CollisionSystem {
  constructor(playerController, obstacleManager, powerUpManager) {
    this.controller = playerController;
    this.obstacles = obstacleManager;
    this.powerUps = powerUpManager;

    // Pre-allocated reusable AABB structures (zero per-frame allocations)
    this.pBox = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
    this.oBox = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
  }

  checkCollisions() {
    if (this.controller.isDead || this.controller.player.invulnerableTimer > 0) {
      return false;
    }

    // Speed boost makes player invulnerable
    if (this.powerUps.hasBoost()) {
      return false;
    }

    this.controller.getBoundingBox(this.pBox);
    const playerZ = this.controller.position.z;
    const playerX = this.controller.position.x;
    const obsList = this.obstacles.obstacles;

    for (let i = 0; i < obsList.length; i++) {
      const obs = obsList[i];
      if (!obs.active) continue;

      const oPos = obs.mesh.position;

      // Spatial Early-Out: Only check obstacles within proximity window
      const dz = Math.abs(oPos.z - playerZ);
      const isTrain = obs.type === OBSTACLE_TYPES.MOVING_TRAIN;
      const maxDz = isTrain ? 6.5 : 4.0;
      if (dz > maxDz) continue;

      const dx = Math.abs(oPos.x - playerX);
      if (dx > 2.2) continue; // Different railway lane

      // Compute obstacle bounding box in-place
      const b = this.oBox;
      if (obs.type === OBSTACLE_TYPES.LOW_BARRIER) {
        b.minX = oPos.x - 1.1;
        b.maxX = oPos.x + 1.1;
        b.minY = 0;
        b.maxY = 0.85;
        b.minZ = oPos.z - 0.2;
        b.maxZ = oPos.z + 0.2;
      } else if (obs.type === OBSTACLE_TYPES.HIGH_BARRIER) {
        b.minX = oPos.x - 1.2;
        b.maxX = oPos.x + 1.2;
        b.minY = 1.12;
        b.maxY = 1.8;
        b.minZ = oPos.z - 0.2;
        b.maxZ = oPos.z + 0.2;
      } else if (obs.type === OBSTACLE_TYPES.LANE_BLOCKER) {
        b.minX = oPos.x - 1.1;
        b.maxX = oPos.x + 1.1;
        b.minY = 0;
        b.maxY = 3.0;
        b.minZ = oPos.z - 2.1;
        b.maxZ = oPos.z + 2.1;
      } else if (obs.type === OBSTACLE_TYPES.MOVING_TRAIN) {
        b.minX = oPos.x - 1.15;
        b.maxX = oPos.x + 1.15;
        b.minY = 0;
        b.maxY = 3.2;
        b.minZ = oPos.z - 3.6;
        b.maxZ = oPos.z + 3.6;
      }

      if (this.intersectAABB(this.pBox, b)) {
        this.handleCollision(obs);
        return true;
      }
    }

    return false;
  }

  intersectAABB(a, b) {
    return (
      a.minX <= b.maxX &&
      a.maxX >= b.minX &&
      a.minY <= b.maxY &&
      a.maxY >= b.minY &&
      a.minZ <= b.maxZ &&
      a.maxZ >= b.minZ
    );
  }

  handleCollision(obstacle) {
    // If shield is active, shield absorbs the collision!
    if (this.powerUps.consumeShield()) {
      Sound.playPowerup();
      this.controller.player.setInvulnerable(1.6);
      GlobalEvents.emit(EVENTS.PLAYER_COLLISION, { absorbedByShield: true, obstacle });
      return;
    }

    // Lethal collision
    this.controller.isDead = true;
    Sound.playCollision();
    GlobalEvents.emit(EVENTS.PLAYER_COLLISION, { absorbedByShield: false, obstacle });
    GlobalEvents.emit(EVENTS.GAME_OVER);
  }
}
