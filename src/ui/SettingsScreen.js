/**
 * AI Gesture Runner 3D - SettingsScreen
 * Controls graphics quality, sensitivity, audio volumes, and local data reset.
 */

import { Settings } from '../services/SettingsService.js';
import { Calibration } from '../gesture/GestureCalibration.js';
import { Storage } from '../services/StorageService.js';
import { Sound } from '../services/SoundService.js';

export class SettingsScreen {
  constructor(container, onAction) {
    this.container = container;
    this.onAction = onAction;
    this.element = null;

    this.build();
  }

  build() {
    this.element = document.createElement('div');
    this.element.id = 'settings-screen';
    this.element.className = 'screen-overlay hidden';

    const current = Settings.getAll();

    this.element.innerHTML = `
      <div class="settings-content glass-card">
        <h2 class="section-title">GAME <span class="neon-accent">SETTINGS</span></h2>

        <div class="settings-list">
          <!-- Gesture Sensitivity -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Gesture Sensitivity</span>
              <span class="setting-desc">Adjust lateral deadzones and movement response</span>
            </div>
            <div class="setting-ctrl">
              <select id="set-sensitivity" class="select-input">
                <option value="low" ${current.gestureSensitivity === 'low' ? 'selected' : ''}>Low (Relaxed)</option>
                <option value="medium" ${current.gestureSensitivity === 'medium' ? 'selected' : ''}>Medium (Balanced)</option>
                <option value="high" ${current.gestureSensitivity === 'high' ? 'selected' : ''}>High (Fast Twitch)</option>
              </select>
            </div>
          </div>

          <!-- Graphics Quality -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Graphics Quality</span>
              <span class="setting-desc">Resolution target, shadows, materials, and textures</span>
            </div>
            <div class="setting-ctrl">
              <select id="set-graphics" class="select-input">
                <option value="auto" ${current.graphicsQuality === 'auto' || !current.graphicsQuality ? 'selected' : ''}>Auto (Adaptive 60–120 FPS)</option>
                <option value="4k" ${current.graphicsQuality === '4k' ? 'selected' : ''}>Maximum / 4K UHD (3840 × 2160)</option>
                <option value="ultra" ${current.graphicsQuality === 'ultra' ? 'selected' : ''}>Ultra / Quad HD (2560 × 1440)</option>
                <option value="high" ${current.graphicsQuality === 'high' ? 'selected' : ''}>High / Full HD (1920 × 1080)</option>
                <option value="medium" ${current.graphicsQuality === 'medium' ? 'selected' : ''}>Balanced / 1080p (Optimized)</option>
                <option value="low" ${current.graphicsQuality === 'low' ? 'selected' : ''}>Performance (Battery Saver)</option>
              </select>
            </div>
          </div>

          <!-- BGM Volume -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Music Volume (BGM)</span>
              <span class="setting-desc">Procedural cyberpunk synthwave soundtrack</span>
            </div>
            <div class="setting-ctrl">
              <input type="range" id="set-bgm" min="0" max="1" step="0.05" value="${current.bgmVolume}" class="range-input">
            </div>
          </div>

          <!-- SFX Volume -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Sound Effects (SFX)</span>
              <span class="setting-desc">Jump, slide, coin chime, collision audio</span>
            </div>
            <div class="setting-ctrl">
              <input type="range" id="set-sfx" min="0" max="1" step="0.05" value="${current.sfxVolume}" class="range-input">
            </div>
          </div>

          <!-- PIP Camera Visibility -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Show In-Game Camera Preview</span>
              <span class="setting-desc">Display skeleton tracking PIP canvas during runs</span>
            </div>
            <div class="setting-ctrl">
              <input type="checkbox" id="set-pip" ${current.showPipCamera ? 'checked' : ''} class="toggle-input">
            </div>
          </div>

          <!-- Reset Data -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Reset Local Data</span>
              <span class="setting-desc">Clear high scores, records, and achievements</span>
            </div>
            <div class="setting-ctrl">
              <button id="btn-reset-data" class="btn btn-danger btn-sm">RESET DATA</button>
            </div>
          </div>
        </div>

        <div class="settings-actions">
          <button id="btn-settings-back" class="btn btn-primary">
            ⬅ BACK TO MENU
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);
    this.bindEvents();
  }

  bindEvents() {
    this.element.querySelector('#set-sensitivity').onchange = (e) => {
      Settings.set('gestureSensitivity', e.target.value);
      Calibration.setSensitivity(e.target.value);
    };

    this.element.querySelector('#set-graphics').onchange = (e) => {
      Settings.set('graphicsQuality', e.target.value);
    };

    this.element.querySelector('#set-bgm').oninput = (e) => {
      Settings.set('bgmVolume', parseFloat(e.target.value));
    };

    this.element.querySelector('#set-sfx').oninput = (e) => {
      Settings.set('sfxVolume', parseFloat(e.target.value));
      Sound.playClick();
    };

    this.element.querySelector('#set-pip').onchange = (e) => {
      Settings.set('showPipCamera', e.target.checked);
    };

    this.element.querySelector('#btn-reset-data').onclick = () => {
      if (confirm('Are you sure you want to clear all high scores and local records?')) {
        Storage.clearAllGameData();
        location.reload();
      }
    };

    this.element.querySelector('#btn-settings-back').onclick = () => {
      Sound.playClick();
      this.onAction('BACK');
    };
  }

  show() {
    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
  }
}
