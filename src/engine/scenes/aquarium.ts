import * as THREE from 'three';
import type { Environment } from './types';
import { createSandTexture, createWaterTexture } from './textures';

const TANK = {
  width: 720,
  height: 200,
  depth: 620,
};

const FLOOR_Y = -95;
const SURFACE_Y = 105;
const BACK_Z = -TANK.depth;

interface Fish {
  group: THREE.Group;
  tailPivot: THREE.Object3D;
  phase: number;
  speed: number;
  rangeX: number;
  baseY: number;
  baseZ: number;
  driftZ: number;
  previous: THREE.Vector3;
}

interface Seaweed {
  mesh: THREE.Mesh;
  baseRotation: number;
  phase: number;
}

function createFish(size: number, color: number, accent: number, seed: number): Fish {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0.08,
  });
  const bellyMaterial = new THREE.MeshStandardMaterial({
    color: accent,
    roughness: 0.48,
  });
  const finMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.72),
    roughness: 0.55,
    side: THREE.DoubleSide,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), bodyMaterial);
  body.scale.set(size * 0.5, size * 0.27, size * 0.15);
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), bellyMaterial);
  belly.scale.set(size * 0.42, size * 0.14, size * 0.137);
  belly.position.set(size * 0.03, -size * 0.1, 0);
  group.add(belly);

  const eyeGeometry = new THREE.SphereGeometry(size * 0.04, 8, 8);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x06121c });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(size * 0.31, size * 0.06, side * size * 0.126);
    group.add(eye);
  }

  // Tail on a pivot so it can wag independently.
  const tailPivot = new THREE.Object3D();
  tailPivot.position.set(-size * 0.43, 0, 0);
  group.add(tailPivot);

  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(size * 0.23, size * 0.4, 4),
    finMaterial,
  );
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -size * 0.14;
  tail.scale.z = 0.2;
  tailPivot.add(tail);

  const fin = new THREE.Mesh(
    new THREE.ConeGeometry(size * 0.13, size * 0.26, 3),
    finMaterial,
  );
  fin.position.set(-size * 0.04, size * 0.2, 0);
  fin.rotation.z = -0.6;
  fin.scale.z = 0.18;
  group.add(fin);

  return {
    group,
    tailPivot,
    phase: seed * 1.73,
    speed: 0.16 + (seed % 5) * 0.028,
    rangeX: 100 + (seed % 5) * 28,
    baseY: -50 + (seed % 8) * 13,
    baseZ: -175 - (seed % 7) * 58 - (seed % 3) * 12,
    driftZ: 18 + (seed % 4) * 12,
    previous: new THREE.Vector3(),
  };
}

function createRock(radius: number, position: THREE.Vector3, color: number): THREE.Mesh {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(radius, 1),
    new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0.02 }),
  );
  rock.position.copy(position);
  rock.scale.set(1.12, 0.76, 1);
  rock.rotation.set(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.35);
  return rock;
}

function createCoral(radius: number, height: number, color: number): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.56 });

  const trunkHeight = height * 0.38;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.5, radius * 0.88, trunkHeight, 7),
    material,
  );
  trunk.position.y = trunkHeight / 2;
  group.add(trunk);

  const crown = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.55, 10, 8), material);
  crown.position.y = trunkHeight;
  crown.scale.y = 0.7;
  group.add(crown);

  // Bent staghorn branches with rounded tips read more organically than
  // straight cones at a distance.
  for (let branchIndex = 0; branchIndex < 5; branchIndex += 1) {
    const angle = (branchIndex / 5) * Math.PI * 2 + Math.random() * 0.4;
    const branch = new THREE.Group();
    branch.position.y = trunkHeight + (branchIndex % 2) * height * 0.04;
    branch.rotation.y = angle;
    branch.rotation.z = 0.48 + (branchIndex % 3) * 0.16 + Math.random() * 0.1;

    const length = height * (0.24 + Math.random() * 0.16);
    const lower = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.15, radius * 0.31, length, 6),
      material,
    );
    lower.position.y = length / 2;
    branch.add(lower);

    const fork = new THREE.Group();
    fork.position.y = length;
    fork.rotation.z = -0.28 - Math.random() * 0.22;
    const upperLength = length * (0.55 + Math.random() * 0.3);
    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.07, radius * 0.15, upperLength, 5),
      material,
    );
    upper.position.y = upperLength / 2;
    fork.add(upper);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.17, 8, 6), material);
    tip.position.y = upperLength;
    fork.add(tip);

    branch.add(fork);
    group.add(branch);
  }

  return group;
}

