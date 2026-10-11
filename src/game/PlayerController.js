/**
 * AI Gesture Runner 3D - PlayerController
 * Controls lane positioning, jump gravity arc, slide duration, and forward velocity.
 */

import { GAME_CONFIG } from '../core/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';
import { Sound } from '../services/SoundService.js';
import { ANIM_STATES } from './PlayerAnimationController.js';

export class PlayerController {
  constructor(player) {
    this.player = player;
    this.currentLane = 0; // -1: Left, 0: Center, 1: Right
    this.targetX = 0;
    this.position = { x: 0, y: 0, z: 0 };
    this.velocityY = 0;
    this.speed = GAME_CONFIG.PLAYER.INITIAL_SPEED;
    this.state = 'RUNNING'; // 'RUNNING', 'JUMPING', 'SLIDING'
    this.slideTimer = 0;
    this.distance = 0;
    this.isDead = false;

    this.bindEvents();
  }

  bindEvents() {
    GlobalEvents.on(EVENTS.PLAYER_MOVE_LANE, ({ direction }) => {
      this.changeLane(direction);
    });

    GlobalEvents.on(EVENTS.PLAYER_JUMP, () => {
      this.jump();
    });

    GlobalEvents.on(EVENTS.PLAYER_SLIDE, () => {
      this.slide();
    });
  }

  changeLane(direction) {
    if (this.isDead) return;
    const newLane = MathUtils.clamp(this.currentLane + direction, -1, 1);
    if (newLane !== this.currentLane) {
      this.currentLane = newLane;
      this.targetX = this.currentLane * GAME_CONFIG.LANES.WIDTH;
      if (this.state === 'RUNNING') {
        this.player.animator.setState(direction < 0 ? ANIM_STATES.MOVING_LEFT : ANIM_STATES.MOVING_RIGHT);
      }
    }
  }

  jump() {
    if (this.isDead) return;
    // Can jump from ground or cancel slide into jump
    if (this.state === 'RUNNING' || this.state === 'SLIDING') {
      this.state = 'JUMPING';
      this.velocityY = GAME_CONFIG.PLAYER.JUMP_VELOCITY;
      this.slideTimer = 0;
      this.player.animator.setState(ANIM_STATES.JUMPING);
      Sound.playJump();
    }
  }

  slide() {
    if (this.isDead) return;
    // Can slide from running, or fast-fall from jump into slide
    if (this.state === 'RUNNING') {
      this.state = 'SLIDING';
      this.slideTimer = GAME_CONFIG.PLAYER.SLIDE_DURATION;
      this.player.animator.setState(ANIM_STATES.SLIDING);
      Sound.playSlide();
    } else if (this.state === 'JUMPING') {
      // Fast fall down
      this.velocityY = -GAME_CONFIG.PLAYER.JUMP_VELOCITY;
      this.state = 'SLIDING';
      this.slideTimer = GAME_CONFIG.PLAYER.SLIDE_DURATION;
      this.player.animator.setState(ANIM_STATES.SLIDING);
      Sound.playSlide();
    }
  }

  update(dt) {
    if (this.isDead) return;

    // 1. Forward run movement
    this.position.z -= this.speed * dt;
    this.distance = -this.position.z;

    // 2. Lateral lane shift interpolation
    this.position.x = MathUtils.lerp(
      this.position.x,
      this.targetX,
      1 - Math.exp(-GAME_CONFIG.LANES.SWITCH_SPEED * dt)
    );

    // 3. Vertical jump physics
    if (this.state === 'JUMPING') {
      this.position.y += this.velocityY * dt;
      this.velocityY -= GAME_CONFIG.PLAYER.GRAVITY * dt;

      if (this.position.y <= 0) {
        this.position.y = 0;
        this.velocityY = 0;
        this.state = 'RUNNING';
        this.player.animator.setState(ANIM_STATES.LANDING);
      }
    }

    // 4. Slide duration countdown
    if (this.state === 'SLIDING') {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.slideTimer = 0;
        this.state = 'RUNNING';
        this.player.animator.setState(ANIM_STATES.RUNNING);
      }
    }

    // Sync mesh position
    this.player.mesh.position.set(this.position.x, this.position.y, this.position.z);

    // Lateral banking/lean while switching lanes
    const laneDelta = this.targetX - this.position.x;
    this.player.mesh.rotation.z = -laneDelta * 0.12;

    // Ensure player is facing forward (-Z) away from camera during gameplay
    this.player.bodyContainer.rotation.y = 0;

    // Update player procedural skeletal animations
    this.player.animate(this.state, dt, this.speed, this.position);
  }

  getBoundingBox() {
    const isSliding = this.state === 'SLIDING';
    const height = isSliding
      ? GAME_CONFIG.PLAYER.HEIGHT_SLIDING
      : GAME_CONFIG.PLAYER.HEIGHT_NORMAL;

    const width = GAME_CONFIG.PLAYER.WIDTH_COLLISION;
    const depth = 0.8;

    return {
      minX: this.position.x - width / 2,
      maxX: this.position.x + width / 2,
      minY: this.position.y,
      maxY: this.position.y + height,
      minZ: this.position.z - depth / 2,
      maxZ: this.position.z + depth / 2
    };
  }

  reset() {
    this.currentLane = 0;
    this.targetX = 0;
    this.position = { x: 0, y: 0, z: 0 };
    this.velocityY = 0;
    this.speed = GAME_CONFIG.PLAYER.INITIAL_SPEED;
    this.state = 'RUNNING';
    this.slideTimer = 0;
    this.distance = 0;
    this.isDead = false;
    this.player.mesh.position.set(0, 0, 0);
    this.player.mesh.rotation.set(0, 0, 0);
  }
}
