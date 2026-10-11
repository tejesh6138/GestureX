/**
 * AI Gesture Runner 3D - World
 * Initializes Three.js Scene, WebGLRenderer, Daylight Sky City Lighting, Soft Clouds, and Sunlit Skyline.
 */

import * as THREE from 'three';
import { AssetLoader } from '../utils/AssetLoader.js';

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.assetLoader = new AssetLoader();

    // Bright Futuristic Sky City: Radiant sky blue background with gentle atmospheric perspective
    const skyColor = new THREE.Color(0xbfe7ff);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog(skyColor, 60, 260);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLighting();
    this.setupSkyCity();
    this.setupClouds();
  }

  setupLighting() {
    // 1. Warm daylight ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    this.scene.add(ambientLight);

    // 2. Hemisphere light: soft blue sky above, gentle pale reflection from city below
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0xeaf5ff, 0.85);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // 3. Bright golden sun with directional soft shadows
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    sunLight.position.set(28, 55, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 160;
    sunLight.shadow.camera.left = -25;
    sunLight.shadow.camera.right = 25;
    sunLight.shadow.camera.top = 25;
    sunLight.shadow.camera.bottom = -25;
    sunLight.shadow.bias = -0.0008;
    this.scene.add(sunLight);
    this.sunLight = sunLight;

    // 4. Soft sky fill light from opposite angle to prevent harsh black shadows
    const fillLight = new THREE.DirectionalLight(0xbfe7ff, 0.65);
    fillLight.position.set(-25, 30, -25);
    this.scene.add(fillLight);
  }

  setupSkyCity() {
    this.buildings = [];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const cylinderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);

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

    // Populate 64 individual dynamic buildings along both sides of track
    const totalBuildings = 64;
    for (let i = 0; i < totalBuildings; i++) {
      const bHeight = 35 + Math.random() * 95;
      const bWidth = 14 + Math.random() * 16;
      const bDepth = 15 + Math.random() * 20;
      const side = (i % 2 === 0) ? -1 : 1;
      const x = side * (24 + Math.random() * 45);
      const z = 20 - i * 8.5; // Staggered along world Z

      const building = new THREE.Group();

      // Main tower body
      const tower = new THREE.Mesh(boxGeo, whiteFacadeMat);
      tower.scale.set(bWidth, bHeight, bDepth);
      tower.position.set(0, bHeight / 2 - 8, 0);
      tower.castShadow = true;
      tower.receiveShadow = true;
      building.add(tower);

      // Glass window bands and balconies
      const bands = Math.floor(bHeight / 12);
      for (let w = 1; w < bands; w++) {
        const band = new THREE.Mesh(boxGeo, skyBlueGlassMat);
        band.scale.set(bWidth + 0.35, 2.4, bDepth + 0.35);
        band.position.set(0, w * 12 - 6, 0);
        building.add(band);
      }

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
        spire.scale.set(1.6, 16, 1.6);
        spire.position.set(0, bHeight - 2, 0);
        building.add(spire);
      }

      // Occasional overhead skybridge
      if (i % 10 === 0 && side === -1) {
        const skybridge = new THREE.Mesh(boxGeo, bridgeMat);
        skybridge.scale.set(70, 3.5, 6);
        skybridge.position.set(30, 24, 0);
        building.add(skybridge);
      }

      building.position.set(x, 0, z);
      this.scene.add(building);
      this.buildings.push(building);
    }

    // Decorative Main Menu Hero Platform / Terminal (Right side of menu card)
    this.menuPedestal = new THREE.Group();
    const pedGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.92, 24);
    const pedMesh = new THREE.Mesh(pedGeo, whiteFacadeMat);
    pedMesh.position.y = 0.46;
    pedMesh.castShadow = true;
    this.menuPedestal.add(pedMesh);

    const pedTopGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.08, 24);
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
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.88
    });

    const sphereGeo = new THREE.SphereGeometry(1, 8, 8);

    for (let c = 0; c < 32; c++) {
      const cluster = new THREE.Group();
      const puffs = 4 + Math.floor(Math.random() * 4);
      const baseScale = 9 + Math.random() * 12;

      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(sphereGeo, cloudMat);
        puff.scale.set(
          baseScale * (0.8 + Math.random() * 0.5),
          baseScale * (0.5 + Math.random() * 0.4),
          baseScale * (0.8 + Math.random() * 0.5)
        );
        puff.position.set(
          (p - puffs / 2) * (baseScale * 0.55),
          (Math.random() - 0.5) * (baseScale * 0.3),
          (Math.random() - 0.5) * (baseScale * 0.5)
        );
        cluster.add(puff);
      }

      const x = (Math.random() - 0.5) * 280;
      const y = 65 + Math.random() * 45;
      const z = 20 - c * 16;
      cluster.position.set(x, y, z);
      this.scene.add(cluster);
      this.clouds.push(cluster);
    }
  }

  update(playerZ) {
    // 1. Endless-World Motion: Buildings stay in world coordinates and recycle forward
    if (this.buildings && this.buildings.length > 0) {
      const despawnZ = playerZ + 35;
      for (const b of this.buildings) {
        if (b.position.z > despawnZ) {
          // Find lowest Z (farthest ahead)
          let minZ = playerZ;
          for (const other of this.buildings) {
            if (other.position.z < minZ) minZ = other.position.z;
          }
          b.position.z = minZ - (14 + Math.random() * 8);
        }
      }
    }

    // 2. Soft Clouds gentle forward drift and recycling
    if (this.clouds && this.clouds.length > 0) {
      const cloudDespawnZ = playerZ + 45;
      for (const c of this.clouds) {
        if (c.position.z > cloudDespawnZ) {
          let minCloudZ = playerZ;
          for (const other of this.clouds) {
            if (other.position.z < minCloudZ) minCloudZ = other.position.z;
          }
          c.position.z = minCloudZ - (20 + Math.random() * 15);
        }
      }
    }

    // 3. Sun and shadow follow player with smooth offset
    if (this.sunLight) {
      this.sunLight.position.set(28, 55, playerZ + 30);
      this.sunLight.target.position.set(0, 0, playerZ - 10);
      this.sunLight.target.updateMatrixWorld();
    }
  }

  setMenuPedestalVisible(visible) {
    if (this.menuPedestal) {
      this.menuPedestal.visible = visible;
    }
  }

  resize(width, height) {
    const container = this.canvas.parentElement;
    const w = width || (container ? container.clientWidth : window.innerWidth);
    const h = height || (container ? container.clientHeight : window.innerHeight);

    // Adapt DPR: cap at 1.75 on mobile to avoid overheating and GPU throttling, 2.0 on desktop
    const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const maxDpr = isMobile ? 1.75 : 2.0;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(dpr);
    return { width: w, height: h };
  }
}
