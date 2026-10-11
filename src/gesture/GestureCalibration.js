/**
 * AI Gesture Runner 3D - GestureCalibration
 * Calibrates neutral resting hand position, sensitivity deadzones, and motion thresholds.
 */

import { Storage } from '../services/StorageService.js';

export class GestureCalibration {
  constructor() {
    this.neutralX = 0.5;
    this.neutralY = 0.55;
    this.deadzoneX = 0.11;
    this.jumpVelocityThreshold = -0.55; // Upward delta
    this.jumpYThreshold = 0.32;        // Upper screen threshold
    this.slideDurationThreshold = 0.15; // Hold fist for 150ms

    this.samples = [];
    this.isCalibrating = false;

    this.loadSaved();
  }

  loadSaved() {
    const saved = Storage.getItem('GESTURE_CALIBRATION');
    if (saved) {
      this.neutralX = saved.neutralX ?? 0.5;
      this.neutralY = saved.neutralY ?? 0.55;
      this.deadzoneX = saved.deadzoneX ?? 0.11;
    }
  }

  setSensitivity(level) {
    if (level === 'high') {
      this.deadzoneX = 0.08;
      this.jumpVelocityThreshold = -0.45;
    } else if (level === 'low') {
      this.deadzoneX = 0.15;
      this.jumpVelocityThreshold = -0.70;
    } else { // medium
      this.deadzoneX = 0.11;
      this.jumpVelocityThreshold = -0.55;
    }
  }

  startCalibration() {
    this.samples = [];
    this.isCalibrating = true;
  }

  addSample(palmCenter) {
    if (!this.isCalibrating || !palmCenter) return;
    this.samples.push({ x: palmCenter.x, y: palmCenter.y });
  }

  finishCalibration() {
    this.isCalibrating = false;
    if (this.samples.length < 5) return false;

    const avgX = this.samples.reduce((a, b) => a + b.x, 0) / this.samples.length;
    const avgY = this.samples.reduce((a, b) => a + b.y, 0) / this.samples.length;

    this.neutralX = Math.max(0.3, Math.min(0.7, avgX));
    this.neutralY = Math.max(0.35, Math.min(0.75, avgY));

    Storage.setItem('GESTURE_CALIBRATION', {
      neutralX: this.neutralX,
      neutralY: this.neutralY,
      deadzoneX: this.deadzoneX
    });

    console.log(`[GestureCalibration] Calibrated Neutral: X=${this.neutralX.toFixed(2)}, Y=${this.neutralY.toFixed(2)}`);
    return true;
  }
}

export const Calibration = new GestureCalibration();
