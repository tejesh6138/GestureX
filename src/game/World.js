/**
 * AI Gesture Runner 3D - World
 * Ultra-HD Daylight Sky City Scene Controller:
 * - High-resolution rendering targeting 1080p Full HD minimum up to 3840x2160 (4K).
 * - Calibrated sRGB color space, ACES filmic tone mapping, and PCF soft shadow maps.
 * - Procedural architectural high-rise facades with realistic window reflections and roof crowns.
 * - Circular O(1) recycling of architecture and volumetric clouds without popping.
 * - Dynamic adaptive rendering quality controller with hysteresis.
 */

import * as THREE from 'three';
import { Assets } from '../utils/AssetLoader.js';
import { MathUtils } from '../utils/MathUtils.js';

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.qualityTier = 'HIGH';

    // Radiant Sky City Atmosphere: crisp sky blue with subtle horizon depth
    const skyColor = new THREE.Color(0xbfe7ff);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog(skyColor, 75, 290);

    // Renderer setup with Ultra-HD WebGL profile
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });

    // Explicit Modern Three.js Color Space & Tone Mapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    // High-Fidelity Soft Shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Calibrate maximum supported anisotropic filtering from GPU hardware
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    Assets.setMaxAnisotropy(maxAniso);

    this.setupLighting();
    this.setupSkyCity();
    this.setupClouds();
    this.setupSpeedSlipstreamStreaks();
    this.setupGroundEffectsParticles();

    this.resize();
  }

  setupLighting() {
    // 1. Warm daylight ambient light for natural diffuse fill
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    this.scene.add(this.ambientLight);

    // 2. Hemisphere light: soft azure sky above, gentle architectural ground bounce
    this.hemiLight = new THREE.HemisphereLight(0x8cd3ff, 0xeef7ff, 0.85);
    this.hemiLight.position.set(0, 60, 0);
    this.scene.add(this.hemiLight);

    // 3. Bright golden sunlight with high-resolution directional soft shadows
    this.sunLight = new THREE.DirectionalLight(0xfffaee, 2.25);
    this.sunLight.position.set(28, 55, 30);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 175;
    this.sunLight.shadow.camera.left = -28;
    this.sunLight.shadow.camera.right = 28;
    this.sunLight.shadow.camera.top = 28;
    this.sunLight.shadow.camera.bottom = -28;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    // 4. Soft sky blue fill light to balance shadow contrast
    this.fillLight = new THREE.DirectionalLight(0xb2dfff, 0.6);
    this.fillLight.position.set(-28, 32, -25);
    this.scene.add(this.fillLight);
  }

  setupSkyCity() {
    this.buildings = [];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const cylinderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);

    // Ultra-HD Architectural Materials with procedural facade textures
    const glassFacadeMat = new THREE.MeshStandardMaterial({
      map: Assets.getBuildingFacadeTexture(0),
      roughness: 0.18,
      metalness: 0.55
    });

    const whiteCeramicMat = new THREE.MeshStandardMaterial({
      map: Assets.getBuildingFacadeTexture(1),
      roughness: 0.28,
      metalness: 0.2
    });

    const highTechMat = new THREE.MeshStandardMaterial({
      map: Assets.getBuildingFacadeTexture(2),
      roughness: 0.35,
      metalness: 0.45
    });

    const rooftopAccentMat = new THREE.MeshStandardMaterial({
      color: 0xffd34e,
      roughness: 0.25,
      metalness: 0.4
    });

    const beaconLightMat = new THREE.MeshBasicMaterial({
      color: 0xff453a
    });

    const bridgeMat = new THREE.MeshStandardMaterial({
      color: 0x008bff,
      roughness: 0.3,
      metalness: 0.45
    });

    // Populate 48 dynamic high-rise towers along trackside
    this.buildingInterval = 11.0;
    const totalBuildings = 48;
    this.furthestBuildingZ = 0;

    for (let i = 0; i < totalBuildings; i++) {
      const bHeight = 45 + Math.random() * 95;
      const bWidth = 16 + Math.random() * 18;
      const bDepth = 16 + Math.random() * 22;
      const side = (i % 2 === 0) ? -1 : 1;
      const xDist = 26 + Math.random() * 42;
      const x = side * xDist;
      const z = 20 - i * this.buildingInterval;

      const building = new THREE.Group();

      // Alternate architectural facade styles
      let selectedMat = whiteCeramicMat;
      if (i % 3 === 0) selectedMat = glassFacadeMat;
      else if (i % 3 === 1) selectedMat = highTechMat;

      // Main tower body
      const tower = new THREE.Mesh(boxGeo, selectedMat);
      tower.scale.set(bWidth, bHeight, bDepth);
      tower.position.set(0, bHeight / 2 - 8, 0);

      if (xDist < 35) {
        tower.castShadow = true;
      }
      tower.receiveShadow = true;
      building.add(tower);

      // Rooftop architectural crown / communications spire
      if (i % 2 === 0) {
        // High-Tech rooftop communications mast with beacon
        const spire = new THREE.Mesh(cylinderGeo, rooftopAccentMat);
        spire.scale.set(1.4, 16, 1.4);
        spire.position.set(0, bHeight - 1, 0);
        building.add(spire);

        const beacon = new THREE.Mesh(boxGeo, beaconLightMat);
        beacon.scale.set(0.8, 0.8, 0.8);
        beacon.position.set(0, bHeight + 7, 0);
        building.add(beacon);
      } else {
        // Stepped rooftop penthouse crown
        const crown = new THREE.Mesh(boxGeo, glassFacadeMat);
        crown.scale.set(bWidth * 0.72, 8, bDepth * 0.72);
        crown.position.set(0, bHeight - 4, 0);
        building.add(crown);
      }

      // Overhead futuristic skybridge connecting select towers across the sky
      if (i % 8 === 0 && side === -1) {
        const skybridge = new THREE.Mesh(boxGeo, bridgeMat);
        skybridge.scale.set(70, 3.8, 6.5);
        skybridge.position.set(30, 26, 0);
        building.add(skybridge);
      }

      building.position.set(x, 0, z);
      this.scene.add(building);
      this.buildings.push(building);

      if (z < this.furthestBuildingZ) {
        this.furthestBuildingZ = z;
      }
    }

    // Hero Platform / Terminal for Main Menu scene
    this.menuPedestal = new THREE.Group();
    const pedGeo = new THREE.CylinderGeometry(0.58, 0.68, 0.92, 24);
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.15
    });
    const pedMesh = new THREE.Mesh(pedGeo, pedMat);
    pedMesh.position.y = 0.46;
    pedMesh.castShadow = true;
    this.menuPedestal.add(pedMesh);

    const pedTopGeo = new THREE.CylinderGeometry(0.64, 0.64, 0.08, 24);
    const pedTopMat = new THREE.MeshStandardMaterial({
      color: 0x5ab2ff,
      roughness: 0.12,
      metalness: 0.7
    });
    const pedTopMesh = new THREE.Mesh(pedTopGeo, pedTopMat);
    pedTopMesh.position.y = 0.94;
    this.menuPedestal.add(pedTopMesh);

    const pedHoloGeo = new THREE.BoxGeometry(0.5, 0.35, 0.04);
    const pedHoloMat = new THREE.MeshStandardMaterial({
      color: 0xffd34e,
      roughness: 0.25,
      metalness: 0.4
    });
    const pedHoloMesh = new THREE.Mesh(pedHoloGeo, pedHoloMat);
    pedHoloMesh.position.set(0, 1.16, 0);
    pedHoloMesh.rotation.x = -0.25;
    this.menuPedestal.add(pedHoloMesh);

    this.menuPedestal.position.set(1.5, 0, 0.3);
    this.scene.add(this.menuPedestal);
  }

  setupClouds() {
    this.clouds = [];
    this.cloudInterval = 22.0;
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.88
    });

    const sphereGeo = new THREE.SphereGeometry(1, 8, 8);
    const totalClouds = 18;
    this.furthestCloudZ = 0;

    for (let c = 0; c < totalClouds; c++) {
      const cluster = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 3);
      const baseScale = 10 + Math.random() * 12;

      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(sphereGeo, cloudMat);
        puff.scale.set(
          baseScale * (0.8 + Math.random() * 0.4),
          baseScale * (0.5 + Math.random() * 0.3),
          baseScale * (0.8 + Math.random() * 0.4)
        );
        puff.position.set(
          (p - puffs / 2) * (baseScale * 0.55),
          (Math.random() - 0.5) * (baseScale * 0.3),
          (Math.random() - 0.5) * (baseScale * 0.4)
        );
        cluster.add(puff);
      }

      const x = (Math.random() - 0.5) * 280;
      const y = 70 + Math.random() * 45;
      const z = 20 - c * this.cloudInterval;
      cluster.position.set(x, y, z);
      this.scene.add(cluster);
      this.clouds.push(cluster);

      if (z < this.furthestCloudZ) {
        this.furthestCloudZ = z;
      }
    }
  }

  setupSpeedSlipstreamStreaks() {
    const streakCount = 50;
    this.slipstreamGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(streakCount * 6);

    this.slipstreamData = [];
    for (let i = 0; i < streakCount; i++) {
      const side = (i % 2 === 0) ? -1 : 1;
      const x = side * (4.2 + Math.random() * 5.5);
      const y = 0.8 + Math.random() * 3.5;
      const zRel = -Math.random() * 70;
      const length = 2.8 + Math.random() * 4.0;

      this.slipstreamData.push({ x, y, zRel, length });

      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = zRel;

      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y;
      positions[i * 6 + 5] = zRel - length;
    }

    this.slipstreamGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.slipstreamMat = new THREE.LineBasicMaterial({
      color: 0x90e0ef,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });

    this.slipstreamLines = new THREE.LineSegments(this.slipstreamGeo, this.slipstreamMat);
    this.scene.add(this.slipstreamLines);
  }

  setupGroundEffectsParticles() {
    const pCount = 56;
    const pGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(pCount * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    this.groundParticleMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.20,
      transparent: true,
      opacity: 0,
      blending: THREE.NormalBlending
    });

    this.groundParticleSystem = new THREE.Points(pGeo, this.groundParticleMat);
    this.scene.add(this.groundParticleSystem);

    this.particles = [];
  }

  emitDustPuff(x, y, z, count = 4, spread = 0.2, upwards = 1.8) {
    if (this.qualityTier === 'PERFORMANCE' && Math.random() > 0.4) {
      return;
    }

    const actualCount = (this.qualityTier === 'MAX_4K' || this.qualityTier === 'ULTRA' || this.qualityTier === 'HIGH')
      ? count
      : Math.ceil(count * 0.6);

    for (let i = 0; i < actualCount; i++) {
      if (this.particles.length > 50) this.particles.shift();
      this.particles.push({
        x: x + (Math.random() - 0.5) * spread,
        y: y + Math.random() * 0.05,
        z: z + (Math.random() - 0.5) * spread,
        vx: (Math.random() - 0.5) * 1.5,
        vy: upwards + Math.random() * 1.2,
        vz: 3.5 + Math.random() * 2.5,
        life: 0.28,
        maxLife: 0.28
      });
    }
  }

  /**
   * Set Graphics Quality Tier
   * @param {'MAX_4K' | 'ULTRA' | 'HIGH' | 'BALANCED' | 'PERFORMANCE'} tier
   */
  setQuality(tier) {
    this.qualityTier = tier;

    if (tier === 'MAX_4K') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.autoUpdate = true;
      if (this.sunLight) {
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(2048, 2048);
      }
    } else if (tier === 'ULTRA') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.autoUpdate = true;
      if (this.sunLight) {
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(2048, 2048);
      }
    } else if (tier === 'HIGH') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.autoUpdate = true;
      if (this.sunLight) {
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(2048, 2048);
      }
    } else if (tier === 'BALANCED') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
      if (this.sunLight) {
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(1024, 1024);
      }
    } else if (tier === 'PERFORMANCE') {
      this.renderer.shadowMap.enabled = false;
      this.renderer.shadowMap.autoUpdate = false;
      if (this.sunLight) {
        this.sunLight.castShadow = false;
      }
    }

    this.resize();
  }

  /**
   * Returns current internal WebGL drawing-buffer dimensions
   * @returns {{ width: number, height: number }}
   */
  getDrawingBufferSize() {
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    return { width: Math.round(size.x), height: Math.round(size.y) };
  }

  /**
   * Returns effective device pixel ratio applied to renderer
   */
  getEffectiveDpr() {
    return this.renderer.getPixelRatio();
  }

  update(playerPos, speed = 22.0, dt = 0.016) {
    this.renderFrameCount = (this.renderFrameCount || 0) + 1;
    if (this.qualityTier === 'BALANCED' && this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.needsUpdate = (this.renderFrameCount % 2 === 0);
    }

    const playerZ = typeof playerPos === 'number' ? playerPos : (playerPos.z || 0);

    // 1. O(1) Skyline Building Recycling
    const despawnZ = playerZ + 35;
    for (let i = 0; i < this.buildings.length; i++) {
      const b = this.buildings[i];
      if (b.position.z > despawnZ) {
        b.position.z = this.furthestBuildingZ - this.buildingInterval;
        this.furthestBuildingZ = b.position.z;
      }
    }

    // 2. O(1) Clouds Recycling
    const cloudDespawnZ = playerZ + 45;
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      if (c.position.z > cloudDespawnZ) {
        c.position.z = this.furthestCloudZ - this.cloudInterval;
        this.furthestCloudZ = c.position.z;
      }
    }

    // 3. Sun and directional shadow camera follow player with smooth offset
    if (this.sunLight && this.sunLight.castShadow) {
      this.sunLight.position.set(28, 55, playerZ + 30);
      this.sunLight.target.position.set(0, 0, playerZ - 10);
      this.sunLight.target.updateMatrixWorld();
    }

    // 4. Update High-Speed Slipstream Motion Streaks
    if (this.slipstreamLines) {
      const speedThreshold = 22.0;
      const speedMax = 50.0;
      const speedRatio = MathUtils.clamp((speed - speedThreshold) / (speedMax - speedThreshold), 0, 1);

      this.slipstreamMat.opacity = MathUtils.damp(this.slipstreamMat.opacity, speedRatio * 0.42, 4.0, dt);

      if (this.slipstreamMat.opacity > 0.01) {
        const posAttr = this.slipstreamGeo.attributes.position;
        const arr = posAttr.array;
        const spanAhead = 65;

        for (let i = 0; i < this.slipstreamData.length; i++) {
          const s = this.slipstreamData[i];
          s.zRel += speed * dt * 0.65;
          if (s.zRel > 15) {
            s.zRel = -spanAhead - Math.random() * 20;
          }

          const worldZ = playerZ + s.zRel;
          arr[i * 6] = s.x;
          arr[i * 6 + 1] = s.y;
          arr[i * 6 + 2] = worldZ;

          arr[i * 6 + 3] = s.x;
          arr[i * 6 + 4] = s.y;
          arr[i * 6 + 5] = worldZ - s.length;
        }
        posAttr.needsUpdate = true;
      }
    }

    // 5. Update Ground Dust Particles
    if (this.particles.length > 0) {
      const posAttr = this.groundParticleSystem.geometry.attributes.position;
      const arr = posAttr.array;

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 4.0 * dt;

        arr[i * 3] = p.x;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z;
      }

      posAttr.needsUpdate = true;
      this.groundParticleMat.opacity = Math.min(0.7, this.particles.length / 8);
    } else {
      this.groundParticleMat.opacity = 0;
    }
  }

  setMenuPedestalVisible(visible) {
    if (this.menuPedestal) {
      this.menuPedestal.visible = visible;
    }
  }

  reset() {
    this.particles = [];
    if (this.slipstreamMat) {
      this.slipstreamMat.opacity = 0;
    }

    // Reset building sequence
    this.furthestBuildingZ = 0;
    for (let i = 0; i < this.buildings.length; i++) {
      this.buildings[i].position.z = 20 - i * this.buildingInterval;
      if (this.buildings[i].position.z < this.furthestBuildingZ) {
        this.furthestBuildingZ = this.buildings[i].position.z;
      }
    }

    // Reset cloud sequence
    this.furthestCloudZ = 0;
    for (let c = 0; c < this.clouds.length; c++) {
      this.clouds[c].position.z = 20 - c * this.cloudInterval;
      if (this.clouds[c].position.z < this.furthestCloudZ) {
        this.furthestCloudZ = this.clouds[c].position.z;
      }
    }
  }

  /**
   * Ultra-HD Resolution & Drawing-Buffer System
   * Accurately scales the WebGL canvas drawing buffer from 1080p up to 4K UHD.
   * Keeps CSS styling synchronized (width: 100%, height: 100%) with zero stretching.
   */
  resize(width, height) {
    const container = this.canvas.parentElement;
    const w = width || (container ? container.clientWidth : window.innerWidth) || window.innerWidth;
    const h = height || (container ? container.clientHeight : window.innerHeight) || window.innerHeight;

    const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const nativeDpr = window.devicePixelRatio || 1;

    let targetDpr = 1.0;

    if (this.qualityTier === 'MAX_4K') {
      // 4K Ultra HD Target: up to 3840 x 2160
      const desiredDpr = Math.max(2160 / h, 3840 / w);
      targetDpr = Math.max(nativeDpr, Math.min(desiredDpr, 3.5));
    } else if (this.qualityTier === 'ULTRA') {
      // Quad HD Target: up to 2560 x 1440
      const desiredDpr = Math.max(1440 / h, 2560 / w);
      targetDpr = Math.max(nativeDpr, Math.min(desiredDpr, 2.5));
    } else if (this.qualityTier === 'HIGH') {
      // Full HD 1080p Minimum Target: at least 1920 x 1080 on capable displays
      const desiredDpr = Math.max(1080 / h, 1920 / w);
      if (isMobile) {
        targetDpr = Math.min(nativeDpr, 2.0);
      } else {
        targetDpr = Math.max(nativeDpr, Math.min(desiredDpr, 2.0));
      }
    } else if (this.qualityTier === 'BALANCED') {
      // Balanced: 1080p target on desktop, 1.25 DPR max on mobile
      if (isMobile) {
        targetDpr = Math.min(nativeDpr, 1.25);
      } else {
        const desiredDpr = Math.max(1080 / h, 1920 / w);
        targetDpr = Math.min(Math.max(nativeDpr, desiredDpr), 1.5);
      }
    } else {
      // PERFORMANCE: 1.0 DPR on desktop, 0.85 DPR on mobile
      targetDpr = isMobile ? Math.min(nativeDpr * 0.85, 1.0) : 1.0;
    }

    // Hardware safety clamp to prevent GPU buffer allocation failure
    const maxGlSize = 4096;
    if (w * targetDpr > maxGlSize) targetDpr = maxGlSize / w;
    if (h * targetDpr > maxGlSize) targetDpr = maxGlSize / h;

    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(targetDpr);

    return { width: w, height: h };
  }
}
