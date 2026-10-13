/**
 * AI Gesture Runner 3D - Master Game Controller
 * Integrates 3D Graphics, Computer Vision, Physics, Game Loop, State Machine, and UI Screens.
 */

import { World } from '../game/World.js';
import { Track } from '../game/Track.js';
import { Player } from '../game/Player.js';
import { ANIM_STATES } from '../game/PlayerAnimationController.js';
import { PlayerController } from '../game/PlayerController.js';
import { ObstacleManager } from '../game/ObstacleManager.js';
import { CoinManager } from '../game/CoinManager.js';
import { PowerUpManager } from '../game/PowerUpManager.js';
import { CollisionSystem } from '../game/CollisionSystem.js';
import { CameraController } from '../game/CameraController.js';
import { DifficultyManager } from '../game/DifficultyManager.js';
import { ScoreManager } from '../game/ScoreManager.js';
import { GameStateMachine, GAME_STATES } from './GameStateMachine.js';
import { GameLoop } from './GameLoop.js';
import { GlobalEvents, EVENTS } from './EventBus.js';
import { Gestures } from '../gesture/GestureController.js';
import { Camera } from '../gesture/CameraService.js';
import { MediaPipe } from '../gesture/MediaPipeService.js';
import { Sound } from '../services/SoundService.js';
import { Settings } from '../services/SettingsService.js';
import { Quality } from '../services/QualityManager.js';

import { HUD } from '../ui/HUD.js';
import { MenuScreen } from '../ui/MenuScreen.js';
import { CameraSetupScreen } from '../ui/CameraSetupScreen.js';
import { TutorialScreen } from '../ui/TutorialScreen.js';
import { PauseScreen } from '../ui/PauseScreen.js';
import { GameOverScreen } from '../ui/GameOverScreen.js';
import { SettingsScreen } from '../ui/SettingsScreen.js';
import { ResultsScreen } from '../ui/ResultsScreen.js';
import { DiagnosticPanel } from '../ui/DiagnosticPanel.js';

