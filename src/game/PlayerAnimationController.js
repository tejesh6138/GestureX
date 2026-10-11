/**
 * GestureX - Centralized Player Animation Controller
 * Manages skeletal states, smooth blend transitions, and cadence synchronization.
 * Supports: RUNNING, MOVING_LEFT, MOVING_RIGHT, JUMPING, LANDING, SLIDING, COLLISION, GAME_OVER, MENU_LEAN.
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
  }

  setState(newState) {
    if (this.currentState === newState) return;
    this.previousState = this.currentState;
    this.currentState = newState;
    this.stateTime = 0;

    if (newState === ANIM_STATES.LANDING) {
      this.landingTimer = 0.18; // Brief knee absorption
    } else if (newState === ANIM_STATES.MOVING_LEFT) {
      this.leanDirection = -1;
      this.leanTimer = 0.28;
    } else if (newState === ANIM_STATES.MOVING_RIGHT) {
      this.leanDirection = 1;
      this.leanTimer = 0.28;
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
  }

  update(dt, speed = 22.0, playerPos = { x: 0, y: 0, z: 0 }) {
    if (this.isPaused) return;

    this.stateTime += dt;

    // Advance running stride cadence proportional to forward gameplay speed
    const cadenceSpeed = Math.max(12.0, speed) * 0.42;
    this.runCycle += dt * cadenceSpeed;

    // Handle temporary animation timer transitions
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

    // Apply skeletal joint poses based on active state
    switch (this.currentState) {
      case ANIM_STATES.RUNNING:
        this.applyRunningPose(dt);
        break;

      case ANIM_STATES.MOVING_LEFT:
      case ANIM_STATES.MOVING_RIGHT:
        this.applyLaneShiftPose(dt);
        break;

      case ANIM_STATES.JUMPING:
        this.applyJumpingPose(dt, playerPos.y);
        break;

      case ANIM_STATES.LANDING:
        this.applyLandingPose(dt);
        break;

      case ANIM_STATES.SLIDING:
        this.applySlidingPose(dt);
        break;

      case ANIM_STATES.COLLISION:
      case ANIM_STATES.GAME_OVER:
        this.applyCollisionPose(dt);
        break;

      case ANIM_STATES.MENU_LEAN:
        this.applyMenuLeanPose(dt);
        break;

      default:
        this.applyRunningPose(dt);
    }
  }

  /**
   * Continuous Streetwear Running Cycle:
   * Alternating 2-segment leg strides with realistic knee flex and heel-toe strike,
   * counter-swinging arms with bent elbows, subtle torso sway, and backpack bounce.
   */
  applyRunningPose(dt) {
    const p = this.player;
    const cycle = this.runCycle;

    // Sinusoidal stride phases
    const leftStride = Math.sin(cycle);
    const rightStride = -leftStride;

    // 1. Torso & Pelvis dynamics
    // Vertical bobbing (two bobs per full stride cycle)
    const bob = Math.abs(Math.sin(cycle)) * 0.07;
    p.torso.position.y = 0.98 + bob;
    // Natural forward sprint lean
    p.torso.rotation.x = -0.15;
    // Slight pelvic sway with stride
    p.torso.rotation.y = leftStride * 0.08;
    p.torso.rotation.z = Math.cos(cycle) * 0.04;

    // 2. Head & Hood stabilization
    p.head.rotation.x = 0.08; // Head looks slightly up to stay horizontal
    p.head.rotation.y = -p.torso.rotation.y * 0.5; // Compensate torso twist

    // 3. Backpack dynamic bobbing
    if (p.backpack) {
      p.backpack.position.y = 0.05 + Math.sin(cycle * 2) * 0.02;
      p.backpack.rotation.x = 0.06 + Math.sin(cycle * 2) * 0.04;
    }

    // 4. Left Leg (Thigh -> Knee -> Shin -> Sneaker)
    // When left thigh swings forward (positive X rotation in our coordinate space)
    p.leftThigh.rotation.x = leftStride * 0.75;
    // Knee flexes back when leg is swinging forward or recovering
    p.leftKnee.rotation.x = leftStride > 0 ? -leftStride * 0.85 : -0.15;
    p.leftAnkle.rotation.x = leftStride > 0 ? 0.2 : -0.25;

    // 5. Right Leg (Opposite phase)
    p.rightThigh.rotation.x = rightStride * 0.75;
    p.rightKnee.rotation.x = rightStride > 0 ? -rightStride * 0.85 : -0.15;
    p.rightAnkle.rotation.x = rightStride > 0 ? 0.2 : -0.25;

    // 6. Arms (Oppose legs: Left arm swings with right leg)
    // Left Arm
    p.leftShoulder.rotation.x = rightStride * 0.75;
    p.leftShoulder.rotation.z = -0.12; // Natural clearance away from torso
    p.leftElbow.rotation.x = -0.55 - Math.max(0, -rightStride) * 0.6; // Bent elbow flex

    // Right Arm
    p.rightShoulder.rotation.x = leftStride * 0.75;
    p.rightShoulder.rotation.z = 0.12;
    p.rightElbow.rotation.x = -0.55 - Math.max(0, -leftStride) * 0.6;

    // Reset base lateral rotation
    p.bodyContainer.rotation.z = MathUtils.lerp(p.bodyContainer.rotation.z, 0, 0.2);
  }

  /**
   * Lane Shift Dodge / Lean:
   * Body leans in direction of movement, lead hip and arm shift naturally.
   */
  applyLaneShiftPose(dt) {
    this.applyRunningPose(dt);
    const p = this.player;
    const targetLean = this.leanDirection * -0.22; // Bank into the turn
    p.bodyContainer.rotation.z = MathUtils.lerp(p.bodyContainer.rotation.z, targetLean, 0.25);
    p.torso.rotation.y = this.leanDirection * 0.12;
  }

  /**
   * Natural Airborne Jump:
   * Knees tucked up for hurdle clearance, arms extended back/out for balance.
   */
  applyJumpingPose(dt, height) {
    const p = this.player;

    p.torso.position.y = 1.05;
    p.torso.rotation.x = -0.05; // Upright in air
    p.torso.rotation.y = 0;
    p.torso.rotation.z = 0;

    // Knees tucked up
    p.leftThigh.rotation.x = 0.85;
    p.leftKnee.rotation.x = -1.25;
    p.leftAnkle.rotation.x = 0.35;

    p.rightThigh.rotation.x = 0.55;
    p.rightKnee.rotation.x = -0.95;
    p.rightAnkle.rotation.x = 0.25;

    // Arms extended out and slightly back for athletic balance
    p.leftShoulder.rotation.x = 0.65;
    p.leftShoulder.rotation.z = -0.45;
    p.leftElbow.rotation.x = -0.65;

    p.rightShoulder.rotation.x = 0.65;
    p.rightShoulder.rotation.z = 0.45;
    p.rightElbow.rotation.x = -0.65;

    if (p.backpack) {
      p.backpack.position.y = 0.08;
    }
  }

  /**
   * Landing Compression:
   * Knees flex to absorb downward momentum before springing into run.
   */
  applyLandingPose(dt) {
    const p = this.player;

    p.torso.position.y = 0.82; // Deep knee squat
    p.torso.rotation.x = -0.25;

    p.leftThigh.rotation.x = 0.55;
    p.leftKnee.rotation.x = -0.85;
    p.rightThigh.rotation.x = 0.55;
    p.rightKnee.rotation.x = -0.85;

    p.leftShoulder.rotation.x = -0.4;
    p.rightShoulder.rotation.x = -0.4;
  }

  /**
   * Streetwear Crouch Slide:
   * Torso leans forward low beneath overhead gantries, lead leg extended forward,
   * trail knee tucked beneath, left hand touching near ground for balance.
   */
  applySlidingPose(dt) {
    const p = this.player;

    p.torso.position.y = 0.48; // Low center of gravity
    p.torso.rotation.x = -0.65; // Forward lean
    p.torso.rotation.y = 0.15;

    // Lead leg extended forward
    p.leftThigh.rotation.x = 1.35;
    p.leftKnee.rotation.x = -0.25;
    p.leftAnkle.rotation.x = -0.4;

    // Trail leg folded under
    p.rightThigh.rotation.x = -0.75;
    p.rightKnee.rotation.x = -1.55;
    p.rightAnkle.rotation.x = 0.5;

    // Left arm down stabilizing near track
    p.leftShoulder.rotation.x = 0.45;
    p.leftShoulder.rotation.z = -0.55;
    p.leftElbow.rotation.x = -0.45;

    // Right arm trailing back
    p.rightShoulder.rotation.x = -0.95;
    p.rightShoulder.rotation.z = 0.35;
    p.rightElbow.rotation.x = -0.55;
  }

  /**
   * Collision stumble / fall.
   */
  applyCollisionPose(dt) {
    const p = this.player;
    p.torso.position.y = Math.max(0.2, p.torso.position.y - dt * 2.0);
    p.torso.rotation.x = -0.8;
    p.leftThigh.rotation.x = 0.8;
    p.rightThigh.rotation.x = -0.4;
  }

  /**
   * Main Menu Hero Pose:
   * Standing on right side of landing page, turned toward the viewer (front-facing),
   * leaning casually with one arm resting on the hero panel, relaxed stance,
   * subtle breathing and gentle idle head movements.
   */
  applyMenuLeanPose(dt) {
    const p = this.player;
    const t = this.stateTime;

    // Gentle breathing cycle
    const breath = Math.sin(t * 1.8) * 0.012;

    // Natural standing height
    p.torso.position.y = 1.02 + breath;
    p.torso.rotation.x = 0.02;
    p.torso.rotation.y = -0.12; // Casually angled toward viewer
    p.torso.rotation.z = 0.04;  // Hip weight shift

    p.head.rotation.x = -0.04;
    p.head.rotation.y = -0.12 + Math.sin(t * 0.7) * 0.04; // Friendly confident look at viewer
    p.head.rotation.z = -0.03;

    // Right Arm resting naturally on the decorative hero panel/pedestal
    p.rightShoulder.rotation.x = 0.18;
    p.rightShoulder.rotation.y = -0.12;
    p.rightShoulder.rotation.z = -0.72; // Raised outward toward pedestal
    p.rightElbow.rotation.x = -0.65;
    p.rightElbow.rotation.z = -0.25;

    // Left Arm relaxed naturally near waist / jacket pocket
    p.leftShoulder.rotation.x = -0.1;
    p.leftShoulder.rotation.y = 0.08;
    p.leftShoulder.rotation.z = 0.18;
    p.leftElbow.rotation.x = -0.3;

    // Weight shifted stance: solid right leg, relaxed left leg
    p.rightThigh.rotation.x = -0.02;
    p.rightKnee.rotation.x = -0.02;
    p.rightAnkle.rotation.x = 0.02;

    p.leftThigh.rotation.x = 0.12;
    p.leftKnee.rotation.x = -0.24;
    p.leftAnkle.rotation.x = 0.1;
  }
}
