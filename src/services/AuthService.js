/**
 * AI Gesture Runner 3D - AuthService
 * Complete authentication state management connecting UI to Django REST Framework APIs.
 * Supports Guest Mode by default, email registration with OTP, username/password login,
 * JWT lifecycle, profile synchronization, and password reset workflows.
 */

import { ApiClient } from './ApiClient.js';
import { Storage } from './StorageService.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';

export class AuthServiceClass {
  constructor() {
    this.currentUser = Storage.getItem('CURRENT_USER_PROFILE', null);
    this.isAuthenticated = ApiClient.isAuthenticated();
    this.isGuest = !this.isAuthenticated;

    // Asynchronously verify token and sync profile on startup
    if (this.isAuthenticated) {
      this.syncUserProfile().catch(() => {});
    }
  }

  isLoggedIn() {
    return this.isAuthenticated;
  }

  isGuestMode() {
    return !this.isAuthenticated;
  }

  getUser() {
    return this.currentUser ? { ...this.currentUser } : null;
  }

  getDisplayName() {
    if (!this.currentUser) return 'Guest Runner';
    return this.currentUser.profile?.display_name || this.currentUser.username;
  }

  async syncUserProfile() {
    if (!ApiClient.isAuthenticated()) return null;
    const res = await ApiClient.getCurrentUser();
    if (res.ok && res.data) {
      this.currentUser = res.data;
      this.isAuthenticated = true;
      this.isGuest = false;
      Storage.setItem('CURRENT_USER_PROFILE', this.currentUser);
      GlobalEvents.emit(EVENTS.AUTH_STATE_CHANGED, {
        isAuthenticated: true,
        user: this.currentUser
      });
      return this.currentUser;
    } else if (res.status === 401) {
      this.logout();
    }
    return null;
  }

  async register(username, email, password) {
    const res = await ApiClient.register(username, email, password);
    return res;
  }

  async verifyEmail(email, otp) {
    const res = await ApiClient.verifyEmail(email, otp);
    if (res.ok && res.data.user) {
      this.currentUser = res.data.user;
      this.isAuthenticated = true;
      this.isGuest = false;
      Storage.setItem('CURRENT_USER_PROFILE', this.currentUser);
      GlobalEvents.emit(EVENTS.AUTH_STATE_CHANGED, {
        isAuthenticated: true,
        user: this.currentUser
      });
    }
    return res;
  }

  async resendOTP(email) {
    return ApiClient.resendOTP(email);
  }

  async login(username, password) {
    const res = await ApiClient.login(username, password);
    if (res.ok && res.data.user) {
      this.currentUser = res.data.user;
      this.isAuthenticated = true;
      this.isGuest = false;
      Storage.setItem('CURRENT_USER_PROFILE', this.currentUser);
      GlobalEvents.emit(EVENTS.AUTH_STATE_CHANGED, {
        isAuthenticated: true,
        user: this.currentUser
      });

      // Synchronize any queued offline scores
      ApiClient.flushPendingRuns().catch(() => {});
    }
    return res;
  }

  async logout() {
    await ApiClient.logout();
    this.currentUser = null;
    this.isAuthenticated = false;
    this.isGuest = true;
    Storage.removeItem('CURRENT_USER_PROFILE');
    GlobalEvents.emit(EVENTS.AUTH_STATE_CHANGED, {
      isAuthenticated: false,
      user: null
    });
    return { ok: true };
  }

  async updateProfile(profileData) {
    const res = await ApiClient.updateProfile(profileData);
    if (res.ok && res.data) {
      this.currentUser = res.data;
      Storage.setItem('CURRENT_USER_PROFILE', this.currentUser);
      GlobalEvents.emit(EVENTS.AUTH_STATE_CHANGED, {
        isAuthenticated: true,
        user: this.currentUser
      });
    }
    return res;
  }

  async changePassword(oldPassword, newPassword) {
    return ApiClient.changePassword(oldPassword, newPassword);
  }

  async requestPasswordReset(email) {
    return ApiClient.requestPasswordReset(email);
  }

  async confirmPasswordReset(email, otp, newPassword) {
    return ApiClient.confirmPasswordReset(email, otp, newPassword);
  }
}

export const AuthService = new AuthServiceClass();
