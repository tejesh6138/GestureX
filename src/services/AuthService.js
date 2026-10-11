/**
 * AI Gesture Runner 3D - AuthService
 * Authentication interface definition for future REST backend integration.
 * No mock credentials or fake logins are implemented in the initial frontend version.
 */

import { ENVIRONMENT } from '../config/environment.js';

export class AuthServiceClass {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
  }

  isAuthEnabled() {
    return ENVIRONMENT.API.ENABLED;
  }

  getCurrentUser() {
    return this.currentUser ? { ...this.currentUser } : null;
  }

  async login(username, password) {
    if (!this.isAuthEnabled()) {
      return {
        success: false,
        message: 'Account authentication is disabled in standalone frontend version.'
      };
    }
    // Interface ready for future REST API implementation
    return { success: false, message: 'Backend integration required.' };
  }

  async register(username, email, password) {
    if (!this.isAuthEnabled()) {
      return {
        success: false,
        message: 'Account registration is disabled in standalone frontend version.'
      };
    }
    // Interface ready for future REST API implementation
    return { success: false, message: 'Backend integration required.' };
  }

  async logout() {
    this.currentUser = null;
    this.isAuthenticated = false;
    return { success: true };
  }
}

export const AuthService = new AuthServiceClass();
