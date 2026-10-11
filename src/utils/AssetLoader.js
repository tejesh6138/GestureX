/**
 * AI Gesture Runner 3D - AssetLoader
 * Procedural texture and asset generator for 100% reliable, zero-asset-failure graphics.
 */

import * as THREE from 'three';

export class AssetLoader {
  constructor() {
    this.textures = new Map();
  }

  /**
   * Generates a sleek cyberpunk sci-fi grid texture for the railway/track
   */
  getGridTexture() {
    if (this.textures.has('grid')) return this.textures.get('grid');

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Deep dark cyber blue background
    ctx.fillStyle = '#070b19';
    ctx.fillRect(0, 0, size, size);

    // Glowing grid lines
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;

    const step = 64;
    for (let x = 0; x <= size; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }

    for (let y = 0; y <= size; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    // Inner subtle micro-dots
    ctx.fillStyle = '#ff007f';
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 4;
    for (let x = step / 2; x < size; x += step) {
      for (let y = step / 2; y < size; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.set('grid', texture);
    return texture;
  }

  /**
   * Glowing neon stripe for lane dividers
   */
  getNeonStripeTexture() {
    if (this.textures.has('neon_stripe')) return this.textures.get('neon_stripe');

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
    grad.addColorStop(0.3, 'rgba(0, 240, 255, 1)');
    grad.addColorStop(0.7, 'rgba(0, 240, 255, 1)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(16, 0, 32, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.textures.set('neon_stripe', texture);
    return texture;
  }

  /**
   * Soft glowing circular sprite for particle systems
   */
  getParticleTexture() {
    if (this.textures.has('particle')) return this.textures.get('particle');

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.25, 'rgba(0, 240, 255, 0.85)');
    grad.addColorStop(0.6, 'rgba(255, 0, 127, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    this.textures.set('particle', texture);
    return texture;
  }
}
