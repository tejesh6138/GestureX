/**
 * AI Gesture Runner 3D - CoinManager
 * 3D spinning metallic collectible coins with procedural patterns, magnet physics, and particle bursts.
 */

import * as THREE from 'three';
import { GAME_CONFIG } from '../core/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';
import { Sound } from '../services/SoundService.js';
import { OBSTACLE_TYPES } from './ObstacleManager.js';

export class CoinManager {
  constructor(scene) {
    this.scene = scene;
    this.obstacleManager = null;
    this.coins = [];
    this.pool = [];
    this.nextSpawnZ = -15;
    this.lanes = [GAME_CONFIG.LANES.LEFT_X, GAME_CONFIG.LANES.CENTER_X, GAME_CONFIG.LANES.RIGHT_X];

    this.initCoinAssets();
    this.initParticleBurstSystem();
  }

  setObstacleManager(obstacleManager) {
    this.obstacleManager = obstacleManager;
  }

  initCoinAssets() {
    // Outer Coin Cylinder Geometry with bevel edge
    this.coinGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.10, 24);
    this.coinGeo.rotateX(Math.PI / 2);

    // Inner Core Disc Geometry
    this.coreGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.12, 20);
    this.coreGeo.rotateX(Math.PI / 2);

    // 5-Point Star Emblem
    const starShape = new THREE.Shape();
    const outerR = 0.20;
    const innerR = 0.09;
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();
    this.starGeo = new THREE.ShapeGeometry(starShape);

    // Warm luminous metallic gold materials
    this.coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd34e,
      emissive: 0xffa000,
      emissiveIntensity: 0.45,
      metalness: 0.92,
      roughness: 0.2
    });

    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0xffea79,
      emissive: 0xffc107,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.25
    });

    this.starMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffe57f,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.1
    });
  }

  initParticleBurstSystem() {
    const pCount = 120;
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0xffe033,
      size: 0.22,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });

    this.burstPoints = new THREE.Points(pGeo, pMat);
    this.scene.add(this.burstPoints);
    this.burstParticles = [];
  }

  createCoinMesh() {
    const group = new THREE.Group();

    const outer = new THREE.Mesh(this.coinGeo, this.coinMat);
    outer.castShadow = true;
    group.add(outer);

    const core = new THREE.Mesh(this.coreGeo, this.coreMat);
    group.add(core);

    // Front star emblem
    const starFront = new THREE.Mesh(this.starGeo, this.starMat);
    starFront.position.z = 0.065;
    group.add(starFront);

    // Back star emblem
    const starBack = new THREE.Mesh(this.starGeo, this.starMat);
    starBack.position.z = -0.065;
    starBack.rotateY(Math.PI);
    group.add(starBack);

    this.scene.add(group);
    return group;
  }

  /**
   * Checks if an obstacle blocks a specific lane and Z position.
   */
  isLaneBlocked(laneX, z, radius = 2.5) {
    if (!this.obstacleManager) return false;
    const obstacles = this.obstacleManager.getActiveObstacles();
    for (const obs of obstacles) {
      const p = obs.mesh.position;
      if (Math.abs(p.x - laneX) < 1.1 && Math.abs(p.z - z) < radius) {
        return true;
      }
    }
    return false;
  }

  /**
   * Spawns coins in organized procedural patterns:
   * - Straight line perfectly centered in a lane
   * - Parabolic jump arc centered in a lane
   * - Symmetric diagonal / lane-change trail
   * - Horizontal row across all 3 lanes
   */
  spawnPattern(startZ) {
    const spawnProb = GAME_CONFIG.COINS.SPAWN_PROBABILITY ?? 0.85;
    if (Math.random() > spawnProb) return;

    if (!this.laneHistory) {
      this.laneHistory = [0, 1, 2];
    }

    // Pick lane with balanced distribution across left, center, right
    const laneIdx = this.laneHistory.shift();
    this.laneHistory.push(laneIdx);
    const chosenLane = this.lanes[laneIdx];

    const roll = Math.random();

    if (roll < 0.38) {
      // 1. Centered Straight Trail in selected lane
      if (!this.isLaneBlocked(chosenLane, startZ, 14)) {
        this.spawnStraightTrail(chosenLane, startZ, 6);
      }
    } else if (roll < 0.68) {
      // 2. Parabolic Jump Arc (centered in lane, reachable jump apex)
      if (!this.isLaneBlocked(chosenLane, startZ, 12)) {
        this.spawnArcTrail(chosenLane, startZ, 5);
      }
    } else if (roll < 0.86) {
      // 3. Symmetrical Lane-Change Trail between adjacent lanes
      const targetLaneIdx = laneIdx === 1 ? (Math.random() > 0.5 ? 0 : 2) : 1;
      const startLaneX = this.lanes[laneIdx];
      const endLaneX = this.lanes[targetLaneIdx];
      this.spawnDiagonalTrail(startLaneX, endLaneX, startZ, 5);
    } else {
      // 4. Centered Row across all 3 lanes
      this.spawnRow(startZ);
    }
  }

  spawnStraightTrail(laneX, startZ, count = 6) {
    const spacing = 2.6;
    for (let i = 0; i < count; i++) {
      const z = startZ - i * spacing;
      if (!this.isLaneBlocked(laneX, z, 1.4)) {
        this.addCoin(laneX, 1.0, z);
      }
    }
  }

  spawnArcTrail(laneX, startZ, count = 5) {
    const spacing = 2.5;
    for (let i = 0; i < count; i++) {
      const z = startZ - i * spacing;
      const progress = i / (count - 1);
      // Parabolic curve starting at 1.0m, reaching 2.45m at apex
      const y = 1.0 + Math.sin(progress * Math.PI) * 1.45;
      this.addCoin(laneX, y, z);
    }
  }

  spawnDiagonalTrail(startLaneX, endLaneX, startZ, count = 5) {
    const spacing = 2.6;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      // Smooth cosine easing between lanes
      const smoothT = 0.5 - 0.5 * Math.cos(t * Math.PI);
      const x = MathUtils.lerp(startLaneX, endLaneX, smoothT);
      const z = startZ - i * spacing;
      if (!this.isLaneBlocked(x, z, 1.4)) {
        this.addCoin(x, 1.0, z);
      }
    }
  }

  spawnRow(startZ) {
    this.lanes.forEach((laneX) => {
      if (!this.isLaneBlocked(laneX, startZ, 1.4)) {
        this.addCoin(laneX, 1.0, startZ);
      }
    });
  }

  addCoin(x, y, z) {
    let item = this.pool.find((c) => !c.active);
    if (!item) {
      const mesh = this.createCoinMesh();
      item = { mesh, active: true, collected: false };
      this.pool.push(item);
    }

    item.active = true;
    item.collected = false;
    item.mesh.visible = true;
    item.mesh.position.set(x, y, z);
    item.mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
    this.coins.push(item);
  }

  triggerBurst(x, y, z) {
    for (let i = 0; i < 16; i++) {
      this.burstParticles.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 9,
        vy: (Math.random() - 0.1) * 8.5,
        vz: (Math.random() - 0.5) * 9,
        life: 0.45
      });
    }
  }

  update(playerPos, dt, hasMagnet = false) {
    // 1. Procedural generation ahead of player
    while (this.nextSpawnZ > playerPos.z - 130) {
      this.spawnPattern(this.nextSpawnZ);
      this.nextSpawnZ -= MathUtils.randomRange(22, 34);
    }

    const rotSpeed = GAME_CONFIG.COINS.ROTATION_SPEED || 4.2;
    const collectRadius = GAME_CONFIG.COINS.COLLECTION_RADIUS || 1.35;

    // 2. Continuous rotation & magnet pull physics
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (!c.active || c.collected) continue;

      c.mesh.rotation.y += dt * rotSpeed;

      // Magnet pull physics
      if (hasMagnet) {
        const distToPlayer = MathUtils.distance3D(
          playerPos.x, playerPos.y + 0.8, playerPos.z,
          c.mesh.position.x, c.mesh.position.y, c.mesh.position.z
        );

        if (distToPlayer < GAME_CONFIG.POWER_UPS.MAGNET_RADIUS) {
          const pullSpeed = GAME_CONFIG.POWER_UPS.MAGNET_PULL_SPEED * dt;
          c.mesh.position.x = MathUtils.lerp(c.mesh.position.x, playerPos.x, pullSpeed * 0.45);
          c.mesh.position.y = MathUtils.lerp(c.mesh.position.y, playerPos.y + 0.8, pullSpeed * 0.45);
          c.mesh.position.z = MathUtils.lerp(c.mesh.position.z, playerPos.z, pullSpeed * 0.55);
        }
      }

      // Exact collision detection with player
      const collectDist = MathUtils.distance3D(
        playerPos.x, playerPos.y + 0.8, playerPos.z,
        c.mesh.position.x, c.mesh.position.y, c.mesh.position.z
      );

      if (collectDist < collectRadius) {
        this.collectCoin(c, i);
        continue;
      }

      // Recycle if passed behind player
      if (c.mesh.position.z > playerPos.z + 12) {
        c.active = false;
        c.mesh.visible = false;
        this.coins.splice(i, 1);
      }
    }

    // 3. Update particle bursts
    this.updateParticles(dt);
  }

  collectCoin(coinItem, index) {
    if (coinItem.collected) return;
    coinItem.collected = true;
    coinItem.active = false;
    coinItem.mesh.visible = false;
    this.coins.splice(index, 1);

    const pos = {
      x: coinItem.mesh.position.x,
      y: coinItem.mesh.position.y,
      z: coinItem.mesh.position.z
    };

    this.triggerBurst(pos.x, pos.y, pos.z);
    Sound.playCoin();

    // Trigger HUD animation and coin tally
    GlobalEvents.emit(EVENTS.COIN_COLLECTED, { position: pos, count: 1 });
    GlobalEvents.emit(EVENTS.FLOATING_NOTICE, { text: '+1', position: pos, type: 'coin' });
  }

  updateParticles(dt) {
    if (this.burstParticles.length === 0) {
      this.burstPoints.material.opacity = 0;
      return;
    }

    const posAttr = this.burstPoints.geometry.attributes.position;
    const array = posAttr.array;

    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const p = this.burstParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.burstParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 16.0 * dt; // Gravity

      array[i * 3] = p.x;
      array[i * 3 + 1] = p.y;
      array[i * 3 + 2] = p.z;
    }

    posAttr.needsUpdate = true;
    this.burstPoints.material.opacity = Math.min(1.0, this.burstParticles.length / 8);
  }

  reset() {
    for (const c of this.pool) {
      c.active = false;
      c.collected = false;
      c.mesh.visible = false;
    }
    this.coins = [];
    this.burstParticles = [];
    this.nextSpawnZ = -15;
  }
}
