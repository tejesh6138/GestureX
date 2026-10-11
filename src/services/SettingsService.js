/**
 * AI Gesture Runner 3D - SettingsService
 * Persisted player settings for audio, graphics, and gesture sensitivity.
 */

import { Storage } from './StorageService.js';
import { GlobalEvents, EVENTS } from '../core/EventBus.js';
import { Sound } from './SoundService.js';

export class SettingsService {
  constructor() {
    this.defaultSettings = {
      graphicsQuality: 'high',   // 'high', 'medium', 'low'
      bgmVolume: 0.45,
      sfxVolume: 0.7,
      isMuted: false,
      gestureSensitivity: 'medium', // 'low', 'medium', 'high'
      showPipCamera: true,
      hasCompletedTutorial: false
    };

    this.settings = Storage.getItem('SETTINGS', this.defaultSettings);
    // Apply initial sound settings
    Sound.setMuted(this.settings.isMuted);
    Sound.setBgmVolume(this.settings.bgmVolume);
    Sound.setSfxVolume(this.settings.sfxVolume);
  }

  get(key) {
    return this.settings[key] ?? this.defaultSettings[key];
  }

  getAll() {
    return { ...this.settings };
  }

  set(key, value) {
    this.settings[key] = value;
    Storage.setItem('SETTINGS', this.settings);

    if (key === 'isMuted') Sound.setMuted(value);
    if (key === 'bgmVolume') Sound.setBgmVolume(value);
    if (key === 'sfxVolume') Sound.setSfxVolume(value);

    GlobalEvents.emit(EVENTS.SETTINGS_CHANGED, { key, value, settings: this.settings });
  }

  updateAll(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    Storage.setItem('SETTINGS', this.settings);
    GlobalEvents.emit(EVENTS.SETTINGS_CHANGED, { settings: this.settings });
  }
}

export const Settings = new SettingsService();