export class Game {
  constructor(canvasContainer) {
    this.container = canvasContainer;

    // 1. Initialize 3D Engine & Systems
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'game-canvas';
    this.container.appendChild(this.canvas);

    this.world = new World(this.canvas);
    this.track = new Track(this.world.scene);
    this.player = new Player(this.world.scene);
    this.playerController = new PlayerController(this.player);
    this.obstacleManager = new ObstacleManager(this.world.scene);
    this.coinManager = new CoinManager(this.world.scene);
    this.coinManager.setObstacleManager(this.obstacleManager);
    this.powerUpManager = new PowerUpManager(this.world.scene, this.player);
    this.collisionSystem = new CollisionSystem(
      this.playerController,
      this.obstacleManager,
      this.powerUpManager
    );
    this.cameraController = new CameraController();
    this.difficultyManager = new DifficultyManager(this.playerController, this.powerUpManager);
    this.obstacleManager.setDifficultyManager(this.difficultyManager);
    this.scoreManager = new ScoreManager();

    // 2. State Machine & Loop
    this.stateMachine = new GameStateMachine(GAME_STATES.LOADING);
    this.loop = new GameLoop();
    this.loop.setRenderer(this.world.renderer);

    // Bind Adaptive Quality Controller to World, PerformanceMonitor, and GameLoop
    Quality.bind({
      world: this.world,
      perfMonitor: this.loop.perfMonitor,
      gameLoop: this.loop
    });

    // 3. UI Layer
    this.uiContainer = document.createElement('div');
    this.uiContainer.id = 'ui-root';
    this.container.appendChild(this.uiContainer);

    this.hud = new HUD(this.uiContainer);
    Gestures.setPipCanvas(this.hud.getPipCanvas());
    Gestures.setPerfMonitor(this.loop.perfMonitor);

    this.menuScreen = new MenuScreen(this.uiContainer, (action) => this.handleMenuAction(action));
    this.cameraSetupScreen = new CameraSetupScreen(this.uiContainer, (action) => this.handleCameraSetupAction(action));
    this.tutorialScreen = new TutorialScreen(this.uiContainer, (action) => this.handleTutorialAction(action));
    this.pauseScreen = new PauseScreen(this.uiContainer, (action) => this.handlePauseAction(action));
    this.gameOverScreen = new GameOverScreen(this.uiContainer, (action) => this.handleGameOverAction(action));
    this.settingsScreen = new SettingsScreen(this.uiContainer, (action) => this.handleSettingsAction(action));
    this.resultsScreen = new ResultsScreen(this.uiContainer, (action) => this.handleResultsAction(action));
    this.diagnosticPanel = new DiagnosticPanel(this.uiContainer, this.loop.perfMonitor);

    // Countdown Overlay
    this.countdownEl = document.createElement('div');
    this.countdownEl.id = 'countdown-overlay';
    this.countdownEl.className = 'countdown-overlay hidden';
    this.uiContainer.appendChild(this.countdownEl);

    // 4. Bind Global Event Handlers
    this.bindEvents();
    this.setupGameLoop();

    this.onResizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.onResizeHandler);
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.handleResize(), 120);
    });
    document.addEventListener('fullscreenchange', this.onResizeHandler);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.onResizeHandler);
    }
  }

  bindEvents() {
    // Tracking lost indicator in HUD (sustained loss triggers PAUSE_REQUESTED)
    GlobalEvents.on(EVENTS.TRACKING_LOST, () => {
      this.hud.setTrackingLost(true);
    });

    GlobalEvents.on(EVENTS.TRACKING_RECOVERED, () => {
      this.hud.setTrackingLost(false);
    });

    // Score & Distance HUD updates
    GlobalEvents.on(EVENTS.SCORE_UPDATED, ({ score, coins }) => {
      this.hud.updateScore(score);
      this.hud.updateCoins(coins);
    });

    GlobalEvents.on(EVENTS.DISTANCE_UPDATED, ({ distance }) => {
      this.hud.updateDistance(distance);
    });

    GlobalEvents.on(EVENTS.SPEED_CHANGED, ({ speed }) => {
      this.hud.updateSpeed(speed);
    });

    // State changed sync to gestures
    GlobalEvents.on(EVENTS.STATE_CHANGED, ({ to }) => {
      Gestures.setGameState(to);
    });

    // Explicit Gesture Pause & Resume Requests
    GlobalEvents.on(EVENTS.PAUSE_REQUESTED, (data) => {
      if (this.stateMachine.getState() === GAME_STATES.RUNNING) {
        const reason = (data && data.reason) || 'Game paused via open-palm gesture (✋).';
        this.pauseGame(reason);
      }
    });

    GlobalEvents.on(EVENTS.RESUME_REQUESTED, () => {
      if (this.stateMachine.getState() === GAME_STATES.PAUSED) {
        this.resumeWithCountdown();
      }
    });

    // Gesture UI badge
    GlobalEvents.on(EVENTS.GESTURE_RECOGNIZED, ({ gesture }) => {
      this.hud.setGestureBadge(gesture);
    });

    // Collision response
    GlobalEvents.on(EVENTS.PLAYER_COLLISION, ({ absorbedByShield }) => {
      if (absorbedByShield) {
        this.cameraController.shake(0.35);
      } else {
        this.cameraController.shake(0.7);
      }
    });

    // Game Over
    GlobalEvents.on(EVENTS.GAME_OVER, () => {
      this.onGameOver();
    });

    // Difficulty changed
    GlobalEvents.on('DIFFICULTY_CHANGED', ({ mode }) => {
      this.difficultyManager.setMode(mode);
      this.hud.updateDifficulty(mode);
    });

    // Settings changed
    GlobalEvents.on(EVENTS.SETTINGS_CHANGED, () => {
      const showPip = Settings.get('showPipCamera');
      const pipWrapper = document.querySelector('.hud-pip-wrapper');
      if (pipWrapper) {
        pipWrapper.style.display = showPip ? 'block' : 'none';
      }
    });

    // Landing Dust Impact
    GlobalEvents.on('PLAYER_LANDED', ({ position }) => {
      if (this.world && this.world.emitDustPuff) {
        this.world.emitDustPuff(position.x, 0.02, position.z, 8, 0.45, 1.8);
      }
    });
  }

  setupGameLoop() {
    this.loop.setCallbacks({
      onUpdate: (dt, totalTime) => this.update(dt, totalTime),
      onRender: () => this.render(),
      onInference: (timestamp) => {
        if (Camera.isReady && MediaPipe.isLoaded) {
          return Gestures.processFrame(timestamp);
        }
        return { isFresh: false };
      }
    });

    GlobalEvents.on(EVENTS.CAMERA_READY, ({ video }) => {
      if (this.loop && typeof this.loop.startInferenceScheduler === 'function') {
        this.loop.startInferenceScheduler(video);
      }
    });
  }

  start() {
    this.loop.start();
    this.hud.updateDifficulty(this.difficultyManager.getMode());
    this.stateMachine.transition(GAME_STATES.MENU);
    this.menuScreen.show();
  }

  // ================= STATE ACTIONS & ROUTING =================

  handleMenuAction(action) {
    if (action === 'START') {
      if (!Camera.isReady) {
        this.stateMachine.transition(GAME_STATES.CAMERA_SETUP);
        this.menuScreen.hide();
        this.cameraSetupScreen.show();
      } else {
        this.startCountdown();
      }
    } else if (action === 'CAMERA_SETUP') {
      this.stateMachine.transition(GAME_STATES.CAMERA_SETUP);
      this.menuScreen.hide();
      this.cameraSetupScreen.show();
    } else if (action === 'TUTORIAL') {
      this.stateMachine.transition(GAME_STATES.TUTORIAL);
      this.menuScreen.hide();
      this.tutorialScreen.show();
    } else if (action === 'RESULTS') {
      this.stateMachine.transition(GAME_STATES.RESULTS);
      this.menuScreen.hide();
      this.resultsScreen.show();
    } else if (action === 'SETTINGS') {
      this.menuScreen.hide();
      this.settingsScreen.show();
    }
  }

  handleCameraSetupAction(action) {
    this.cameraSetupScreen.hide();
    if (action === 'START') {
      this.startCountdown();
    } else if (action === 'TUTORIAL') {
      this.stateMachine.transition(GAME_STATES.TUTORIAL);
      this.tutorialScreen.show();
    } else if (action === 'BACK') {
      this.stateMachine.transition(GAME_STATES.MENU);
      this.menuScreen.show();
    }
  }

  handleTutorialAction(action) {
    this.tutorialScreen.hide();
    if (action === 'START') {
      if (!Camera.isReady) {
        this.stateMachine.transition(GAME_STATES.CAMERA_SETUP);
        this.cameraSetupScreen.show();
      } else {
        this.startCountdown();
      }
    } else if (action === 'BACK') {
      this.stateMachine.transition(GAME_STATES.MENU);
      this.menuScreen.show();
    }
  }

  handlePauseAction(action) {
    this.pauseScreen.hide();
    if (action === 'RESUME') {
      this.resumeWithCountdown();
    } else if (action === 'RESTART') {
      this.startCountdown();
    } else if (action === 'MENU') {
      this.stateMachine.transition(GAME_STATES.MENU);
      this.hud.hide();
      this.menuScreen.show();
      this.resetGameplay();
    }
  }

  handleGameOverAction(action) {
    this.gameOverScreen.hide();
    if (action === 'RETRY') {
      this.startCountdown();
    } else if (action === 'RESULTS') {
      this.stateMachine.transition(GAME_STATES.RESULTS);
      this.resultsScreen.show();
    } else if (action === 'MENU') {
      this.stateMachine.transition(GAME_STATES.MENU);
      this.hud.hide();
      this.menuScreen.show();
      this.resetGameplay();
    }
  }

  handleSettingsAction(action) {
    this.settingsScreen.hide();
    this.menuScreen.show();
  }

  handleResultsAction(action) {
    this.resultsScreen.hide();
    if (action === 'START') {
      if (!Camera.isReady) {
        this.stateMachine.transition(GAME_STATES.CAMERA_SETUP);
        this.cameraSetupScreen.show();
      } else {
        this.startCountdown();
      }
    } else {
      this.stateMachine.transition(GAME_STATES.MENU);
      this.menuScreen.show();
      this.resetGameplay();
    }
  }

  // ================= GAMEPLAY LIFECYCLE =================

  startCountdown() {
    this.resetGameplay();
    this.menuScreen.hide();
    this.hud.updateDifficulty(this.difficultyManager.getMode());
    this.hud.show();
    this.stateMachine.transition(GAME_STATES.COUNTDOWN);

    let count = 3;
    this.countdownEl.textContent = count;
    this.countdownEl.classList.remove('hidden');
    Sound.playClick();

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.countdownEl.textContent = count;
        Sound.playClick();
      } else if (count === 0) {
        this.countdownEl.textContent = 'GO!';
        Sound.playPowerup();
      } else {
        clearInterval(interval);
        this.countdownEl.classList.add('hidden');
        this.stateMachine.transition(GAME_STATES.RUNNING);
        this.scoreManager.startRun();
        Sound.startBgm();
      }
    }, 750);
  }

  pauseGame(reason) {
    if (this.stateMachine.getState() !== GAME_STATES.RUNNING) return;
    this.stateMachine.transition(GAME_STATES.PAUSED);
    Sound.stopBgm();
    this.player.animator.pause();
    this.pauseScreen.show(reason);
  }

  resumeWithCountdown() {
    if (this.stateMachine.getState() !== GAME_STATES.PAUSED) return;
    this.pauseScreen.hide();

    // Safely restore grounded state if paused during a jump so character is not left airborne
    if (this.playerController.position.y > 0 || this.playerController.state === 'JUMPING') {
      this.playerController.ensureGrounded();
      this.player.animator.setState(ANIM_STATES.RUNNING);
    }

    this.stateMachine.transition(GAME_STATES.COUNTDOWN);

    let count = 3;
    this.countdownEl.textContent = count;
    this.countdownEl.classList.remove('hidden');
    Sound.playClick();

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.countdownEl.textContent = count;
        Sound.playClick();
      } else if (count === 0) {
        this.countdownEl.textContent = 'GO!';
        Sound.playPowerup();
      } else {
        clearInterval(interval);
        this.countdownEl.classList.add('hidden');
        this.player.animator.resume();
        this.stateMachine.transition(GAME_STATES.RUNNING);
        Sound.startBgm();
      }
    }, 750);
  }

  onGameOver() {
    this.stateMachine.transition(GAME_STATES.GAME_OVER);
    Sound.stopBgm();
    const runSummary = this.scoreManager.finalizeRun(this.difficultyManager.getMode());
    this.hud.hide();
    this.gameOverScreen.show(runSummary);
  }

  resetGameplay() {
    this.playerController.reset();
    this.player.animator.reset();
    this.player.invulnerableTimer = 0;
    this.player.mesh.visible = true;
    this.player.mesh.position.set(0, 0, 0);
    this.player.bodyContainer.rotation.y = 0;
    this.track.reset();
    this.world.reset();
    this.obstacleManager.reset();
    this.coinManager.reset();
    this.powerUpManager.reset();
    this.difficultyManager.reset();
    this.scoreManager.reset();
    this.hud.updateCoins(0);
    this.hud.updateScore(0);
    this.hud.updateDistance(0);
    Gestures.reset();
  }

  update(dt, totalTime) {
    // Dynamic Adaptive Graphics Quality Controller
    Quality.update();

    const state = this.stateMachine.getState();

    // In MENU: Stand on the right side on desktop/laptop, or position cleanly on mobile
    if (state === GAME_STATES.MENU) {
      const isMobile = window.innerWidth < 960;
      this.world.setMenuPedestalVisible(!isMobile);

      if (isMobile) {
        this.player.mesh.position.set(0.0, 0.0, -3.4);
        this.player.bodyContainer.rotation.y = Math.PI;
        this.player.animate(ANIM_STATES.RUNNING, dt, 14);
        this.cameraController.camera.position.set(0, 2.4, 4.8);
        this.cameraController.camera.lookAt(0, 1.2, -3.0);
      } else {
        this.player.mesh.position.set(2.15, 0.0, 0.3);
        this.player.bodyContainer.rotation.y = Math.PI - 0.22; // Turned to face camera/viewer
        this.player.animate(ANIM_STATES.MENU_LEAN, dt, 0);
        this.cameraController.camera.position.set(0.65, 2.3, 4.8);
        this.cameraController.camera.lookAt(0.25, 1.15, -1.5);
      }
      return;
    }

    // In COUNTDOWN: Position character cleanly in current lane at track level facing away (-Z)
    if (state === GAME_STATES.COUNTDOWN) {
      this.world.setMenuPedestalVisible(false);
      this.player.mesh.position.set(this.playerController.position.x, 0, this.playerController.position.z);
      this.player.bodyContainer.rotation.y = 0; // Back facing camera
      this.player.animate(ANIM_STATES.RUNNING, dt, 18, { x: this.playerController.position.x, y: 0, z: this.playerController.position.z });
      this.cameraController.update(this.playerController.position, 18, dt);
      return;
    }

    if (state !== GAME_STATES.RUNNING) return;

    // 1. Update Player Controller (Lateral, Jump, Slide, Forward Speed)
    this.playerController.update(dt);

    // 2. Update Difficulty Progression
    this.difficultyManager.update(this.playerController.distance, dt);

    // 3. Update Procedural Track Chunks
    this.track.update(this.playerController.position.z);

    // 4. Update Obstacles with speed and distance
    this.obstacleManager.update(this.playerController.position.z, dt, this.playerController.distance, this.playerController.speed);

    // 5. Update Coins (with Magnet pull check)
    this.coinManager.update(
      this.playerController.position,
      dt,
      this.powerUpManager.hasMagnet()
    );

    // 6. Update Power-Ups
    this.powerUpManager.update(this.playerController.position, dt);
    this.hud.updatePowerUps(this.powerUpManager.activePowerUps);

    // 7. Check Collisions
    this.collisionSystem.checkCollisions();

    // 8. Update Score & Distance
    this.scoreManager.update(this.playerController.distance);

    // 9. Update Camera Follow & Tilt
    this.cameraController.update(
      this.playerController.position,
      this.playerController.speed,
      dt
    );

    // 10. Update 3D World (lights, distant skyline, slipstream streaks, dust particles)
    this.world.update(this.playerController.position, this.playerController.speed, dt);

    // Subtle track friction dust while sliding
    if (this.playerController.state === 'SLIDING' && Math.random() < 0.45) {
      this.world.emitDustPuff(this.playerController.position.x, 0.04, this.playerController.position.z, 2, 0.18, 0.6);
    }
  }

  render() {
    this.world.renderer.render(this.world.scene, this.cameraController.camera);
  }

  handleResize() {
    const { width, height } = this.world.resize();
    this.cameraController.resize(width, height);
  }
}
