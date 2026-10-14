/**
 * AI Gesture Runner 3D - QualityManager
 * Autonomous Adaptive Graphics Quality Controller with hysteresis:
 * - Supports 5 quality tiers: MAX_4K, ULTRA, HIGH, BALANCED, PERFORMANCE.
 * - Targets minimum 1080p Full HD on capable hardware, scaling up to 4K UHD.
 * - Dynamically balances visual fidelity, pixel ratio, shadow map cost,
 *   and particle volume to sustain target 60-120 FPS on all hardware.
 */

import { GlobalEvents, EVENTS } from '../core/EventBus.js';
import { Settings } from './SettingsService.js';

export const QUALITY_TIERS = {
  MAX_4K: 'MAX_4K',
  ULTRA: 'ULTRA',
  HIGH: 'HIGH',
  BALANCED: 'BALANCED',
  PERFORMANCE: 'PERFORMANCE'
};

export class QualityManager {
  constructor() {
    this.currentTier = QUALITY_TIERS.HIGH;
    this.mode = 'auto'; // 'auto' (adaptive) or 'manual'
    this.world = null;
    this.perfMonitor = null;
    this.lastTierChangeTime = performance.now();
    this.COOLDOWN_MS = 2500; // Minimum time between quality tier shifts (prevents rapid toggling)

    this.initFromSettings();
  }

  initFromSettings() {
    const saved = Settings.get('graphicsQuality') || 'auto';
    if (saved === 'auto') {
      this.mode = 'auto';
      // Detect initial capability hint: mobile starts in BALANCED, desktop in HIGH (1080p target)
      const isMobile = typeof window !== 'undefined' && (
        window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
      );
      this.currentTier = isMobile ? QUALITY_TIERS.BALANCED : QUALITY_TIERS.HIGH;
    } else if (saved === '4k') {
      this.mode = 'manual';
      this.currentTier = QUALITY_TIERS.MAX_4K;
    } else if (saved === 'ultra') {
      this.mode = 'manual';
      this.currentTier = QUALITY_TIERS.ULTRA;
    } else if (saved === 'high') {
      this.mode = 'manual';
      this.currentTier = QUALITY_TIERS.HIGH;
    } else if (saved === 'medium') {
      this.mode = 'manual';
      this.currentTier = QUALITY_TIERS.BALANCED;
    } else if (saved === 'low') {
      this.mode = 'manual';
      this.currentTier = QUALITY_TIERS.PERFORMANCE;
    }
  }

  bind({ world, perfMonitor, gameLoop = null }) {
    this.world = world;
    this.perfMonitor = perfMonitor;
    this.gameLoop = gameLoop;

    if (this.perfMonitor) {
      this.perfMonitor.setQualityTier(this.currentTier);
    }
    if (this.world && this.world.setQuality) {
      this.world.setQuality(this.currentTier);
    }
    this.tuneInferenceInterval(this.currentTier);

    GlobalEvents.on(EVENTS.SETTINGS_CHANGED, ({ key, value }) => {
      if (key === 'graphicsQuality') {
        this.onSettingChanged(value);
      }
    });
  }

  tuneInferenceInterval(tier) {
    if (!this.gameLoop || !this.gameLoop.setInferenceInterval) return;
    if (tier === QUALITY_TIERS.MAX_4K || tier === QUALITY_TIERS.ULTRA || tier === QUALITY_TIERS.HIGH) {
      this.gameLoop.setInferenceInterval(16.6); // Target 60 FPS inference on capable hardware
    } else if (tier === QUALITY_TIERS.BALANCED) {
      this.gameLoop.setInferenceInterval(22); // Target ~45 FPS on balanced hardware
    } else if (tier === QUALITY_TIERS.PERFORMANCE) {
      this.gameLoop.setInferenceInterval(33); // Target ~30 FPS on constrained mobile
    }
  }

  onSettingChanged(value) {
    if (value === 'auto') {
      this.mode = 'auto';
      const isMobile = typeof window !== 'undefined' && (
        window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
      );
      this.applyTier(isMobile ? QUALITY_TIERS.BALANCED : QUALITY_TIERS.HIGH);
    } else {
      this.mode = 'manual';
      if (value === '4k') this.applyTier(QUALITY_TIERS.MAX_4K);
      else if (value === 'ultra') this.applyTier(QUALITY_TIERS.ULTRA);
      else if (value === 'high') this.applyTier(QUALITY_TIERS.HIGH);
      else if (value === 'medium') this.applyTier(QUALITY_TIERS.BALANCED);
      else if (value === 'low') this.applyTier(QUALITY_TIERS.PERFORMANCE);
    }
  }

  /**
   * Called periodically from the main loop to evaluate adaptive performance.
   * @param {number} now
   */
  update(now = performance.now()) {
    if (this.mode !== 'auto' || !this.perfMonitor) return;

    const recommendation = this.perfMonitor.getAdaptiveRecommendation();

    // Critical Emergency Recovery: immediate shift to PERFORMANCE tier
    if (recommendation === 'EMERGENCY_DOWNGRADE') {
      if (this.perfMonitor.consumeRecommendation) this.perfMonitor.consumeRecommendation();
      if (this.currentTier !== QUALITY_TIERS.PERFORMANCE) {
        this.applyTier(QUALITY_TIERS.PERFORMANCE, now);
      }
      return;
    }

    // Standard adjustments respect hysteresis cooldown
    if (now - this.lastTierChangeTime < this.COOLDOWN_MS) return;

    if (recommendation === 'DOWNGRADE') {
      if (this.perfMonitor.consumeRecommendation) this.perfMonitor.consumeRecommendation();
      if (this.currentTier === QUALITY_TIERS.MAX_4K) {
        this.applyTier(QUALITY_TIERS.ULTRA, now);
      } else if (this.currentTier === QUALITY_TIERS.ULTRA) {
        this.applyTier(QUALITY_TIERS.HIGH, now);
      } else if (this.currentTier === QUALITY_TIERS.HIGH) {
        this.applyTier(QUALITY_TIERS.BALANCED, now);
      } else if (this.currentTier === QUALITY_TIERS.BALANCED) {
        this.applyTier(QUALITY_TIERS.PERFORMANCE, now);
      }
    } else if (recommendation === 'UPGRADE') {
      if (this.perfMonitor.consumeRecommendation) this.perfMonitor.consumeRecommendation();
      if (this.currentTier === QUALITY_TIERS.PERFORMANCE) {
        this.applyTier(QUALITY_TIERS.BALANCED, now);
      } else if (this.currentTier === QUALITY_TIERS.BALANCED) {
        this.applyTier(QUALITY_TIERS.HIGH, now);
      }
    }
  }

  applyTier(tier, timestamp = performance.now()) {
    if (this.currentTier === tier && this.lastTierChangeTime > 0) return;

    this.currentTier = tier;
    this.lastTierChangeTime = timestamp;

    if (this.perfMonitor) {
      this.perfMonitor.setQualityTier(tier);
    }

    if (this.world && this.world.setQuality) {
      this.world.setQuality(tier);
    }

    this.tuneInferenceInterval(tier);

    GlobalEvents.emit('QUALITY_TIER_CHANGED', { tier, mode: this.mode });
    console.log(`[QualityManager] Quality Tier set to: ${tier} (Mode: ${this.mode})`);
  }

  getTier() {
    return this.currentTier;
  }

  getMode() {
    return this.mode;
  }
}

export const Quality = new QualityManager();
