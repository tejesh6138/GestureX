/**
 * GestureX - Centralized Player Animation Controller
 * Biomechanically realistic stylized runner animation engine with smooth cross-fade blending,
 * speed-synchronized cadence, natural knee bending, foot contact, and dedicated sliding.
 */

import { MathUtils } from '../utils/MathUtils.js';

export const ANIM_STATES = {
  RUNNING: 'RUNNING',
  MOVING_LEFT: 'MOVING_LEFT',
  MOVING_RIGHT: 'MOVING_RIGHT',
  JUMPING: 'JUMPING',
  LANDING: 'LANDING',
  SLIDING: 'SLIDING',
  COLLISION: 'COLLISION',
  GAME_OVER: 'GAME_OVER',
  MENU_LEAN: 'MENU_LEAN'
};

export class PlayerAnimationController {
  constructor(player) {
    this.player = player;
    this.currentState = ANIM_STATES.RUNNING;
    this.previousState = ANIM_STATES.RUNNING;
    this.stateTime = 0;
    this.runCycle = 0;
    this.isPaused = false;
    this.landingTimer = 0;
    this.leanTimer = 0;
    this.leanDirection = 0; // -1: Left, +1: Right

    // Continuous pose transform buffers for smooth cross-fading
    this.currentPose = this.createEmptyPose();
    this.targetPose = this.createEmptyPose();

    // Secondary dynamics
    this.backpackVelY = 0;
    this.backpackPosY = 0.06;
  }

  createEmptyPose() {
    return {
      bodyContainer: { posY: 0, rotX: 0, rotY: 0, rotZ: 0 },
      torso: { posY: 0.98, rotX: -0.15, rotY: 0, rotZ: 0 },
      pelvis: { posY: 0.58, rotX: 0, rotY: 0, rotZ: 0 },
      head: { rotX: 0.08, rotY: 0, rotZ: 0 },
      backpack: { posY: 0.06, rotX: 0.06 },
      leftShoulder: { rotX: 0, rotY: 0, rotZ: -0.16 },
      leftElbow: { rotX: -0.55, rotY: 0, rotZ: 0 },
      rightShoulder: { rotX: 0, rotY: 0, rotZ: 0.16 },
      rightElbow: { rotX: -0.55, rotY: 0, rotZ: 0 },
      leftThigh: { rotX: 0, rotY: 0, rotZ: 0 },
      leftKnee: { rotX: -0.2, rotY: 0, rotZ: 0 },
      leftAnkle: { rotX: 0, rotY: 0, rotZ: 0 },
      rightThigh: { rotX: 0, rotY: 0, rotZ: 0 },
      rightKnee: { rotX: -0.2, rotY: 0, rotZ: 0 },
      rightAnkle: { rotX: 0, rotY: 0, rotZ: 0 }
    };
  }

  setState(newState) {
    if (this.currentState === newState) return;

    // Preserve transient animations (LANDING, lane leans) if transition to RUNNING is requested while timers are active
    if (newState === ANIM_STATES.RUNNING) {
      if (this.currentState === ANIM_STATES.LANDING && this.landingTimer > 0) {
        return;
      }
      if ((this.currentState === ANIM_STATES.MOVING_LEFT || this.currentState === ANIM_STATES.MOVING_RIGHT) && this.leanTimer > 0) {
        return;
      }
    }

    this.previousState = this.currentState;
    this.currentState = newState;
    this.stateTime = 0;

    if (newState === ANIM_STATES.LANDING) {
      this.landingTimer = 0.16; // Knee compression absorption
    } else if (newState === ANIM_STATES.MOVING_LEFT) {
      this.leanDirection = -1;
      this.leanTimer = 0.26;
    } else if (newState === ANIM_STATES.MOVING_RIGHT) {
      this.leanDirection = 1;
      this.leanTimer = 0.26;
    }
  }

