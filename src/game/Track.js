/**
 * AI Gesture Runner 3D - Track
 * High-Performance Procedural 3-lane Subway Surfers-inspired railway track.
 * Uses InstancedMesh for concrete sleepers, shared geometries/materials,
 * and O(1) circular chunk recycling for maximum frame rate.
 */

import * as THREE from 'three';
import { GAME_CONFIG } from '../core/GameConfig.js';
import { AssetLoader } from '../utils/AssetLoader.js';

export class Track {
  constructor(scene) {
    this.scene = scene;
    this.assetLoader = new AssetLoader();
    this.chunks = [];
    this.chunkLength = GAME_CONFIG.TRACK.CHUNK_LENGTH || 60.0;
    this.totalChunks = GAME_CONFIG.TRACK.ACTIVE_CHUNKS || 6;
    this.trackWidth = GAME_CONFIG.LANES.WIDTH * 3 + 2.4; // Total railway bed width
    this.laneCenters = [GAME_CONFIG.LANES.LEFT_X, GAME_CONFIG.LANES.CENTER_X, GAME_CONFIG.LANES.RIGHT_X];
    this.furthestZ = 0;

    this.initMaterials();
    this.initSharedGeometries();
    this.buildInitialTrack();
  }

  initMaterials() {
    // 1. Light ballast railway gravel bed
    this.ballastMaterial = new THREE.MeshStandardMaterial({
      color: 0xc8d8e8,
      roughness: 0.85,
      metalness: 0.05
    });

    // 2. Wooden railway sleepers (ties)
    this.sleeperMaterial = new THREE.MeshStandardMaterial({
      color: 0x6d4c41,
      roughness: 0.75,
      metalness: 0.1
    });

    // 3. Polished steel rails (metallic shine)
    this.railMaterial = new THREE.MeshStandardMaterial({
      color: 0xe0e8f0,
      metalness: 0.92,
      roughness: 0.18
    });

    // 4. White & Sky-Blue side platform curbs
    this.curbMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.1
    });

    this.warningStripeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd34e,
      roughness: 0.3,
      metalness: 0.2
    });

    // 5. Overhead Sky Gantry Structure
    this.gantryMaterial = new THREE.MeshStandardMaterial({
      color: 0x008bff,
      roughness: 0.35,
      metalness: 0.4
    });

    this.gantryAccentMat = new THREE.MeshStandardMaterial({
      color: 0xff7a5c,
      roughness: 0.3,
      metalness: 0.3
    });

    // 6. Lush green foliage for trackside planters
    this.foliageMaterial = new THREE.MeshStandardMaterial({
      color: 0x6ec207,
      roughness: 0.7,
      metalness: 0.05
    });

    this.woodTrunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x795548,
      roughness: 0.8
    });

    // 7. Elevated Sky Pillar Material
    this.pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.1
    });
  }

  initSharedGeometries() {
    this.bedGeo = new THREE.BoxGeometry(this.trackWidth, 0.7, this.chunkLength);
    this.sleeperGeo = new THREE.BoxGeometry(1.9, 0.09, 0.32);
    this.railGeo = new THREE.BoxGeometry(0.08, 0.16, this.chunkLength);
    this.curbGeo = new THREE.BoxGeometry(0.7, 0.45, this.chunkLength);
    this.stripeGeo = new THREE.BoxGeometry(0.18, 0.05, this.chunkLength);
    this.trunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 1.8, 8);
    this.foliageGeo = new THREE.DodecahedronGeometry(1.1);
    this.pillarGeo = new THREE.CylinderGeometry(0.9, 1.2, 35, 10);
    this.postGeo = new THREE.BoxGeometry(0.45, 6.2, 0.45);
    this.beamGeo = new THREE.BoxGeometry(this.trackWidth + 1.6, 0.5, 0.5);
    this.signGeo = new THREE.BoxGeometry(3.5, 0.9, 0.15);
  }

  createChunk(chunkIndex) {
    const chunkGroup = new THREE.Group();
    const zOffset = -chunkIndex * this.chunkLength;

    // 1. Ballast Gravel Track Bed
    const bed = new THREE.Mesh(this.bedGeo, this.ballastMaterial);
    bed.position.set(0, -0.35, 0);
    bed.receiveShadow = true;
    chunkGroup.add(bed);

    // 2. High-Performance Instanced Sleepers (1 draw call for all 99 sleepers in chunk!)
    const sleepersPerLane = Math.floor(this.chunkLength / 1.8);
    const totalSleepers = sleepersPerLane * this.laneCenters.length;
    const instancedSleepers = new THREE.InstancedMesh(this.sleeperGeo, this.sleeperMaterial, totalSleepers);
    instancedSleepers.receiveShadow = true;

    const dummyMatrix = new THREE.Matrix4();
    let sleeperIdx = 0;

    this.laneCenters.forEach((laneX) => {
      for (let s = 0; s < sleepersPerLane; s++) {
        const sz = -this.chunkLength / 2 + s * 1.8 + 0.9;
        dummyMatrix.setPosition(laneX, 0.04, sz);
        instancedSleepers.setMatrixAt(sleeperIdx++, dummyMatrix);
      }

      // Left & Right steel rails (thin ground metallic geometry, receive shadow from obstacles/player)
      const railGauge = 0.68;
      const leftRail = new THREE.Mesh(this.railGeo, this.railMaterial);
      leftRail.position.set(laneX - railGauge, 0.12, 0);
      leftRail.receiveShadow = true;
      chunkGroup.add(leftRail);

      const rightRail = new THREE.Mesh(this.railGeo, this.railMaterial);
      rightRail.position.set(laneX + railGauge, 0.12, 0);
      rightRail.receiveShadow = true;
      chunkGroup.add(rightRail);
    });

    instancedSleepers.instanceMatrix.needsUpdate = true;
    chunkGroup.add(instancedSleepers);

    // 3. Left and Right Safety Curbs with Yellow Hazard Warning Strip
    const curbWidth = 0.7;

    // Left walkway
    const leftCurb = new THREE.Mesh(this.curbGeo, this.curbMaterial);
    leftCurb.position.set(-this.trackWidth / 2 + curbWidth / 2, 0.15, 0);
    chunkGroup.add(leftCurb);

    const leftStripe = new THREE.Mesh(this.stripeGeo, this.warningStripeMaterial);
    leftStripe.position.set(-this.trackWidth / 2 + curbWidth, 0.38, 0);
    chunkGroup.add(leftStripe);

    // Right walkway
    const rightCurb = new THREE.Mesh(this.curbGeo, this.curbMaterial);
    rightCurb.position.set(this.trackWidth / 2 - curbWidth / 2, 0.15, 0);
    chunkGroup.add(rightCurb);

    const rightStripe = new THREE.Mesh(this.stripeGeo, this.warningStripeMaterial);
    rightStripe.position.set(this.trackWidth / 2 - curbWidth, 0.38, 0);
    chunkGroup.add(rightStripe);

    // 4. Trackside Stylized Trees
    const treeCount = 3;
    for (let t = 0; t < treeCount; t++) {
      const tz = -this.chunkLength / 2 + (t + 0.5) * (this.chunkLength / treeCount);
      const side = t % 2 === 0 ? 1 : -1;
      const tx = side * (this.trackWidth / 2 + 1.2);

      const treeGroup = this.createStylizedTree();
      treeGroup.position.set(tx, 0.1, tz);
      chunkGroup.add(treeGroup);
    }

    // 5. Overhead Sky Gantry at chunk midpoint
    const gantry = this.createSkyGantry();
    gantry.position.set(0, 0, 0);
    chunkGroup.add(gantry);

    // 6. Elevated Support Pillar Underneath
    const pillar = new THREE.Mesh(this.pillarGeo, this.pillarMaterial);
    pillar.position.set(0, -18, 0);
    chunkGroup.add(pillar);

    chunkGroup.position.set(0, 0, zOffset);
    this.scene.add(chunkGroup);
    return chunkGroup;
  }

  createStylizedTree() {
    const tree = new THREE.Group();

    // Trunk
    const trunk = new THREE.Mesh(this.trunkGeo, this.woodTrunkMaterial);
    trunk.position.y = 0.9;
    tree.add(trunk);

    // Foliage canopy: main foliage casts soft shadow
    const foliage1 = new THREE.Mesh(this.foliageGeo, this.foliageMaterial);
    foliage1.position.y = 2.2;
    foliage1.castShadow = true;
    tree.add(foliage1);

    const foliage2 = new THREE.Mesh(this.foliageGeo, this.foliageMaterial);
    foliage2.scale.set(0.75, 0.75, 0.75);
    foliage2.position.set(0.3, 2.9, 0.1);
    tree.add(foliage2);

    return tree;
  }

  createSkyGantry() {
    const gantry = new THREE.Group();
    const pillarHeight = 6.2;

    // Left post
    const postL = new THREE.Mesh(this.postGeo, this.gantryMaterial);
    postL.position.set(-this.trackWidth / 2 - 0.5, pillarHeight / 2, 0);
    postL.castShadow = true;
    gantry.add(postL);

    // Right post
    const postR = new THREE.Mesh(this.postGeo, this.gantryMaterial);
    postR.position.set(this.trackWidth / 2 + 0.5, pillarHeight / 2, 0);
    postR.castShadow = true;
    gantry.add(postR);

    // Top beam
    const topBeam = new THREE.Mesh(this.beamGeo, this.gantryMaterial);
    topBeam.position.set(0, pillarHeight, 0);
    topBeam.castShadow = true;
    gantry.add(topBeam);

    // Center futuristic station destination signboard
    const sign = new THREE.Mesh(this.signGeo, this.gantryAccentMat);
    sign.position.set(0, pillarHeight - 0.5, 0);
    gantry.add(sign);

    return gantry;
  }

  buildInitialTrack() {
    for (let i = 0; i < this.totalChunks; i++) {
      const chunk = this.createChunk(i);
      this.chunks.push(chunk);
    }
    this.furthestZ = -(this.totalChunks - 1) * this.chunkLength;
  }

  /**
   * O(1) circular chunk recycling along player's -Z path.
   */
  update(playerZ) {
    const despawnDist = GAME_CONFIG.TRACK.DESPAWN_DISTANCE || 25.0;

    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      if (chunk.position.z > playerZ + despawnDist) {
        chunk.position.z = this.furthestZ - this.chunkLength;
        this.furthestZ = chunk.position.z;
      }
    }
  }

  reset() {
    for (let i = 0; i < this.chunks.length; i++) {
      this.chunks[i].position.z = -i * this.chunkLength;
    }
    this.furthestZ = -(this.chunks.length - 1) * this.chunkLength;
  }
}
