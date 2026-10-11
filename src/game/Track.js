/**
 * AI Gesture Runner 3D - Track
 * Procedural 3-lane Subway Surfers-inspired railway track with wooden sleepers,
 * polished steel rails, track ballast, side platforms, trees, and sky bridges.
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

    this.initMaterials();
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

  createChunk(chunkIndex) {
    const chunkGroup = new THREE.Group();
    const zOffset = -chunkIndex * this.chunkLength;

    // 1. Ballast Gravel Track Bed
    const bedGeo = new THREE.BoxGeometry(this.trackWidth, 0.7, this.chunkLength);
    const bed = new THREE.Mesh(bedGeo, this.ballastMaterial);
    bed.position.set(0, -0.35, 0);
    bed.receiveShadow = true;
    chunkGroup.add(bed);

    // 2. Concrete Sleepers and Steel Rails for all 3 Railway Lanes
    const sleeperGeo = new THREE.BoxGeometry(1.9, 0.09, 0.32);
    const railGeo = new THREE.BoxGeometry(0.08, 0.16, this.chunkLength);
    const railGauge = 0.68; // Half-gauge distance to left and right rail

    this.laneCenters.forEach((laneX) => {
      // Sleepers placed every 1.8m along the chunk
      const sleeperCount = Math.floor(this.chunkLength / 1.8);
      for (let s = 0; s < sleeperCount; s++) {
        const sz = -this.chunkLength / 2 + s * 1.8 + 0.9;
        const sleeper = new THREE.Mesh(sleeperGeo, this.sleeperMaterial);
        sleeper.position.set(laneX, 0.04, sz);
        sleeper.receiveShadow = true;
        chunkGroup.add(sleeper);
      }

      // Left steel rail
      const leftRail = new THREE.Mesh(railGeo, this.railMaterial);
      leftRail.position.set(laneX - railGauge, 0.12, 0);
      leftRail.castShadow = true;
      chunkGroup.add(leftRail);

      // Right steel rail
      const rightRail = new THREE.Mesh(railGeo, this.railMaterial);
      rightRail.position.set(laneX + railGauge, 0.12, 0);
      rightRail.castShadow = true;
      chunkGroup.add(rightRail);
    });

    // 3. Left and Right Safety Curbs with Yellow Hazard Warning Strip
    const curbWidth = 0.7;
    const curbGeo = new THREE.BoxGeometry(curbWidth, 0.45, this.chunkLength);
    const stripeGeo = new THREE.BoxGeometry(0.18, 0.05, this.chunkLength);

    // Left walkway
    const leftCurb = new THREE.Mesh(curbGeo, this.curbMaterial);
    leftCurb.position.set(-this.trackWidth / 2 + curbWidth / 2, 0.15, 0);
    chunkGroup.add(leftCurb);

    const leftStripe = new THREE.Mesh(stripeGeo, this.warningStripeMaterial);
    leftStripe.position.set(-this.trackWidth / 2 + curbWidth, 0.38, 0);
    chunkGroup.add(leftStripe);

    // Right walkway
    const rightCurb = new THREE.Mesh(curbGeo, this.curbMaterial);
    rightCurb.position.set(this.trackWidth / 2 - curbWidth / 2, 0.15, 0);
    chunkGroup.add(rightCurb);

    const rightStripe = new THREE.Mesh(stripeGeo, this.warningStripeMaterial);
    rightStripe.position.set(this.trackWidth / 2 - curbWidth, 0.38, 0);
    chunkGroup.add(rightStripe);

    // 4. Trackside Greenery & Trees (alternating sides for natural sky park feel)
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

    // 6. Elevated Support Pillar Underneath (Connecting to Sky City below)
    const pillarGeo = new THREE.CylinderGeometry(0.9, 1.2, 35, 12);
    const pillar = new THREE.Mesh(pillarGeo, this.pillarMaterial);
    pillar.position.set(0, -18, 0);
    chunkGroup.add(pillar);

    chunkGroup.position.set(0, 0, zOffset);
    this.scene.add(chunkGroup);
    return chunkGroup;
  }

  createStylizedTree() {
    const tree = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 1.8, 8);
    const trunk = new THREE.Mesh(trunkGeo, this.woodTrunkMaterial);
    trunk.position.y = 0.9;
    trunk.castShadow = true;
    tree.add(trunk);

    // Foliage canopy (layered low-poly spheres)
    const foliageGeo = new THREE.DodecahedronGeometry(1.1);
    const foliage1 = new THREE.Mesh(foliageGeo, this.foliageMaterial);
    foliage1.position.y = 2.2;
    foliage1.castShadow = true;
    tree.add(foliage1);

    const foliage2 = new THREE.Mesh(foliageGeo, this.foliageMaterial);
    foliage2.scale.set(0.75, 0.75, 0.75);
    foliage2.position.set(0.3, 2.9, 0.1);
    foliage2.castShadow = true;
    tree.add(foliage2);

    return tree;
  }

  createSkyGantry() {
    const gantry = new THREE.Group();
    const pillarHeight = 6.2;
    const postGeo = new THREE.BoxGeometry(0.45, pillarHeight, 0.45);
    const beamGeo = new THREE.BoxGeometry(this.trackWidth + 1.6, 0.5, 0.5);
    const signGeo = new THREE.BoxGeometry(3.5, 0.9, 0.15);

    // Left post
    const postL = new THREE.Mesh(postGeo, this.gantryMaterial);
    postL.position.set(-this.trackWidth / 2 - 0.5, pillarHeight / 2, 0);
    postL.castShadow = true;
    gantry.add(postL);

    // Right post
    const postR = new THREE.Mesh(postGeo, this.gantryMaterial);
    postR.position.set(this.trackWidth / 2 + 0.5, pillarHeight / 2, 0);
    postR.castShadow = true;
    gantry.add(postR);

    // Top beam
    const topBeam = new THREE.Mesh(beamGeo, this.gantryMaterial);
    topBeam.position.set(0, pillarHeight, 0);
    topBeam.castShadow = true;
    gantry.add(topBeam);

    // Center futuristic station destination signboard
    const sign = new THREE.Mesh(signGeo, this.gantryAccentMat);
    sign.position.set(0, pillarHeight - 0.5, 0);
    gantry.add(sign);

    return gantry;
  }

  buildInitialTrack() {
    for (let i = 0; i < this.totalChunks; i++) {
      const chunk = this.createChunk(i);
      this.chunks.push(chunk);
    }
  }

  update(playerZ) {
    const despawnDist = GAME_CONFIG.TRACK.DESPAWN_DISTANCE || 25.0;
    // When a chunk is far behind player, cycle it forward
    for (const chunk of this.chunks) {
      if (chunk.position.z > playerZ + despawnDist) {
        let minZ = 0;
        for (const c of this.chunks) {
          if (c.position.z < minZ) minZ = c.position.z;
        }
        chunk.position.z = minZ - this.chunkLength;
      }
    }
  }

  reset() {
    for (let i = 0; i < this.chunks.length; i++) {
      this.chunks[i].position.z = -i * this.chunkLength;
    }
  }
}
