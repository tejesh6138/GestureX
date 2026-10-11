/**
 * AI Gesture Runner 3D - ObstacleManager
 * Subway Surfers-inspired railway runner obstacles:
 * - Red-and-White Striped Low Jump Barricades
 * - Overhead Slide Signs & Clearance Gantries
 * - Colorful Approaching Modern Passenger Trains
 * - Static Railway Cargo Crates & Track Equipment
 */

import * as THREE from 'three';
import { GAME_CONFIG } from '../core/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

export const OBSTACLE_TYPES = {
  LOW_BARRIER: 'LOW_BARRIER',     // Red-and-white striped jump barricade (Requires JUMP)
  HIGH_BARRIER: 'HIGH_BARRIER',   // Overhead clearance structure (Requires SLIDE)
  LANE_BLOCKER: 'LANE_BLOCKER',   // Static railway crates / platform container (Requires LANE CHANGE)
  MOVING_TRAIN: 'MOVING_TRAIN'    // Approaching modern passenger train (Requires LANE CHANGE)
};

export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    this.pool = [];
    this.nextSpawnZ = -GAME_CONFIG.TRACK.OBSTACLE_START_DISTANCE;
    this.lanes = [GAME_CONFIG.LANES.LEFT_X, GAME_CONFIG.LANES.CENTER_X, GAME_CONFIG.LANES.RIGHT_X];
    this.animTime = 0;
    this.difficultyManager = null;

    this.initSharedMaterials();
  }

  setDifficultyManager(dm) {
    this.difficultyManager = dm;
  }

  initSharedMaterials() {
    // Red & White striped hurdle materials
    this.stripedRedMat = new THREE.MeshStandardMaterial({
      color: 0xee2222,
      roughness: 0.35,
      metalness: 0.1
    });

    this.stripedWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.1
    });

    this.supportPostMat = new THREE.MeshStandardMaterial({
      color: 0x455a64,
      roughness: 0.6,
      metalness: 0.3
    });

    // Overhead high slide barrier materials
    this.overheadBeamMat = new THREE.MeshStandardMaterial({
      color: 0xffd34e,
      roughness: 0.3,
      metalness: 0.2
    });

    this.overheadFrameMat = new THREE.MeshStandardMaterial({
      color: 0x008bff,
      roughness: 0.4,
      metalness: 0.3
    });

    this.overheadSignMat = new THREE.MeshStandardMaterial({
      color: 0xff7a5c,
      roughness: 0.35,
      metalness: 0.1
    });

    // Static Cargo Crates & Construction Equipment
    this.crateWoodMat = new THREE.MeshStandardMaterial({
      color: 0x8d6e63,
      roughness: 0.8,
      metalness: 0.05
    });

    this.crateCornerMat = new THREE.MeshStandardMaterial({
      color: 0x37474f,
      roughness: 0.5,
      metalness: 0.6
    });

    // Approaching Modern Passenger Train
    this.trainBodyMat = new THREE.MeshStandardMaterial({
      color: 0x008bff, // Radiant sky blue express body
      roughness: 0.25,
      metalness: 0.4
    });

    this.trainRoofMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.1
    });

    this.trainTrimMat = new THREE.MeshStandardMaterial({
      color: 0xffd34e, // Sunny yellow aerodynamic stripe
      roughness: 0.3,
      metalness: 0.2
    });

    this.trainGlassMat = new THREE.MeshStandardMaterial({
      color: 0x29b6f6,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85
    });

    this.trainHeadlightMat = new THREE.MeshBasicMaterial({
      color: 0xfffaed // Bright warm headlights
    });

    this.trainBogieMat = new THREE.MeshStandardMaterial({
      color: 0x263238,
      roughness: 0.7,
      metalness: 0.6
    });
  }

  createObstacleMesh(type) {
    const group = new THREE.Group();

    if (type === OBSTACLE_TYPES.LOW_BARRIER) {
      // 1. RED-AND-WHITE STRIPED RAILWAY JUMP BARRIER
      // Two vertical support legs with base plates
      const legGeo = new THREE.BoxGeometry(0.12, 0.85, 0.12);
      const baseGeo = new THREE.BoxGeometry(0.35, 0.08, 0.45);

      const legL = new THREE.Mesh(legGeo, this.supportPostMat);
      legL.position.set(-1.0, 0.425, 0);
      legL.castShadow = true;
      group.add(legL);

      const baseL = new THREE.Mesh(baseGeo, this.supportPostMat);
      baseL.position.set(-1.0, 0.04, 0);
      group.add(baseL);

      const legR = new THREE.Mesh(legGeo, this.supportPostMat);
      legR.position.set(1.0, 0.425, 0);
      legR.castShadow = true;
      group.add(legR);

      const baseR = new THREE.Mesh(baseGeo, this.supportPostMat);
      baseR.position.set(1.0, 0.04, 0);
      group.add(baseR);

      // Horizontal Barricade Plank composed of alternating Red and White segments
      const segmentCount = 7;
      const totalWidth = 2.2;
      const segWidth = totalWidth / segmentCount;
      const plankGeo = new THREE.BoxGeometry(segWidth, 0.42, 0.12);

      for (let s = 0; s < segmentCount; s++) {
        const segX = -totalWidth / 2 + (s + 0.5) * segWidth;
        const mat = (s % 2 === 0) ? this.stripedRedMat : this.stripedWhiteMat;
        const seg = new THREE.Mesh(plankGeo, mat);
        seg.position.set(segX, 0.58, 0);
        seg.castShadow = true;
        group.add(seg);
      }

    } else if (type === OBSTACLE_TYPES.HIGH_BARRIER) {
      // 2. OVERHEAD BARRIER / CLEARANCE GANTRY (Requires SLIDE underneath)
      const postGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.8, 12);
      const postL = new THREE.Mesh(postGeo, this.overheadFrameMat);
      postL.position.set(-1.15, 1.4, 0);
      postL.castShadow = true;
      group.add(postL);

      const postR = new THREE.Mesh(postGeo, this.overheadFrameMat);
      postR.position.set(1.15, 1.4, 0);
      postR.castShadow = true;
      group.add(postR);

      // Horizontal Overhead clearance beam (bottom clearance at 1.15m height)
      const beamGeo = new THREE.BoxGeometry(2.4, 0.38, 0.3);
      const beam = new THREE.Mesh(beamGeo, this.overheadBeamMat);
      beam.position.set(0, 1.45, 0);
      beam.castShadow = true;
      group.add(beam);

      // Caution stripe pattern on overhead beam
      const stripeCount = 6;
      const stripeGeo = new THREE.BoxGeometry(0.2, 0.39, 0.32);
      for (let i = 0; i < stripeCount; i++) {
        const sx = -1.0 + i * 0.4;
        const st = new THREE.Mesh(stripeGeo, (i % 2 === 0) ? this.stripedRedMat : this.stripedWhiteMat);
        st.position.set(sx, 1.45, 0);
        group.add(st);
      }

      // Overhead clearance signboard
      const signGeo = new THREE.BoxGeometry(1.4, 0.45, 0.1);
      const sign = new THREE.Mesh(signGeo, this.overheadSignMat);
      sign.position.set(0, 1.88, 0);
      group.add(sign);

    } else if (type === OBSTACLE_TYPES.LANE_BLOCKER) {
      // 3. STATIC RAILWAY OBSTACLES: Stacked Cargo Crates & Trackside Station Equipment
      // Main lower crate
      const lowerGeo = new THREE.BoxGeometry(2.1, 1.6, 2.6);
      const lowerCrate = new THREE.Mesh(lowerGeo, this.crateWoodMat);
      lowerCrate.position.set(0, 0.8, 0);
      lowerCrate.castShadow = true;
      lowerCrate.receiveShadow = true;
      group.add(lowerCrate);

      // Metal corner braces
      const cornerGeo = new THREE.BoxGeometry(2.14, 0.16, 2.64);
      const topRim = new THREE.Mesh(cornerGeo, this.crateCornerMat);
      topRim.position.set(0, 1.55, 0);
      group.add(topRim);

      const botRim = new THREE.Mesh(cornerGeo, this.crateCornerMat);
      botRim.position.set(0, 0.1, 0);
      group.add(botRim);

      // Secondary upper crate slightly offset for realism
      const upperGeo = new THREE.BoxGeometry(1.7, 1.3, 1.9);
      const upperCrate = new THREE.Mesh(upperGeo, this.overheadBeamMat);
      upperCrate.position.set(0.1, 2.25, -0.1);
      upperCrate.castShadow = true;
      group.add(upperCrate);

    } else if (type === OBSTACLE_TYPES.MOVING_TRAIN) {
      // 4. COLORFUL MODERN PASSENGER TRAIN (Subway Surfers-style express carriage)
      const trainLength = 7.6;
      const trainWidth = 2.2;
      const trainHeight = 2.9;

      // Aerodynamic Train Body (Sky blue with rounded edges)
      const bodyGeo = new THREE.BoxGeometry(trainWidth, trainHeight * 0.75, trainLength);
      const body = new THREE.Mesh(bodyGeo, this.trainBodyMat);
      body.position.set(0, 1.5, 0);
      body.castShadow = true;
      group.add(body);

      // Curved / Beveled White Roof
      const roofGeo = new THREE.BoxGeometry(trainWidth * 0.95, 0.45, trainLength * 0.98);
      const roof = new THREE.Mesh(roofGeo, this.trainRoofMat);
      roof.position.set(0, 2.75, 0);
      roof.castShadow = true;
      group.add(roof);

      // Golden racing speed stripe along flanks
      const stripeGeo = new THREE.BoxGeometry(trainWidth + 0.06, 0.25, trainLength);
      const stripe = new THREE.Mesh(stripeGeo, this.trainTrimMat);
      stripe.position.set(0, 1.15, 0);
      group.add(stripe);

      // Front Driver Windshield facing the oncoming player (Z+)
      const frontWindowGeo = new THREE.BoxGeometry(trainWidth * 0.78, 0.95, 0.15);
      const frontWindow = new THREE.Mesh(frontWindowGeo, this.trainGlassMat);
      frontWindow.position.set(0, 1.95, trainLength / 2 + 0.02);
      group.add(frontWindow);

      // Side Passenger Windows
      const sideWindowCount = 4;
      const sideWinGeo = new THREE.BoxGeometry(trainWidth + 0.08, 0.65, 1.1);
      for (let w = 0; w < sideWindowCount; w++) {
        const wz = -trainLength / 2 + 1.2 + w * 1.6;
        const win = new THREE.Mesh(sideWinGeo, this.trainGlassMat);
        win.position.set(0, 1.85, wz);
        group.add(win);
      }

      // Twin Bright Front Headlights
      const headlightGeo = new THREE.BoxGeometry(0.38, 0.32, 0.12);
      const hl1 = new THREE.Mesh(headlightGeo, this.trainHeadlightMat);
      hl1.position.set(-0.65, 0.85, trainLength / 2 + 0.03);
      group.add(hl1);

      const hl2 = new THREE.Mesh(headlightGeo, this.trainHeadlightMat);
      hl2.position.set(0.65, 0.85, trainLength / 2 + 0.03);
      group.add(hl2);

      // Wheels / Bogies on rails
      const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.18, 12);
      wheelGeo.rotateZ(Math.PI / 2);

      const wheelZOffsets = [-2.2, -1.2, 1.2, 2.2];
      wheelZOffsets.forEach((wz) => {
        const wL = new THREE.Mesh(wheelGeo, this.trainBogieMat);
        wL.position.set(-0.7, 0.28, wz);
        group.add(wL);

        const wR = new THREE.Mesh(wheelGeo, this.trainBogieMat);
        wR.position.set(0.7, 0.28, wz);
        group.add(wR);
      });
    }

    this.scene.add(group);
    return group;
  }

  /**
   * Spawns obstacles procedurally while strictly guaranteeing gameplay fairness.
   * Every pattern guarantees at least ONE viable passage (jump, slide, or empty lane).
   */
  spawnPattern(spawnZ, playerDistance = 0) {
    const roll = Math.random();
    const laneIndices = [0, 1, 2];
    const cfg = this.difficultyManager ? this.difficultyManager.getConfig() : GAME_CONFIG.OBSTACLES;

    // Moving Trains: Spawning probability scaled by selected mode (Easy, Medium, Fast)
    const trainChance = cfg.ALLOW_MOVING_TRAIN_CHANCE !== undefined ? cfg.ALLOW_MOVING_TRAIN_CHANCE : 0.35;
    const allowMovingTrain = playerDistance > 60 && Math.random() < trainChance;

    if (allowMovingTrain) {
      // Train in 1 lane. Remaining 2 lanes: 1 lane free, 1 lane optionally jumpable barrier
      const trainLane = MathUtils.randomChoice(laneIndices);
      this.addObstacle(OBSTACLE_TYPES.MOVING_TRAIN, this.lanes[trainLane], spawnZ);

      const remainingLanes = laneIndices.filter((l) => l !== trainLane);
      if (Math.random() < 0.45) {
        const hurdleLane = MathUtils.randomChoice(remainingLanes);
        this.addObstacle(OBSTACLE_TYPES.LOW_BARRIER, this.lanes[hurdleLane], spawnZ);
      }
      return;
    }

    if (roll < 0.30) {
      // Pattern 1: Single Crate Container (2 lanes clear)
      const blockLane = MathUtils.randomChoice(laneIndices);
      this.addObstacle(OBSTACLE_TYPES.LANE_BLOCKER, this.lanes[blockLane], spawnZ);

      // Low barrier in one of the other lanes (player can jump or take clear lane)
      if (Math.random() > 0.5) {
        const otherLane = MathUtils.randomChoice(laneIndices.filter((l) => l !== blockLane));
        this.addObstacle(OBSTACLE_TYPES.LOW_BARRIER, this.lanes[otherLane], spawnZ);
      }
    } else if (roll < 0.55) {
      // Pattern 2: Two Blockers (leaving exactly 1 clear lane)
      const freeLane = MathUtils.randomChoice(laneIndices);
      laneIndices.filter((l) => l !== freeLane).forEach((laneIdx) => {
        this.addObstacle(OBSTACLE_TYPES.LANE_BLOCKER, this.lanes[laneIdx], spawnZ);
      });
    } else if (roll < 0.78) {
      // Pattern 3: Combo of Low Striped Barrier (Jump) and High Beam (Slide)
      const jumpLane = MathUtils.randomChoice(laneIndices);
      const slideLane = MathUtils.randomChoice(laneIndices.filter((l) => l !== jumpLane));
      this.addObstacle(OBSTACLE_TYPES.LOW_BARRIER, this.lanes[jumpLane], spawnZ);
      this.addObstacle(OBSTACLE_TYPES.HIGH_BARRIER, this.lanes[slideLane], spawnZ);
    } else {
      // Pattern 4: Double Low Striped Barrier hurdles (both jumpable) + 1 free lane
      const freeLane = MathUtils.randomChoice(laneIndices);
      laneIndices.filter((l) => l !== freeLane).forEach((laneIdx) => {
        this.addObstacle(OBSTACLE_TYPES.LOW_BARRIER, this.lanes[laneIdx], spawnZ);
      });
    }
  }

  addObstacle(type, laneX, z) {
    const cfg = this.difficultyManager ? this.difficultyManager.getConfig() : GAME_CONFIG.OBSTACLES;
    const trainSpeed = cfg.MOVING_TRAIN_SPEED !== undefined ? cfg.MOVING_TRAIN_SPEED : 12.0;

    let item = this.pool.find((o) => !o.active && o.type === type);
    if (!item) {
      const mesh = this.createObstacleMesh(type);
      item = {
        type,
        mesh,
        active: true,
        speed: type === OBSTACLE_TYPES.MOVING_TRAIN ? trainSpeed : 0
      };
      this.pool.push(item);
    }

    item.active = true;
    item.mesh.visible = true;
    item.speed = type === OBSTACLE_TYPES.MOVING_TRAIN ? trainSpeed : 0;
    item.mesh.position.set(laneX, 0, z);
    this.obstacles.push(item);
  }

  update(playerZ, dt = 0.016, playerDistance = 0) {
    this.animTime += dt;
    const spawnDistanceAhead = 150;
    const cfg = this.difficultyManager ? this.difficultyManager.getConfig() : GAME_CONFIG.OBSTACLES;
    const minGap = cfg.MIN_SPAWN_GAP || 24;
    const maxGap = cfg.MAX_SPAWN_GAP || 34;

    // 1. Spawning with progressive gap spacing
    while (this.nextSpawnZ > playerZ - spawnDistanceAhead) {
      this.spawnPattern(this.nextSpawnZ, playerDistance);
      const gap = Math.max(
        minGap,
        maxGap - (playerDistance * 0.003)
      );
      this.nextSpawnZ -= gap;
    }

    // 2. Update movement and animations for active obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (!obs.active) continue;

      // Moving Trains travel forward towards the player along the rails
      if (obs.type === OBSTACLE_TYPES.MOVING_TRAIN) {
        obs.mesh.position.z += obs.speed * dt;
      }

      // Recycle obstacles that have passed behind the player
      if (obs.mesh.position.z > playerZ + 20) {
        obs.active = false;
        obs.mesh.visible = false;
        this.obstacles.splice(i, 1);
      }
    }
  }

  getActiveObstacles() {
    return this.obstacles.filter((o) => o.active);
  }

  reset() {
    for (const obs of this.pool) {
      obs.active = false;
      obs.mesh.visible = false;
    }
    this.obstacles = [];
    this.nextSpawnZ = -GAME_CONFIG.TRACK.OBSTACLE_START_DISTANCE;
    this.animTime = 0;
  }
}
