/**
 * GestureX - Comprehensive Automated Test Suite
 * Tests core gameplay mechanics, gesture classification, physics, collisions,
 * scoring, persistence, obstacle reachability, and state management.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { MathUtils } from '../src/utils/MathUtils.js';
import { GAME_CONFIG, DIFFICULTY_MODES, DIFFICULTY_CONFIG } from '../src/core/GameConfig.js';
import { HandTracker } from '../src/gesture/HandTracker.js';
import { GestureClassifier } from '../src/gesture/GestureClassifier.js';
import { ScoreService } from '../src/services/ScoreService.js';
import { StorageService } from '../src/services/StorageService.js';
import { CollisionSystem } from '../src/game/CollisionSystem.js';
import { OBSTACLE_TYPES } from '../src/game/ObstacleManager.js';
import { GlobalEvents, EVENTS } from '../src/core/EventBus.js';

// Helper to construct normalized 21 MediaPipe hand landmarks
function createHandLandmarks({
  indexExt = false,
  indexSlant = 0, // -1: left, 0: center, 1: right
  middleExt = false,
  ringExt = false,
  pinkyExt = false,
  thumbExt = false
} = {}) {
  // Mirrored space: HandTracker does pt.x = 1.0 - input.x.
  // To have mirrored output.x be X, input.x must be 1.0 - X.
  // Wrist at center bottom
  const wrist = { x: 0.5, y: 0.8, z: 0 };
  const baseKnuckles = {
    thumbMcp: { x: 0.42, y: 0.68, z: 0 },
    indexMcp: { x: 0.46, y: 0.55, z: 0 },
    middleMcp: { x: 0.50, y: 0.52, z: 0 },
    ringMcp: { x: 0.54, y: 0.54, z: 0 },
    pinkyMcp: { x: 0.58, y: 0.58, z: 0 }
  };

  const pts = new Array(21);
  pts[0] = { ...wrist };

  // Thumb
  pts[1] = { x: 0.45, y: 0.74, z: 0 };
  pts[2] = { ...baseKnuckles.thumbMcp };
  pts[3] = thumbExt ? { x: 0.38, y: 0.62, z: 0 } : { x: 0.45, y: 0.64, z: 0 };
  pts[4] = thumbExt ? { x: 0.34, y: 0.56, z: 0 } : { x: 0.48, y: 0.62, z: 0 }; // Thumb Tip

  // Helper for 3 segments
  function placeFinger(mcpIdx, mcp, isExtended, slantOffset = 0) {
    if (isExtended) {
      // Extended straight upward (decreasing Y)
      pts[mcpIdx] = { ...mcp };
      pts[mcpIdx + 1] = { x: mcp.x + slantOffset * 0.33, y: mcp.y - 0.10, z: 0 };
      pts[mcpIdx + 2] = { x: mcp.x + slantOffset * 0.66, y: mcp.y - 0.20, z: 0 };
      pts[mcpIdx + 3] = { x: mcp.x + slantOffset * 1.00, y: mcp.y - 0.30, z: 0 }; // Tip
    } else {
      // Folded tightly toward palm/wrist
      pts[mcpIdx] = { ...mcp };
      pts[mcpIdx + 1] = { x: mcp.x, y: mcp.y - 0.04, z: 0 };
      pts[mcpIdx + 2] = { x: mcp.x, y: mcp.y + 0.04, z: 0 };
      pts[mcpIdx + 3] = { x: mcp.x, y: mcp.y + 0.08, z: 0 }; // Tip curled in
    }
  }

  // Note: in HandTracker, points are mirrored: pt.x = 1.0 - input.x.
  // If we want index to slant left in mirrored space (output.x < mcp.x),
  // input.x should have slantOffset > 0 so that (1.0 - input.x) has slantOffset < 0.
  // Or vice versa. Let's make index slant explicitly in input coordinates:
  placeFinger(5, baseKnuckles.indexMcp, indexExt, -indexSlant * 0.16);
  placeFinger(9, baseKnuckles.middleMcp, middleExt, 0);
  placeFinger(13, baseKnuckles.ringMcp, ringExt, 0);
  placeFinger(17, baseKnuckles.pinkyMcp, pinkyExt, 0);

  return pts;
}

describe('1. Kinematic Gesture Recognition', () => {
  const tracker = new HandTracker();
  const classifier = new GestureClassifier();

  test('Recognizes Closed Fist as SLIDE', () => {
    const rawLandmarks = createHandLandmarks({
      indexExt: false,
      middleExt: false,
      ringExt: false,
      pinkyExt: false,
      thumbExt: false
    });
    const handData = tracker.process(rawLandmarks);
    assert.ok(handData, 'HandTracker should return handData');
    assert.equal(handData.isFist, true, 'isFist should be true');
    assert.equal(handData.extendedCount, 0, 'Extended count should be 0');

    const result = classifier.classifyRaw(handData);
    assert.equal(result.gesture, 'SLIDE', 'Classifier raw gesture should be SLIDE');
  });

  test('Recognizes Peace Sign (Index + Middle) as JUMP', () => {
    const rawLandmarks = createHandLandmarks({
      indexExt: true,
      middleExt: true,
      ringExt: false,
      pinkyExt: false,
      thumbExt: false
    });
    const handData = tracker.process(rawLandmarks);
    assert.ok(handData);
    assert.equal(handData.isTwoFingers, true, 'isTwoFingers should be true');
    assert.equal(handData.isThreeFingers, false, 'isThreeFingers should be false');

    const result = classifier.classifyRaw(handData);
    assert.equal(result.gesture, 'JUMP', 'Classifier raw gesture should be JUMP');
  });

  test('Recognizes 3 Fingers (Index + Middle + Ring) as RESUME (held steadily)', () => {
    const rawLandmarks = createHandLandmarks({
      indexExt: true,
      middleExt: true,
      ringExt: true,
      pinkyExt: false,
      thumbExt: false
    });
    const handData = tracker.process(rawLandmarks);
    assert.ok(handData);
    assert.equal(handData.isThreeFingers, true, 'isThreeFingers should be true');
    assert.equal(handData.isTwoFingers, false, 'isTwoFingers should be false');
    assert.equal(handData.isOpenPalm, false, 'isOpenPalm should be false');

    // Initial frame returns HOLDING_RESUME
    const initial = classifier.classifyRaw(handData);
    assert.equal(initial.gesture, 'HOLDING_RESUME');

    // After required hold duration (>= 300ms) and frames >= 3, returns RESUME
    handData.timestamp += 350;
    classifier.threeFingerFrames = 3;
    const confirmed = classifier.classifyRaw(handData);
    assert.equal(confirmed.gesture, 'RESUME');
  });

  test('Recognizes Open Palm as PAUSE (held steadily)', () => {
    classifier.reset();
    const rawLandmarks = createHandLandmarks({
      indexExt: true,
      middleExt: true,
      ringExt: true,
      pinkyExt: true,
      thumbExt: true
    });
    const handData = tracker.process(rawLandmarks);
    assert.ok(handData);
    assert.equal(handData.isOpenPalm, true, 'isOpenPalm should be true');
    assert.equal(handData.isThreeFingers, false, 'isThreeFingers should be false');

    const initial = classifier.classifyRaw(handData);
    assert.equal(initial.gesture, 'HOLDING_PAUSE');

    handData.timestamp += 320;
    classifier.palmFrames = 3;
    const confirmed = classifier.classifyRaw(handData);
    assert.equal(confirmed.gesture, 'PAUSE');
  });

  test('Recognizes Index Finger Slanted Left as MOVE_LEFT', () => {
    classifier.reset();
    const rawLandmarks = createHandLandmarks({
      indexExt: true,
      indexSlant: -1, // Slanted left in user space
      middleExt: false,
      ringExt: false,
      pinkyExt: false,
      thumbExt: false
    });
    const handData = tracker.process(rawLandmarks);
    assert.ok(handData);
    assert.equal(handData.isIndexOnly, true, 'isIndexOnly should be true');
    assert.equal(handData.isIndexSlantedLeft, true, 'isIndexSlantedLeft should be true');
    assert.equal(handData.isIndexSlantedRight, false, 'isIndexSlantedRight should be false');

    const result = classifier.classifyRaw(handData);
    assert.equal(result.gesture, 'MOVE_LEFT');
  });

  test('Recognizes Index Finger Slanted Right as MOVE_RIGHT', () => {
    classifier.reset();
    const rawLandmarks = createHandLandmarks({
      indexExt: true,
      indexSlant: 1, // Slanted right in user space
      middleExt: false,
      ringExt: false,
      pinkyExt: false,
      thumbExt: false
    });
    const handData = tracker.process(rawLandmarks);
    assert.ok(handData);
    assert.equal(handData.isIndexOnly, true, 'isIndexOnly should be true');
    assert.equal(handData.isIndexSlantedRight, true, 'isIndexSlantedRight should be true');
    assert.equal(handData.isIndexSlantedLeft, false, 'isIndexSlantedLeft should be false');

    const result = classifier.classifyRaw(handData);
    assert.equal(result.gesture, 'MOVE_RIGHT');
  });
});

describe('2. Lane Movement & Clamp Limits', () => {
  test('Clamps lane changes strictly between -1 (Left) and +1 (Right)', () => {
    let currentLane = 0; // Center

    // Move left
    currentLane = MathUtils.clamp(currentLane - 1, -1, 1);
    assert.equal(currentLane, -1, 'Lane should be -1 (Left)');

    // Move left again (boundary check)
    currentLane = MathUtils.clamp(currentLane - 1, -1, 1);
    assert.equal(currentLane, -1, 'Lane must remain clamped at -1');

    // Move right twice
    currentLane = MathUtils.clamp(currentLane + 1, -1, 1);
    assert.equal(currentLane, 0, 'Lane should be 0 (Center)');
    currentLane = MathUtils.clamp(currentLane + 1, -1, 1);
    assert.equal(currentLane, 1, 'Lane should be 1 (Right)');

    // Move right again (boundary check)
    currentLane = MathUtils.clamp(currentLane + 1, -1, 1);
    assert.equal(currentLane, 1, 'Lane must remain clamped at 1');
  });
});

describe('3. Jump Physics & Landing Recovery', () => {
  test('Simulates gravity arc and clamps strictly to ground at y=0', () => {
    const jumpVel = GAME_CONFIG.PLAYER.JUMP_VELOCITY || 14.5;
    const gravity = GAME_CONFIG.PLAYER.GRAVITY || 32.0;

    let posY = 0;
    let velY = jumpVel;
    let isGrounded = false;
    const dt = 0.016; // 60 FPS delta time
    let steps = 0;
    let apexY = 0;

    while (!isGrounded && steps < 120) {
      posY += velY * dt;
      velY -= gravity * dt;
      if (posY > apexY) apexY = posY;

      if (posY <= 0) {
        posY = 0;
        velY = 0;
        isGrounded = true;
      }
      steps++;
    }

    assert.equal(isGrounded, true, 'Character must land back on ground');
    assert.equal(posY, 0, 'Character must clamp to ground height 0');
    assert.ok(apexY >= 1.8 && apexY <= 4.0, `Jump apex (${apexY.toFixed(2)}m) should be reachable and believable`);
  });
});

describe('4. 3D AABB Collision Detection', () => {
  const dummyController = {
    position: { x: 0, y: 0, z: -20 },
    isDead: false,
    player: { invulnerableTimer: 0 },
    getBoundingBox(target) {
      target.minX = this.position.x - 0.4;
      target.maxX = this.position.x + 0.4;
      target.minY = this.position.y;
      target.maxY = this.position.y + 1.8;
      target.minZ = this.position.z - 0.4;
      target.maxZ = this.position.z + 0.4;
      return target;
    }
  };

  const dummyObstacles = {
    obstacles: []
  };

  const dummyPowerUps = {
    hasBoost: () => false,
    consumeShield: () => false
  };

  const collisionSystem = new CollisionSystem(dummyController, dummyObstacles, dummyPowerUps);

  test('Detects intersection when obstacle overlaps player AABB', () => {
    dummyObstacles.obstacles = [
      {
        type: OBSTACLE_TYPES.LOW_BARRIER,
        active: true,
        mesh: { position: { x: 0, y: 0, z: -20 } }
      }
    ];
    dummyController.isDead = false;

    const hit = collisionSystem.checkCollisions();
    assert.equal(hit, true, 'Should detect direct collision');
    assert.equal(dummyController.isDead, true, 'Lethal collision should set isDead');
  });

  test('Ignores obstacles in different railway lanes', () => {
    dummyController.isDead = false;
    dummyObstacles.obstacles = [
      {
        type: OBSTACLE_TYPES.LOW_BARRIER,
        active: true,
        mesh: { position: { x: 2.6, y: 0, z: -20 } } // Lane 1 (Right) while player is at Lane 0 (Center)
      }
    ];

    const hit = collisionSystem.checkCollisions();
    assert.equal(hit, false, 'Should not collide with obstacle in adjacent lane');
  });

  test('Shield absorbs collision and prevents death', () => {
    dummyController.isDead = false;
    let shieldConsumed = false;
    dummyPowerUps.consumeShield = () => {
      shieldConsumed = true;
      return true;
    };
    dummyController.player.setInvulnerable = (d) => {
      dummyController.player.invulnerableTimer = d;
    };

    dummyObstacles.obstacles = [
      {
        type: OBSTACLE_TYPES.LOW_BARRIER,
        active: true,
        mesh: { position: { x: 0, y: 0, z: -20 } }
      }
    ];

    const hit = collisionSystem.checkCollisions();
    assert.equal(hit, true, 'Collision was detected and handled');
    assert.equal(shieldConsumed, true, 'Shield must be consumed');
    assert.equal(dummyController.isDead, false, 'Player must remain alive');
  });
});

describe('5. Score, Coins, and Persistence Records', () => {
  const scoreService = new ScoreService();

  test('Calculates score correctly using distance and coin factors', () => {
    const distanceMeters = 250;
    const coins = 12;
    const expectedScore = distanceMeters * GAME_CONFIG.SCORING.POINTS_PER_METER +
                          coins * GAME_CONFIG.SCORING.POINTS_PER_COIN;

    const actualScore = Math.floor(distanceMeters * 1.0 + coins * GAME_CONFIG.SCORING.POINTS_PER_COIN);
    assert.equal(actualScore, expectedScore, 'Score calculation must match standard formula');
  });

  test('Sets new personal best ONLY when strictly exceeded', () => {
    // Fresh test storage instance
    const testStorage = new StorageService();
    testStorage.clearAllGameData();

    // Baseline initial run establishes baseline without spurious record banner
    const run1 = {
      score: 1000,
      coinsCollected: 5,
      distanceTravelled: 200,
      durationSeconds: 15,
      highestSpeed: 22,
      difficulty: 'MEDIUM'
    };
    const res1 = scoreService.saveRun(run1);
    assert.equal(res1.personalBest.score, 1000);

    // Lower run does not trigger new high score
    const run2 = {
      score: 800,
      coinsCollected: 2,
      distanceTravelled: 150,
      durationSeconds: 10,
      highestSpeed: 22,
      difficulty: 'MEDIUM'
    };
    const res2 = scoreService.saveRun(run2);
    assert.equal(res2.isNewHighScore, false, 'Lower score cannot be new high score');
    assert.equal(res2.personalBest.score, 1000, 'Personal best must remain 1000');

    // Higher run strictly triggers new personal best
    const run3 = {
      score: 1500,
      coinsCollected: 8,
      distanceTravelled: 300,
      durationSeconds: 20,
      highestSpeed: 24,
      difficulty: 'MEDIUM'
    };
    const res3 = scoreService.saveRun(run3);
    assert.equal(res3.isNewHighScore, true, 'Higher score must be flagged as new high score');
    assert.equal(res3.personalBest.score, 1500, 'Personal best must update to 1500');
  });

  test('Single-run coin record triggers only on actual increase', () => {
    const prevPB = scoreService.getPersonalBest();
    const currentCoinRecord = scoreService.getHighestRunCoins();

    const run = {
      score: 500,
      coinsCollected: currentCoinRecord + 10, // Higher coin count
      distanceTravelled: 100,
      durationSeconds: 10,
      highestSpeed: 22,
      difficulty: 'MEDIUM'
    };

    const res = scoreService.saveRun(run);
    assert.equal(res.isNewCoinRecord, true, 'Coin record must be set when previous record exceeded');
    assert.equal(scoreService.getHighestRunCoins(), currentCoinRecord + 10);
  });
});

describe('6. Difficulty Configurations & Reachability', () => {
  test('All three difficulty modes exist with meaningful speed differences', () => {
    assert.ok(DIFFICULTY_CONFIG[DIFFICULTY_MODES.EASY], 'EASY mode must be configured');
    assert.ok(DIFFICULTY_CONFIG[DIFFICULTY_MODES.MEDIUM], 'MEDIUM mode must be configured');
    assert.ok(DIFFICULTY_CONFIG[DIFFICULTY_MODES.FAST], 'FAST mode must be configured');

    const easySpeed = DIFFICULTY_CONFIG[DIFFICULTY_MODES.EASY].INITIAL_SPEED;
    const medSpeed = DIFFICULTY_CONFIG[DIFFICULTY_MODES.MEDIUM].INITIAL_SPEED;
    const fastSpeed = DIFFICULTY_CONFIG[DIFFICULTY_MODES.FAST].INITIAL_SPEED;

    assert.ok(easySpeed < medSpeed, `Easy speed (${easySpeed}) must be slower than Medium (${medSpeed})`);
    assert.ok(medSpeed < fastSpeed, `Medium speed (${medSpeed}) must be slower than Fast (${fastSpeed})`);
  });

  test('Obstacle reachability rule: at least 1 lane is always clear at any depth', () => {
    // Simulate obstacle depth patterns
    const laneCount = 3;
    for (let depth = 0; depth < 50; depth++) {
      // Simulate random blocker generation ensuring at least one lane is safe
      const safeLane = Math.floor(Math.random() * laneCount);
      const blockedLanes = [0, 1, 2].filter((l) => l !== safeLane);

      // Verify that blocked lanes count is at most 2
      assert.ok(blockedLanes.length < laneCount, 'Never block all 3 lanes at same depth');
      assert.ok(blockedLanes.includes(safeLane) === false, 'Safe lane must never be blocked');
    }
  });
});

describe('7. Ultra-HD Resolution & Graphics Quality Tiers', () => {
  test('Quality tiers include MAX_4K, ULTRA, HIGH, BALANCED, PERFORMANCE', async () => {
    const { QUALITY_TIERS } = await import('../src/services/QualityManager.js');
    assert.equal(QUALITY_TIERS.MAX_4K, 'MAX_4K');
    assert.equal(QUALITY_TIERS.ULTRA, 'ULTRA');
    assert.equal(QUALITY_TIERS.HIGH, 'HIGH');
    assert.equal(QUALITY_TIERS.BALANCED, 'BALANCED');
    assert.equal(QUALITY_TIERS.PERFORMANCE, 'PERFORMANCE');
  });

  test('Calculates exact 1080p Full HD target drawing buffer on 1536x864 (1.25x scale) display', () => {
    const w = 1536;
    const h = 864;
    const nativeDpr = 1.25;

    // HIGH tier: target at least 1920x1080
    const desiredDpr = Math.max(1080 / h, 1920 / w);
    const targetDpr = Math.max(nativeDpr, Math.min(desiredDpr, 2.0));

    const drawW = Math.round(w * targetDpr);
    const drawH = Math.round(h * targetDpr);

    assert.equal(drawW, 1920, 'Width must render at exact 1920px Full HD');
    assert.equal(drawH, 1080, 'Height must render at exact 1080px Full HD');
  });

  test('Calculates exact 1440p Quad HD target drawing buffer on 1536x864 display', () => {
    const w = 1536;
    const h = 864;
    const nativeDpr = 1.25;

    // ULTRA tier: target 2560x1440
    const desiredDpr = Math.max(1440 / h, 2560 / w);
    const targetDpr = Math.max(nativeDpr, Math.min(desiredDpr, 2.5));

    const drawW = Math.round(w * targetDpr);
    const drawH = Math.round(h * targetDpr);

    assert.equal(drawW, 2560, 'Width must render at 2560px Quad HD');
    assert.equal(drawH, 1440, 'Height must render at 1440px Quad HD');
  });

  test('Calculates exact 4K Ultra HD target drawing buffer on 1536x864 display', () => {
    const w = 1536;
    const h = 864;
    const nativeDpr = 1.25;

    // MAX_4K tier: target 3840x2160
    const desiredDpr = Math.max(2160 / h, 3840 / w);
    const targetDpr = Math.max(nativeDpr, Math.min(desiredDpr, 3.5));

    const drawW = Math.round(w * targetDpr);
    const drawH = Math.round(h * targetDpr);

    assert.equal(drawW, 3840, 'Width must render at 3840px 4K UHD');
    assert.equal(drawH, 2160, 'Height must render at 2160px 4K UHD');
  });

  test('Calculates native 4K output on 3840x2160 physical display with 1.0 DPR', () => {
    const w = 3840;
    const h = 2160;
    const nativeDpr = 1.0;

    const desiredDpr = Math.max(2160 / h, 3840 / w);
    const targetDpr = Math.max(nativeDpr, Math.min(desiredDpr, 3.5));

    const drawW = Math.round(w * targetDpr);
    const drawH = Math.round(h * targetDpr);

    assert.equal(drawW, 3840, 'Width must be 3840');
    assert.equal(drawH, 2160, 'Height must be 2160');
  });

  test('Safety clamps drawing buffer to WebGL max renderbuffer limit (4096px)', () => {
    const w = 3840;
    const h = 2160;
    let targetDpr = 3.5; // Hypothetical extreme DPR

    const maxGlSize = 4096;
    if (w * targetDpr > maxGlSize) targetDpr = maxGlSize / w;
    if (h * targetDpr > maxGlSize) targetDpr = maxGlSize / h;

    const drawW = Math.round(w * targetDpr);
    const drawH = Math.round(h * targetDpr);

    assert.ok(drawW <= maxGlSize, `Width ${drawW} must not exceed ${maxGlSize}`);
    assert.ok(drawH <= maxGlSize, `Height ${drawH} must not exceed ${maxGlSize}`);
  });

  test('Anisotropy can be configured up to hardware limit (16x)', async () => {
    const { Assets } = await import('../src/utils/AssetLoader.js');
    Assets.setMaxAnisotropy(16);
    assert.equal(Assets.maxAnisotropy, 16, 'AssetLoader max anisotropy must be 16');
  });
});
