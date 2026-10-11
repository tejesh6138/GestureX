/**
 * AI Gesture Runner 3D - CollisionSystem
 * 3D AABB intersection tests accounting for dynamic jumping heights and crouching slide profiles.
 */

import { OBSTACLE_TYPES } from './ObstacleManager.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';
import { Sound } from '../services/SoundService.js';

export class CollisionSystem {
  constructor(playerController, obstacleManager, powerUpManager) {
    this.controller = playerController;
    this.obstacles = obstacleManager;
    this.powerUps = powerUpManager;
  }

  checkCollisions() {
    if (this.controller.isDead || this.controller.player.invulnerableTimer > 0) {
      return false;
    }

    // Speed boost makes player invulnerable
    if (this.powerUps.hasBoost()) {
      return false;
    }

    const pBox = this.controller.getBoundingBox();
    const activeObs = this.obstacles.getActiveObstacles();

    for (const obs of activeObs) {
      const oPos = obs.mesh.position;
      let oBox = null;

      if (obs.type === OBSTACLE_TYPES.LOW_BARRIER) {
        // Hurdle width: 2.2, height: 0.85, depth: 0.4
        oBox = {
          minX: oPos.x - 1.1,
          maxX: oPos.x + 1.1,
          minY: 0,
          maxY: 0.85,
          minZ: oPos.z - 0.2,
          maxZ: oPos.z + 0.2
        };
      } else if (obs.type === OBSTACLE_TYPES.HIGH_BARRIER) {
        // Overhead beam: height from 1.15 to 1.8
        oBox = {
          minX: oPos.x - 1.2,
          maxX: oPos.x + 1.2,
          minY: 1.12,
          maxY: 1.8,
          minZ: oPos.z - 0.2,
          maxZ: oPos.z + 0.2
        };
      } else if (obs.type === OBSTACLE_TYPES.LANE_BLOCKER) {
        // Full train blocker
        oBox = {
          minX: oPos.x - 1.1,
          maxX: oPos.x + 1.1,
          minY: 0,
          maxY: 3.0,
          minZ: oPos.z - 2.1,
          maxZ: oPos.z + 2.1
        };
      } else if (obs.type === OBSTACLE_TYPES.MOVING_TRAIN) {
        // Heavy oncoming cyber-train
        oBox = {
          minX: oPos.x - 1.15,
          maxX: oPos.x + 1.15,
          minY: 0,
          maxY: 3.2,
          minZ: oPos.z - 3.6,
          maxZ: oPos.z + 3.6
        };
      }

      if (oBox && this.intersectAABB(pBox, oBox)) {
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
