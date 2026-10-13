/**
 * AI Gesture Runner 3D - World
 * High-Performance Daylight Sky City Scene Controller:
 * - Dynamic adaptive rendering quality (HIGH / BALANCED / PERFORMANCE).
 * - O(1) circular building & cloud recycling (zero O(N^2) loops).
 * - Frustum-aware shadow culling for distant architecture.
 * - Hardware-calibrated DPR limits for mobile and laptop thermal safety.
 * - Optimized speed slipstreams and dust particles.
 */

import * as THREE from 'three';
import { AssetLoader } from '../utils/AssetLoader.js';
import { MathUtils } from '../utils/MathUtils.js';

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.assetLoader = new AssetLoader();
    this.qualityTier = 'HIGH';

    // Bright Futuristic Sky City: Radiant sky blue background with gentle atmospheric perspective
    const skyColor = new THREE.Color(0xbfe7ff);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog(skyColor, 65, 260);

    // Renderer setup with high-performance WebGL profile
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.setupLighting();
    this.setupSkyCity();
    this.setupClouds();
    this.setupSpeedSlipstreamStreaks();
    this.setupGroundEffectsParticles();

    this.resize();
  }

  setupLighting() {
    // 1. Warm daylight ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
    this.scene.add(this.ambientLight);

    // 2. Hemisphere light: soft blue sky above, gentle pale reflection from city below
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0xeaf5ff, 0.9);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // 3. Bright golden sun with directional soft shadows
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    this.sunLight.position.set(28, 55, 30);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 160;
    this.sunLight.shadow.camera.left = -25;
    this.sunLight.shadow.camera.right = 25;
    this.sunLight.shadow.camera.top = 25;
    this.sunLight.shadow.camera.bottom = -25;
    this.sunLight.shadow.bias = -0.0008;
    this.scene.add(this.sunLight);

    // 4. Soft sky fill light
    this.fillLight = new THREE.DirectionalLight(0xbfe7ff, 0.65);
    this.fillLight.position.set(-25, 30, -25);
    this.scene.add(this.fillLight);
  }

  setupSkyCity() {
    this.buildings = [];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const cylinderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);

    // Clean, vibrant architectural materials
    const whiteFacadeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.12
    });

    const skyBlueGlassMat = new THREE.MeshStandardMaterial({
      color: 0x5ab2ff,
      roughness: 0.15,
      metalness: 0.7,
      transparent: true,
      opacity: 0.88
    });

    const yellowAccentMat = new THREE.MeshStandardMaterial({
      color: 0xffd34e,
      roughness: 0.3,
      metalness: 0.35
    });

    const orangeAccentMat = new THREE.MeshStandardMaterial({
      color: 0xff6b4a,
      roughness: 0.3,
      metalness: 0.25
    });

    const greenGardenMat = new THREE.MeshStandardMaterial({
      color: 0x64c800,
      roughness: 0.8,
      metalness: 0.05
    });

    const bridgeMat = new THREE.MeshStandardMaterial({
      color: 0x008bff,
      roughness: 0.3,
      metalness: 0.45
    });

    // Populate 48 dynamic buildings along trackside
    this.buildingInterval = 10.5;
    const totalBuildings = 48;
    this.furthestBuildingZ = 0;

    for (let i = 0; i < totalBuildings; i++) {
      const bHeight = 35 + Math.random() * 85;
      const bWidth = 14 + Math.random() * 16;
      const bDepth = 15 + Math.random() * 20;
      const side = (i % 2 === 0) ? -1 : 1;
      const xDist = 24 + Math.random() * 40;
      const x = side * xDist;
      const z = 20 - i * this.buildingInterval;

      const building = new THREE.Group();

      // Main tower body
      const tower = new THREE.Mesh(boxGeo, whiteFacadeMat);
      tower.scale.set(bWidth, bHeight, bDepth);
      tower.position.set(0, bHeight / 2 - 8, 0);

      // Frustum-aware shadow culling: only cast shadows from buildings close to track
      if (xDist < 30) {
        tower.castShadow = true;
      }
      tower.receiveShadow = true;
      building.add(tower);

      // Architectural window accents (1-2 clean horizontal bands per building instead of 10)
      const band = new THREE.Mesh(boxGeo, skyBlueGlassMat);
      band.scale.set(bWidth + 0.35, Math.min(8.0, bHeight * 0.22), bDepth + 0.35);
      band.position.set(0, bHeight * 0.45, 0);
      building.add(band);

      // Rooftop features
      if (Math.random() > 0.5) {
        const garden = new THREE.Mesh(boxGeo, greenGardenMat);
        garden.scale.set(bWidth * 0.88, 1.4, bDepth * 0.88);
        garden.position.set(0, bHeight - 7.3, 0);
        building.add(garden);
      } else {
        const spire = new THREE.Mesh(
          cylinderGeo,
          Math.random() > 0.5 ? yellowAccentMat : orangeAccentMat
        );
        spire.scale.set(1.6, 14, 1.6);
        spire.position.set(0, bHeight - 2, 0);
        building.add(spire);
      }

      // Occasional overhead skybridge
      if (i % 8 === 0 && side === -1) {
        const skybridge = new THREE.Mesh(boxGeo, bridgeMat);
        skybridge.scale.set(65, 3.5, 6);
        skybridge.position.set(28, 24, 0);
        building.add(skybridge);
      }

      building.position.set(x, 0, z);
      this.scene.add(building);
      this.buildings.push(building);

      if (z < this.furthestBuildingZ) {
        this.furthestBuildingZ = z;
      }
    }

    // Decorative Main Menu Hero Platform / Terminal
    this.menuPedestal = new THREE.Group();
    const pedGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.92, 20);
    const pedMesh = new THREE.Mesh(pedGeo, whiteFacadeMat);
    pedMesh.position.y = 0.46;
    pedMesh.castShadow = true;
    this.menuPedestal.add(pedMesh);

    const pedTopGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.08, 20);
    const pedTopMesh = new THREE.Mesh(pedTopGeo, skyBlueGlassMat);
    pedTopMesh.position.y = 0.94;
    this.menuPedestal.add(pedTopMesh);

    const pedHoloGeo = new THREE.BoxGeometry(0.5, 0.35, 0.04);
    const pedHoloMesh = new THREE.Mesh(pedHoloGeo, yellowAccentMat);
    pedHoloMesh.position.set(0, 1.16, 0);
    pedHoloMesh.rotation.x = -0.25;
    this.menuPedestal.add(pedHoloMesh);

    this.menuPedestal.position.set(1.5, 0, 0.3);
    this.scene.add(this.menuPedestal);
  }

  setupClouds() {
    this.clouds = [];
    this.cloudInterval = 20.0;
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.85
    });

    const sphereGeo = new THREE.SphereGeometry(1, 7, 7);
    const totalClouds = 18;
    this.furthestCloudZ = 0;

    for (let c = 0; c < totalClouds; c++) {
      const cluster = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 3);
      const baseScale = 9 + Math.random() * 11;

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

      const x = (Math.random() - 0.5) * 260;
      const y = 65 + Math.random() * 45;
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
    const streakCount = 45;
    this.slipstreamGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(streakCount * 6);

    this.slipstreamData = [];
    for (let i = 0; i < streakCount; i++) {
      const side = (i % 2 === 0) ? -1 : 1;
      const x = side * (4.2 + Math.random() * 5.5);
      const y = 0.8 + Math.random() * 3.5;
      const zRel = -Math.random() * 65;
      const length = 2.5 + Math.random() * 3.5;

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
    const pCount = 48;
    const pGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(pCount * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    this.groundParticleMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.18,
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
      return; // Save CPU on particle physics when in performance mode
    }

    const actualCount = this.qualityTier === 'HIGH' ? count : Math.ceil(count * 0.6);
    for (let i = 0; i < actualCount; i++) {
      if (this.particles.length > 40) this.particles.shift();
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
   * Adaptive Graphics Quality Configuration
   * @param {'HIGH' | 'BALANCED' | 'PERFORMANCE'} tier
   */
  setQuality(tier) {
    this.qualityTier = tier;

    if (tier === 'HIGH') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.autoUpdate = true;
      if (this.sunLight) {
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(1024, 1024);
      }
    } else if (tier === 'BALANCED') {
      this.renderer.shadowMap.enabled = true;
      // Staggered shadow map pass: autoUpdate false, updated every 2nd frame in update()
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
      if (this.sunLight) {
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(512, 512);
      }
    } else if (tier === 'PERFORMANCE') {
      // Disable shadow map rendering; vibrant ambient + hemisphere + directional daylight remains
      this.renderer.shadowMap.enabled = false;
      this.renderer.shadowMap.autoUpdate = false;
      if (this.sunLight) {
        this.sunLight.castShadow = false;
      }
    }

    this.resize();
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

  resize(width, height) {
    const container = this.canvas.parentElement;
    const w = width || (container ? container.clientWidth : window.innerWidth);
    const h = height || (container ? container.clientHeight : window.innerHeight);

    // Calibrated DPR limits to prevent GPU fill-rate saturation on high-density laptop & mobile screens
    const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    let maxDpr = 1.0;

    if (this.qualityTier === 'HIGH') {
      maxDpr = isMobile ? 1.0 : 1.25;
    } else if (this.qualityTier === 'BALANCED') {
      maxDpr = 1.0;
    } else {
      maxDpr = isMobile ? 0.85 : 1.0;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(dpr);
    return { width: w, height: h };
  }
}
