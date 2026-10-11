/**
 * AI Gesture Runner 3D - StorageService
 * Versioned local storage abstraction with migration support and defensive validation.
 */

import { ENVIRONMENT } from '../config/environment.js';

export class StorageService {
  constructor() {
    this.prefix = ENVIRONMENT.STORAGE_KEY_PREFIX;
    this.schemaVersion = 1;
    this.initSchema();
  }

  getKey(key) {
    return `${this.prefix}${key}`;
  }

  initSchema() {
    try {
      const storedVer = localStorage.getItem(this.getKey('SCHEMA_VER'));
      if (!storedVer) {
        localStorage.setItem(this.getKey('SCHEMA_VER'), String(this.schemaVersion));
      }
    } catch (e) {
      console.warn('[StorageService] LocalStorage not available or restricted:', e);
    }
  }

  getItem(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(this.getKey(key));
      if (raw === null || raw === undefined) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.error(`[StorageService] Failed to read key "${key}":`, e);
      return defaultValue;
    }
  }

  setItem(key, value) {
    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[StorageService] Failed to write key "${key}":`, e);
      return false;
    }
  }

  removeItem(key) {
    try {
      localStorage.removeItem(this.getKey(key));
    } catch (e) {
      console.error(`[StorageService] Failed to remove key "${key}":`, e);
    }
  }

  clearAllGameData() {
    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.error('[StorageService] Clear failed:', e);
    }
  }
}

export const Storage = new StorageService();
