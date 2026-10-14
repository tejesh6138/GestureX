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
import { Assets } from '../utils/AssetLoader.js';

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

    this.hazardStripeMat = new THREE.MeshStandardMaterial({
      map: Assets.getHazardStripeTexture(),
      roughness: 0.3,
      metalness: 0.15
    });

    this.supportPostMat = new THREE.MeshStandardMaterial({
      color: 0x37474f,
      roughness: 0.5,
      metalness: 0.4
    });

    // Overhead high slide barrier materials
    this.overheadBeamMat = new THREE.MeshStandardMaterial({
      color: 0xffd34e,
      roughness: 0.3,
      metalness: 0.2
    });

    this.overheadFrameMat = new THREE.MeshStandardMaterial({
      color: 0x008bff,
      roughness: 0.35,
      metalness: 0.4
    });

    this.overheadSignMat = new THREE.MeshStandardMaterial({
      color: 0xff6b4a,
      roughness: 0.35,
      metalness: 0.2
    });

    // Static Cargo Crates & Construction Equipment
    this.crateWoodMat = new THREE.MeshStandardMaterial({
      map: Assets.getSleeperTexture(),
      roughness: 0.75,
      metalness: 0.1
    });

    this.crateCornerMat = new THREE.MeshStandardMaterial({
      color: 0x263238,
      roughness: 0.4,
      metalness: 0.7
    });

    // Approaching Modern Passenger Train
    this.trainBodyMat = new THREE.MeshStandardMaterial({
      map: Assets.getTrainExteriorTexture(),
      roughness: 0.2,
      metalness: 0.35
    });

    this.trainRoofMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.2
    });

    this.trainTrimMat = new THREE.MeshStandardMaterial({
      color: 0xffd34e, // Sunny yellow aerodynamic stripe
      roughness: 0.25,
      metalness: 0.35
    });

    this.trainGlassMat = new THREE.MeshStandardMaterial({
      color: 0x29b6f6,
      roughness: 0.08,
      metalness: 0.85,
      transparent: true,
      opacity: 0.88
    });

    this.trainHeadlightMat = new THREE.MeshBasicMaterial({
      color: 0xfffaee // Bright warm headlights
    });

    this.trainBogieMat = new THREE.MeshStandardMaterial({
      color: 0x1e272c,
      roughness: 0.6,
      metalness: 0.7
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
        // Shadow optimization: 1 center plank casts the horizontal bar shadow rather than 7 redundant draw calls
        if (s === 3) {
          seg.castShadow = true;
        }
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
   * Calculates dynamic fair obstacle gap based on current world speed and difficulty.
   * Ensures ample reaction time, gesture recognition latency, and execution duration.
   */
  calculateFairGap(playerSpeed = 22, difficultyMode = 'MEDIUM') {
    const cfg = this.difficultyManager ? this.difficultyManager.getConfig() : GAME_CONFIG.OBSTACLES;
    const baseMinGap = cfg.MIN_SPAWN_GAP || 24;

    // Required reaction time per difficulty mode:
    // EASY: 1.30s, MEDIUM: 1.00s, FAST: 0.75s
    let reactionTime = 1.00;
    if (difficultyMode === 'EASY') reactionTime = 1.30;
    else if (difficultyMode === 'FAST') reactionTime = 0.75;

    // Gesture stability latency (0.15s) + action execution (0.45s)
    const maneuverTime = 0.60;
    const totalReactionTime = reactionTime + maneuverTime;

    // Speed-synchronized spacing expands proportionally with speed
    const speedBasedGap = playerSpeed * totalReactionTime;
    return Math.max(baseMinGap, speedBasedGap);
  }

  /**
   * Spawns obstacles procedurally while strictly guaranteeing gameplay fairness.
   * Evaluates the complete multi-lane pattern together and maintains a continuous,
   * reachable safe path forward at all times.
   */
  spawnPattern(spawnZ, playerDistance = 0, playerZ = 0, playerSpeed = 22) {
    const laneIndices = [0, 1, 2];
    const cfg = this.difficultyManager ? this.difficultyManager.getConfig() : GAME_CONFIG.OBSTACLES;
    const diffMode = this.difficultyManager ? this.difficultyManager.getMode() : 'MEDIUM';

    if (this.currentSafeLane === undefined) {
      this.currentSafeLane = 1; // Start in center lane
    }
    if (this.lastRequiredAction === undefined) {
      this.lastRequiredAction = 'NONE';
      this.lastActionZ = 0;
    }

    // 1. Determine next reachable safe lane (at most 1 lane shift away from current safe lane)
    const reachableLanes = [];
    if (this.currentSafeLane > 0) reachableLanes.push(this.currentSafeLane - 1);
    reachableLanes.push(this.currentSafeLane);
    if (this.currentSafeLane < 2) reachableLanes.push(this.currentSafeLane + 1);

    const nextSafeLane = MathUtils.randomChoice(reachableLanes);
    const otherLanes = laneIndices.filter((l) => l !== nextSafeLane);

    // 2. Check for oncoming train condition:
    // Allow at most ONE oncoming train at a time. Do not spawn a second train while one is already active.
    const activeTrain = this.obstacles.find((o) => o.active && o.type === OBSTACLE_TYPES.MOVING_TRAIN);
    const trainChance = cfg.ALLOW_MOVING_TRAIN_CHANCE !== undefined ? cfg.ALLOW_MOVING_TRAIN_CHANCE : 0.35;
    const allowTrain = !activeTrain && playerDistance > 50 && Math.random() < trainChance;

    if (allowTrain) {
      // Pick a train lane that is NOT the safe lane
      const trainLane = MathUtils.randomChoice(otherLanes);
      const trainSpeed = cfg.MOVING_TRAIN_SPEED !== undefined ? cfg.MOVING_TRAIN_SPEED : 12.0;

      // Calculate intersection meeting depth where train meets the player
      const relSpeed = Math.max(12, playerSpeed + trainSpeed);
      const tMeet = Math.abs(playerZ - spawnZ) / relSpeed;
      const zMeet = playerZ - playerSpeed * tMeet;

      // Spawn the approaching modern passenger train
      this.addObstacle(OBSTACLE_TYPES.MOVING_TRAIN, this.lanes[trainLane], spawnZ);

      // Third lane (neither train nor safe lane): optionally add a jump hurdle
      const thirdLane = otherLanes.find((l) => l !== trainLane);
      if (thirdLane !== undefined && Math.random() < 0.40) {
        this.addObstacle(OBSTACLE_TYPES.LOW_BARRIER, this.lanes[thirdLane], spawnZ);
      }

      // Next safe lane remains 100% OPEN throughout the entire train corridor
      this.currentSafeLane = nextSafeLane;
      this.lastRequiredAction = 'TRAIN_PASS';
      this.lastActionZ = zMeet;
      return;
    }

    // 3. Prevent incompatible rapid-fire actions (e.g. SLIDE immediately after JUMP or vice versa)
    const distSinceLastAction = Math.abs(spawnZ - this.lastActionZ);
    const minRecoveryDist = playerSpeed * 0.85;
    const canJump = this.lastRequiredAction !== 'SLIDE' || distSinceLastAction > minRecoveryDist;
    const canSlide = this.lastRequiredAction !== 'JUMP' || distSinceLastAction > minRecoveryDist;

    const roll = Math.random();

    if (roll < 0.22) {
      // Pattern A: Clear High-Speed Runway (100% open across all 3 lanes)
      // Gives breathing room and momentum
      this.currentSafeLane = nextSafeLane;
      this.lastRequiredAction = 'NONE';
      this.lastActionZ = spawnZ;

    } else if (roll < 0.48) {
      // Pattern B: Single Impassable Blocker (1 lane blocked, 2 lanes clear)
      // The blocked lane is NEVER the designated safe lane
      const blockLane = MathUtils.randomChoice(otherLanes);
      this.addObstacle(OBSTACLE_TYPES.LANE_BLOCKER, this.lanes[blockLane], spawnZ);

      // In the remaining non-safe lane, optionally place a jumpable low hurdle
      const remainingLane = otherLanes.find((l) => l !== blockLane);
      if (remainingLane !== undefined && canJump && Math.random() < 0.45) {
        this.addObstacle(OBSTACLE_TYPES.LOW_BARRIER, this.lanes[remainingLane], spawnZ);
      }

      this.currentSafeLane = nextSafeLane;
      this.lastRequiredAction = 'LANE_SHIFT';
      this.lastActionZ = spawnZ;

    } else if (roll < 0.68) {
      // Pattern C: Double Blocker Choke Point (2 lanes blocked, exactly 1 safe lane)
      // Both other lanes are blocked, leaving nextSafeLane 100% clear.
      // nextSafeLane is guaranteed reachable with at most 1 lane shift.
      otherLanes.forEach((laneIdx) => {
        this.addObstacle(OBSTACLE_TYPES.LANE_BLOCKER, this.lanes[laneIdx], spawnZ);
      });

      this.currentSafeLane = nextSafeLane;
      this.lastRequiredAction = 'LANE_SHIFT';
      this.lastActionZ = spawnZ;

    } else if (roll < 0.85 && canJump) {
      // Pattern D: Red-and-White Low Jump Barricade Sequence
      // Place low hurdles in 1 or 2 lanes (including nextSafeLane). All hurdles are clearable by JUMP.
      this.addObstacle(OBSTACLE_TYPES.LOW_BARRIER, this.lanes[nextSafeLane], spawnZ);

      const otherHurdleLane = MathUtils.randomChoice(otherLanes);
      if (Math.random() < 0.50) {
        this.addObstacle(OBSTACLE_TYPES.LOW_BARRIER, this.lanes[otherHurdleLane], spawnZ);
      }

      this.currentSafeLane = nextSafeLane;
      this.lastRequiredAction = 'JUMP';
      this.lastActionZ = spawnZ;

    } else if (canSlide) {
      // Pattern E: Overhead Slide Clearance Gantry
      // Place overhead beam across 1 or 2 lanes (including nextSafeLane). Clearable by crouching SLIDE.
      this.addObstacle(OBSTACLE_TYPES.HIGH_BARRIER, this.lanes[nextSafeLane], spawnZ);

      const otherSlideLane = MathUtils.randomChoice(otherLanes);
      if (Math.random() < 0.45) {
        this.addObstacle(OBSTACLE_TYPES.HIGH_BARRIER, this.lanes[otherSlideLane], spawnZ);
      }

      this.currentSafeLane = nextSafeLane;
      this.lastRequiredAction = 'SLIDE';
      this.lastActionZ = spawnZ;

    } else {
      // Fallback: Safe Single Blocker
      const blockLane = MathUtils.randomChoice(otherLanes);
      this.addObstacle(OBSTACLE_TYPES.LANE_BLOCKER, this.lanes[blockLane], spawnZ);
      this.currentSafeLane = nextSafeLane;
      this.lastRequiredAction = 'NONE';
      this.lastActionZ = spawnZ;
    }
  }

  addObstacle(type, laneX, z) {
    // Secondary Safety Validation: Ensure this obstacle doesn't block all 3 lanes at depth z
    const toleranceZ = 2.4;
    const sameDepthObs = this.obstacles.filter(
      (o) => o.active && Math.abs(o.mesh.position.z - z) < toleranceZ
    );

    // If adding this would block all 3 lanes with impassable obstacles, reject it
    if (type === OBSTACLE_TYPES.LANE_BLOCKER || type === OBSTACLE_TYPES.MOVING_TRAIN) {
      const impassableCount = sameDepthObs.filter(
        (o) => o.type === OBSTACLE_TYPES.LANE_BLOCKER || o.type === OBSTACLE_TYPES.MOVING_TRAIN
      ).length;
      if (impassableCount >= 2) {
        // Already 2 lanes blocked at this depth! Do NOT block the 3rd lane.
        return null;
      }
    }

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
    return item;
  }

  update(playerZ, dt = 0.016, playerDistance = 0, playerSpeed = 22) {
    this.animTime += dt;
    const spawnDistanceAhead = 150;
    const diffMode = this.difficultyManager ? this.difficultyManager.getMode() : 'MEDIUM';

    // 1. Spawning with speed-synchronized fair gap spacing
    while (this.nextSpawnZ > playerZ - spawnDistanceAhead) {
      this.spawnPattern(this.nextSpawnZ, playerDistance, playerZ, playerSpeed);

      // Spacing calculated from player speed and reaction window
      let gap = this.calculateFairGap(playerSpeed, diffMode);

      // If last action was JUMP or SLIDE, append landing/stand-up recovery margin
      if (this.lastRequiredAction === 'JUMP') {
        gap += playerSpeed * 0.35;
      } else if (this.lastRequiredAction === 'SLIDE') {
        gap += playerSpeed * 0.30;
      } else if (this.lastRequiredAction === 'TRAIN_PASS') {
        gap += playerSpeed * 0.50; // Extra clearance after passing train
      }

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
    this.currentSafeLane = 1;
    this.lastRequiredAction = 'NONE';
    this.lastActionZ = 0;
  }
}
