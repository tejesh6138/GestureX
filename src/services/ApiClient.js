/**
 * AI Gesture Runner 3D - ApiClient
 * Contract abstraction for future REST API backend communication.
 * Offline-first design: cleanly indicates backend availability without breaking frontend.
 */

import { ENVIRONMENT } from '../config/environment.js';

export class ApiClientClass {
  constructor() {
    this.baseUrl = ENVIRONMENT.API.BASE_URL;
    this.isEnabled = ENVIRONMENT.API.ENABLED;
  }

  isBackendConnected() {
    return this.isEnabled;
  }

  async submitScore(runResult) {
    if (!this.isEnabled) {
      return {
        success: false,
        offline: true,
        message: 'Cloud leaderboards are currently unavailable. Score saved locally.'
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}${ENVIRONMENT.API.ENDPOINTS.SCORES}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(runResult)
      });
      return await response.json();
    } catch (err) {
      console.warn('[ApiClient] Failed to submit score to remote server:', err);
      return { success: false, offline: true, error: err.message };
    }
  }

  async fetchLeaderboard() {
    if (!this.isEnabled) {
      return {
        available: false,
        entries: [],
        message: 'Global Cloud Leaderboard requires backend server connection. Running in local standalone mode.'
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}${ENVIRONMENT.API.ENDPOINTS.LEADERBOARD}`);
      const data = await response.json();
      return {
        available: true,
        entries: data.entries || [],
        message: 'Global Leaderboard fetched successfully.'
      };
    } catch (err) {
      return {
        available: false,
        entries: [],
        message: 'Network error connecting to Leaderboard server.'
      };
    }
  }
}

export const ApiClient = new ApiClientClass();
