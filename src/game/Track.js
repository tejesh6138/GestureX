/**
 * AI Gesture Runner 3D - Track
 * Ultra-HD Procedural 3-lane Subway Surfers-inspired railway track:
 * - High-resolution crushed stone ballast gravel bed with depth and speckle detailing.
 * - Instanced wooden/concrete railway sleepers with steel tie-plates and hex bolts.
 * - Mirror-polished steel rails with razor-sharp specular running surface highlights.
 * - Platform safety curbs with high-visibility diagonal hazard warning stripes.
 * - Overhead futuristic station gantries and trackside stylized planters.
 * - O(1) circular chunk recycling for maximum frame rate.
 */

import * as THREE from 'three';
import { GAME_CONFIG } from '../core/GameConfig.js';
import { Assets } from '../utils/AssetLoader.js';

export class Track {
  constructor(scene) {
    this.scene = scene;
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
    // 1. Ultra-HD Crushed stone ballast gravel track bed
    this.ballastMaterial = new THREE.MeshStandardMaterial({
      map: Assets.getTrackBallastTexture(),
      roughness: 0.85,
      metalness: 0.05
    });

    // 2. Weathered railway sleepers with steel tie-plates & hex bolts
    this.sleeperMaterial = new THREE.MeshStandardMaterial({
      map: Assets.getSleeperTexture(),
      roughness: 0.65,
      metalness: 0.15
    });

    // 3. Mirror-polished steel rails
    this.railMaterial = new THREE.MeshStandardMaterial({
      color: 0xdae2ec,
      metalness: 0.92,
      roughness: 0.18
    });

    // High-gloss polished rail running surface (creates specular sun glare down the tracks)
    this.railCapMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.98,
      roughness: 0.06
    });

    // 4. White platform walkway curbs
    this.curbMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.1
    });

    // Sharp 45° yellow & dark slate hazard warning stripes
    this.warningStripeMaterial = new THREE.MeshStandardMaterial({
      map: Assets.getHazardStripeTexture(),
      roughness: 0.3,
      metalness: 0.15
    });

    // 5. Overhead Sky Gantry Structure
    this.gantryMaterial = new THREE.MeshStandardMaterial({
      color: 0x008bff,
      roughness: 0.3,
      metalness: 0.45
    });

    this.gantryAccentMat = new THREE.MeshStandardMaterial({
      color: 0xff7a5c,
      roughness: 0.3,
      metalness: 0.3
    });

    // 6. Lush green foliage for trackside planters
    this.foliageMaterial = new THREE.MeshStandardMaterial({
      color: 0x5eb800,
      roughness: 0.65,
      metalness: 0.05
    });

    this.woodTrunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x6d4c41,
      roughness: 0.8
    });

    // 7. Elevated Sky Pillar Material
    this.pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.15
    });
  }

  initSharedGeometries() {
    this.bedGeo = new THREE.BoxGeometry(this.trackWidth, 0.7, this.chunkLength);
    this.sleeperGeo = new THREE.BoxGeometry(1.9, 0.09, 0.32);
    this.railGeo = new THREE.BoxGeometry(0.08, 0.16, this.chunkLength);
    this.railCapGeo = new THREE.BoxGeometry(0.05, 0.02, this.chunkLength);
    this.curbGeo = new THREE.BoxGeometry(0.7, 0.45, this.chunkLength);
    this.stripeGeo = new THREE.BoxGeometry(0.24, 0.05, this.chunkLength);
    this.trunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 1.8, 8);
    this.foliageGeo = new THREE.DodecahedronGeometry(1.1);
    this.pillarGeo = new THREE.CylinderGeometry(0.9, 1.2, 35, 12);
    this.postGeo = new THREE.BoxGeometry(0.45, 6.2, 0.45);
    this.beamGeo = new THREE.BoxGeometry(this.trackWidth + 1.6, 0.5, 0.5);
    this.signGeo = new THREE.BoxGeometry(3.8, 1.0, 0.15);
  }

  createChunk(chunkIndex) {
    const chunkGroup = new THREE.Group();
    const zOffset = -chunkIndex * this.chunkLength;

    // 1. Ballast Gravel Track Bed
    const bed = new THREE.Mesh(this.bedGeo, this.ballastMaterial);
    bed.position.set(0, -0.35, 0);
    bed.receiveShadow = true;
    chunkGroup.add(bed);

    // 2. High-Performance Instanced Sleepers (1 draw call for all sleepers in chunk)
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

      // Left & Right steel rails with specular railhead caps
      const railGauge = 0.68;

      // Left Rail
      const leftRail = new THREE.Mesh(this.railGeo, this.railMaterial);
      leftRail.position.set(laneX - railGauge, 0.12, 0);
      leftRail.receiveShadow = true;
      chunkGroup.add(leftRail);

      const leftCap = new THREE.Mesh(this.railCapGeo, this.railCapMaterial);
      leftCap.position.set(laneX - railGauge, 0.21, 0);
      chunkGroup.add(leftCap);

      // Right Rail
      const rightRail = new THREE.Mesh(this.railGeo, this.railMaterial);
      rightRail.position.set(laneX + railGauge, 0.12, 0);
      rightRail.receiveShadow = true;
      chunkGroup.add(rightRail);

      const rightCap = new THREE.Mesh(this.railCapGeo, this.railCapMaterial);
      rightCap.position.set(laneX + railGauge, 0.21, 0);
      chunkGroup.add(rightCap);
    });

    instancedSleepers.instanceMatrix.needsUpdate = true;
    chunkGroup.add(instancedSleepers);

    // 3. Left and Right Safety Curbs with Yellow Hazard Warning Strip
    const curbWidth = 0.7;

    // Left Walkway
    const leftCurb = new THREE.Mesh(this.curbGeo, this.curbMaterial);
    leftCurb.position.set(-this.trackWidth / 2 + curbWidth / 2, 0.15, 0);
    leftCurb.receiveShadow = true;
    chunkGroup.add(leftCurb);

    const leftStripe = new THREE.Mesh(this.stripeGeo, this.warningStripeMaterial);
    leftStripe.position.set(-this.trackWidth / 2 + curbWidth - 0.02, 0.38, 0);
    chunkGroup.add(leftStripe);

    // Right Walkway
    const rightCurb = new THREE.Mesh(this.curbGeo, this.curbMaterial);
    rightCurb.position.set(this.trackWidth / 2 - curbWidth / 2, 0.15, 0);
    rightCurb.receiveShadow = true;
    chunkGroup.add(rightCurb);

    const rightStripe = new THREE.Mesh(this.stripeGeo, this.warningStripeMaterial);
    rightStripe.position.set(this.trackWidth / 2 - curbWidth + 0.02, 0.38, 0);
    chunkGroup.add(rightStripe);

    // 4. Trackside Planters with Foliage
    const treeCount = 3;
    for (let t = 0; t < treeCount; t++) {
      const tz = -this.chunkLength / 2 + (t + 0.5) * (this.chunkLength / treeCount);
      const side = t % 2 === 0 ? 1 : -1;
      const tx = side * (this.trackWidth / 2 + 1.3);

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

    // Planter base pot
    const planterGeo = new THREE.BoxGeometry(1.2, 0.45, 1.2);
    const planter = new THREE.Mesh(planterGeo, this.curbMaterial);
    planter.position.y = 0.22;
    planter.castShadow = true;
    tree.add(planter);

    // Trunk
    const trunk = new THREE.Mesh(this.trunkGeo, this.woodTrunkMaterial);
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    tree.add(trunk);

    // Foliage canopy
    const foliage1 = new THREE.Mesh(this.foliageGeo, this.foliageMaterial);
    foliage1.position.y = 2.4;
    foliage1.castShadow = true;
    tree.add(foliage1);

    const foliage2 = new THREE.Mesh(this.foliageGeo, this.foliageMaterial);
    foliage2.scale.set(0.75, 0.75, 0.75);
    foliage2.position.set(0.3, 3.1, 0.1);
    foliage2.castShadow = true;
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
    sign.position.set(0, pillarHeight - 0.55, 0);
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
