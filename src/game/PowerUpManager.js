/**
 * AI Gesture Runner 3D - PowerUpManager
 * Spawns and manages Magnet, Shield, and Speed Boost power-ups with player visual auras.
 */

import * as THREE from 'three';
import { GAME_CONFIG } from '../core/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';
import { Sound } from '../services/SoundService.js';

export const POWER_UP_TYPES = {
  MAGNET: 'MAGNET',
  SHIELD: 'SHIELD',
  BOOST: 'BOOST'
};

export class PowerUpManager {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.items = [];
    this.nextSpawnZ = -60;
    this.lanes = [GAME_CONFIG.LANES.LEFT_X, GAME_CONFIG.LANES.CENTER_X, GAME_CONFIG.LANES.RIGHT_X];

    // Active power-up states
    this.activePowerUps = {
      [POWER_UP_TYPES.MAGNET]: 0,
      [POWER_UP_TYPES.SHIELD]: false,
      [POWER_UP_TYPES.BOOST]: 0
    };

    this.initAssets();
    this.createPlayerAuras();
  }

  initAssets() {
    this.magnetMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });
    this.shieldMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });
    this.boostMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, wireframe: true });

    this.octaGeo = new THREE.OctahedronGeometry(0.55);
    this.sphereGeo = new THREE.SphereGeometry(0.5, 12, 12);
    this.boxGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  }

  createPlayerAuras() {
    // Holographic shield bubble around player
    const shieldBubbleGeo = new THREE.SphereGeometry(1.4, 16, 16);
    const shieldBubbleMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    this.shieldAura = new THREE.Mesh(shieldBubbleGeo, shieldBubbleMat);
    this.shieldAura.visible = false;
    this.player.mesh.add(this.shieldAura);
    this.shieldAura.position.y = 1.0;
  }

  createPowerUpMesh(type) {
    const group = new THREE.Group();
    let mesh;

    if (type === POWER_UP_TYPES.MAGNET) {
      mesh = new THREE.Mesh(this.octaGeo, this.magnetMat);
    } else if (type === POWER_UP_TYPES.SHIELD) {
      mesh = new THREE.Mesh(this.sphereGeo, this.shieldMat);
    } else {
      mesh = new THREE.Mesh(this.boxGeo, this.boostMat);
    }

    group.add(mesh);
    this.scene.add(group);
    return { group, mesh, type };
  }

  spawnPowerUp(z) {
    const types = [POWER_UP_TYPES.MAGNET, POWER_UP_TYPES.SHIELD, POWER_UP_TYPES.BOOST];
    const type = MathUtils.randomChoice(types);
    const lane = MathUtils.randomChoice(this.lanes);

    const item = this.createPowerUpMesh(type);
    item.group.position.set(lane, 1.2, z);
    item.active = true;
    this.items.push(item);
  }

  update(playerPos, dt) {
    // 1. Spawning powerups periodically (every 70-110m)
    while (this.nextSpawnZ > playerPos.z - 120) {
      this.spawnPowerUp(this.nextSpawnZ);
      this.nextSpawnZ -= MathUtils.randomRange(70, 110);
    }

    // 2. Animate and check collection
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (!item.active) continue;

      item.mesh.rotation.x += dt * 2.0;
      item.mesh.rotation.y += dt * 3.0;

      const dist = MathUtils.distance3D(
        playerPos.x, playerPos.y + 0.9, playerPos.z,
        item.group.position.x, item.group.position.y, item.group.position.z
      );

      if (dist < 1.4) {
        this.activatePowerUp(item.type);
        item.active = false;
        item.group.visible = false;
        this.items.splice(i, 1);
        continue;
      }

      // Recycle if passed
      if (item.group.position.z > playerPos.z + 10) {
        item.active = false;
        item.group.visible = false;
        this.items.splice(i, 1);
      }
    }

    // 3. Count down active powerup durations
    if (this.activePowerUps[POWER_UP_TYPES.MAGNET] > 0) {
      this.activePowerUps[POWER_UP_TYPES.MAGNET] -= dt;
      if (this.activePowerUps[POWER_UP_TYPES.MAGNET] <= 0) {
        GlobalEvents.emit(EVENTS.POWERUP_EXPIRED, { type: POWER_UP_TYPES.MAGNET });
      }
    }

    if (this.activePowerUps[POWER_UP_TYPES.BOOST] > 0) {
      this.activePowerUps[POWER_UP_TYPES.BOOST] -= dt;
      if (this.activePowerUps[POWER_UP_TYPES.BOOST] <= 0) {
        GlobalEvents.emit(EVENTS.POWERUP_EXPIRED, { type: POWER_UP_TYPES.BOOST });
      }
    }

    // Update shield aura rotation and visibility
    this.shieldAura.visible = this.activePowerUps[POWER_UP_TYPES.SHIELD];
    if (this.shieldAura.visible) {
      this.shieldAura.rotation.y += dt * 2;
    }
  }

  activatePowerUp(type) {
    Sound.playPowerup();

    if (type === POWER_UP_TYPES.MAGNET) {
      this.activePowerUps[POWER_UP_TYPES.MAGNET] = GAME_CONFIG.POWER_UPS.MAGNET_DURATION;
    } else if (type === POWER_UP_TYPES.SHIELD) {
      this.activePowerUps[POWER_UP_TYPES.SHIELD] = true;
    } else if (type === POWER_UP_TYPES.BOOST) {
      this.activePowerUps[POWER_UP_TYPES.BOOST] = GAME_CONFIG.POWER_UPS.BOOST_DURATION;
    }

    GlobalEvents.emit(EVENTS.POWERUP_COLLECTED, { type, duration: this.activePowerUps[type] });
  }

  consumeShield() {
    if (this.activePowerUps[POWER_UP_TYPES.SHIELD]) {
      this.activePowerUps[POWER_UP_TYPES.SHIELD] = false;
      this.shieldAura.visible = false;
      return true;
    }
    return false;
  }

  hasMagnet() {
    return this.activePowerUps[POWER_UP_TYPES.MAGNET] > 0;
  }

  hasBoost() {
    return this.activePowerUps[POWER_UP_TYPES.BOOST] > 0;
  }

  hasShield() {
    return this.activePowerUps[POWER_UP_TYPES.SHIELD];
  }

  reset() {
    for (const item of this.items) {
      item.active = false;
      item.group.visible = false;
    }
    this.items = [];
    this.activePowerUps[POWER_UP_TYPES.MAGNET] = 0;
    this.activePowerUps[POWER_UP_TYPES.SHIELD] = false;
    this.activePowerUps[POWER_UP_TYPES.BOOST] = 0;
    this.shieldAura.visible = false;
    this.nextSpawnZ = -60;
  }
}
