/**
 * AI Gesture Runner 3D - AuthModal
 * Cyberpunk interactive authentication modal supporting:
 * - Real-time Email OTP Registration
 * - Username & Password Normal Login
 * - Password Reset Request & Confirmation
 * - User Profile & Account Settings
 */

import { AuthService } from '../services/AuthService.js';
import { Sound } from '../services/SoundService.js';

export class AuthModal {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.currentView = 'LOGIN'; // 'LOGIN' | 'REGISTER' | 'OTP' | 'FORGOT' | 'RESET_CONFIRM' | 'PROFILE'
    this.pendingEmail = '';
    this.cooldownSeconds = 0;
    this.cooldownTimer = null;

    this.build();
  }

  build() {
    this.element = document.createElement('div');
    this.element.id = 'auth-modal-overlay';
    this.element.className = 'screen-overlay auth-modal-overlay hidden';

    this.element.innerHTML = `
      <div class="auth-modal-card glass-card">
        <button id="auth-modal-close" class="auth-close-btn" title="Close">✕</button>

        <div class="auth-header">
          <div class="auth-brand-logo">GESTURE<span class="brand-x">X</span></div>
          <div id="auth-modal-subtitle" class="auth-subtitle">RUNNER AUTHENTICATION</div>
        </div>

        <div id="auth-alert" class="auth-alert hidden"></div>

        <!-- 1. LOGIN VIEW -->
        <div id="view-login" class="auth-view">
          <form id="form-login" class="auth-form" autocomplete="on">
            <div class="form-group">
              <label for="login-username">USERNAME OR EMAIL</label>
              <input type="text" id="login-username" class="auth-input" placeholder="Enter username or email" required autocomplete="username" />
            </div>
            <div class="form-group">
              <div class="label-with-link">
                <label for="login-password">PASSWORD</label>
                <a href="#" id="link-forgot-pw" class="auth-link">Forgot password?</a>
              </div>
              <input type="password" id="login-password" class="auth-input" placeholder="Enter password" required autocomplete="current-password" />
            </div>
            <button type="submit" id="btn-submit-login" class="btn btn-primary btn-glow auth-submit-btn">
              ⚡ LOG IN
            </button>
          </form>
          <div class="auth-footer-switch">
            Don't have an account? <a href="#" id="link-goto-register" class="auth-link-highlight">Create Account</a>
          </div>
        </div>

        <!-- 2. REGISTER VIEW -->
        <div id="view-register" class="auth-view hidden">
          <form id="form-register" class="auth-form" autocomplete="on">
            <div class="form-group">
              <label for="reg-username">RUNNER USERNAME</label>
              <input type="text" id="reg-username" class="auth-input" placeholder="e.g. CyberRunner99" minlength="3" maxlength="150" required autocomplete="username" />
            </div>
            <div class="form-group">
              <label for="reg-email">REAL EMAIL ADDRESS (FOR OTP)</label>
              <input type="email" id="reg-email" class="auth-input" placeholder="name@example.com" required autocomplete="email" />
              <div class="field-hint">A real 6-digit OTP will be dispatched to this inbox.</div>
            </div>
            <div class="form-group">
              <label for="reg-password">PASSWORD</label>
              <input type="password" id="reg-password" class="auth-input" placeholder="Minimum 8 characters" minlength="8" required autocomplete="new-password" />
            </div>
            <button type="submit" id="btn-submit-register" class="btn btn-primary btn-glow auth-submit-btn">
              📨 SEND VERIFICATION OTP
            </button>
          </form>
          <div class="auth-footer-switch">
            Already registered? <a href="#" id="link-goto-login" class="auth-link-highlight">Log In</a>
          </div>
        </div>

        <!-- 3. OTP VERIFICATION VIEW -->
        <div id="view-otp" class="auth-view hidden">
          <div class="otp-notice">
            Enter the 6-digit verification code dispatched to:
            <div id="otp-target-email" class="otp-email-highlight">runner@example.com</div>
          </div>
          <form id="form-otp" class="auth-form">
            <div class="form-group">
              <label for="input-otp-code">6-DIGIT VERIFICATION CODE</label>
              <input type="text" id="input-otp-code" class="auth-input otp-code-input" placeholder="••••••" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code" />
            </div>
            <button type="submit" id="btn-submit-otp" class="btn btn-primary btn-glow auth-submit-btn">
              ✓ VERIFY & ACTIVATE ACCOUNT
            </button>
          </form>
          <div class="otp-resend-row">
            <button id="btn-resend-otp" class="btn btn-secondary btn-sm" type="button">
              🔄 RESEND CODE
            </button>
            <span id="otp-timer-label" class="otp-timer"></span>
          </div>
          <div class="auth-footer-switch">
            Wrong email address? <a href="#" id="link-otp-back-register" class="auth-link">Back to registration</a>
          </div>
        </div>

        <!-- 4. FORGOT PASSWORD VIEW -->
        <div id="view-forgot" class="auth-view hidden">
          <div class="otp-notice">
            Enter your account email to receive a password reset verification code.
          </div>
          <form id="form-forgot" class="auth-form">
            <div class="form-group">
              <label for="forgot-email">ACCOUNT EMAIL</label>
              <input type="email" id="forgot-email" class="auth-input" placeholder="name@example.com" required autocomplete="email" />
            </div>
            <button type="submit" id="btn-submit-forgot" class="btn btn-primary btn-glow auth-submit-btn">
              SEND RESET CODE
            </button>
          </form>
          <div class="auth-footer-switch">
            Remembered password? <a href="#" id="link-forgot-back-login" class="auth-link-highlight">Back to Log In</a>
          </div>
        </div>

        <!-- 5. PASSWORD RESET CONFIRM VIEW -->
        <div id="view-reset-confirm" class="auth-view hidden">
          <div class="otp-notice">
            Enter the code from your email along with your new password:
          </div>
          <form id="form-reset-confirm" class="auth-form">
            <div class="form-group">
              <label for="reset-otp-code">VERIFICATION CODE</label>
              <input type="text" id="reset-otp-code" class="auth-input otp-code-input" placeholder="••••••" maxlength="6" required />
            </div>
            <div class="form-group">
              <label for="reset-new-pw">NEW PASSWORD</label>
              <input type="password" id="reset-new-pw" class="auth-input" placeholder="Minimum 8 characters" minlength="8" required />
            </div>
            <button type="submit" id="btn-submit-reset-confirm" class="btn btn-primary btn-glow auth-submit-btn">
              UPDATE PASSWORD & LOG IN
            </button>
          </form>
        </div>

        <!-- 6. USER PROFILE & ACCOUNT VIEW -->
        <div id="view-profile" class="auth-view hidden">
          <div class="profile-info-grid">
            <div class="profile-avatar-circle" id="profile-avatar">⚡</div>
            <div class="profile-main-meta">
              <div id="profile-username" class="profile-user-title">Runner</div>
              <div id="profile-email" class="profile-user-email">email@test.com</div>
              <div class="profile-verified-pill">✓ Email Verified</div>
            </div>
          </div>

          <form id="form-profile-update" class="auth-form" style="margin-top: 16px;">
            <div class="form-group">
              <label for="prof-display-name">LEADERBOARD DISPLAY NAME</label>
              <input type="text" id="prof-display-name" class="auth-input" placeholder="Public alias" maxlength="50" />
            </div>
            <button type="submit" class="btn btn-secondary btn-sm" style="width: 100%;">
              💾 SAVE DISPLAY NAME
            </button>
          </form>

          <div class="profile-actions-row">
            <button id="btn-logout" class="btn btn-danger btn-sm" type="button">
              🚪 LOG OUT
            </button>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);
    this.bindEvents();
  }

  showAlert(message, type = 'error') {
    const alertEl = this.element.querySelector('#auth-alert');
    alertEl.textContent = message;
    alertEl.className = `auth-alert alert-${type}`;
    alertEl.classList.remove('hidden');
  }

  clearAlert() {
    const alertEl = this.element.querySelector('#auth-alert');
    alertEl.classList.add('hidden');
    alertEl.textContent = '';
  }

  switchView(viewName) {
    this.currentView = viewName;
    this.clearAlert();

    const views = ['login', 'register', 'otp', 'forgot', 'reset-confirm', 'profile'];
    views.forEach((v) => {
      const el = this.element.querySelector(`#view-${v}`);
      if (el) el.classList.add('hidden');
    });

    const target = this.element.querySelector(`#view-${viewName.toLowerCase().replace('_', '-')}`);
    if (target) target.classList.remove('hidden');

    const subtitleEl = this.element.querySelector('#auth-modal-subtitle');
    const titles = {
      LOGIN: 'RUNNER AUTHENTICATION',
      REGISTER: 'CREATE RUNNER ACCOUNT',
      OTP: 'EMAIL VERIFICATION',
      FORGOT: 'RESET PASSWORD',
      RESET_CONFIRM: 'CHOOSE NEW PASSWORD',
      PROFILE: 'RUNNER PROFILE'
    };
    if (subtitleEl) subtitleEl.textContent = titles[viewName] || 'ACCOUNT';

    // Populate profile if viewing profile
    if (viewName === 'PROFILE') {
      this.populateProfile();
    }
  }

  populateProfile() {
    const user = AuthService.getUser();
    if (!user) return;
    this.element.querySelector('#profile-username').textContent = user.username;
    this.element.querySelector('#profile-email').textContent = user.email;
    const dispInput = this.element.querySelector('#prof-display-name');
    dispInput.value = user.profile?.display_name || user.username;
  }

  startCooldown(seconds = 60) {
    this.cooldownSeconds = seconds;
    const btn = this.element.querySelector('#btn-resend-otp');
    const label = this.element.querySelector('#otp-timer-label');

    btn.disabled = true;
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);

    const updateLabel = () => {
      if (this.cooldownSeconds > 0) {
        label.textContent = `Wait ${this.cooldownSeconds}s`;
        this.cooldownSeconds--;
      } else {
        clearInterval(this.cooldownTimer);
        btn.disabled = false;
        label.textContent = '';
      }
    };
    updateLabel();
    this.cooldownTimer = setInterval(updateLabel, 1000);
  }

  show(initialView = 'LOGIN') {
    if (AuthService.isLoggedIn() && initialView === 'LOGIN') {
      this.switchView('PROFILE');
    } else {
      this.switchView(initialView);
    }
    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
    this.clearAlert();
  }

  bindEvents() {
    // Close button
    this.element.querySelector('#auth-modal-close').onclick = () => {
      Sound.playClick();
      this.hide();
    };

    // Close on backdrop click
    this.element.onclick = (e) => {
      if (e.target === this.element) this.hide();
    };

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.element.classList.contains('hidden')) {
        this.hide();
      }
    });

    // Navigation Links
    this.element.querySelector('#link-goto-register').onclick = (e) => {
      e.preventDefault();
      Sound.playClick();
      this.switchView('REGISTER');
    };

    this.element.querySelector('#link-goto-login').onclick = (e) => {
      e.preventDefault();
      Sound.playClick();
      this.switchView('LOGIN');
    };

    this.element.querySelector('#link-forgot-pw').onclick = (e) => {
      e.preventDefault();
      Sound.playClick();
      this.switchView('FORGOT');
    };

    this.element.querySelector('#link-forgot-back-login').onclick = (e) => {
      e.preventDefault();
      Sound.playClick();
      this.switchView('LOGIN');
    };

    this.element.querySelector('#link-otp-back-register').onclick = (e) => {
      e.preventDefault();
      Sound.playClick();
      this.switchView('REGISTER');
    };

    // Form 1: LOGIN
    this.element.querySelector('#form-login').onsubmit = async (e) => {
      e.preventDefault();
      Sound.playClick();
      const username = this.element.querySelector('#login-username').value.trim();
      const password = this.element.querySelector('#login-password').value;
      const btn = this.element.querySelector('#btn-submit-login');

      btn.disabled = true;
      btn.textContent = 'AUTHENTICATING...';

      const res = await AuthService.login(username, password);
      btn.disabled = false;
      btn.textContent = '⚡ LOG IN';

      if (res.ok) {
        Sound.playPowerup();
        this.showAlert('Login successful! Welcome back.', 'success');
        setTimeout(() => this.hide(), 800);
      } else {
        if (res.data?.email_unverified) {
          this.pendingEmail = res.data.email || username;
          this.element.querySelector('#otp-target-email').textContent = this.pendingEmail;
          this.switchView('OTP');
          this.showAlert('Please verify your email address to complete login.', 'warning');
        } else {
          this.showAlert(res.error || 'Invalid credentials.');
        }
      }
    };

    // Form 2: REGISTER
    this.element.querySelector('#form-register').onsubmit = async (e) => {
      e.preventDefault();
      Sound.playClick();
      const username = this.element.querySelector('#reg-username').value.trim();
      const email = this.element.querySelector('#reg-email').value.trim();
      const password = this.element.querySelector('#reg-password').value;
      const btn = this.element.querySelector('#btn-submit-register');

      btn.disabled = true;
      btn.textContent = 'DISPATCHING OTP...';

      const res = await AuthService.register(username, email, password);
      btn.disabled = false;
      btn.textContent = '📨 SEND VERIFICATION OTP';

      if (res.ok) {
        Sound.playPowerup();
        this.pendingEmail = email;
        this.element.querySelector('#otp-target-email').textContent = email;
        this.switchView('OTP');
        this.startCooldown(60);
        this.showAlert('Verification code dispatched to your email!', 'success');
      } else {
        const err = res.error || 'Registration failed. Check inputs.';
        this.showAlert(typeof err === 'object' ? JSON.stringify(err) : err);
      }
    };

    // Form 3: OTP VERIFICATION
    this.element.querySelector('#form-otp').onsubmit = async (e) => {
      e.preventDefault();
      Sound.playClick();
      const otp = this.element.querySelector('#input-otp-code').value.trim();
      const btn = this.element.querySelector('#btn-submit-otp');

      btn.disabled = true;
      btn.textContent = 'VERIFYING...';

      const res = await AuthService.verifyEmail(this.pendingEmail, otp);
      btn.disabled = false;
      btn.textContent = '✓ VERIFY & ACTIVATE ACCOUNT';

      if (res.ok) {
        Sound.playPowerup();
        this.showAlert('Account verified! Welcome to GestureX.', 'success');
        setTimeout(() => this.hide(), 1000);
      } else {
        this.showAlert(res.error || 'Invalid or expired verification code.');
      }
    };

    // Resend OTP Button
    this.element.querySelector('#btn-resend-otp').onclick = async () => {
      Sound.playClick();
      const res = await AuthService.resendOTP(this.pendingEmail);
      if (res.ok) {
        this.startCooldown(60);
        this.showAlert('A new verification code has been dispatched.', 'success');
      } else {
        this.showAlert(res.error || 'Failed to resend code.');
      }
    };

    // Form 4: FORGOT PASSWORD
    this.element.querySelector('#form-forgot').onsubmit = async (e) => {
      e.preventDefault();
      Sound.playClick();
      const email = this.element.querySelector('#forgot-email').value.trim();
      const btn = this.element.querySelector('#btn-submit-forgot');

      btn.disabled = true;
      btn.textContent = 'SENDING...';

      const res = await AuthService.requestPasswordReset(email);
      btn.disabled = false;
      btn.textContent = 'SEND RESET CODE';

      this.pendingEmail = email;
      this.switchView('RESET_CONFIRM');
      this.showAlert('If registered, a reset code was sent to your email.', 'info');
    };

    // Form 5: RESET CONFIRM
    this.element.querySelector('#form-reset-confirm').onsubmit = async (e) => {
      e.preventDefault();
      Sound.playClick();
      const otp = this.element.querySelector('#reset-otp-code').value.trim();
      const newPw = this.element.querySelector('#reset-new-pw').value;
      const btn = this.element.querySelector('#btn-submit-reset-confirm');

      btn.disabled = true;
      btn.textContent = 'RESETTING...';

      const res = await AuthService.confirmPasswordReset(this.pendingEmail, otp, newPw);
      btn.disabled = false;
      btn.textContent = 'UPDATE PASSWORD & LOG IN';

      if (res.ok) {
        Sound.playPowerup();
        this.showAlert('Password reset! Please log in with your new password.', 'success');
        setTimeout(() => this.switchView('LOGIN'), 1200);
      } else {
        this.showAlert(res.error || 'Invalid code or password requirements not met.');
      }
    };

    // Form 6: PROFILE UPDATE
    this.element.querySelector('#form-profile-update').onsubmit = async (e) => {
      e.preventDefault();
      Sound.playClick();
      const dispName = this.element.querySelector('#prof-display-name').value.trim();
      const res = await AuthService.updateProfile({ display_name: dispName });
      if (res.ok) {
        this.showAlert('Display name updated successfully!', 'success');
      } else {
        this.showAlert(res.error || 'Failed to update profile.');
      }
    };

    // LOGOUT
    this.element.querySelector('#btn-logout').onclick = async () => {
      Sound.playClick();
      await AuthService.logout();
      this.showAlert('Logged out successfully.', 'info');
      setTimeout(() => this.hide(), 600);
    };
  }
}