  getState() {
    return this.currentState;
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  reset() {
    this.currentState = ANIM_STATES.RUNNING;
    this.previousState = ANIM_STATES.RUNNING;
    this.stateTime = 0;
    this.runCycle = 0;
    this.isPaused = false;
    this.landingTimer = 0;
    this.leanTimer = 0;
    this.leanDirection = 0;
    this.backpackVelY = 0;
    this.backpackPosY = 0.06;
    this.currentPose = this.createEmptyPose();
    this.targetPose = this.createEmptyPose();
    this.applyPoseToHierarchy();
  }

  update(dt, speed = 22.0, playerPos = { x: 0, y: 0, z: 0 }) {
    if (this.isPaused) return;

    this.stateTime += dt;

    // Stride cadence synchronized with apparent ground movement
    // Average stride length = 2.45m; cadence = speed / strideLength * 2*PI
    const strideLength = 2.45;
    const cadenceSpeed = (Math.max(12.0, speed) / strideLength) * (Math.PI * 2);
    this.runCycle += dt * cadenceSpeed;

    // Temporary state timers
    if (this.landingTimer > 0) {
      this.landingTimer -= dt;
      if (this.landingTimer <= 0 && this.currentState === ANIM_STATES.LANDING) {
        this.setState(ANIM_STATES.RUNNING);
      }
    }

    if (this.leanTimer > 0) {
      this.leanTimer -= dt;
      if (this.leanTimer <= 0 && (this.currentState === ANIM_STATES.MOVING_LEFT || this.currentState === ANIM_STATES.MOVING_RIGHT)) {
        this.setState(ANIM_STATES.RUNNING);
      }
    }

    // Safety synchronization between world position and animation state:
    // If character is grounded (playerPos.y <= 0.001) but animator is still in JUMPING state, trigger landing compression
    if (playerPos.y <= 0.001 && this.currentState === ANIM_STATES.JUMPING) {
      this.setState(ANIM_STATES.LANDING);
    }

    // 1. Calculate Target Skeletal Pose for active state
    switch (this.currentState) {
      case ANIM_STATES.RUNNING:
        this.computeRunningPose(speed, dt);
        break;

      case ANIM_STATES.MOVING_LEFT:
      case ANIM_STATES.MOVING_RIGHT:
        this.computeLaneShiftPose(speed, dt);
        break;

      case ANIM_STATES.JUMPING:
        this.computeJumpingPose(playerPos.y, dt);
        break;

      case ANIM_STATES.LANDING:
        this.computeLandingPose(dt);
        break;

      case ANIM_STATES.SLIDING:
        this.computeSlidingPose(dt, speed);
        break;

      case ANIM_STATES.COLLISION:
      case ANIM_STATES.GAME_OVER:
        this.computeCollisionPose(dt);
        break;

      case ANIM_STATES.MENU_LEAN:
        this.computeMenuLeanPose(dt);
        break;

      default:
        this.computeRunningPose(speed, dt);
    }

    // 2. Smoothly damp all current skeletal joint transforms toward target pose
    // Eliminates sudden snapping or stepping
    const blendRate = 22.0; // Responsive damping (~50-80ms blend window)
    this.blendPose(dt, blendRate);

    // 3. Apply smoothed pose transforms to Three.js hierarchy
    this.applyPoseToHierarchy();
  }

  /**
   * Biomechanically Realistic Stylized Running Gait:
   * - Smooth continuous harmonic leg cycling (no conditional step pops)
   * - Speed-responsive forward torso sprint tilt
   * - Dual-peak pelvic vertical oscillation (flight vs stance impact)
   * - Pelvic roll & yaw with counter-torso spinal twist
   * - Opposing arm counter-swing with dynamic elbow drive
   * - Natural heel-strike to toe-off ankle roll
   * - Head stabilization and dynamic backpack bounce
   */
  computeRunningPose(speed, dt) {
    const cycle = this.runCycle;
    const t = this.targetPose;

    // Left and Right leg phases (180 degrees opposing)
    const leftPhase = cycle;
    const rightPhase = cycle + Math.PI;

    // 1. Pelvis & Torso Dynamics
    // Dual-peak vertical bobbing: peak in mid-flight, compression on stance strike
    const bob = Math.cos(cycle * 2) * 0.055;
    t.pelvis.posY = 0.58 + bob;
    t.torso.posY = 0.98 + bob;

    // Forward sprint lean increases with speed
    const speedRatio = MathUtils.clamp((speed - 16.0) / 28.0, 0, 1);
    const sprintLean = -0.16 - speedRatio * 0.12;
    t.torso.rotX = sprintLean;

    // Pelvic list (roll toward swing side) and yaw (rotation forward with lead leg)
    const pelvicYaw = Math.sin(cycle) * 0.09;
    const pelvicRoll = Math.cos(cycle) * 0.04;
    t.pelvis.rotY = pelvicYaw;
    t.pelvis.rotZ = pelvicRoll;

    // Spinal counter-rotation in upper torso
    t.torso.rotY = -pelvicYaw * 0.75;
    t.torso.rotZ = -pelvicRoll * 0.7;

    // 2. Head & Hood Stabilization
    // Compensate torso tilt to keep eye level forward along track
    t.head.rotX = -sprintLean * 0.65;
    t.head.rotY = -t.torso.rotY * 0.6;
    t.head.rotZ = 0;

    // 3. Dynamic Backpack Secondary Bounce
    t.backpack.posY = 0.06 + Math.sin(cycle * 2 - 0.5) * 0.025;
    t.backpack.rotX = 0.08 + Math.sin(cycle * 2 - 0.7) * 0.045;

    // 4. Left Leg Kinematics (Thigh -> Knee -> Shin -> Sneaker)
    const leftSwing = Math.sin(leftPhase);
    // Thigh swing forward (+X) and drive back (-X)
    t.leftThigh.rotX = leftSwing * 0.68 + Math.cos(leftPhase * 2) * 0.06;
    t.leftThigh.rotY = -pelvicYaw * 0.4;
    t.leftThigh.rotZ = 0;

    // Smooth continuous knee flexion: deep bend during swing recovery, slight cushion on stance
    // Never snaps or jumps
    const leftSwingForward = Math.max(0, leftSwing);
    const leftSwingBack = Math.max(0, -leftSwing);
    t.leftKnee.rotX = -0.22 - leftSwingForward * 0.95 - leftSwingBack * 0.28;

    // Ankle: dorsiflexion on forward reach, plantarflexion on push-off
    t.leftAnkle.rotX = leftSwing * 0.26 - Math.cos(leftPhase) * 0.15;

    // 5. Right Leg Kinematics (Opposite 180° phase)
    const rightSwing = Math.sin(rightPhase);
    t.rightThigh.rotX = rightSwing * 0.68 + Math.cos(rightPhase * 2) * 0.06;
    t.rightThigh.rotY = pelvicYaw * 0.4;
    t.rightThigh.rotZ = 0;

    const rightSwingForward = Math.max(0, rightSwing);
    const rightSwingBack = Math.max(0, -rightSwing);
    t.rightKnee.rotX = -0.22 - rightSwingForward * 0.95 - rightSwingBack * 0.28;

    t.rightAnkle.rotX = rightSwing * 0.26 - Math.cos(rightPhase) * 0.15;

    // 6. Arms Counter-Swing (Oppose legs)
    // Left Arm swings forward with Right Leg
    const leftArmDrive = Math.sin(rightPhase);
    t.leftShoulder.rotX = leftArmDrive * 0.72;
    t.leftShoulder.rotZ = -0.16; // Clearance from jacket
    t.leftShoulder.rotY = -leftArmDrive * 0.10;
    // Elbow flexes more forward (-1.1 rad), relaxes back (-0.4 rad)
    t.leftElbow.rotX = -0.65 - Math.max(0, leftArmDrive) * 0.50;

    // Right Arm swings forward with Left Leg
    const rightArmDrive = Math.sin(leftPhase);
    t.rightShoulder.rotX = rightArmDrive * 0.72;
    t.rightShoulder.rotZ = 0.16;
    t.rightShoulder.rotY = rightArmDrive * 0.10;
    t.rightElbow.rotX = -0.65 - Math.max(0, rightArmDrive) * 0.50;

    t.bodyContainer.rotZ = 0;
  }

  /**
   * Lane Shift Dodge / Lean:
   * Body banks smoothly into the turn, leading hip shifts.
   */
  computeLaneShiftPose(speed, dt) {
    this.computeRunningPose(speed, dt);
    const t = this.targetPose;
    const bankAngle = this.leanDirection * -0.24; // Lean into the turn
    t.bodyContainer.rotZ = bankAngle;
    t.torso.rotY += this.leanDirection * 0.14;
    t.torso.rotZ += bankAngle * 0.3;
  }

  /**
   * Dedicated Crouch Slide:
   * - Center of mass lowered significantly beneath overhead clearance gantries.
   * - Lead leg extended forward skimming rails, trail leg tucked under pelvis.
   * - Torso leaned low and forward.
   * - Left hand down near track for balance, right arm sweeping back.
   * - Head tilted up to face forward under obstacle.
   */
  computeSlidingPose(dt, speed) {
    const t = this.targetPose;

    // Low center of mass
    t.pelvis.posY = 0.26;
    t.torso.posY = 0.44;
    t.torso.rotX = -0.68; // Deep forward crouch lean
    t.torso.rotY = 0.12;
    t.torso.rotZ = -0.04;

    // Head tilted up relative to leaned torso so character looks forward down the track
    t.head.rotX = 0.38;
    t.head.rotY = -0.10;
    t.head.rotZ = 0;

    // Lead Right Leg: extended forward skimming the track
    t.rightThigh.rotX = 1.35;
    t.rightThigh.rotY = 0.08;
    t.rightThigh.rotZ = 0.05;
    t.rightKnee.rotX = -0.18; // Nearly straight
    t.rightAnkle.rotX = -0.25;

    // Trail Left Leg: tucked tightly beneath pelvis
    t.leftThigh.rotX = -0.82;
    t.leftThigh.rotY = -0.12;
    t.leftThigh.rotZ = -0.10;
    t.leftKnee.rotX = -1.68; // Sharply folded knee
    t.leftAnkle.rotX = 0.60;

    // Left Arm: low near track surface for stability
    t.leftShoulder.rotX = 0.58;
    t.leftShoulder.rotZ = -0.52;
    t.leftShoulder.rotY = 0.15;
    t.leftElbow.rotX = -0.38;

    // Right Arm: trailing backward for balance
    t.rightShoulder.rotX = -0.92;
    t.rightShoulder.rotZ = 0.38;
    t.rightShoulder.rotY = -0.12;
    t.rightElbow.rotX = -0.62;

    // Backpack tilted forward
    t.backpack.posY = 0.08;
    t.backpack.rotX = 0.18;

    t.bodyContainer.rotZ = 0;
  }

  /**
   * Athletic Airborne Jump:
   * Knees tucked up for hurdle clearance, arms extended out/back for athletic balance.
   */
  computeJumpingPose(height, dt) {
    const t = this.targetPose;

    t.pelvis.posY = 0.62;
    t.torso.posY = 1.05;
    t.torso.rotX = -0.08;
    t.torso.rotY = 0;
    t.torso.rotZ = 0;

    t.head.rotX = 0.05;
    t.head.rotY = 0;
    t.head.rotZ = 0;

    // Knees tucked up high
    t.leftThigh.rotX = 0.95;
    t.leftKnee.rotX = -1.35;
    t.leftAnkle.rotX = 0.35;

    t.rightThigh.rotX = 0.72;
    t.rightKnee.rotX = -1.12;
    t.rightAnkle.rotX = 0.28;

    // Athletic balance arm spread
    t.leftShoulder.rotX = 0.65;
    t.leftShoulder.rotZ = -0.45;
    t.leftElbow.rotX = -0.68;

    t.rightShoulder.rotX = 0.65;
    t.rightShoulder.rotZ = 0.45;
    t.rightElbow.rotX = -0.68;

    t.backpack.posY = 0.09;
    t.backpack.rotX = 0.05;
    t.bodyContainer.rotZ = 0;
  }

  /**
   * Landing Compression:
   * Deep knee squat cushion absorbing downward momentum before springing into run.
   */
  computeLandingPose(dt) {
    const t = this.targetPose;

    t.pelvis.posY = 0.42;
    t.torso.posY = 0.78;
    t.torso.rotX = -0.28;
    t.torso.rotY = 0;
    t.torso.rotZ = 0;

    t.head.rotX = 0.12;

    t.leftThigh.rotX = 0.68;
    t.leftKnee.rotX = -0.95;
    t.leftAnkle.rotX = -0.15;

    t.rightThigh.rotX = 0.68;
    t.rightKnee.rotX = -0.95;
    t.rightAnkle.rotX = -0.15;

    t.leftShoulder.rotX = -0.45;
    t.leftShoulder.rotZ = -0.25;
    t.leftElbow.rotX = -0.85;

    t.rightShoulder.rotX = -0.45;
    t.rightShoulder.rotZ = 0.25;
    t.rightElbow.rotX = -0.85;

    t.backpack.posY = 0.04;
    t.bodyContainer.rotZ = 0;
  }

  computeCollisionPose(dt) {
    const t = this.targetPose;
    t.torso.posY = 0.35;
    t.torso.rotX = -0.85;
    t.leftThigh.rotX = 0.9;
    t.rightThigh.rotX = -0.5;
    t.leftShoulder.rotX = -0.8;
    t.rightShoulder.rotX = 0.5;
  }

  computeMenuLeanPose(dt) {
    const t = this.targetPose;
    const time = this.stateTime;
    const breath = Math.sin(time * 1.8) * 0.012;

    t.pelvis.posY = 0.58;
    t.torso.posY = 1.02 + breath;
    t.torso.rotX = 0.02;
    t.torso.rotY = -0.12;
    t.torso.rotZ = 0.04;

    t.head.rotX = -0.04;
    t.head.rotY = -0.12 + Math.sin(time * 0.7) * 0.04;
    t.head.rotZ = -0.03;

    t.rightShoulder.rotX = 0.18;
    t.rightShoulder.rotY = -0.12;
    t.rightShoulder.rotZ = -0.72;
    t.rightElbow.rotX = -0.65;
    t.rightElbow.rotZ = -0.25;

    t.leftShoulder.rotX = -0.1;
    t.leftShoulder.rotY = 0.08;
    t.leftShoulder.rotZ = 0.18;
    t.leftElbow.rotX = -0.3;

    t.rightThigh.rotX = -0.02;
    t.rightKnee.rotX = -0.02;
    t.rightAnkle.rotX = 0.02;

    t.leftThigh.rotX = 0.12;
    t.leftKnee.rotX = -0.24;
    t.leftAnkle.rotX = 0.1;

    t.backpack.posY = 0.06;
    t.backpack.rotX = 0.04;
    t.bodyContainer.rotZ = 0;
  }

  blendPose(dt, lambda) {
    const c = this.currentPose;
    const t = this.targetPose;

    const damp = (curr, target) => MathUtils.damp(curr, target, lambda, dt);

    // Torso & Pelvis
    c.torso.posY = damp(c.torso.posY, t.torso.posY);
    c.torso.rotX = damp(c.torso.rotX, t.torso.rotX);
    c.torso.rotY = damp(c.torso.rotY, t.torso.rotY);
    c.torso.rotZ = damp(c.torso.rotZ, t.torso.rotZ);

    c.pelvis.posY = damp(c.pelvis.posY, t.pelvis.posY);
    c.pelvis.rotY = damp(c.pelvis.rotY, t.pelvis.rotY);
    c.pelvis.rotZ = damp(c.pelvis.rotZ, t.pelvis.rotZ);

    // Head
    c.head.rotX = damp(c.head.rotX, t.head.rotX);
    c.head.rotY = damp(c.head.rotY, t.head.rotY);
    c.head.rotZ = damp(c.head.rotZ, t.head.rotZ);

    // Backpack
    c.backpack.posY = damp(c.backpack.posY, t.backpack.posY);
    c.backpack.rotX = damp(c.backpack.rotX, t.backpack.rotX);

    // Arms
    c.leftShoulder.rotX = damp(c.leftShoulder.rotX, t.leftShoulder.rotX);
    c.leftShoulder.rotY = damp(c.leftShoulder.rotY, t.leftShoulder.rotY);
    c.leftShoulder.rotZ = damp(c.leftShoulder.rotZ, t.leftShoulder.rotZ);
    c.leftElbow.rotX = damp(c.leftElbow.rotX, t.leftElbow.rotX);

    c.rightShoulder.rotX = damp(c.rightShoulder.rotX, t.rightShoulder.rotX);
    c.rightShoulder.rotY = damp(c.rightShoulder.rotY, t.rightShoulder.rotY);
    c.rightShoulder.rotZ = damp(c.rightShoulder.rotZ, t.rightShoulder.rotZ);
    c.rightElbow.rotX = damp(c.rightElbow.rotX, t.rightElbow.rotX);

    // Legs
    c.leftThigh.rotX = damp(c.leftThigh.rotX, t.leftThigh.rotX);
    c.leftThigh.rotY = damp(c.leftThigh.rotY, t.leftThigh.rotY);
    c.leftThigh.rotZ = damp(c.leftThigh.rotZ, t.leftThigh.rotZ);
    c.leftKnee.rotX = damp(c.leftKnee.rotX, t.leftKnee.rotX);
    c.leftAnkle.rotX = damp(c.leftAnkle.rotX, t.leftAnkle.rotX);

    c.rightThigh.rotX = damp(c.rightThigh.rotX, t.rightThigh.rotX);
    c.rightThigh.rotY = damp(c.rightThigh.rotY, t.rightThigh.rotY);
    c.rightThigh.rotZ = damp(c.rightThigh.rotZ, t.rightThigh.rotZ);
    c.rightKnee.rotX = damp(c.rightKnee.rotX, t.rightKnee.rotX);
    c.rightAnkle.rotX = damp(c.rightAnkle.rotX, t.rightAnkle.rotX);

    // Body container banking
    c.bodyContainer.rotZ = damp(c.bodyContainer.rotZ, t.bodyContainer.rotZ);
  }

  applyPoseToHierarchy() {
    const p = this.player;
    const c = this.currentPose;

    // Body Container
    p.bodyContainer.rotation.z = c.bodyContainer.rotZ;

    // Torso
    p.torso.position.y = c.torso.posY;
    p.torso.rotation.x = c.torso.rotX;
    p.torso.rotation.y = c.torso.rotY;
    p.torso.rotation.z = c.torso.rotZ;

    // Pelvis
    p.pelvis.position.y = c.pelvis.posY;
    p.pelvis.rotation.y = c.pelvis.rotY;
    p.pelvis.rotation.z = c.pelvis.rotZ;

    // Head
    p.head.rotation.x = c.head.rotX;
    p.head.rotation.y = c.head.rotY;
    p.head.rotation.z = c.head.rotZ;

    // Backpack
    if (p.backpack) {
      p.backpack.position.y = c.backpack.posY;
      p.backpack.rotation.x = c.backpack.rotX;
    }

    // Shoulders & Arms
    p.leftShoulder.rotation.x = c.leftShoulder.rotX;
    p.leftShoulder.rotation.y = c.leftShoulder.rotY;
    p.leftShoulder.rotation.z = c.leftShoulder.rotZ;
    p.leftElbow.rotation.x = c.leftElbow.rotX;

    p.rightShoulder.rotation.x = c.rightShoulder.rotX;
    p.rightShoulder.rotation.y = c.rightShoulder.rotY;
    p.rightShoulder.rotation.z = c.rightShoulder.rotZ;
    p.rightElbow.rotation.x = c.rightElbow.rotX;

    // Thighs, Knees & Ankles
    p.leftThigh.rotation.x = c.leftThigh.rotX;
    p.leftThigh.rotation.y = c.leftThigh.rotY;
    p.leftThigh.rotation.z = c.leftThigh.rotZ;
    p.leftKnee.rotation.x = c.leftKnee.rotX;
    p.leftAnkle.rotation.x = c.leftAnkle.rotX;

    p.rightThigh.rotation.x = c.rightThigh.rotX;
    p.rightThigh.rotation.y = c.rightThigh.rotY;
    p.rightThigh.rotation.z = c.rightThigh.rotZ;
    p.rightKnee.rotation.x = c.rightKnee.rotX;
    p.rightAnkle.rotation.x = c.rightAnkle.rotX;
  }
}
