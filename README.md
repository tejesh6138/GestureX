# GestureX — AI Gesture Runner 3D

> A high-speed, touch-free 3D browser endless runner powered by MediaPipe computer vision, Three.js WebGL graphics, and real-time hand-gesture recognition.

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Key Features](#2-key-features)
- [3. Hand Gesture Controls](#3-hand-gesture-controls)
- [4. Technology Stack](#4-technology-stack)
- [5. System Architecture & Pipelines](#5-system-architecture--pipelines)
- [6. Project Directory Structure](#6-project-directory-structure)
- [7. System Requirements](#7-system-requirements)
- [8. Installation & Local Setup](#8-installation--local-setup)
- [9. Configuration & AI Model Setup](#9-configuration--ai-model-setup)
- [10. Gameplay Instructions](#10-gameplay-instructions)
- [11. Development & Production Build](#11-development--production-build)
- [12. Deployment Guide (Render Static Site)](#12-deployment-guide-render-static-site)
- [13. Performance Architecture & Adaptive Quality](#13-performance-architecture--adaptive-quality)
- [14. Data Storage & Privacy](#14-data-storage--privacy)
- [15. Troubleshooting](#15-troubleshooting)
- [16. Future Roadmap](#16-future-roadmap)
- [17. Contributing & License](#17-contributing--license)

---

## 1. Overview

**GestureX — AI Gesture Runner 3D** is an interactive, browser-based 3D endless runner game where the player controls a streetwear athlete dashing along an elevated railway through a futuristic sky city. Unlike traditional web games that rely on arrow keys, WASD, or touch swipes, GestureX is operated **100% touch-free** using real-time hand gestures captured via the user's webcam.

The application fuses modern **Computer Vision** (Google MediaPipe Tasks Vision) and **Hardware-Accelerated 3D Graphics** (Three.js and WebGL). Computer vision inference and game physics rendering operate on decoupled pipelines to maintain high visual responsiveness, crisp animations, and sub-frame gesture actuation.

GestureX is designed for modern desktop laptops and mobile browsers that support WebGL 2.0 and WebAssembly, delivering an arcade experience directly in the browser with zero native plugin installations.

---

## 2. Key Features

### Implemented & Verified Features

- **Webcam-Based, Touch-Free Controls:** Play entirely without touching a keyboard, mouse, or screen during active runs.
- **Real-Time MediaPipe Hand Tracking:** Powered by `@mediapipe/tasks-vision` HandLandmarker with a 4-tier GPU/CPU and local/CDN fallback runtime.
- **Six Distinct Kinematic Gestures:** Robust relative-geometry classification for Left, Right, Jump, Slide, Pause, and Resume.
- **Three-Lane Endless Runner Mechanics:** Procedural railway generation, dynamic lane switching (2.6 m lane width), jump gravity physics, and low-profile slide maneuvers.
- **3D Articulated Streetwear Character:** Custom procedural 3D runner with red hoodie, cap, backpack, cargo joggers, and high-top skate sneakers running forward into the environment.
- **Dynamic Hazards & Obstacles:** Static railway hurdles, duck-under high hurdles, static cyber-trains, and oncoming moving trains with audio warning sirens.
- **Power-Up System:**
  - **Coin Magnet:** Automatically pulls nearby coins toward the player within a 14 m radius.
  - **Shield:** Absorbs one obstacle collision, preventing instant defeat.
  - **Speed Boost:** Grants high-velocity invulnerability (1.45× multiplier) with camera FOV expansion and motion streaks.
- **Interactive Scoring & Multiplier:** Distance-based points, coin values, consecutive pickup combo multipliers, and real-time HUD counters.
- **Three Difficulty Modes:**
  - **Easy:** 16.0 m/s starting speed, wider hazard gaps, lower moving train frequency.
  - **Medium:** 22.0 m/s balanced arcade speed with dynamic train schedules.
  - **Fast:** 30.0 m/s hyper-reflex sprint with dense obstacle patterns and oncoming trains.
- **Points-Only Holographic Skeleton HUD:** High-tech picture-in-picture (PIP) display visualizing 21 tracked hand joints and skeletal connections without revealing the raw camera video feed.
- **Procedural Web Audio Engine:** Custom synthesizer audio engine built entirely on Web Audio API; generates dynamic synthwave BGM, whooshes, chimes, and impact chords with zero external audio assets.
- **Adaptive Graphics Quality Manager:** Monitored 25.0 ms frame-time budget with dynamic tier shifting (`HIGH`, `BALANCED`, `PERFORMANCE`) and emergency recovery downgrades.
- **Live AI & System Diagnostics Panel:** Collapsible real-time diagnostic overlay reporting separate Game Render FPS, p95 Frame Time, Camera Capture Rate, AI Inference Rate, Inference Duration, and Gesture Action Delay.
- **Local Persistence via localStorage:** Automatically records personal bests, high scores, cumulative coin totals, games played, run history, audio preferences, and 9 unlockable achievements.
- **Bright Sky City Aesthetics:** Vibrant daylight atmosphere with procedural towers, garden rooftops, moving clouds, high-speed slipstream streaks, and landing dust particles.

---

## 3. Hand Gesture Controls

Gesture recognition operates on the 21 MediaPipe hand landmarks in normalized camera space (mirrored for intuitive mirror-like interaction). Pose classification relies on scale-invariant relative Euclidean distances, finger straightness ratios, and angular slants—never raw pixel coordinates.

| Action | Hand Gesture | Kinematic Classification Criteria |
| :--- | :--- | :--- |
| **Move Left** | Index finger extended and slanted left | Index finger extended; middle, ring, pinky folded; composite slant angle $<-0.18$ relative to wrist-knuckle axis. Moves player exactly one lane left. |
| **Move Right** | Index finger extended and slanted right | Index finger extended; middle, ring, pinky folded; composite slant angle $>+0.18$ relative to wrist-knuckle axis. Moves player exactly one lane right. |
| **Jump** | Index & middle fingers extended upward (Peace / V sign) | Index and middle fingers extended upward ($y < \text{MCP}.y$); ring and pinky fingers folded tight toward palm. Single-trigger debounced. |
| **Slide** | All fingers closed into a fist | All four fingers folded toward palm ($\text{tip-to-palm distance} < 0.85$); thumb folded. Drops hitbox height from 1.8 m to 0.7 m. Fast-falls if airborne. |
| **Pause** | All five fingers extended (Open palm) | All 4 main fingers extended with open thumb. Must be held steadily for $\ge 260\text{ ms}$ while in `RUNNING` state. |
| **Resume** | Index, middle, & ring fingers extended upward (3 Fingers) | Index, middle, and ring extended upward; pinky folded. Must be held steadily for $\ge 300\text{ ms}$ while in `PAUSED` state. |

> **Environmental Note:** Recognition accuracy depends on adequate lighting, keeping the hand centered within the camera frame (roughly 0.5 m to 1.5 m from the lens), and avoiding extreme background motion.

---

## 4. Technology Stack

The project uses modern web standards and client-side modules without heavy frameworks:

| Technology | Role & Purpose |
| :--- | :--- |
| **HTML5** | Semantic application scaffolding, meta tags, and root container mounts (`index.html`). |
| **CSS3** | Modern vanilla styling, CSS custom properties, glassmorphism overlays, responsive breakpoints, and animations. |
| **JavaScript (ES2022 / ESM)** | Object-oriented game loop, state machines, kinematics math, event dispatching, and UI screens. |
| **Three.js (`three` v0.186.1)** | WebGL scene graph, perspective camera, procedural geometry, instanced meshes, PCF shadows, and lighting. |
| **MediaPipe Tasks Vision (`@mediapipe/tasks-vision` v1.1.0)** | Client-side neural-network hand-landmarker model executing via WebAssembly and WebGL delegate. |
| **Browser MediaDevices API** | Lightweight webcam video capture (`getUserMedia`) configured for 320×240 at 60 FPS request. |
| **Web Audio API** | 100% procedural sound synthesis generating interactive synthwave BGM and low-latency SFX. |
| **Vite (`vite` v8.3.4)** | Development server, HMR, custom MediaPipe sourcemap middleware, and Rollup production build tooling. |
| **localStorage API** | Browser-local persistence for settings, statistics, run histories, personal bests, and achievements. |
| **Render Static Site** | Cloud deployment configuration for static single-page web hosting. |

---

## 5. System Architecture & Pipelines

GestureX decouples artificial intelligence inference from 3D WebGL rendering:

```
[ Webcam Sensor ] ──( 320x240 @ 30-60 FPS )──> [ CameraService ]
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
         [ AI Vision Pipeline ]                                            [ Three.js Render Pipeline ]
      requestVideoFrameCallback (16.6ms)                                  requestAnimationFrame (60-120 FPS)
                       │                                                             │
         [ MediaPipeService (WASM/GPU) ]                                       [ GameLoop: tick(dt) ]
                       │                                                             │
          [ HandTracker (21 Landmarks) ]                                    [ PlayerController (Physics) ]
                       │                                                             │
         [ GestureClassifier (Consensus) ]                                   [ Track / Obstacle Managers ]
                       │                                                             │
        [ GestureController (Debounce) ]                                     [ Collision & Coin Systems ]
                       │                                                             │
           (EventBus Action Dispatch) ─────────── [ GlobalEvents ] ─────────> [ WebGLRenderer.render() ]
```

1. **AI Gesture Pipeline:** Operates autonomously via `requestVideoFrameCallback` (with high-resolution timer fallback). Detects landmarks only on fresh camera frames. A heavy vision frame never stalls the game render loop.
2. **Three.js Render Pipeline:** Runs at the screen's native refresh rate ($60\text{--}120\text{ FPS}$) via `requestAnimationFrame`. Integrates physics with clamped delta time ($dt$).
3. **Decoupled Actuation:** When consensus classification locks a gesture, an event is emitted through `GlobalEvents` (`EventBus.js`). Player movement and state transitions respond with $1.8\text{--}2.5\text{ ms}$ action latency.

---

## 6. Project Directory Structure

```
GestureX/
├── dist/                              # Production build output (generated by npm run build)
├── docs/                              # Project documentation assets
├── public/                            # Static assets served as-is by Vite
│   ├── audio/                         # Audio directory (Web Audio API synthesizes BGM/SFX procedurally)
│   ├── icons/                         # UI and gesture graphic assets
│   │   └── gesture-resume.png         # Reference card for 3-finger resume gesture
│   ├── models/                        # Pre-bundled local MediaPipe AI task models
│   │   └── hand_landmarker.task       # HandLandmarker float16 task bundle (7.8 MB)
│   ├── textures/                      # Texture storage (Three.js materials generated procedurally)
│   └── wasm/                          # Pre-bundled local MediaPipe Vision WebAssembly binaries
│       ├── vision_wasm_internal.js
│       ├── vision_wasm_internal.wasm
│       ├── vision_wasm_module_internal.js
│       ├── vision_wasm_module_internal.wasm
│       ├── vision_wasm_nosimd_internal.js
│       └── vision_wasm_nosimd_internal.wasm
├── src/                               # Application source code
│   ├── assets/
│   │   └── asset-manifest.js          # Asset references and preloading manifest
│   ├── config/
│   │   └── environment.js             # Environment variables, model paths, storage keys
│   ├── core/
│   │   ├── EventBus.js                # Centralized pub/sub event architecture
│   │   ├── Game.js                    # Game coordinator and subsystem manager
│   │   ├── GameConfig.js              # Physics balance, lane constants, and difficulty modes
│   │   ├── GameLoop.js                # Decoupled RAF renderer and AI scheduler
│   │   └── GameStateMachine.js        # Finite state machine (MENU, RUNNING, PAUSED, etc.)
│   ├── game/
│   │   ├── CameraController.js        # Dynamic third-person camera with FOV velocity warp
│   │   ├── CoinManager.js             # Procedural coin lines, rotation, and distance checks
│   │   ├── CollisionSystem.js         # Zero-allocation AABB collision detection
│   │   ├── DifficultyManager.js       # Easy, Medium, and Fast speed and hazard scaling
│   │   ├── ObstacleManager.js         # Hurdles, cyber-trains, and obstacle pooling
│   │   ├── Player.js                  # 3D streetwear character mesh hierarchy
│   │   ├── PlayerAnimationController.js # Procedural skeletal rigging (run, jump, slide)
│   │   ├── PlayerController.js        # Lane switching, jump gravity arcs, and ground anchors
│   │   ├── PowerUpManager.js          # Magnet, Shield, and Speed Boost lifecycles
│   │   ├── ScoreManager.js            # In-run score, meters, and combo multiplier calculations
│   │   ├── Track.js                   # Instanced railway sleepers, rails, and chunk pooling
│   │   └── World.js                   # Sky city scene, daylight lighting, clouds, and particles
│   ├── gesture/
│   │   ├── CameraService.js           # MediaDevices webcam lifecycle and 60 FPS monitoring
│   │   ├── GestureCalibration.js      # Interaction zone calibration
│   │   ├── GestureClassifier.js       # Temporal consensus classifier for 6 gestures
│   │   ├── GestureController.js       # Gesture orchestrator, debouncing, and PIP HUD skeleton
│   │   ├── HandTracker.js             # 21-landmark kinematic geometry and slant angle math
│   │   └── MediaPipeService.js        # HandLandmarker loader with 4-tier GPU/CPU fallback
│   ├── services/
│   │   ├── AchievementService.js      # 9 local achievements and unlock triggers
│   │   ├── ApiClient.js               # Structured client contract for future REST APIs
│   │   ├── AuthService.js             # Authentication stub for future backend integration
│   │   ├── QualityManager.js          # Adaptive graphics controller (HIGH/BALANCED/PERFORMANCE)
│   │   ├── ScoreService.js            # Run history, personal bests, and leaderboard sorting
│   │   ├── SettingsService.js         # Persisted audio, sensitivity, and quality preferences
│   │   ├── SoundService.js            # Procedural Web Audio API synthwave BGM and sound effects
│   │   └── StorageService.js          # Versioned, prefixed localStorage abstraction
│   ├── styles/
│   │   ├── game.css                   # In-game HUD, PIP skeleton, screens, and modals
│   │   ├── main.css                   # Base typography, CSS tokens, and layout resets
│   │   └── responsive.css             # Mobile and laptop adaptive viewport styles
│   ├── ui/
│   │   ├── CameraSetupScreen.js       # Camera permissions, webcam preview, and device selector
│   │   ├── DiagnosticPanel.js         # Real-time collapsible AI & WebGL performance table
│   │   ├── GameOverScreen.js          # Game-over summary, personal best indicator, play again
│   │   ├── HUD.js                     # In-game overlay: score, coins, speed, combo, PIP canvas
│   │   ├── MenuScreen.js              # Title screen, mode selector, high scores, achievements
│   │   ├── PauseScreen.js             # Pause overlay with resume gesture reminder
│   │   ├── ResultsScreen.js           # Post-run breakdown and achievements review
│   │   ├── SettingsScreen.js          # Settings modal: audio, sensitivity, quality tier
│   │   └── TutorialScreen.js          # Interactive 6-gesture practice checklist
│   ├── utils/
│   │   ├── AssetLoader.js             # Texture and model loader
│   │   ├── MathUtils.js               # Clamping, lerping, dampening, and distance helpers
│   │   └── PerformanceMonitor.js      # Frame time EMA, p95, spike counter, and budget evaluation
│   └── main.js                        # Browser entry point; mounts Game onto #app-container
├── index.html                         # Single-page HTML shell
├── package.json                       # Project dependencies, metadata, and npm scripts
├── package-lock.json                  # Deterministic dependency lockfile
└── vite.config.js                     # Vite build, server, and MediaPipe sourcemap configuration
```

---

## 7. System Requirements

### Development Environment

- **Node.js:** v18.0.0 or higher (tested on Node.js v20.x and v24.x).
- **npm:** v9.0.0 or higher.
- **Operating System:** Windows 10/11, macOS 12+, or modern Linux.

### Client / Gameplay Requirements

- **Browser:** Modern desktop or mobile browser with WebGL 2.0 and WebAssembly:
  - Google Chrome 90+ (recommended)
  - Microsoft Edge 90+
  - Mozilla Firefox 95+
  - Safari 15.4+ (iOS 15.4+ / macOS)
- **Webcam:** Any functional 720p/1080p webcam or mobile front-facing camera.
- **Security Context:** **HTTPS** is strictly required by browser standards for camera access when deployed online. Local testing works over `http://localhost:3000` or `http://127.0.0.1:3000`.

---

## 8. Installation & Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/tejesh6138/GestureX.git
cd GestureX
```

### 2. Install Dependencies

Install the verified dependencies via npm:

```bash
npm install
```

### 3. Launch Development Server

Start Vite's local development server:

```bash
npm run dev
```

Vite will output the local network URL (typically `http://localhost:3000/`).

### 4. Enable Camera & Calibrate

1. Open `http://localhost:3000/` in Chrome or Edge.
2. Click **START RUN** or **CAMERA SETUP**.
3. When prompted by the browser, click **Allow** to grant webcam permission.
4. Position your hand roughly 1 meter in front of the camera. The points-only holographic skeleton in the top-right HUD will illuminate blue upon detection.

---

## 9. Configuration & AI Model Setup

GestureX ships with **pre-bundled, zero-download local AI models** located in `public/models/` and `public/wasm/`.

### MediaPipe Configuration (`src/config/environment.js`)

```javascript
AI: {
  MODEL_PATH: './models/hand_landmarker.task',
  MODEL_FALLBACK_URL: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  WASM_PATH: './wasm',
  WASM_FALLBACK_URL: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm',
  NUM_HANDS: 1,
  MIN_HAND_DETECTION_CONFIDENCE: 0.6,
  MIN_HAND_PRESENCE_CONFIDENCE: 0.6,
  MIN_TRACKING_CONFIDENCE: 0.6
}
```

### Multi-Tier Fallback Mechanism (`src/gesture/MediaPipeService.js`)

To guarantee uptime across diverse environments, the model initializes using a cascading 4-tier fallback:
1. **Local Model (GPU Delegate):** Loads `public/models/hand_landmarker.task` with WebGL GPU acceleration.
2. **Local Model (CPU Delegate):** Re-attempts local model on WebAssembly CPU fallback if WebGL shader compilation fails.
3. **CDN Model (GPU Delegate):** Downloads from Google Storage CDN if local static files are blocked.
4. **CDN Model (CPU Delegate):** Final fallback ensuring functionality even on restricted environments.

---

## 10. Gameplay Instructions

1. **Start Screen:** Choose your difficulty mode (**Easy**, **Medium**, or **Fast**) on the main menu.
2. **First Run Setup:** If camera permission has not been granted, the game automatically opens the **Camera Setup Screen**. Verify your video feed and click **I'm Ready**.
3. **Countdown:** A 3-second countdown initiates, positioning your character centered on the track.
4. **Dodge & Collect:**
   - Slant your extended index finger **Left** or **Right** to switch lanes.
   - Flash a **Peace Sign (2 Fingers)** upward to jump over track barriers.
   - Form a **Closed Fist** to slide underneath high obstacle bars.
   - Collect gold coins and pick up glowing power-ups (**Magnet**, **Shield**, **Boost**).
5. **Pause & Resume:**
   - Flash an **Open Palm (5 Fingers)** while running to pause the game.
   - Flash **Three Fingers** upward while paused to resume the run.
6. **Game Over & Review:** When a collision occurs without an active shield, the run concludes. Review your score, coins, speed, distance, and unlocked achievements on the Results screen, then click **Play Again**.

---

## 11. Development & Production Build

Scripts defined in `package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "node --test tests/gesturex.test.js"
}
```

### Automated Testing

Run the built-in automated test suite covering kinematics, gestures, physics, collision detection, and persistence:

```bash
npm test
```

### Production Build

Run the production build:

```bash
npm run build
```

Vite transforms all ES modules and outputs the optimized bundle into the `dist/` directory:
- `dist/index.html` — Minified HTML shell.
- `dist/assets/` — CSS bundles and bundled JavaScript chunks.
- Static assets (`public/models/` and `public/wasm/`) are copied into the root of `dist/`.

### Local Production Preview

To test the production build locally:

```bash
npm run preview
```

---

## 12. Deployment Guide (Render Static Site)

GestureX is configured for deployment as a static site on hosting platforms such as **Render**, **Vercel**, or **Netlify**.

### Render Configuration

| Setting | Value |
| :--- | :--- |
| **Service Type** | Static Site |
| **Name** | `gesturex` |
| **Repository** | `https://github.com/tejesh6138/GestureX.git` |
| **Branch** | `main` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |
| **Root Directory** | *(Leave blank / repository root)* |

### Critical Deployment Notes

1. **HTTPS Enforcement:** Render provides automatic SSL/TLS certificates. HTTPS is **mandatory**; browsers reject `getUserMedia()` webcam access over unencrypted HTTP.
2. **Static Asset Routing:** The Vite configuration sets `base: './'` to support relative asset loading. Confirm that `dist/models/hand_landmarker.task` and `dist/wasm/*.wasm` are accessible with HTTP 200 responses.

---

## 13. Performance Architecture & Adaptive Quality

To prevent frame drops on resource-constrained hardware, GestureX implements real-time adaptive throttling:

### 1. Rendering Optimization
- **Railway Sleeper Instancing:** Uses `THREE.InstancedMesh` for 600+ track sleepers, cutting draw calls from $>700$ to $<85$.
- **Silhouette-Only Shadow Pass:** Shadows are restricted to primary character meshes and major obstacles; static scenery and secondary foliage do not cast shadows.
- **Staggered Shadow Map Updates:** On `BALANCED` graphics quality, shadow maps update every second frame (`autoUpdate = false`). On `PERFORMANCE` quality, shadow maps are disabled completely.
- **DPR Clamping:** Device Pixel Ratio is capped at $1.25$ on desktop and $1.0$ on mobile devices.

### 2. Adaptive Quality Manager (`src/services/QualityManager.js`)
- **Frame-Time Budget Monitoring:** Evaluates frame times against a 25.0 ms threshold ($40\text{ FPS}$).
- **Emergency Downgrade:** If frame times exceed $35\text{ ms}$ for $\ge 600\text{ ms}$, quality instantly drops to `PERFORMANCE` tier to recover frame rate.
- **Dynamic Inference Throttling:**
  - `HIGH`: 16.6 ms target interval ($\sim 60\text{ FPS}$ inference).
  - `BALANCED`: 22.0 ms target interval ($\sim 45\text{ FPS}$ inference).
  - `PERFORMANCE`: 33.0 ms target interval ($\sim 30\text{ FPS}$ inference).

### 3. Real-Time Diagnostic Panel
Expandable via the header button at the top of the screen:
- **Game Render FPS:** Live rendered frame rate (smoothed via Exponential Moving Average).
- **Frame Time (p95):** Smoothed frame duration and 95th-percentile peak time.
- **Camera Capture Rate:** Monitored camera stream delivery rate ($30\text{--}60\text{ FPS}$).
- **AI Inference Rate:** Measured MediaPipe inferences processed per second.
- **Inference Latency:** Raw neural-network model execution duration in milliseconds.
- **Gesture Action Delay:** Time elapsed from consensus classification to gameplay action ($<2.5\text{ ms}$).

> **Note on Performance Targets:** Achieving 60 FPS rendering and 50+ FPS inference requires supported hardware with WebGL GPU acceleration. Devices with software WebGL or low-power integrated GPUs will automatically adapt downward to preserve responsive control.

---

## 14. Data Storage & Privacy

### Client-Side Privacy Guarantee

- **100% On-Device Processing:** All webcam video frames are processed directly in your browser's local memory using WebAssembly and WebGL.
- **Zero Video Transmission:** Camera frames, photos, and video streams are **never** recorded, transmitted, or uploaded to any remote server or third-party service.
- **Hidden Video Element:** The `<video>` element remains off-screen; only the points-only holographic skeleton coordinates are rendered on the HUD.

### Local Storage Schema

All game data is saved in your browser's `localStorage` under the key prefix `AGR3D_V1_`:

| Storage Key | Stored Data & Purpose |
| :--- | :--- |
| `AGR3D_V1_PERSONAL_BEST` | Best score, coins collected, distance travelled, run duration, and timestamp. |
| `AGR3D_V1_RUN_HISTORY` | Array of recent run results for post-game comparison and statistics. |
| `AGR3D_V1_TOTAL_COINS` | Cumulative count of all collected coins across all runs. |
| `AGR3D_V1_HIGHEST_RUN_COINS` | Record for the most coins gathered in a single run. |
| `AGR3D_V1_GAMES_PLAYED` | Total count of completed game attempts. |
| `AGR3D_V1_UNLOCKED_ACHIEVEMENTS` | Array of unlocked achievement IDs. |
| `AGR3D_V1_SETTINGS` | Audio volume, mute status, sensitivity, and graphics quality tier. |

---

## 15. Troubleshooting

### Camera & MediaPipe Issues

| Problem | Potential Cause | Solution |
| :--- | :--- | :--- |
| **"Camera permission denied"** | Browser blocked camera access | Click the lock/camera icon in your browser address bar, set Camera to **Allow**, and refresh. |
| **"Camera unavailable or in use"** | Another app or tab is using the webcam | Close Zoom, Teams, Skype, or other browser tabs accessing the webcam, then restart the game. |
| **"AI Model load failed"** | Local task asset blocked or network failure | Verify that `public/models/hand_landmarker.task` exists. Ensure connection to Google Cloud Storage CDN fallback is unblocked. |
| **"No Hand Detected" in PIP** | Poor lighting or hand too close/far | Center your hand 0.8 m to 1.2 m from the camera in front of an unobstructed background with adequate lighting. |
| **Left / Right movements inverted** | Mirror camera confusion | Coordinates are mirrored automatically so that slanting left relative to your perspective moves left on-screen. Ensure your entire hand is visible. |

### Visual & Rendering Issues

| Problem | Potential Cause | Solution |
| :--- | :--- | :--- |
| **Low Game FPS / Lag** | High shadow cost or fill-rate saturation | Open the Settings modal and select **Low / Performance** graphics, or let the Adaptive Quality Controller downscale automatically. |
| **Blank / Black 3D Screen** | WebGL 2.0 disabled or GPU driver crash | Visit `chrome://gpu` to verify hardware acceleration is enabled. Update display graphics drivers. |
| **Audio not playing** | Browser audio autoplay policy | Click anywhere on the screen or click **START RUN**; modern browsers require user interaction before initializing `AudioContext`. |

---

## 16. Future Roadmap

The frontend is architecturally decoupled and prepared for optional cloud expansion via [ApiClient.js](src/services/ApiClient.js):

- [ ] **Backend REST API:** Django REST Framework service for cloud player profiles and score verification.
- [ ] **Relational Database:** PostgreSQL integration for verified global leaderboards.
- [ ] **User Authentication:** JSON Web Token (JWT) account login and cross-device stat syncing.
- [ ] **Ghost Run Replays:** Record and stream competitor runs using landmark velocity logs.
- [ ] **Additional Environments:** Cyberpunk Night Market, Neon Highway, and Orbital Station themes.
- [ ] **Custom Runner Skins:** Unlockable streetwear outfits and skate sneaker cosmetics.

---

## 17. Contributing & License

### Contributing

Contributions, bug reports, and optimizations are welcome!

1. Fork the repository (`https://github.com/tejesh6138/GestureX`).
2. Create your feature branch (`git checkout -b feature/NewFeature`).
3. Commit your changes (`git commit -m "Add NewFeature"`).
4. Push to the branch (`git push origin feature/NewFeature`).
5. Open a Pull Request on GitHub.

### License

This project is licensed under the **MIT License** as specified in `package.json`. See the repository for full details.

---

*GestureX — AI Gesture Runner 3D is developed with modern Three.js, MediaPipe Tasks Vision, and the Web Audio API.*
