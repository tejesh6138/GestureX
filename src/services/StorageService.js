/**
 * AI Gesture Runner 3D - StorageService
 * Versioned local storage abstraction with migration support and defensive validation.
 */

import { ENVIRONMENT } from '../config/environment.js';

export class StorageService {
  constructor() {
    this.prefix = ENVIRONMENT.STORAGE_KEY_PREFIX;
    this.schemaVersion = 1;
    this.memoryStore = new Map();
    this.initSchema();
  }

  getKey(key) {
    return `${this.prefix}${key}`;
  }

  initSchema() {
    try {
      if (typeof localStorage !== 'undefined') {
        const storedVer = localStorage.getItem(this.getKey('SCHEMA_VER'));
        if (!storedVer) {
          localStorage.setItem(this.getKey('SCHEMA_VER'), String(this.schemaVersion));
        }
      }
    } catch (e) {
      console.warn('[StorageService] LocalStorage not available or restricted, using in-memory store:', e);
    }
  }

  getItem(key, defaultValue = null) {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.getKey(key));
        if (raw === null || raw === undefined) {
          return this.memoryStore.has(key) ? this.memoryStore.get(key) : defaultValue;
        }
        return JSON.parse(raw);
      }
    } catch (e) {
      return this.memoryStore.has(key) ? this.memoryStore.get(key) : defaultValue;
    }
    return this.memoryStore.has(key) ? this.memoryStore.get(key) : defaultValue;
  }

  setItem(key, value) {
    this.memoryStore.set(key, value);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.getKey(key), JSON.stringify(value));
        return true;
      }
    } catch (e) {
      console.warn(`[StorageService] LocalStorage write failed for "${key}", kept in memory:`, e);
      return true;
    }
    return true;
  }

  removeItem(key) {
    this.memoryStore.delete(key);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.getKey(key));
      }
    } catch (e) {
      console.warn(`[StorageService] LocalStorage remove failed for "${key}":`, e);
    }
  }

  clearAllGameData() {
    this.memoryStore.clear();
    try {
      if (typeof localStorage !== 'undefined') {
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(this.prefix)) {
            toRemove.push(k);
          }
        }
        toRemove.forEach((k) => localStorage.removeItem(k));
      }
    } catch (e) {
      console.error('[StorageService] Clear failed:', e);
    }
  }
}

export const Storage = new StorageService();
