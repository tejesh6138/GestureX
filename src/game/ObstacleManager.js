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
    this.currentSafeLane = 1;
    this.lastRequiredAction = 'NONE';
    this.lastActionZ = 0;
    this.lastPlayerZ = 0;
    this.lastPlayerSpeed = 22;

    this.initSharedMaterials();
  }

  setDifficultyManager(dm) {
    this.difficultyManager = dm;
  }

  initSharedMaterials() {
    if (typeof document === 'undefined') {
      const dummyMat = new THREE.MeshBasicMaterial();
      this.stripedRedMat = dummyMat;
      this.stripedWhiteMat = dummyMat;
      this.hazardStripeMat = dummyMat;
      this.supportPostMat = dummyMat;
      this.overheadBeamMat = dummyMat;
      this.overheadFrameMat = dummyMat;
      this.overheadSignMat = dummyMat;
      this.crateWoodMat = dummyMat;
      this.crateCornerMat = dummyMat;
      this.trainBodyMat = dummyMat;
      this.trainRoofMat = dummyMat;
      this.trainTrimMat = dummyMat;
      this.trainGlassMat = dummyMat;
      this.trainHeadlightMat = dummyMat;
      this.trainBogieMat = dummyMat;
      return;
    }

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
    if (!this.stripedRedMat) {
      this.initSharedMaterials();
    }
    const group = new THREE.Group();

    if (type === OBSTACLE_TYPES.LOW_BARRIER) {
      // 1. RED-AND-WHITE STRIPED RAILWAY JUMP BARRICADE
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

      // Secondary upper crate
      const upperGeo = new THREE.BoxGeometry(1.7, 1.3, 1.9);
      const upperCrate = new THREE.Mesh(upperGeo, this.overheadBeamMat);
      upperCrate.position.set(0.1, 2.25, -0.1);
      upperCrate.castShadow = true;
      group.add(upperCrate);

    } else if (type === OBSTACLE_TYPES.MOVING_TRAIN) {
      // 4. COLORFUL MODERN PASSENGER TRAIN
      const trainLength = 7.6;
      const trainWidth = 2.2;
      const trainHeight = 2.9;

      // Aerodynamic Train Body
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

      // Front Driver Windshield
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

    if (this.scene) {
      this.scene.add(group);
    }
    return group;
  }

  /**
   * Helper: Resolves the closest railway lane index (0: Left, 1: Center, 2: Right)
   */
  getLaneIndex(laneX) {
    let closestIdx = 1;
    let minDist = Infinity;
    for (let i = 0; i < this.lanes.length; i++) {
      const dist = Math.abs(this.lanes[i] - laneX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }
    return closestIdx;
  }

  /**
   * Computes the effective player-space Z encounter interval for any obstacle
   * (stationary hurdles/crates or oncoming passenger trains).
   */
  getObstaclePlayerZRange(obs, playerZ = 0, playerSpeed = 22) {
    const laneX = obs.mesh ? obs.mesh.position.x : (obs.laneX !== undefined ? obs.laneX : this.lanes[obs.laneIndex !== undefined ? obs.laneIndex : 1]);
    const laneIndex = obs.laneIndex !== undefined ? obs.laneIndex : this.getLaneIndex(laneX);
    const zPos = obs.mesh ? obs.mesh.position.z : (obs.z !== undefined ? obs.z : 0);

    if (obs.type === OBSTACLE_TYPES.MOVING_TRAIN) {
      const cfg = this.difficultyManager ? this.difficultyManager.getConfig() : GAME_CONFIG.OBSTACLES;
      const trainSpeed = obs.speed !== undefined ? obs.speed : (cfg.MOVING_TRAIN_SPEED !== undefined ? cfg.MOVING_TRAIN_SPEED : 12.0);
      const relSpeed = Math.max(12, playerSpeed + trainSpeed);
      const dist = playerZ - zPos;

      // If the train has already passed behind the player
      if (dist < -6.0) {
        return null;
      }

      // Time and player meeting depth
      const tMeet = dist / relSpeed;
      const zMeet = playerZ - playerSpeed * tMeet;

      // Train collision half-span in player distance (train half-length 3.6m + player 0.4m)
      const halfSpan = (4.0 / relSpeed) * playerSpeed;

      // Reaction and maneuver margin required to detect train and clear the lane
      const entryMargin = Math.max(5.0, playerSpeed * 0.40);
      const exitMargin = Math.max(2.5, playerSpeed * 0.15);

      return {
        laneIndex,
        laneX,
        type: obs.type,
        impassable: true,
        zCenter: zMeet,
        zMin: zMeet - halfSpan - exitMargin,
        zMax: zMeet + halfSpan + entryMargin,
        isTrain: true
      };
    } else {
      let halfDepth = 0.2;
      let impassable = false;
      if (obs.type === OBSTACLE_TYPES.LANE_BLOCKER) {
        halfDepth = 2.1;
        impassable = true;
      }

      const buffer = 0.4; // player collision half depth
      return {
        laneIndex,
        laneX,
        type: obs.type,
        impassable,
        zCenter: zPos,
        zMin: zPos - halfDepth - buffer,
        zMax: zPos + halfDepth + buffer,
        isTrain: false
      };
    }
  }

  /**
   * Validates a candidate set of obstacles against all active obstacles (including moving trains)
   * to guarantee gameplay fairness, reachability, and zero unavoidable 3-lane blocks.
   * Returns true if safe and achievable, false if impossible or creates an unavoidable trap.
   */
  validateObstaclePattern(candidates = [], playerZ = 0, playerSpeed = 22, diffMode = 'MEDIUM') {
    const allRanges = [];

    // Active obstacles
    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      const range = this.getObstaclePlayerZRange(obs, playerZ, playerSpeed);
      if (range) allRanges.push(range);
    }

    // Candidate obstacles
    for (const cand of candidates) {
      const range = this.getObstaclePlayerZRange(cand, playerZ, playerSpeed);
      if (range) allRanges.push(range);
    }

    if (allRanges.length === 0) return true;

    // Reaction window size: time required for recognition, cooldown, and lane change
    let reactionSeconds = 0.45;
    if (diffMode === 'EASY') reactionSeconds = 0.55;
    else if (diffMode === 'FAST') reactionSeconds = 0.38;
    const reactionWindow = Math.max(7.0, playerSpeed * reactionSeconds);

    // Check depths: sample all key boundary points
    const checkDepths = [];
    for (const r of allRanges) {
      checkDepths.push(r.zCenter);
      checkDepths.push(r.zMin);
      checkDepths.push(r.zMax);
    }

    for (const z of checkDepths) {
      // Find all obstacles overlapping within the reaction window of z
      const overlapping = allRanges.filter(
        (r) => Math.abs(r.zCenter - z) <= reactionWindow || (z >= r.zMin && z <= r.zMax)
      );

      const blockedLanes = [false, false, false];
      const impassableLanes = [false, false, false];
      let trainCount = 0;

      for (const r of overlapping) {
        blockedLanes[r.laneIndex] = true;
        if (r.impassable) impassableLanes[r.laneIndex] = true;
        if (r.isTrain) trainCount++;
      }

      // Condition 1: All three lanes blocked within the reaction window
      if (blockedLanes[0] && blockedLanes[1] && blockedLanes[2]) {
        return false;
      }

      // Condition 2: Two lanes impassable (e.g. train + crate, or 2 crates), and the third lane has any obstacle
      // within the reaction window. The player in either impassable lane cannot simultaneously switch and dodge.
      if (impassableLanes.filter(Boolean).length >= 2 && overlapping.length >= 3) {
        return false;
      }

      // Condition 3: A moving train is present and either:
      // a) Another lane is impassable (crate) within reaction window
      // b) Both side lanes have obstacles
      if (trainCount > 0) {
        if (impassableLanes.filter(Boolean).length >= 2) {
          return false;
        }
        if (blockedLanes.filter(Boolean).length >= 3) {
          return false;
        }
      }
    }

    // Condition 4: Consecutive obstacles spaced closer than the required transition distance
    const sortedObs = [...allRanges].sort((a, b) => b.zCenter - a.zCenter);
    for (let i = 0; i < sortedObs.length - 1; i++) {
      const a = sortedObs[i];
      const b = sortedObs[i + 1];
      const dz = Math.abs(a.zCenter - b.zCenter);

      if (a.laneIndex !== b.laneIndex) {
        const laneDiff = Math.abs(a.laneIndex - b.laneIndex);
        const minShiftTime = laneDiff === 1 ? 0.35 : 0.70;
        const minShiftDist = Math.max(laneDiff === 1 ? 6.5 : 13.0, playerSpeed * minShiftTime);

        if (a.impassable && b.impassable && dz < minShiftDist) {
          const thirdLane = [0, 1, 2].find((l) => l !== a.laneIndex && l !== b.laneIndex);
          const thirdBlocked = allRanges.some(
            (r) => r.laneIndex === thirdLane && Math.abs(r.zCenter - (a.zCenter + b.zCenter) / 2) < minShiftDist
          );
          if (thirdBlocked) {
            return false;
          }
        }
      }

      // Conflicting vertical actions (JUMP immediately followed by SLIDE or vice-versa)
      if (dz < playerSpeed * 0.70) {
        if (
          (a.type === OBSTACLE_TYPES.LOW_BARRIER && b.type === OBSTACLE_TYPES.HIGH_BARRIER) ||
          (a.type === OBSTACLE_TYPES.HIGH_BARRIER && b.type === OBSTACLE_TYPES.LOW_BARRIER)
        ) {
          if (a.laneIndex === b.laneIndex) {
            return false;
          }
        }
      }
    }

    // Condition 5: Forward Reachability Simulation (Path Feasibility)
    const minZ = Math.min(...allRanges.map((r) => r.zMin));
    const stepSize = 1.5;
    let currentLanes = new Set([this.currentSafeLane !== undefined ? this.currentSafeLane : 1]);
    let distSinceLaneShift = 0;

    for (let z = playerZ; z >= minZ - 2.0; z -= stepSize) {
      distSinceLaneShift += stepSize;

      const canShift1 = distSinceLaneShift >= Math.max(6.0, playerSpeed * 0.35);
      const canShift2 = distSinceLaneShift >= Math.max(12.0, playerSpeed * 0.70);

      const nextLanes = new Set();
      for (const lane of currentLanes) {
        nextLanes.add(lane);
        if (canShift1) {
          if (lane > 0) nextLanes.add(lane - 1);
          if (lane < 2) nextLanes.add(lane + 1);
        }
        if (canShift2) {
          nextLanes.add(0);
          nextLanes.add(1);
          nextLanes.add(2);
        }
      }

      // Filter out lanes that have impassable obstacles at depth z
      const validLanes = new Set();
      for (const lane of nextLanes) {
        const isBlocked = allRanges.some(
          (r) => r.laneIndex === lane && z >= r.zMin && z <= r.zMax && r.impassable
        );
        if (!isBlocked) {
          validLanes.add(lane);
        }
      }

      if (validLanes.size === 0) {
        return false;
      }

      if (validLanes.size < nextLanes.size) {
        distSinceLaneShift = 0;
      }
      currentLanes = validLanes;
    }

    return true;
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
      const trainSpeed = cfg.MOVING_TRAIN_SPEED !== undefined ? cfg.MOVING_TRAIN_SPEED : 12.0;

      // Test candidate train lanes in otherLanes for reachable, unblocked corridors
      const candidateTrainLanes = [...otherLanes].sort(() => Math.random() - 0.5);
      let chosenTrainLane = null;

      for (const tLane of candidateTrainLanes) {
        const candidateObs = [
          { type: OBSTACLE_TYPES.MOVING_TRAIN, laneIndex: tLane, z: spawnZ, speed: trainSpeed }
        ];
        if (this.validateObstaclePattern(candidateObs, playerZ, playerSpeed, diffMode)) {
          chosenTrainLane = tLane;
          break;
        }
      }

      if (chosenTrainLane !== null) {
        // Train is safely placed! Spawn the approaching modern passenger train
        this.addObstacle(OBSTACLE_TYPES.MOVING_TRAIN, this.lanes[chosenTrainLane], spawnZ);

        // Third lane: only place a low hurdle if strictly validated and safe
        const thirdLane = otherLanes.find((l) => l !== chosenTrainLane);
        if (thirdLane !== undefined && Math.random() < 0.30) {
          const hurdleCandidate = [
            { type: OBSTACLE_TYPES.LOW_BARRIER, laneIndex: thirdLane, z: spawnZ }
          ];
          if (this.validateObstaclePattern(hurdleCandidate, playerZ, playerSpeed, diffMode)) {
            this.addObstacle(OBSTACLE_TYPES.LOW_BARRIER, this.lanes[thirdLane], spawnZ);
          }
        }

        const relSpeed = Math.max(12, playerSpeed + trainSpeed);
        const tMeet = Math.abs(playerZ - spawnZ) / relSpeed;
        const zMeet = playerZ - playerSpeed * tMeet;

        // Next safe lane remains 100% OPEN throughout the entire train corridor
        this.currentSafeLane = nextSafeLane;
        this.lastRequiredAction = 'TRAIN_PASS';
        this.lastActionZ = zMeet;
        return;
      }
      // If chosenTrainLane is null, train spawn is delayed to prevent an unavoidable trap.
      // Falls through to validate and spawn safe static obstacles.
    }

    // 3. Generate candidate static obstacle patterns
    const distSinceLastAction = Math.abs(spawnZ - this.lastActionZ);
    const minRecoveryDist = playerSpeed * 0.85;
    const canJump = this.lastRequiredAction !== 'SLIDE' || distSinceLastAction > minRecoveryDist;
    const canSlide = this.lastRequiredAction !== 'JUMP' || distSinceLastAction > minRecoveryDist;

    const generateCandidates = (patternType) => {
      const candidates = [];
      if (patternType === 'A') {
        // Pattern A: Clear Runway (100% open across all 3 lanes)
        return { candidates, action: 'NONE', safeLane: nextSafeLane };
      }
      if (patternType === 'B') {
        // Pattern B: Single Impassable Blocker
        const blockLane = MathUtils.randomChoice(otherLanes);
        candidates.push({ type: OBSTACLE_TYPES.LANE_BLOCKER, laneIndex: blockLane, z: spawnZ });
        const remainingLane = otherLanes.find((l) => l !== blockLane);
        if (remainingLane !== undefined && canJump && Math.random() < 0.40) {
          candidates.push({ type: OBSTACLE_TYPES.LOW_BARRIER, laneIndex: remainingLane, z: spawnZ });
        }
        return { candidates, action: 'LANE_SHIFT', safeLane: nextSafeLane };
      }
      if (patternType === 'C') {
        // Pattern C: Double Blocker Choke Point (leaving nextSafeLane clear)
        otherLanes.forEach((laneIdx) => {
          candidates.push({ type: OBSTACLE_TYPES.LANE_BLOCKER, laneIndex: laneIdx, z: spawnZ });
        });
        return { candidates, action: 'LANE_SHIFT', safeLane: nextSafeLane };
      }
      if (patternType === 'D' && canJump) {
        // Pattern D: Red-and-White Low Jump Barricade Sequence
        candidates.push({ type: OBSTACLE_TYPES.LOW_BARRIER, laneIndex: nextSafeLane, z: spawnZ });
        const otherHurdleLane = MathUtils.randomChoice(otherLanes);
        if (Math.random() < 0.50) {
          candidates.push({ type: OBSTACLE_TYPES.LOW_BARRIER, laneIndex: otherHurdleLane, z: spawnZ });
        }
        return { candidates, action: 'JUMP', safeLane: nextSafeLane };
      }
      if (patternType === 'E' && canSlide) {
        // Pattern E: Overhead Slide Clearance Gantry
        candidates.push({ type: OBSTACLE_TYPES.HIGH_BARRIER, laneIndex: nextSafeLane, z: spawnZ });
        const otherSlideLane = MathUtils.randomChoice(otherLanes);
        if (Math.random() < 0.45) {
          candidates.push({ type: OBSTACLE_TYPES.HIGH_BARRIER, laneIndex: otherSlideLane, z: spawnZ });
        }
        return { candidates, action: 'SLIDE', safeLane: nextSafeLane };
      }
      // Fallback single blocker
      const blockLane = MathUtils.randomChoice(otherLanes);
      candidates.push({ type: OBSTACLE_TYPES.LANE_BLOCKER, laneIndex: blockLane, z: spawnZ });
      return { candidates, action: 'LANE_SHIFT', safeLane: nextSafeLane };
    };

    const roll = Math.random();
    let preferredPattern = 'A';
    if (roll < 0.22) preferredPattern = 'A';
    else if (roll < 0.48) preferredPattern = 'B';
    else if (roll < 0.68) preferredPattern = 'C';
    else if (roll < 0.85 && canJump) preferredPattern = 'D';
    else if (canSlide) preferredPattern = 'E';
    else preferredPattern = 'B';

    // Patterns to test in order of preference
    const patternOrder = [preferredPattern, 'B', 'D', 'E', 'A'];
    let chosen = null;

    for (const pat of patternOrder) {
      const result = generateCandidates(pat);
      if (this.validateObstaclePattern(result.candidates, playerZ, playerSpeed, diffMode)) {
        chosen = result;
        break;
      }
    }

    if (!chosen) {
      // Guaranteed safe fallback: Pattern A (Clear Runway - 0 obstacles)
      chosen = generateCandidates('A');
    }

    // Spawn the validated obstacles
    for (const c of chosen.candidates) {
      this.addObstacle(c.type, this.lanes[c.laneIndex], c.z);
    }

    this.currentSafeLane = chosen.safeLane;
    this.lastRequiredAction = chosen.action;
    this.lastActionZ = spawnZ;
  }

  addObstacle(type, laneX, z) {
    const playerZ = this.lastPlayerZ || 0;
    const playerSpeed = this.lastPlayerSpeed || 22;
    const laneIndex = this.getLaneIndex(laneX);

    // Defense-in-depth: Validate that adding this single obstacle doesn't block all 3 lanes
    const candidateRange = this.getObstaclePlayerZRange(
      { type, laneIndex, laneX, z },
      playerZ,
      playerSpeed
    );

    if (candidateRange) {
      const reactionDist = Math.max(6.0, playerSpeed * 0.35);
      const overlapping = this.obstacles.filter((o) => {
        if (!o.active) return false;
        const r = this.getObstaclePlayerZRange(o, playerZ, playerSpeed);
        if (!r) return false;
        return Math.abs(r.zCenter - candidateRange.zCenter) <= reactionDist ||
               (candidateRange.zMin <= r.zMax && candidateRange.zMax >= r.zMin);
      });

      const blockedLanes = [false, false, false];
      blockedLanes[laneIndex] = true;
      let impassableCount = candidateRange.impassable ? 1 : 0;
      let trainPresent = candidateRange.isTrain;

      for (const o of overlapping) {
        const r = this.getObstaclePlayerZRange(o, playerZ, playerSpeed);
        if (r) {
          blockedLanes[r.laneIndex] = true;
          if (r.impassable) impassableCount++;
          if (r.isTrain) trainPresent = true;
        }
      }

      // Reject if all 3 lanes blocked within reaction window
      if (blockedLanes[0] && blockedLanes[1] && blockedLanes[2]) {
        return null;
      }
      // Reject if 2 lanes impassable and adding an impassable obstacle to another lane
      if (impassableCount >= 2 && candidateRange.impassable && blockedLanes.filter(Boolean).length >= 3) {
        return null;
      }
      // Reject if a train is present and all 3 lanes would be blocked
      if (trainPresent && blockedLanes[0] && blockedLanes[1] && blockedLanes[2]) {
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
    this.lastPlayerZ = playerZ;
    this.lastPlayerSpeed = playerSpeed;
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
    this.lastPlayerZ = 0;
    this.lastPlayerSpeed = 22;
  }
}
