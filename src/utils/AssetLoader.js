/**
 * AI Gesture Runner 3D - AssetLoader
 * High-Performance Procedural Ultra-HD Texture Generator:
 * - Generates crisp 1024px & 512px canvas textures with linear mipmaps and anisotropic filtering.
 * - 100% self-contained: zero external network dependency, zero broken CDN URLs, zero missing asset errors.
 * - Perfectly tailored to the bright futuristic Sky City aesthetic and GestureX streetwear brand.
 */

import * as THREE from 'three';

export class AssetLoader {
  constructor() {
    this.textures = new Map();
    this.maxAnisotropy = 8;
  }

  setMaxAnisotropy(val) {
    this.maxAnisotropy = Math.max(1, Math.min(16, val || 8));
    this.textures.forEach((tex) => {
      tex.anisotropy = this.maxAnisotropy;
      tex.needsUpdate = true;
    });
  }

  _createCanvas(w, h) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  _dummyTexture(key, rx = 1, ry = 1) {
    const dummy = new THREE.Texture();
    this._configureTexture(dummy, rx, ry);
    this.textures.set(key, dummy);
    return dummy;
  }

  /**
   * Helper: Standardizes texture parameters for high-definition WebGL rendering
   */
  _configureTexture(texture, repeatX = 1, repeatY = 1) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = this.maxAnisotropy;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Ultra-HD Crushed Ballast Gravel Track Bed Texture (1024x1024)
   * High-frequency stone detailing with Sky City pale blue and quartz-grey speckles.
   */
  getTrackBallastTexture() {
    if (this.textures.has('ballast')) return this.textures.get('ballast');

    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base light ballast stone bed
    ctx.fillStyle = '#C2D4E5';
    ctx.fillRect(0, 0, size, size);

    // Procedural multi-frequency crushed stone speckles
    const seed = 12345;
    let s = seed;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    // Layer 1: Medium gravel stones (soft shadows and highlights)
    for (let i = 0; i < 4000; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 3 + rnd() * 6;
      const tone = rnd();

      if (tone < 0.35) {
        ctx.fillStyle = '#A8BECE'; // Shadowed pebble
      } else if (tone < 0.7) {
        ctx.fillStyle = '#D6E4F0'; // Sunlit quartz pebble
      } else if (tone < 0.85) {
        ctx.fillStyle = '#8FA8BE'; // Deep crevice
      } else {
        ctx.fillStyle = '#E8F1F8'; // Bright crystalline grain
      }

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Layer 2: Fine sharp granite grit
    ctx.fillStyle = 'rgba(70, 95, 120, 0.45)';
    for (let i = 0; i < 6000; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // Layer 3: Subtle directional rail bed compaction lines
    ctx.strokeStyle = 'rgba(160, 185, 205, 0.35)';
    ctx.lineWidth = 2;
    for (let y = 0; y < size; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y + (rnd() - 0.5) * 6);
      ctx.lineTo(size, y + (rnd() - 0.5) * 6);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    this._configureTexture(texture, 1, 8);
    this.textures.set('ballast', texture);
    return texture;
  }

  /**
   * Railway Sleeper (Tie) Texture (512x512)
   * Weathered hardwood/concrete tie with steel fastener base plates and bolt heads.
   */
  getSleeperTexture() {
    if (this.textures.has('sleeper')) return this.textures.get('sleeper');

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Rich teak wood / treated timber base
    ctx.fillStyle = '#5A3D31';
    ctx.fillRect(0, 0, size, size);

    // Wood grain lines
    ctx.fillStyle = '#4A3127';
    for (let y = 0; y < size; y += 4) {
      const wave = Math.sin(y * 0.05) * 8;
      ctx.fillRect(0, y, size, 1.5 + Math.sin(y * 0.1) * 0.8);
    }

    // Edge bevel shadow
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, 'rgba(20, 10, 5, 0.5)');
    grad.addColorStop(0.08, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.92, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(20, 10, 5, 0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Left and Right heavy steel rail fastener plates
    const plateWidth = 90;
    const plateHeight = size * 0.7;
    const plateY = (size - plateHeight) / 2;

    const drawPlate = (px) => {
      // Dark cast steel plate
      ctx.fillStyle = '#263238';
      ctx.fillRect(px, plateY, plateWidth, plateHeight);

      // Plate bevel highlight
      ctx.strokeStyle = '#455A64';
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 1, plateY + 1, plateWidth - 2, plateHeight - 2);

      // 4 Heavy Hex Bolts
      ctx.fillStyle = '#78909C';
      const boltR = 7;
      const bolts = [
        [px + 18, plateY + 25],
        [px + plateWidth - 18, plateY + 25],
        [px + 18, plateY + plateHeight - 25],
        [px + plateWidth - 18, plateY + plateHeight - 25]
      ];
      bolts.forEach(([bx, by]) => {
        ctx.beginPath();
        ctx.arc(bx, by, boltR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1A2327';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Rail mounting groove in plate center
      ctx.fillStyle = '#1A2327';
      ctx.fillRect(px + plateWidth / 2 - 10, plateY, 20, plateHeight);
    };

    drawPlate(60);
    drawPlate(size - 60 - plateWidth);

    const texture = new THREE.CanvasTexture(canvas);
    this._configureTexture(texture, 1, 1);
    this.textures.set('sleeper', texture);
    return texture;
  }

  /**
   * Razor-Sharp 45-degree Diagonal Hazard Warning Stripes (512x128)
   * High-visibility golden yellow and dark charcoal stripes for curbs and obstacles.
   */
  getHazardStripeTexture() {
    if (this.textures.has('hazard_stripe')) return this.textures.get('hazard_stripe');

    const w = 512;
    const h = 128;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Vibrant safety yellow background
    ctx.fillStyle = '#FFD34E';
    ctx.fillRect(0, 0, w, h);

    // Deep slate black diagonal 45° warning stripes
    ctx.fillStyle = '#1E252B';
    const stripeWidth = 32;
    for (let x = -h; x < w + h; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth + h, h);
      ctx.lineTo(x + h, h);
      ctx.closePath();
      ctx.fill();
    }

    // Top and bottom edge bevel lines for 3D depth
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(0, 0, w, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, h - 3, w, 3);

    const texture = new THREE.CanvasTexture(canvas);
    this._configureTexture(texture, 8, 1);
    this.textures.set('hazard_stripe', texture);
    return texture;
  }

  /**
   * High-Rise Modern Architecture Building Facades (1024x1024)
   * Creates realistic curtain wall glass grids, window mullions, and illuminated interior lights.
   * @param {number} style 0 = Glass Curtain Wall, 1 = Futuristic White Tower, 2 = Luxury High-Rise
   */
  getBuildingFacadeTexture(style = 0) {
    const key = `facade_${style}`;
    if (this.textures.has(key)) return this.textures.get(key);

    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (style === 0) {
      // Style 0: Modern Sky Blue Glass Curtain Wall Tower
      ctx.fillStyle = '#E8F4FC';
      ctx.fillRect(0, 0, size, size);

      const cols = 8;
      const rows = 16;
      const colW = size / cols;
      const rowH = size / rows;
      const mullion = 4;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * colW;
          const y = r * rowH;

          // Mullion Frame
          ctx.fillStyle = '#0D47A1';
          ctx.fillRect(x, y, colW, rowH);

          // Reflective Glass Pane
          const glassGrad = ctx.createLinearGradient(x, y, x + colW, y + rowH);
          const rand = Math.sin(c * 17 + r * 31);
          if (rand > 0.45) {
            // Sunlit sky reflection
            glassGrad.addColorStop(0, '#5AB2FF');
            glassGrad.addColorStop(0.5, '#78C4FF');
            glassGrad.addColorStop(1, '#A0D8FF');
          } else if (rand > -0.3) {
            // Deep reflective glass
            glassGrad.addColorStop(0, '#008BFF');
            glassGrad.addColorStop(1, '#5AB2FF');
          } else {
            // Interior office light glow
            glassGrad.addColorStop(0, '#FFE8A3');
            glassGrad.addColorStop(1, '#FFD34E');
          }

          ctx.fillStyle = glassGrad;
          ctx.fillRect(x + mullion, y + mullion, colW - mullion * 2, rowH - mullion * 2);

          // Glass pane specular sheen
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.moveTo(x + mullion, y + mullion);
          ctx.lineTo(x + colW * 0.6, y + mullion);
          ctx.lineTo(x + mullion, y + rowH * 0.6);
          ctx.closePath();
          ctx.fill();
        }
      }
    } else if (style === 1) {
      // Style 1: Ultra-Clean Futuristic White Ceramic Tower with Sky-Blue Ribbon Windows
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      // Horizontal floor plates with ribbon glass windows
      const floors = 12;
      const floorH = size / floors;

      for (let f = 0; f < floors; f++) {
        const fy = f * floorH;

        // White architectural panel joints
        ctx.fillStyle = '#E1E8ED';
        ctx.fillRect(0, fy, size, 3);

        // Ribbon window bank
        const winY = fy + floorH * 0.32;
        const winH = floorH * 0.46;

        ctx.fillStyle = '#1A2938';
        ctx.fillRect(0, winY, size, winH);

        // Window mullions and panes
        const panes = 10;
        const pW = size / panes;
        for (let p = 0; p < panes; p++) {
          const px = p * pW;
          const glassGrad = ctx.createLinearGradient(px, winY, px + pW, winY + winH);
          glassGrad.addColorStop(0, '#008BFF');
          glassGrad.addColorStop(1, '#63C5FF');
          ctx.fillStyle = glassGrad;
          ctx.fillRect(px + 3, winY + 2, pW - 6, winH - 4);
        }

        // Orange / Red architectural accent strip on select floors
        if (f % 3 === 0) {
          ctx.fillStyle = '#FF6B4A';
          ctx.fillRect(0, fy + floorH - 6, size, 4);
        }
      }
    } else {
      // Style 2: High-Tech City Spire with Illuminated LED Bands & Terraces
      ctx.fillStyle = '#1A1D20';
      ctx.fillRect(0, 0, size, size);

      const rows = 14;
      const rowH = size / rows;
      for (let r = 0; r < rows; r++) {
        const y = r * rowH;

        // Dark anodized aluminum panel
        ctx.fillStyle = '#2C3238';
        ctx.fillRect(0, y + 2, size, rowH - 4);

        // Horizontal cyan architectural illumination strip
        ctx.fillStyle = '#00F0FF';
        ctx.fillRect(0, y + rowH - 4, size, 3);

        // Individual window cubes
        const wins = 8;
        const wW = size / wins;
        for (let w = 0; w < wins; w++) {
          const wx = w * wW;
          ctx.fillStyle = Math.sin(w * 13 + r * 7) > 0 ? '#FFD34E' : '#3FA5FF';
          ctx.fillRect(wx + 12, y + 10, wW - 24, rowH - 24);
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    this._configureTexture(texture, 1, 2);
    this.textures.set(key, texture);
    return texture;
  }

  /**
   * Aerodynamic Modern High-Speed Express Train Texture (1024x512)
   * High-gloss sky blue livery, yellow aerodynamic dart stripe, panoramic tinted windows,
   * LED destination matrix signboard "SKYWAY EXPRESS", and passenger compartment silhouettes.
   */
  getTrainExteriorTexture() {
    if (this.textures.has('train_livery')) return this.textures.get('train_livery');

    const w = 1024;
    const h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // High-Gloss Radiant Sky-Blue Livery
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#008BFF');
    bgGrad.addColorStop(0.5, '#29B6F6');
    bgGrad.addColorStop(1, '#0065BD');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Dynamic Sweeping Aerodynamic Sunny-Yellow Racing Stripe
    ctx.fillStyle = '#FFD34E';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62);
    ctx.lineTo(w, h * 0.58);
    ctx.lineTo(w, h * 0.68);
    ctx.lineTo(0, h * 0.72);
    ctx.closePath();
    ctx.fill();

    // Red Accent Trim Line
    ctx.fillStyle = '#FF453A';
    ctx.fillRect(0, h * 0.72, w, 8);

    // Continuous Dark Tinted Panoramic Window Band
    const winY = h * 0.22;
    const winH = h * 0.32;
    ctx.fillStyle = '#111822';
    ctx.fillRect(0, winY, w, winH);

    // Individual Window Panes with Sun Reflection
    const numWindows = 8;
    const winWidth = w / numWindows;
    for (let i = 0; i < numWindows; i++) {
      const wx = i * winWidth + 8;
      const curW = winWidth - 16;

      const paneGrad = ctx.createLinearGradient(wx, winY, wx + curW, winY + winH);
      paneGrad.addColorStop(0, '#1E3854');
      paneGrad.addColorStop(0.6, '#3A74A6');
      paneGrad.addColorStop(1, '#569DD6');

      ctx.fillStyle = paneGrad;
      ctx.fillRect(wx, winY + 4, curW, winH - 8);

      // Specular highlight across glass
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.moveTo(wx, winY + 4);
      ctx.lineTo(wx + curW * 0.5, winY + 4);
      ctx.lineTo(wx, winY + winH * 0.6);
      ctx.closePath();
      ctx.fill();

      // Passenger seat silhouette
      ctx.fillStyle = 'rgba(15, 25, 35, 0.65)';
      ctx.beginPath();
      ctx.arc(wx + curW * 0.5, winY + winH * 0.45, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Illuminated LED Destination Signboard
    const signX = w * 0.08;
    const signY = h * 0.08;
    const signW = w * 0.42;
    const signH = h * 0.10;

    ctx.fillStyle = '#050B14';
    ctx.fillRect(signX, signY, signW, signH);
    ctx.strokeStyle = '#FFD34E';
    ctx.lineWidth = 2;
    ctx.strokeRect(signX, signY, signW, signH);

    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FFD34E';
    ctx.shadowColor = '#FFD34E';
    ctx.shadowBlur = 8;
    ctx.fillText('SKYWAY EXPRESS • L1', signX + 16, signY + 28);
    ctx.shadowBlur = 0;

    // Heavy Train Bogie / Undercarriage Skirt
    ctx.fillStyle = '#14181C';
    ctx.fillRect(0, h * 0.85, w, h * 0.15);

    const texture = new THREE.CanvasTexture(canvas);
    this._configureTexture(texture, 1, 1);
    this.textures.set('train_livery', texture);
    return texture;
  }

  /**
   * Ultra-HD Golden Coin Face Texture (512x512)
   * Detailed radial coin notches, concentric ring embossing, and high-shine star emblem.
   */
  getCoinFaceTexture() {
    if (this.textures.has('coin_face')) return this.textures.get('coin_face');

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;

    // Radial gold background
    const bgGrad = ctx.createRadialGradient(c, c, 20, c, c, c);
    bgGrad.addColorStop(0, '#FFF5A5');
    bgGrad.addColorStop(0.5, '#FFD34E');
    bgGrad.addColorStop(0.85, '#FFA000');
    bgGrad.addColorStop(1, '#D97706');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // Milled Outer Rim Notches (48 serrations)
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 4;
    const numNotches = 48;
    for (let i = 0; i < numNotches; i++) {
      const angle = (i / numNotches) * Math.PI * 2;
      const x1 = c + Math.cos(angle) * (c - 16);
      const y1 = c + Math.sin(angle) * (c - 16);
      const x2 = c + Math.cos(angle) * (c - 3);
      const y2 = c + Math.sin(angle) * (c - 3);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Inner Embossed Raised Concentric Rings
    ctx.strokeStyle = '#FFFBEB';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(c, c, c - 24, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(c, c, c - 30, 0, Math.PI * 2);
    ctx.stroke();

    // Center Star Core
    const starR = 120;
    const innerR = 50;
    ctx.fillStyle = '#FFFBEB';
    ctx.shadowColor = '#FFE082';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? starR : innerR;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = c + Math.cos(a) * r;
      const y = c + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    const texture = new THREE.CanvasTexture(canvas);
    this._configureTexture(texture, 1, 1);
    this.textures.set('coin_face', texture);
    return texture;
  }

  /**
   * Streetwear Technical Hoodie & Jacket Fabric Texture (512x512)
   * High-resolution athletic diamond micro-weave, dual stitching seams, and GestureX crest.
   */
  getPlayerHoodieTexture() {
    if (this.textures.has('hoodie_fabric')) return this.textures.get('hoodie_fabric');

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Vibrant Red Base
    ctx.fillStyle = '#E53935';
    ctx.fillRect(0, 0, size, size);

    // Micro-weave diamond pattern
    ctx.fillStyle = 'rgba(180, 20, 20, 0.25)';
    const step = 8;
    for (let x = 0; x < size; x += step) {
      for (let y = 0; y < size; y += step) {
        if ((x / step + y / step) % 2 === 0) {
          ctx.fillRect(x, y, step / 2, step / 2);
        }
      }
    }

    // Fabric Highlight
    ctx.fillStyle = 'rgba(255, 120, 120, 0.15)';
    for (let x = step / 2; x < size; x += step) {
      for (let y = step / 2; y < size; y += step) {
        if ((x / step + y / step) % 2 === 1) {
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    // Dual-Needle Topstitching Seam Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(32, 0);
    ctx.lineTo(32, size);
    ctx.moveTo(38, 0);
    ctx.lineTo(38, size);
    ctx.moveTo(size - 32, 0);
    ctx.lineTo(size - 32, size);
    ctx.moveTo(size - 38, 0);
    ctx.lineTo(size - 38, size);
    ctx.stroke();
    ctx.setLineDash([]);

    const texture = new THREE.CanvasTexture(canvas);
    this._configureTexture(texture, 2, 2);
    this.textures.set('hoodie_fabric', texture);
    return texture;
  }

  /**
   * Streetwear Skate Sneaker Texture (512x512)
   * High-contrast vulcanized rubber cupsole texture with tread grip pattern.
   */
  getSneakerSoleTexture() {
    if (this.textures.has('sneaker_sole')) return this.textures.get('sneaker_sole');

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    // Hexagonal / waffle skate tread pattern
    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 3;
    const step = 24;
    for (let x = 0; x < size; x += step) {
      for (let y = 0; y < size; y += step) {
        ctx.strokeRect(x + 2, y + 2, step - 4, step - 4);
      }
    }

    // Red racing accent foxing stripe along sole perimeter
    ctx.fillStyle = '#E53935';
    ctx.fillRect(0, size - 32, size, 16);

    const texture = new THREE.CanvasTexture(canvas);
    this._configureTexture(texture, 1, 1);
    this.textures.set('sneaker_sole', texture);
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
    grad.addColorStop(0.6, 'rgba(255, 211, 78, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    this.textures.set('particle', texture);
    return texture;
  }
}

export const Assets = new AssetLoader();
