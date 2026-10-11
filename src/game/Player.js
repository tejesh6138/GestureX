/**
 * GestureX - 3D Streetwear Runner Character
 * Faithfully models the stylized 3D character from the reference sheet:
 * - Red hood over head with drawstrings
 * - Black baseball cap with red brim and white/red lightning logo
 * - Cartoon anime facial features and dark hair fringe
 * - Black streetwear jacket with red shoulder/sleeve chevrons and white undershirt
 * - Black backpack with red accents
 * - Black cargo joggers with red side racing stripes
 * - High-top red, black, and white skate sneakers
 * - Back-facing gameplay orientation (running forward into the sky city)
 * - Articulated joint hierarchy controlled by PlayerAnimationController
 */

import * as THREE from 'three';
import { PlayerAnimationController, ANIM_STATES } from './PlayerAnimationController.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.invulnerableTimer = 0;

    this.initMaterials();
    this.buildCharacterHierarchy();

    // Centralized Animation Controller
    this.animator = new PlayerAnimationController(this);

    this.scene.add(this.mesh);
  }

  initMaterials() {
    // Streetwear Color Palette matching the visual reference sheet
    this.hoodRedMat = new THREE.MeshStandardMaterial({
      color: 0xE53935, // Vibrant hoodie red
      roughness: 0.45,
      metalness: 0.05
    });

    this.jacketBlackMat = new THREE.MeshStandardMaterial({
      color: 0x1A1D20, // Matte black jacket
      roughness: 0.55,
      metalness: 0.15
    });

    this.shirtWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xF5F7FA, // Clean white cotton tee
      roughness: 0.6,
      metalness: 0.05
    });

    this.accentRedMat = new THREE.MeshStandardMaterial({
      color: 0xFF2828, // Racing red accents/chevrons
      roughness: 0.35,
      metalness: 0.1
    });

    this.skinMat = new THREE.MeshStandardMaterial({
      color: 0xFFDFBA, // Cartoon warm skin tone
      roughness: 0.65,
      metalness: 0.0
    });

    this.hairDarkMat = new THREE.MeshStandardMaterial({
      color: 0x221B18, // Dark anime hair fringe
      roughness: 0.8,
      metalness: 0.05
    });

    this.capBlackMat = new THREE.MeshStandardMaterial({
      color: 0x141618,
      roughness: 0.5,
      metalness: 0.1
    });

    this.capBrimRedMat = new THREE.MeshStandardMaterial({
      color: 0xE53935,
      roughness: 0.4,
      metalness: 0.1
    });

    this.logoWhiteMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF
    });

    this.pantsBlackMat = new THREE.MeshStandardMaterial({
      color: 0x1A1D20, // Black streetwear cargo pants
      roughness: 0.65,
      metalness: 0.08
    });

    this.pantsStripeRedMat = new THREE.MeshStandardMaterial({
      color: 0xE53935, // Red vertical side stripes
      roughness: 0.4,
      metalness: 0.1
    });

    this.sneakerRedMat = new THREE.MeshStandardMaterial({
      color: 0xE53935,
      roughness: 0.35,
      metalness: 0.1
    });

    this.sneakerWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF, // White rubber midsole & toe cap
      roughness: 0.3,
      metalness: 0.05
    });

    this.sneakerBlackMat = new THREE.MeshStandardMaterial({
      color: 0x1A1D20,
      roughness: 0.45,
      metalness: 0.1
    });

    this.backpackBlackMat = new THREE.MeshStandardMaterial({
      color: 0x1E2226,
      roughness: 0.7,
      metalness: 0.1
    });

    this.backpackRedMat = new THREE.MeshStandardMaterial({
      color: 0xE53935,
      roughness: 0.45,
      metalness: 0.1
    });

    this.strapBuckleMat = new THREE.MeshStandardMaterial({
      color: 0xDCE8F5,
      roughness: 0.3,
      metalness: 0.8
    });

    this.eyesDarkMat = new THREE.MeshBasicMaterial({ color: 0x17202A });
  }

  buildCharacterHierarchy() {
    // 1. Root and Body Container
    // Facing orientation: The character is built facing -Z (forward along track).
    // In gameplay, the camera is behind (+Z) looking towards -Z.
    // Thus the player sees the back of the red hood, jacket, backpack, pants, and sneakers!
    this.bodyContainer = new THREE.Group();
    this.mesh.add(this.bodyContainer);

    // 2. Torso / Pelvis Group
    this.torso = new THREE.Group();
    this.torso.position.y = 0.98;
    this.bodyContainer.add(this.torso);

    // Inner White Tee (visible from front -Z)
    const shirtGeo = new THREE.BoxGeometry(0.38, 0.54, 0.26);
    const shirtMesh = new THREE.Mesh(shirtGeo, this.shirtWhiteMat);
    shirtMesh.position.set(0, 0.02, -0.01);
    shirtMesh.castShadow = true;
    shirtMesh.receiveShadow = true;
    this.torso.add(shirtMesh);

    // Black Streetwear Jacket
    const jacketGeo = new THREE.BoxGeometry(0.48, 0.56, 0.32);
    const jacketMesh = new THREE.Mesh(jacketGeo, this.jacketBlackMat);
    jacketMesh.castShadow = true;
    jacketMesh.receiveShadow = true;
    this.torso.add(jacketMesh);

    // Front Red Zipper & Collar Trim (on -Z side)
    const zipperGeo = new THREE.BoxGeometry(0.04, 0.54, 0.02);
    const zipper = new THREE.Mesh(zipperGeo, this.accentRedMat);
    zipper.position.set(0, 0.02, -0.165);
    this.torso.add(zipper);

    const collarGeo = new THREE.BoxGeometry(0.34, 0.08, 0.12);
    const collar = new THREE.Mesh(collarGeo, this.accentRedMat);
    collar.position.set(0, 0.28, -0.1);
    this.torso.add(collar);

    // 3. Backpack (Mounted on +Z side facing the gameplay camera)
    this.backpack = new THREE.Group();
    this.backpack.position.set(0, 0.06, 0.19);
    this.torso.add(this.backpack);

    // Main pack body
    const packBodyGeo = new THREE.BoxGeometry(0.34, 0.42, 0.18);
    const packBody = new THREE.Mesh(packBodyGeo, this.backpackBlackMat);
    packBody.castShadow = true;
    packBody.receiveShadow = true;
    this.backpack.add(packBody);

    // Red top flap & pocket
    const packFlapGeo = new THREE.BoxGeometry(0.35, 0.14, 0.19);
    const packFlap = new THREE.Mesh(packFlapGeo, this.backpackRedMat);
    packFlap.position.set(0, 0.15, 0.01);
    packFlap.castShadow = true;
    this.backpack.add(packFlap);

    // Red horizontal pocket bar
    const packBarGeo = new THREE.BoxGeometry(0.24, 0.06, 0.03);
    const packBar = new THREE.Mesh(packBarGeo, this.accentRedMat);
    packBar.position.set(0, -0.06, 0.1);
    this.backpack.add(packBar);

    // Padded harness shoulder straps over jacket
    const strapGeo = new THREE.BoxGeometry(0.06, 0.48, 0.35);
    const strapL = new THREE.Mesh(strapGeo, this.backpackBlackMat);
    strapL.position.set(-0.16, 0.05, 0.02);
    this.torso.add(strapL);

    const strapR = new THREE.Mesh(strapGeo, this.backpackBlackMat);
    strapR.position.set(0.16, 0.05, 0.02);
    this.torso.add(strapR);

    // Metal harness buckles
    const buckleGeo = new THREE.BoxGeometry(0.07, 0.03, 0.02);
    const buckleL = new THREE.Mesh(buckleGeo, this.strapBuckleMat);
    buckleL.position.set(-0.16, -0.08, -0.16);
    this.torso.add(buckleL);

    const buckleR = new THREE.Mesh(buckleGeo, this.strapBuckleMat);
    buckleR.position.set(0.16, -0.08, -0.16);
    this.torso.add(buckleR);

    // 4. Head Group (Neck, Face, Cap, Hood)
    this.head = new THREE.Group();
    this.head.position.set(0, 0.46, 0);
    this.torso.add(this.head);

    // Stylized Anime Head Base (Warm Skin Tone)
    const headGeo = new THREE.SphereGeometry(0.22, 16, 16);
    headGeo.scale(1.0, 1.05, 0.95);
    const headMesh = new THREE.Mesh(headGeo, this.skinMat);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // Cartoon Anime Eyes on Front Face (-Z)
    const eyeGeo = new THREE.SphereGeometry(0.035, 12, 12);
    eyeGeo.scale(1.0, 1.3, 0.4);

    const eyeL = new THREE.Mesh(eyeGeo, this.eyesDarkMat);
    eyeL.position.set(-0.08, 0.02, -0.19);
    this.head.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, this.eyesDarkMat);
    eyeR.position.set(0.08, 0.02, -0.19);
    this.head.add(eyeR);

    // Dark Anime Hair Fringe under cap
    const hairGeo = new THREE.BoxGeometry(0.28, 0.08, 0.12);
    const hair = new THREE.Mesh(hairGeo, this.hairDarkMat);
    hair.position.set(0, 0.11, -0.16);
    hair.rotation.x = -0.15;
    this.head.add(hair);

    // Black Baseball Cap Crown
    const capCrownGeo = new THREE.SphereGeometry(0.23, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const capCrown = new THREE.Mesh(capCrownGeo, this.capBlackMat);
    capCrown.position.set(0, 0.06, 0);
    capCrown.castShadow = true;
    this.head.add(capCrown);

    // Curved Red Visor Brim projecting forward (-Z)
    const brimGeo = new THREE.BoxGeometry(0.26, 0.025, 0.18);
    const capBrim = new THREE.Mesh(brimGeo, this.capBrimRedMat);
    capBrim.position.set(0, 0.09, -0.22);
    capBrim.rotation.x = -0.18; // Sporty angled cap brim
    capBrim.castShadow = true;
    this.head.add(capBrim);

    // White Lightning Emblem on cap front
    const logoGeo = new THREE.BoxGeometry(0.08, 0.06, 0.02);
    const capLogo = new THREE.Mesh(logoGeo, this.logoWhiteMat);
    capLogo.position.set(0, 0.18, -0.19);
    this.head.add(capLogo);

    // Red Hoodie Cowl enveloping back (+Z), top, and sides of head
    const hoodCowlGeo = new THREE.SphereGeometry(0.26, 16, 16);
    hoodCowlGeo.scale(1.05, 1.1, 1.15);
    const hoodMesh = new THREE.Mesh(hoodCowlGeo, this.hoodRedMat);
    hoodMesh.position.set(0, 0.04, 0.04);
    hoodMesh.castShadow = true;
    hoodMesh.receiveShadow = true;
    this.head.add(hoodMesh);

    // Red Hood Rim framing the face
    const hoodRimGeo = new THREE.TorusGeometry(0.23, 0.04, 12, 24);
    const hoodRim = new THREE.Mesh(hoodRimGeo, this.hoodRedMat);
    hoodRim.position.set(0, 0.02, -0.1);
    hoodRim.rotation.x = Math.PI / 2;
    this.head.add(hoodRim);

    // Hanging Hoodie Drawstrings
    const cordGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8);
    const cordL = new THREE.Mesh(cordGeo, this.shirtWhiteMat);
    cordL.position.set(-0.09, -0.16, -0.12);
    this.torso.add(cordL);

    const cordR = new THREE.Mesh(cordGeo, this.shirtWhiteMat);
    cordR.position.set(0.09, -0.16, -0.12);
    this.torso.add(cordR);

    // 5. Articulated Limbs: Left Arm (2 segments: Upper Arm -> Forearm -> Hand)
    this.leftShoulder = new THREE.Group();
    this.leftShoulder.position.set(-0.31, 0.22, 0);
    this.torso.add(this.leftShoulder);

    // Left Upper Arm (Black with red chevron arrow)
    const upperArmGeo = new THREE.BoxGeometry(0.13, 0.28, 0.13);
    const leftUpperArmMesh = new THREE.Mesh(upperArmGeo, this.jacketBlackMat);
    leftUpperArmMesh.position.y = -0.14;
    leftUpperArmMesh.castShadow = true;
    this.leftShoulder.add(leftUpperArmMesh);

    const chevronGeo = new THREE.BoxGeometry(0.14, 0.08, 0.14);
    const leftChevron = new THREE.Mesh(chevronGeo, this.accentRedMat);
    leftChevron.position.y = -0.1;
    this.leftShoulder.add(leftChevron);

    // Left Elbow & Forearm
    this.leftElbow = new THREE.Group();
    this.leftElbow.position.set(0, -0.28, 0);
    this.leftShoulder.add(this.leftElbow);

    const forearmGeo = new THREE.BoxGeometry(0.12, 0.24, 0.12);
    const leftForearmMesh = new THREE.Mesh(forearmGeo, this.jacketBlackMat);
    leftForearmMesh.position.y = -0.12;
    leftForearmMesh.castShadow = true;
    this.leftElbow.add(leftForearmMesh);

    // Left Hand (Skin Tone)
    const handGeo = new THREE.BoxGeometry(0.09, 0.1, 0.07);
    const leftHandMesh = new THREE.Mesh(handGeo, this.skinMat);
    leftHandMesh.position.set(0, -0.26, 0);
    leftHandMesh.castShadow = true;
    this.leftElbow.add(leftHandMesh);

    // 6. Right Arm (2 segments: Upper Arm -> Forearm -> Hand)
    this.rightShoulder = new THREE.Group();
    this.rightShoulder.position.set(0.31, 0.22, 0);
    this.torso.add(this.rightShoulder);

    const rightUpperArmMesh = new THREE.Mesh(upperArmGeo, this.jacketBlackMat);
    rightUpperArmMesh.position.y = -0.14;
    rightUpperArmMesh.castShadow = true;
    this.rightShoulder.add(rightUpperArmMesh);

    const rightChevron = new THREE.Mesh(chevronGeo, this.accentRedMat);
    rightChevron.position.y = -0.1;
    this.rightShoulder.add(rightChevron);

    this.rightElbow = new THREE.Group();
    this.rightElbow.position.set(0, -0.28, 0);
    this.rightShoulder.add(this.rightElbow);

    const rightForearmMesh = new THREE.Mesh(forearmGeo, this.jacketBlackMat);
    rightForearmMesh.position.y = -0.12;
    rightForearmMesh.castShadow = true;
    this.rightElbow.add(rightForearmMesh);

    const rightHandMesh = new THREE.Mesh(handGeo, this.skinMat);
    rightHandMesh.position.set(0, -0.26, 0);
    rightHandMesh.castShadow = true;
    this.rightElbow.add(rightHandMesh);

    // 7. Pelvis & Legs: Left Leg (Thigh -> Knee/Shin -> Sneaker)
    this.pelvis = new THREE.Group();
    this.pelvis.position.set(0, 0.58, 0);
    this.bodyContainer.add(this.pelvis);

    // Pelvis shorts/cuff base
    const pelvisGeo = new THREE.BoxGeometry(0.38, 0.16, 0.28);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, this.pantsBlackMat);
    pelvisMesh.castShadow = true;
    this.pelvis.add(pelvisMesh);

    // Left Thigh
    this.leftThigh = new THREE.Group();
    this.leftThigh.position.set(-0.14, 0, 0);
    this.pelvis.add(this.leftThigh);

    const thighGeo = new THREE.BoxGeometry(0.16, 0.32, 0.17);
    const leftThighMesh = new THREE.Mesh(thighGeo, this.pantsBlackMat);
    leftThighMesh.position.y = -0.16;
    leftThighMesh.castShadow = true;
    this.leftThigh.add(leftThighMesh);

    // Outer Red Racing Stripe on Thigh
    const thighStripeGeo = new THREE.BoxGeometry(0.02, 0.32, 0.06);
    const leftThighStripe = new THREE.Mesh(thighStripeGeo, this.pantsStripeRedMat);
    leftThighStripe.position.set(-0.085, -0.16, 0);
    this.leftThigh.add(leftThighStripe);

    // Cargo Pocket on outer left thigh
    const pocketGeo = new THREE.BoxGeometry(0.04, 0.12, 0.1);
    const leftPocket = new THREE.Mesh(pocketGeo, this.accentRedMat);
    leftPocket.position.set(-0.09, -0.16, 0);
    this.leftThigh.add(leftPocket);

    // Left Knee & Shin
    this.leftKnee = new THREE.Group();
    this.leftKnee.position.set(0, -0.32, 0);
    this.leftThigh.add(this.leftKnee);

    const shinGeo = new THREE.BoxGeometry(0.15, 0.32, 0.16);
    const leftShinMesh = new THREE.Mesh(shinGeo, this.pantsBlackMat);
    leftShinMesh.position.y = -0.16;
    leftShinMesh.castShadow = true;
    this.leftKnee.add(leftShinMesh);

    const shinStripeGeo = new THREE.BoxGeometry(0.02, 0.32, 0.06);
    const leftShinStripe = new THREE.Mesh(shinStripeGeo, this.pantsStripeRedMat);
    leftShinStripe.position.set(-0.08, -0.16, 0);
    this.leftKnee.add(leftShinStripe);

    // Left Sneaker Group (Red, Black, and White High-Tops)
    this.leftAnkle = new THREE.Group();
    this.leftAnkle.position.set(0, -0.32, 0);
    this.leftKnee.add(this.leftAnkle);
    this.buildHighTopSneaker(this.leftAnkle);

    // 8. Right Leg (Thigh -> Knee/Shin -> Sneaker)
    this.rightThigh = new THREE.Group();
    this.rightThigh.position.set(0.14, 0, 0);
    this.pelvis.add(this.rightThigh);

    const rightThighMesh = new THREE.Mesh(thighGeo, this.pantsBlackMat);
    rightThighMesh.position.y = -0.16;
    rightThighMesh.castShadow = true;
    this.rightThigh.add(rightThighMesh);

    const rightThighStripe = new THREE.Mesh(thighStripeGeo, this.pantsStripeRedMat);
    rightThighStripe.position.set(0.085, -0.16, 0);
    this.rightThigh.add(rightThighStripe);

    const rightPocket = new THREE.Mesh(pocketGeo, this.accentRedMat);
    rightPocket.position.set(0.09, -0.16, 0);
    this.rightThigh.add(rightPocket);

    this.rightKnee = new THREE.Group();
    this.rightKnee.position.set(0, -0.32, 0);
    this.rightThigh.add(this.rightKnee);

    const rightShinMesh = new THREE.Mesh(shinGeo, this.pantsBlackMat);
    rightShinMesh.position.y = -0.16;
    rightShinMesh.castShadow = true;
    this.rightKnee.add(rightShinMesh);

    const rightShinStripe = new THREE.Mesh(shinStripeGeo, this.pantsStripeRedMat);
    rightShinStripe.position.set(0.08, -0.16, 0);
    this.rightKnee.add(rightShinStripe);

    this.rightAnkle = new THREE.Group();
    this.rightAnkle.position.set(0, -0.32, 0);
    this.rightKnee.add(this.rightAnkle);
    this.buildHighTopSneaker(this.rightAnkle);

    // Shadows across the entire character mesh
    this.mesh.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }

  /**
   * Builds the Red, Black, and White High-Top Skate Sneaker
   */
  buildHighTopSneaker(parentGroup) {
    const sneaker = new THREE.Group();
    sneaker.position.set(0, 0, 0);

    // White Rubber Midsole
    const soleGeo = new THREE.BoxGeometry(0.16, 0.06, 0.32);
    const sole = new THREE.Mesh(soleGeo, this.sneakerWhiteMat);
    sole.position.set(0, -0.03, -0.04);
    sole.castShadow = true;
    sneaker.add(sole);

    // Red Rubber Outsole Tread
    const treadGeo = new THREE.BoxGeometry(0.16, 0.02, 0.32);
    const tread = new THREE.Mesh(treadGeo, this.sneakerRedMat);
    tread.position.set(0, -0.06, -0.04);
    sneaker.add(tread);

    // Red Leather Upper (Heel, Ankle Collar, Eyestay)
    const upperGeo = new THREE.BoxGeometry(0.15, 0.14, 0.28);
    const upper = new THREE.Mesh(upperGeo, this.sneakerRedMat);
    upper.position.set(0, 0.05, -0.03);
    upper.castShadow = true;
    sneaker.add(upper);

    // Black Side Quarter & Tongue
    const sideGeo = new THREE.BoxGeometry(0.155, 0.12, 0.16);
    const side = new THREE.Mesh(sideGeo, this.sneakerBlackMat);
    side.position.set(0, 0.06, -0.02);
    sneaker.add(side);

    // White Front Toe Box
    const toeGeo = new THREE.BoxGeometry(0.14, 0.07, 0.1);
    const toe = new THREE.Mesh(toeGeo, this.sneakerWhiteMat);
    toe.position.set(0, 0.02, -0.14);
    sneaker.add(toe);

    // White Lightning Swoosh Stripe on sides
    const swooshGeo = new THREE.BoxGeometry(0.16, 0.03, 0.16);
    const swoosh = new THREE.Mesh(swooshGeo, this.sneakerWhiteMat);
    swoosh.position.set(0, 0.04, -0.04);
    sneaker.add(swoosh);

    parentGroup.add(sneaker);
  }

  animate(state, dt, speed = 22.0, playerPos = { x: 0, y: 0, z: 0 }) {
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      this.mesh.visible = Math.floor(performance.now() * 0.02) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }

    // Pass state to the Centralized Animation Controller
    this.animator.setState(state);
    this.animator.update(dt, speed, playerPos);
  }

  setInvulnerable(duration) {
    this.invulnerableTimer = duration;
  }
}