export function createAquarium(): Environment {
  const group = new THREE.Group();

  const sandTexture = createSandTexture();
  sandTexture.repeat.set(6, 5);
  const waterTexture = createWaterTexture();
  waterTexture.repeat.set(1.2, 1);

  // ── Tank shell ──────────────────────────────────────────────────────────
  const sandMaterial = new THREE.MeshStandardMaterial({
    map: sandTexture,
    roughness: 0.92,
    metalness: 0,
    color: 0xd8c49a,
  });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(TANK.width, TANK.depth), sandMaterial);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, FLOOR_Y, -TANK.depth / 2);
  group.add(sand);

  const backMaterial = new THREE.MeshStandardMaterial({
    map: waterTexture,
    emissive: 0x0a4a5f,
    emissiveMap: waterTexture,
    emissiveIntensity: 0.28,
    roughness: 0.9,
  });
  const tankCenterY = (FLOOR_Y + SURFACE_Y) / 2;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(TANK.width, TANK.height), backMaterial);
  back.position.set(0, tankCenterY, BACK_Z);
  group.add(back);

  const sideMaterial = new THREE.MeshStandardMaterial({
    map: waterTexture,
    color: 0x5b9cb0,
    emissive: 0x063346,
    emissiveIntensity: 0.35,
    roughness: 0.9,
  });
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(TANK.depth, TANK.height), sideMaterial);
    wall.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(side * (TANK.width / 2), tankCenterY, -TANK.depth / 2);
    group.add(wall);
  }

  // Underside of the water surface.
  const surfaceMaterial = new THREE.MeshStandardMaterial({
    color: 0x6fdcf5,
    emissive: 0x0ea5c4,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.2,
    roughness: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(TANK.width, TANK.depth), surfaceMaterial);
  surface.rotation.x = Math.PI / 2;
  surface.position.set(0, SURFACE_Y, -TANK.depth / 2);
  group.add(surface);

  // ── Reef ────────────────────────────────────────────────────────────────
  const rockLayout: Array<[number, number, number, number]> = [
    [-230, -265, 36, 0x2f4858],
    [195, -305, 40, 0x3a4a55],
    [-115, -355, 46, 0x2b3e4c],
    [280, -435, 36, 0x344b59],
    [-300, -475, 44, 0x2c4552],
    [25, -505, 62, 0x354f5c],
    [205, -575, 34, 0x2a3f4d],
    [-190, -605, 32, 0x314855],
    [90, -220, 27, 0x2c424f],
  ];
  const coralColors = [0xf43f5e, 0x14b8a6, 0xf59e0b, 0xa855f7, 0xfb7185, 0x2dd4bf];

  for (const [x, z, radius, color] of rockLayout) {
    const rock = createRock(radius, new THREE.Vector3(x, FLOOR_Y + radius * 0.52, z), color);
    group.add(rock);

    const coral = createCoral(
      radius * 0.18,
      30 + Math.random() * 48,
      coralColors[Math.floor(Math.random() * coralColors.length)],
    );
    coral.position.set(x + (Math.random() - 0.5) * radius * 0.5, FLOOR_Y + radius * 1.08, z);
    coral.rotation.y = Math.random() * Math.PI * 2;
    group.add(coral);
  }

  // A tall central coral spire anchors the view.
  const centralCoral = createCoral(11, 88, 0xf97316);
  centralCoral.position.set(25, FLOOR_Y + 74, -500);
  group.add(centralCoral);
  const centralCoralTwo = createCoral(8, 62, 0xf43f5e);
  centralCoralTwo.position.set(-16, FLOOR_Y + 66, -510);
  group.add(centralCoralTwo);

  // ── Seaweed ─────────────────────────────────────────────────────────────
  const seaweeds: Seaweed[] = [];
  const seaweedMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f9e6f,
    roughness: 0.68,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 26; i += 1) {
    const height = 45 + Math.random() * 70;
    const blade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 2.2, height, 4),
      seaweedMaterial,
    );
    const x = (Math.random() - 0.5) * TANK.width * 0.85;
    const z = -170 - Math.random() * (TANK.depth - 190);
    blade.position.set(x, FLOOR_Y + height / 2, z);
    const baseRotation = (Math.random() - 0.5) * 0.38;
    blade.rotation.z = baseRotation;
    group.add(blade);
    seaweeds.push({ mesh: blade, baseRotation, phase: Math.random() * Math.PI * 2 });
  }

  // Foreground kelp frames the window; it swings with parallax as you move.
  for (const [x, z, height] of [
    [-78, -145, 118],
    [82, -160, 108],
    [-172, -330, 126],
    [184, -380, 118],
  ] as Array<[number, number, number]>) {
    const blade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 2, height, 5),
      seaweedMaterial,
    );
    blade.position.set(x, FLOOR_Y + height / 2, z);
    const baseRotation = (x < 0 ? 1 : -1) * 0.08;
    blade.rotation.z = baseRotation;
    group.add(blade);
    seaweeds.push({ mesh: blade, baseRotation, phase: Math.random() * Math.PI * 2 });
  }

  // ── Fish ────────────────────────────────────────────────────────────────
  const palette = [
    { body: 0xf97316, accent: 0xfff7ed },
    { body: 0x0284c7, accent: 0xfacc15 },
    { body: 0xec4899, accent: 0xffe4e6 },
    { body: 0x10b981, accent: 0xd1fae5 },
    { body: 0xfbbf24, accent: 0xfffbeb },
    { body: 0xa855f7, accent: 0xf3e8ff },
    { body: 0xef4444, accent: 0xffe4e6 },
    { body: 0x38bdf8, accent: 0xe0f2fe },
    { body: 0xf472b6, accent: 0xfdf2f8 },
  ];

  const fishes: Fish[] = [];
  for (let i = 0; i < 18; i += 1) {
    const colors = palette[i % palette.length];
    const size = 13 + ((i * 7) % 15) + Math.random() * 6;
    const fish = createFish(size, colors.body, colors.accent, i);
    const startX = Math.sin(fish.phase) * fish.rangeX;
    const startZ = fish.baseZ + Math.cos(fish.phase) * fish.driftZ;
    fish.group.position.set(startX, fish.baseY, startZ);
    fish.previous.copy(fish.group.position);
    group.add(fish.group);
    fishes.push(fish);
  }

  // ── Bubbles ─────────────────────────────────────────────────────────────
  const bubbleCount = 170;
  const bubblePositions = new Float32Array(bubbleCount * 3);
  const bubbleSpeeds = new Float32Array(bubbleCount);
  for (let i = 0; i < bubbleCount; i += 1) {
    const clustered = i % 3 !== 0;
    bubblePositions[i * 3] = clustered
      ? 25 + (Math.random() - 0.5) * 90
      : (Math.random() - 0.5) * TANK.width * 0.85;
    bubblePositions[i * 3 + 1] = FLOOR_Y + Math.random() * TANK.height;
    bubblePositions[i * 3 + 2] = clustered
      ? -460 + (Math.random() - 0.5) * 130
      : -80 - Math.random() * (TANK.depth - 100);
    bubbleSpeeds[i] = 7 + Math.random() * 16;
  }
  const bubbleGeometry = new THREE.BufferGeometry();
  bubbleGeometry.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3));
  const bubbles = new THREE.Points(
    bubbleGeometry,
    new THREE.PointsMaterial({
      color: 0xd6f8ff,
      size: 2.3,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    }),
  );
  group.add(bubbles);

  // ── Light shafts ────────────────────────────────────────────────────────
  const shaftMaterial = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.035,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shafts: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i += 1) {
    const shaft = new THREE.Mesh(
      new THREE.ConeGeometry(18 + i * 6, 280, 12, 1, true),
      shaftMaterial,
    );
    shaft.position.set(-130 + i * 85, 55, -260 - i * 80);
    shaft.rotation.z = (Math.random() - 0.5) * 0.12;
    group.add(shaft);
    shafts.push(shaft);
  }

  // ── Lighting ────────────────────────────────────────────────────────────
  const hemisphere = new THREE.HemisphereLight(0xc3f7ff, 0x083244, 1.55);
  group.add(hemisphere);

  const sunlight = new THREE.DirectionalLight(0xe8fcff, 2.6);
  sunlight.position.set(80, 380, 220);
  group.add(sunlight);

  const caustic = new THREE.PointLight(0x38bdf8, 3, 900, 0);
  caustic.position.set(0, 160, -280);
  group.add(caustic);

  const warmRim = new THREE.PointLight(0xf59e0b, 0.5, 700, 0);
  warmRim.position.set(-180, -40, -320);
  group.add(warmRim);

  return {
    group,
    background: new THREE.Color(0x063b50),
    fog: new THREE.Fog(0x063b50, 300, 1050),
    update: (dt, elapsed) => {
      // Fish swim along gentle Lissajous paths.
      for (const fish of fishes) {
        const angle = elapsed * fish.speed + fish.phase;
        const x = Math.sin(angle) * fish.rangeX;
        const y = fish.baseY + Math.sin(angle * 0.62 + fish.phase * 1.7) * 16;
        const z = fish.baseZ + Math.cos(angle * 0.47 + fish.phase) * fish.driftZ;

        const dx = x - fish.previous.x;
        const dz = z - fish.previous.z;
        if (Math.abs(dx) + Math.abs(dz) > 1e-4) {
          const targetYaw = Math.atan2(-dz, dx);
          fish.group.rotation.y += (targetYaw - fish.group.rotation.y) * Math.min(1, dt * 4);
        }

        fish.group.position.set(x, y, z);
        fish.previous.set(x, y, z);

        fish.tailPivot.rotation.y = Math.sin(elapsed * 7.5 + fish.phase * 3) * 0.5;
        fish.group.rotation.z = Math.sin(angle * 0.9) * 0.055;
      }

      // Bubbles rise and wrap around.
      const position = bubbleGeometry.attributes.position as THREE.BufferAttribute;
      const array = position.array as Float32Array;
      for (let i = 0; i < bubbleCount; i += 1) {
        array[i * 3 + 1] += bubbleSpeeds[i] * dt;
        array[i * 3] += Math.sin(elapsed * 1.6 + i) * dt * 2;
        if (array[i * 3 + 1] > SURFACE_Y) {
          array[i * 3 + 1] = FLOOR_Y;
          array[i * 3] = (Math.random() - 0.5) * TANK.width * 0.85;
          array[i * 3 + 2] = -80 - Math.random() * (TANK.depth - 100);
        }
      }
      position.needsUpdate = true;

      // Caustic shimmer
      caustic.intensity = 2.8 + Math.sin(elapsed * 2.1) * 0.6 + Math.cos(elapsed * 4.7) * 0.24;
      caustic.position.x = Math.sin(elapsed * 0.5) * 150;
      surfaceMaterial.emissiveIntensity = 0.5 + Math.sin(elapsed * 1.4) * 0.16;
      shaftMaterial.opacity = 0.028 + Math.sin(elapsed * 0.8) * 0.01;

      // Seaweed sway
      for (const weed of seaweeds) {
        weed.mesh.rotation.z =
          weed.baseRotation + Math.sin(elapsed * 1.15 + weed.phase) * 0.12;
      }

      // Slight lateral drift keeps the god rays alive.
      for (let i = 0; i < shafts.length; i += 1) {
        shafts[i].rotation.z = Math.sin(elapsed * 0.3 + i) * 0.06;
      }
    },
  };
}
