# GestureX — AI Gesture Runner 3D

> A high-speed, touch-free 3D browser endless runner powered by MediaPipe computer vision, Three.js WebGL graphics, real-time hand-gesture recognition, and a production-ready **Django REST Framework + Neon PostgreSQL + SMTP Email OTP** full-stack backend.

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Key Features](#2-key-features)
- [3. Hand Gesture Controls](#3-hand-gesture-controls)
- [4. Mandatory Technology Stack](#4-mandatory-technology-stack)
- [5. System Architecture & Pipelines](#5-system-architecture--pipelines)
- [6. Database Architecture & Data Models (Neon PostgreSQL)](#6-database-architecture--data-models-neon-postgresql)
- [7. Registration & Real-Time SMTP Email OTP Workflow](#7-registration--real-time-smtp-email-otp-workflow)
- [8. Authentication & JWT Lifecycle](#8-authentication--jwt-lifecycle)
- [9. Cloud Score Synchronization & Idempotency](#9-cloud-score-synchronization--idempotency)
- [10. Guest Mode vs. Authenticated Mode](#10-guest-mode-vs-authenticated-mode)
- [11. REST API Specification](#11-rest-api-specification)
- [12. Project Directory Structure](#12-project-directory-structure)
- [13. Environment Variables Guide](#13-environment-variables-guide)
- [14. Local Development Setup](#14-local-development-setup)
- [15. Automated Testing Suite](#15-automated-testing-suite)
- [16. Render Production Deployment Guide](#16-render-production-deployment-guide)
- [17. Security & Privacy Architecture](#17-security--privacy-architecture)
- [18. Troubleshooting](#18-troubleshooting)
- [19. Contributing & License](#19-contributing--license)

---

## 1. Overview

**GestureX — AI Gesture Runner 3D** is an arcade endless runner game where players navigate an athlete dashing across elevated sky-railways through a futuristic cyber city. Operating **100% touch-free**, player movements (lateral lane shifting, jumping, sliding, pausing, and resuming) are translated directly from webcam video via machine learning.

The application combines a high-performance **Frontend Game Engine** (Three.js WebGL, MediaPipe Vision WebAssembly, Web Audio API, Vanilla JS) with an enterprise **Django REST Framework Backend** connected to **Neon Serverless PostgreSQL**, featuring:
- Cryptographically secure single-use **Email OTP Verification** sent via real SMTP.
- Standard **Username & Password Login** issuing rotating **SimpleJWT tokens**.
- Server-authoritative **Cloud Score Synchronization** with client UUID idempotency.
- Live **Global High-Score Leaderboard** and career progression statistics.
- Full preservation of **Guest Gameplay** for zero-friction browser play.

---

## 2. Key Features

### Implemented & Verified Features

- **Touch-Free AI Gesture Control:** Zero keyboard or touch interaction required during gameplay.
- **MediaPipe Hand Tracking:** `@mediapipe/tasks-vision` HandLandmarker executing on WebAssembly and WebGL delegate.
- **Six Kinematic Hand Gestures:** Left, Right, Jump (Peace Sign), Slide (Fist), Pause (Open Palm), and Resume (Three Fingers).
- **Three Selectable Difficulty Modes:** Easy (16 m/s), Medium (22 m/s), and Fast (30 m/s) with dynamic train spawn schedules.
- **Unavoidable Obstacle Prevention:** Procedural hazard generator guarantees at least one navigable lane at any depth.
- **Real-Time SMTP Email OTP Verification:** 6-digit random verification codes sent via real SMTP with 5-minute expiry and resend cooldown.
- **SimpleJWT Authentication:** Bearer token authentication with automatic silent refresh on 401 and token blacklisting on logout.
- **Neon PostgreSQL Persistence:** Hosted serverless PostgreSQL with connection pooling and SSL encryption (`sslmode=require`).
- **Idempotent Score Submissions:** Every completed run carries a client UUID preventing duplicate records during network retries.
- **Atomic Career Statistics:** Transactional updates for highest scores, total coins, distance records, and games played.
- **Server-Authoritative Achievements:** Badges unlocked exclusively when server-validated milestone criteria are satisfied.
- **Global & Local Leaderboards:** View local records offline or switch to live Neon PostgreSQL global rankings.
- **Guest Mode Support:** Complete game experience available offline or without an account using browser `localStorage`.
- **Procedural Web Audio Engine:** Synthesized dynamic synthwave music and sound effects using zero external audio files.
- **Adaptive Graphics Quality Manager:** Monitored frame-time budgets dynamically adjusting shadow, particle, and rendering resolution tiers.

---

## 3. Hand Gesture Controls

Gestures are classified from the 21 MediaPipe hand landmarks in normalized camera space (mirrored for mirror-like intuition). Classification relies on relative Euclidean distances, finger straightness ratios, and angular slants:

| Action | Hand Gesture | Classification Criteria |
| :--- | :--- | :--- |
| **Move Left** | Index finger extended & slanted left | Index extended; middle, ring, pinky folded; slant angle $<-0.18$. Moves player one lane left. |
| **Move Right** | Index finger extended & slanted right | Index extended; middle, ring, pinky folded; slant angle $>+0.18$. Moves player one lane right. |
| **Jump** | Index & middle fingers extended (Peace / V sign) | Index and middle fingers extended upward; ring and pinky folded tight toward palm. Debounced trigger. |
| **Slide** | All fingers closed into a fist | All four fingers folded toward palm ($\text{tip-to-palm distance} < 0.85$). Hitbox drops from 1.8 m to 0.7 m. |
| **Pause** | All five fingers extended (Open palm) | All 4 main fingers extended with open thumb. Must be held steadily for $\ge 260\text{ ms}$ during gameplay. |
| **Resume** | Index, middle, & ring fingers extended (3 Fingers) | Index, middle, and ring extended upward; pinky folded. Must be held steadily for $\ge 300\text{ ms}$ while paused. |

---

## 4. Mandatory Technology Stack

### Frontend (Static Site)
- **HTML5 & CSS3:** Semantic structure, custom design tokens, glassmorphic HUD overlays, and responsive breakpoints.
- **Vanilla JavaScript (ES2022 / ESM):** Object-oriented game loop, kinematic state machines, and API clients without heavy frameworks.
- **Three.js (`three` v0.186.1):** WebGL rendering, instanced meshes, custom shaders, and dynamic lighting.
- **MediaPipe Tasks Vision (`@mediapipe/tasks-vision` v1.1.0):** Neural-network hand landmark classification running in WebAssembly.
- **Browser MediaDevices API:** Camera video capture (`320×240` at 60 FPS request).
- **Web Audio API:** Real-time synthesizer audio engine generating dynamic synthwave BGM and SFX.
- **Vite (`vite` v8.3.4):** Module bundler, dev server with HMR, and Rollup production build tooling.

### Backend (Web Service)
- **Python 3.12+ / 3.14:** Core runtime language.
- **Django 5.1+ / 6.0:** High-level web framework.
- **Django REST Framework (DRF 3.15+):** REST API serializers, views, permissions, throttles, and pagination.
- **Django REST Framework SimpleJWT (5.3+):** JSON Web Token authentication with refresh rotation and blacklisting.
- **Neon PostgreSQL:** Cloud serverless relational database accessed via `psycopg2-binary` and `dj-database-url`.
- **WhiteNoise (6.6+):** Production static asset serving directly from Gunicorn.
- **Gunicorn (22.0+):** Production WSGI HTTP server.
- **django-cors-headers:** Domain-restricted CORS and CSRF protection.

---

## 5. System Architecture & Pipelines

```mermaid
flowchart TD
    subgraph Client["Browser (Render Static Site)"]
        Cam[Webcam Feed] --> MP[MediaPipe HandLandmarker]
        MP --> GC[Gesture Classifier]
        GC --> GM[3D Game Engine / Three.js]
        GM --> SM[Score & Run Manager]
        SM --> LS[(Browser localStorage)]
        SM --> AC[ApiClient]
        UI[Auth Modal & Screens] <--> AS[AuthService]
        AS <--> AC
    end

    subgraph Backend["Django REST API (Render Web Service)"]
        AC -- HTTPS / JWT Bearer --> GW[Django URL Router / Throttle]
        GW --> AuthApp[Accounts App]
        GW --> GameApp[Game App]
        AuthApp --> SimpleJWT[SimpleJWT Token Engine]
        AuthApp --> OTPSvc[OTP & Mail Service]
    end

    subgraph CloudServices["External Cloud Infrastructure"]
        OTPSvc -- SMTP TLS --> SMTP[Mail Provider: Gmail / SendGrid]
        SMTP -- Email Delivery --> UserInbox[Runner Email Inbox]
        GameApp -- SSL Encrypted Pooling --> NeonDB[(Neon PostgreSQL Database)]
        AuthApp -- SSL Encrypted Pooling --> NeonDB
    end
```

---

## 6. Database Architecture & Data Models (Neon PostgreSQL)

The database schema is fully managed through Django migrations targeting Neon PostgreSQL with SSL (`sslmode=require`).

### Models Overview

1. **`accounts.User` (Custom User Model):**
   - Inherits from `AbstractUser`.
   - `email`: Mandatory unique `EmailField` (indexed).
   - `is_email_verified`: `BooleanField(default=False)`.
   - `is_active`: Set to `False` until OTP email verification completes.

2. **`accounts.UserProfile`:**
   - One-to-one relationship with `User`.
   - `display_name`: Public alias shown on leaderboards.
   - `avatar_color`: Custom runner color theme (hex).
   - `preferred_difficulty`: Game difficulty mode (`EASY`, `MEDIUM`, `HARD`, `FAST`).
   - `sound_enabled`, `music_enabled`, `sfx_volume`, `music_volume`.

3. **`accounts.EmailVerificationOTP`:**
   - `id`: Unique UUID.
   - `email`: Recipient email address (indexed).
   - `otp_hash`: SHA-256 hash of the 6-digit verification code.
   - `purpose`: `REGISTRATION` or `PASSWORD_RESET`.
   - `expires_at`: UTC timestamp (5-minute expiry).
   - `attempts`: Attempt counter (max 5 attempts before invalidation).
   - `is_used`: Single-use consumption flag.

4. **`game.GameRun`:**
   - `id`: BigAutoField.
   - `run_id`: Unique client UUID for network retry idempotency.
   - `user`: ForeignKey to `User`.
   - `score`: Final run score (0 to 10,000,000).
   - `coins`: Gold coins collected (0 to 1,000,000).
   - `distance`: Distance traversed in virtual meters.
   - `duration_seconds`: Gameplay elapsed duration.
   - `difficulty`: `EASY`, `MEDIUM`, `HARD`, `FAST`.
   - `status`: `COMPLETED`, `CRASHED`, `ABORTED`.
   - Composite indexes on `[user, -score]` and `[-score, created_at]`.

5. **`game.UserStats`:**
   - One-to-one relationship with `User`.
   - Aggregated career stats: `highest_score`, `total_runs`, `total_coins`, `best_coins_single_run`, `total_distance`, `best_distance`, `last_played_at`.
   - Updated atomically using database transactions and `select_for_update()`.

6. **`game.Achievement` & `game.UserAchievement`:**
   - Canonical definitions for badges: `first_flight`, `cyber_initiate`, `neon_veteran`, `grid_legend`, `coin_collector`, `digital_tycoon`, `vault_master`, `endurance_runner`, `marathon_runner`.
   - Server-side criteria evaluation; unlocked records stored with timestamps.

---

## 7. Registration & Real-Time SMTP Email OTP Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Player as Runner (Browser)
    participant Front as Frontend (GestureX)
    participant API as Django REST API
    participant SMTP as SMTP Mail Server
    participant Neon as Neon PostgreSQL

    Player->>Front: Enters Username, Email, Password
    Front->>API: POST /api/v1/auth/register/
    API->>API: Validate uniqueness & password strength
    API->>Neon: Create User (is_active=False, is_email_verified=False)
    API->>API: Generate 6-digit OTP via secrets.randbelow()
    API->>Neon: Store SHA-256(OTP) with 5-min expiry
    API->>SMTP: Dispatch rich Cyberpunk HTML email
    SMTP-->>Player: Delivers OTP to actual Email Inbox
    API-->>Front: HTTP 201 "OTP sent to email"
    Front->>Player: Displays OTP Verification View
    Player->>Front: Enters 6-digit OTP code
    Front->>API: POST /api/v1/auth/verify-email/
    API->>Neon: Validate code hash, expiration, attempt limit
    API->>Neon: Update User: is_active=True, is_email_verified=True
    API->>API: Generate SimpleJWT Access + Refresh tokens
    API-->>Front: HTTP 200 { user, tokens: { access, refresh } }
    Front->>Front: Stores tokens & emits AUTH_STATE_CHANGED
    Front-->>Player: Success notification, Welcome to GestureX!
```

---

## 8. Authentication & JWT Lifecycle

### Normal Login
Once an account has been verified via OTP, recurring logins **do not require an OTP**:
1. User provides `username` (or `email`) and `password`.
2. Backend authenticates via Django's secure credential hashing (`PBKDF2SHA256`).
3. Rejects unverified accounts with HTTP 400 and flag `email_unverified: true` to prompt verification.
4. Generates SimpleJWT token pair:
   - **Access Token:** 45 minutes lifetime (used in `Authorization: Bearer <token>`).
   - **Refresh Token:** 14 days lifetime.

### Silent Token Refresh
The frontend `ApiClient` automatically detects HTTP 401 errors:
1. When an access token expires during an API request, `ApiClient` automatically calls `POST /api/v1/auth/token/refresh/` using the stored refresh token.
2. If refresh succeeds, the stored access token is updated and the original request is transparently retried.
3. If the refresh token is expired or invalid, the session is cleared and the UI smoothly falls back to Guest Mode.

### Logout & Token Blacklisting
Upon logout, `POST /api/v1/auth/logout/` blacklists the refresh token in the backend database using `rest_framework_simplejwt.token_blacklist`, preventing replay attacks.

---

## 9. Cloud Score Synchronization & Idempotency

When a game run concludes:
1. `ScoreManager.finalizeRun()` calculates final score, coins collected, distance, duration, and top speed.
2. A client-side UUID (`run_id`) is attached to the result.
3. If the player is authenticated:
   - `ApiClient.submitScore()` sends `POST /api/v1/game-runs/`.
   - The backend identifies the user strictly from the verified JWT payload.
   - The backend checks for duplicate submissions using `run_id`. If found, it returns HTTP 200 without double-counting stats.
   - Inside an atomic transaction (`transaction.atomic()`), the run is persisted and career totals in `UserStats` are incremented.
   - Server-side achievement rules evaluate if milestones were reached and award badges.
4. **Offline Resilience:** If network connectivity fails, the run is enqueued in `PENDING_RUNS_QUEUE` in browser storage. When connectivity resumes, the queue is automatically flushed to the backend.
5. **Non-Blocking Execution:** All cloud synchronization requests execute asynchronously outside the 60 FPS Three.js rendering loop. The game-over screen displays immediately without waiting for network I/O.

---

## 10. Guest Mode vs. Authenticated Mode

GestureX maintains complete separation between guest and authenticated data:

| Feature | Guest Mode | Authenticated Mode (Neon Cloud) |
| :--- | :--- | :--- |
| **Playability** | 100% playable without registration | 100% playable |
| **Score Storage** | Local browser `localStorage` | Neon PostgreSQL Relational DB |
| **Personal Bests** | Tracked locally per device | Persistent across devices and browsers |
| **Leaderboard** | Local runs only | Global Shared Leaderboard (Rank 1 to 50+) |
| **Achievements** | Local browser tracking | Verified & persisted on Neon Cloud |
| **Cloud Sync Status** | `💾 Saved Locally (Guest Mode)` | `☁️ Synchronized to Neon Cloud` |

---

## 11. REST API Specification

All backend endpoints are versioned under `/api/v1/`:

### Authentication & Account (`/api/v1/auth/` & `/api/v1/users/`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register/` | Public | Initiates registration; sends 6-digit OTP via real SMTP. |
| `POST` | `/api/v1/auth/verify-email/` | Public | Validates OTP; activates account; returns JWT tokens. |
| `POST` | `/api/v1/auth/resend-otp/` | Public | Resends OTP with 60-second cooldown protection. |
| `POST` | `/api/v1/auth/login/` | Public | Authenticates username/password; issues JWT token pair. |
| `POST` | `/api/v1/auth/token/refresh/`| Public | Exchanges valid refresh token for a fresh access token. |
| `POST` | `/api/v1/auth/logout/` | Bearer | Blacklists refresh token and terminates session. |
| `POST` | `/api/v1/auth/password-reset/request/` | Public | Dispatches password reset OTP to user email. |
| `POST` | `/api/v1/auth/password-reset/confirm/` | Public | Validates OTP and updates account password. |
| `GET` | `/api/v1/users/me/` | Bearer | Retrieves authenticated runner account and profile. |
| `PATCH`| `/api/v1/users/me/` | Bearer | Updates display name and game preferences. |
| `POST` | `/api/v1/users/me/change-password/` | Bearer | Updates password for authenticated user. |

### Gameplay & Statistics (`/api/v1/`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/game-runs/` | Bearer | Idempotently submits completed run; updates career stats. |
| `GET` | `/api/v1/game-runs/` | Bearer | Lists historical runs completed by the user. |
| `GET` | `/api/v1/game-runs/<id>/` | Bearer | Retrieves specific game run details. |
| `GET` | `/api/v1/game-stats/me/` | Bearer | Returns aggregated career stats and global leaderboard rank. |
| `GET` | `/api/v1/leaderboard/` | Public | Retrieves global high scores (`?limit=50&mode=runs\|players`). |
| `GET` | `/api/v1/leaderboard/me/` | Bearer | Returns user's best run and rank in the global leaderboard. |
| `GET` | `/api/v1/achievements/` | Public | Lists available badges and unlock status. |
| `GET` | `/api/v1/health/` | Public | Healthcheck verifying database connectivity. |

---

## 12. Project Directory Structure

```text
GestureX/
├── backend/                             # Django REST Framework Backend Service
│   ├── accounts/                        # User authentication, OTP & profiles
│   │   ├── migrations/                  # Database migration files
│   │   ├── models.py                    # User, UserProfile, EmailVerificationOTP
│   │   ├── serializers.py               # Register, Login, OTP, Profile serializers
│   │   ├── services.py                  # Cryptographic OTP generation & SMTP dispatch
│   │   ├── signals.py                   # Automatic profile generation hooks
│   │   ├── tests.py                     # 6 automated authentication tests
│   │   ├── urls.py                      # Sub-routing for auth and user accounts
│   │   └── views.py                     # API views for authentication lifecycle
│   ├── game/                            # Authoritative gameplay persistence
│   │   ├── migrations/                  # Database migration files
│   │   ├── models.py                    # GameRun, UserStats, Achievement
│   │   ├── serializers.py               # GameRun, Leaderboard, Stats serializers
│   │   ├── services.py                  # Idempotent run recorder & badge rules
│   │   ├── signals.py                   # Automatic stats generation hooks
│   │   ├── tests.py                     # 6 automated gameplay & stats tests
│   │   ├── urls.py                      # Sub-routing for scores, stats, leaderboards
│   │   └── views.py                     # API views for scores and leaderboards
│   ├── gesturex_backend/                # Core Django project configuration
│   │   ├── settings.py                  # Neon PostgreSQL, JWT, CORS, SMTP settings
│   │   ├── urls.py                      # Master API router (/api/v1/)
│   │   ├── wsgi.py                      # Gunicorn production WSGI entry point
│   │   └── asgi.py                      # ASGI configuration
│   ├── .env.example                     # Backend environment variable template
│   ├── build.sh                         # Render build script (pip, collectstatic, migrate)
│   ├── manage.py                        # Django management command script
│   ├── Procfile                         # Render start command (Gunicorn)
│   └── requirements.txt                 # Pinned backend Python dependencies
├── src/                                 # Frontend Application (Three.js & MediaPipe)
│   ├── config/
│   │   └── environment.js               # API endpoints & MediaPipe CDN configuration
│   ├── core/                            # GameLoop, StateMachine, EventBus
│   ├── game/                            # Player, ObstacleManager, Track, World, Collision
│   ├── gesture/                         # CameraService, MediaPipeService, GestureController
│   ├── services/                        # ApiClient, AuthService, ScoreService, StorageService
│   ├── styles/                          # main.css, game.css, responsive.css
│   ├── ui/                              # AuthModal, MenuScreen, GameOverScreen, ResultsScreen
│   └── main.js                          # Application entry point
├── tests/                               # Frontend automated test suite
│   ├── gesturex.test.js                 # 30 tests (kinematics, physics, obstacles, quality)
│   └── api_auth.test.js                 # 5 tests (ApiClient, JWT, offline queue, guest mode)
├── .env.example                         # Root frontend environment variable template
├── index.html                           # Single-page HTML entry point
├── package.json                         # Frontend dependencies & npm test scripts
├── vite.config.js                       # Vite configuration
└── README.md                            # Complete technical documentation
```

---

## 13. Environment Variables Guide

### Backend Environment Variables (`backend/.env.example` -> Render Web Service)

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `DJANGO_SECRET_KEY` | Secret cryptographic key for Django. | `production-crypto-secret-key-string` |
| `DJANGO_DEBUG` | Enable/disable debug mode (Must be `False` in production). | `False` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated list of permitted hostnames. | `localhost,127.0.0.1,gesturex-backend.onrender.com,*.onrender.com` |
| `DATABASE_URL` | Neon PostgreSQL connection string (pooled or direct with SSL). | `postgresql://neondb_owner:PASSWORD@ep-random.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `CORS_ALLOWED_ORIGINS` | Permitted frontend origins for CORS. | `http://localhost:3000,http://localhost:5173,https://gesturex.onrender.com` |
| `CSRF_TRUSTED_ORIGINS` | Trusted origins for CSRF protection. | `http://localhost:3000,https://gesturex.onrender.com,https://*.onrender.com` |
| `EMAIL_HOST` | SMTP server hostname. | `smtp.gmail.com` (or SendGrid/Brevo/SES) |
| `EMAIL_PORT` | SMTP port. | `587` |
| `EMAIL_HOST_USER` | SMTP authentication username / email. | `your_email@gmail.com` |
| `EMAIL_HOST_PASSWORD` | SMTP authentication password / App Password. | `your_16_digit_app_password` |
| `EMAIL_USE_TLS` | Enable TLS encryption for SMTP. | `True` |
| `DEFAULT_FROM_EMAIL` | Sender address appearing in runner inboxes. | `GestureX Security <noreply@gesturex.com>` |
| `USE_CONSOLE_EMAIL` | Set to `True` for offline development without SMTP. | `False` |
| `OTP_EXPIRY_MINUTES` | Expiration window for OTP codes. | `5` |
| `OTP_RESEND_COOLDOWN_SECONDS` | Cooldown period between OTP resends. | `60` |
| `JWT_ACCESS_MINUTES` | Access token lifespan. | `45` |
| `JWT_REFRESH_DAYS` | Refresh token lifespan. | `14` |
| `FRONTEND_URL` | Base URL of deployed frontend. | `https://gesturex.onrender.com` |

> [!WARNING]
> Never commit real database URLs, SMTP passwords, or Django secret keys to version control. Set them securely through the Render dashboard or in local `.env` files ignored by Git.

### Frontend Environment Variables (`.env.example` -> Render Static Site)

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Public HTTPS REST API base URL. | `https://gesturex-backend.onrender.com/api/v1` |

> [!IMPORTANT]
> The `DATABASE_URL` is never exposed to browser JavaScript or prefixed with `VITE_`. Only the backend connects directly to Neon PostgreSQL.

---

## 14. Local Development Setup

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate a Python virtual environment (optional but recommended)
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure local environment variables
cp .env.example .env
# Edit .env to set DATABASE_URL (or leave blank to use local SQLite) and SMTP credentials

# Run database migrations
python manage.py migrate

# Start the Django development server
python manage.py runserver 8000
```
Backend will be available at: `http://localhost:8000/api/v1/health/`

### 2. Frontend Setup

```bash
# In the root repository directory
npm install

# Copy environment template
cp .env.example .env.local
# Set VITE_API_BASE_URL=http://localhost:8000/api/v1 in .env.local

# Start the Vite development server
npm run dev
```
Frontend will be available at: `http://localhost:5173/` or `http://localhost:3000/`

---

## 15. Automated Testing Suite

The project includes unit and integration tests across both frontend and backend.

### Running Backend Tests (Django Test Runner)
```bash
cd backend
python manage.py test
```
**Results:**
- Ran 12 tests across `accounts` and `game` apps in ~13.8 seconds.
- **Pass rate: 100% (12/12 passed, 0 failures, 0 errors).**
- Tests verified:
  1. `test_registration_creates_pending_user_and_sends_otp`: Pending account status & SMTP dispatch.
  2. `test_duplicate_registration_rejected`: Rejection of duplicate usernames and emails.
  3. `test_email_verification_activates_account_and_issues_tokens`: Account activation and token generation.
  4. `test_invalid_and_expired_otp_rejected`: Attempt limiting, code expiry, and wrong code handling.
  5. `test_login_requires_verified_email`: Unverified accounts prevented from logging in.
  6. `test_authenticated_profile_and_logout`: Profile retrieval, updates, and token blacklisting.
  7. `test_health_check_endpoint`: Healthcheck endpoint database status.
  8. `test_unauthenticated_run_submission_rejected`: 401 response on unauthenticated score submission.
  9. `test_submit_run_updates_stats_and_awards_achievements`: Transactional stats calculation & badge triggers.
  10. `test_idempotent_duplicate_run_submission`: Duplicate run UUID handling without double-counting.
  11. `test_leaderboard_ordering_and_user_rank`: Deterministic sorting and player placement.
  12. `test_achievements_list_endpoint`: Server badges enumeration.

### Running Frontend Tests (Node.js Native Test Runner)
```bash
npm test
```
**Results:**
- Ran 35 tests across 8 suites in ~289 ms.
- **Pass rate: 100% (35/35 passed, 0 failures).**
- Suites verified:
  1. Kinematic Gesture Recognition (Left, Right, Jump, Slide, Pause, Resume).
  2. Lane Movement & Clamp Limits.
  3. Jump Physics & Landing Recovery.
  4. 3D AABB Collision Detection.
  5. Score, Coins, and Persistence Records.
  6. Difficulty Configurations & Procedural Hazard Reachability.
  7. Ultra-HD Resolution & Graphics Quality Tiers.
  8. Frontend API Client & Auth Integration (Token storage, guest mode, idempotency, offline queueing).

### Production Build Validation
```bash
npm run build
```
**Results:**
- Built client bundle in 2.13s with zero build errors.

---

## 16. Render Production Deployment Guide

Deploying GestureX to production requires two Render services:
1. **Render Web Service** for the Django backend.
2. **Render Static Site** for the existing frontend.

---

### Step 1: Prepare Neon PostgreSQL
1. Create a project at [Neon Console](https://console.neon.tech/).
2. In your Neon dashboard, copy the **Pooled connection string**. It follows the format:
   ```text
   postgresql://[user]:[password]@[endpoint]-pooler.[region].aws.neon.tech/[database]?sslmode=require
   ```
3. Keep this connection string ready for backend environment variables.

---

### Step 2: Deploy Django Backend on Render Web Service
1. In the Render Dashboard, click **New +** -> **Web Service**.
2. Connect your `GestureX` repository.
3. Configure the service settings:
   - **Name:** `gesturex-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Python 3`
   - **Build Command:** `./build.sh` (or `pip install -r requirements.txt && python manage.py collectstatic --no-input && python manage.py migrate`)
   - **Start Command:** `gunicorn gesturex_backend.wsgi:application --bind 0.0.0.0:$PORT`
4. In the **Environment Variables** tab, add:
   - `DJANGO_SECRET_KEY`: Generate a random secure key.
   - `DJANGO_DEBUG`: `False`
   - `DJANGO_ALLOWED_HOSTS`: `localhost,127.0.0.1,gesturex-backend.onrender.com,*.onrender.com`
   - `DATABASE_URL`: Your Neon PostgreSQL pooled connection string.
   - `CORS_ALLOWED_ORIGINS`: `https://gesturex.onrender.com` (your frontend Render URL)
   - `CSRF_TRUSTED_ORIGINS`: `https://gesturex.onrender.com,https://*.onrender.com`
   - `EMAIL_HOST`: `smtp.gmail.com`
   - `EMAIL_PORT`: `587`
   - `EMAIL_HOST_USER`: Your email address.
   - `EMAIL_HOST_PASSWORD`: Your 16-character SMTP App Password.
   - `EMAIL_USE_TLS`: `True`
   - `DEFAULT_FROM_EMAIL`: `GestureX Security <noreply@gesturex.com>`
   - `FRONTEND_URL`: `https://gesturex.onrender.com`
5. Click **Deploy Web Service**.
6. When deployment completes, verify the healthcheck:
   `https://gesturex-backend.onrender.com/api/v1/health/`

---

### Step 3: Deploy Frontend on Render Static Site
1. In the Render Dashboard, click **New +** -> **Static Site**.
2. Connect the same `GestureX` repository.
3. Configure the static site settings:
   - **Name:** `gesturex`
   - **Root Directory:** (leave blank for repo root)
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
4. In the **Environment Variables** tab, add:
   - `VITE_API_BASE_URL`: `https://gesturex-backend.onrender.com/api/v1`
5. Click **Deploy Static Site**.
6. Open your deployed URL (`https://gesturex.onrender.com`). You can now register, receive a real email OTP, log in, play touch-free, and save scores to Neon PostgreSQL!

---

## 17. Security & Privacy Architecture

- **Camera Privacy:** Raw webcam video frames are processed exclusively inside browser memory by MediaPipe's WebAssembly model. Video frames are **never stored, recorded, transmitted, or uploaded** to the backend.
- **Cryptographic OTP Protection:** Verification codes are generated using Python's `secrets` module and hashed with SHA-256 before storage. Plaintext OTPs are never persisted in database logs.
- **Strict Attempt Limiting & Cooldowns:** OTP verification is capped at 5 attempts, after which the code is invalidated. Resend requests enforce a 60-second cooldown to mitigate email flooding.
- **JWT Protection:** Access tokens are short-lived (45 minutes). Refresh tokens are rotated on each use and revoked on logout.
- **Database Connection Security:** Neon PostgreSQL connections enforce TLS/SSL (`sslmode=require`). Credentials are supplied strictly via environment variables.
- **Zero Network Block in Gameplay:** Score submissions and profile updates are decoupled from the 60 FPS Three.js rendering loop, guaranteeing zero frame stutter or game freezing during network I/O.

---

## 18. Troubleshooting

### 1. Email OTP Not Received
- Check your email's **Spam / Junk** folder.
- If using Gmail SMTP, verify you are using a 16-character **Google App Password**, not your primary Google account password.
- Verify `EMAIL_USE_TLS=True` and `EMAIL_PORT=587`.
- For local offline development, set `USE_CONSOLE_EMAIL=True` in `backend/.env` to view OTP codes in the terminal.

### 2. Neon Database Connection Issues
- Verify that `?sslmode=require` is present at the end of your `DATABASE_URL`.
- Ensure your Neon compute instance is active (Neon instances automatically resume on incoming traffic).
- For migrations, if using Neon's connection pooler causes transaction issues, use Neon's direct connection string for migration commands.

### 3. CORS Error in Browser Console
- Check that your frontend origin (e.g., `https://gesturex.onrender.com` or `http://localhost:5173`) is listed in `CORS_ALLOWED_ORIGINS` in your backend environment variables.

### 4. Camera Permission Denied
- Ensure camera access is allowed in your browser settings (look for the camera icon in the URL address bar).
- HTTPS is required for camera access in modern browsers when hosted remotely.

---

## 19. Contributing & License

Contributions are welcome! Please follow these guidelines:
1. Ensure `npm test` and `python manage.py test` pass before submitting pull requests.
2. Maintain documentation integrity and preserve existing docstrings.
3. Keep frontend game rendering decoupled from backend network requests.

**License:** MIT License. Built with ❤️ for touch-free computer vision gaming.
