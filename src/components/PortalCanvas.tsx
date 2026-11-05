import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { updateOffAxisProjection, EYE_SEPARATION_CM } from '../rendering/OffAxisCamera';
import { useAppStore } from '../store';

// ── Procedural Canvas Textures ────────────────────────────────────────────────

function createCheckeredTexture(size = 512, tiles = 16) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const tileSize = size / tiles;
  for (let y = 0; y < size; y += tileSize) {
    for (let x = 0; x < size; x += tileSize) {
      const isEven = (x / tileSize + y / tileSize) % 2 === 0;
      ctx.fillStyle = isEven ? '#f1f5f9' : '#1e293b';
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, tileSize, tileSize);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createBrickTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#291307';
  ctx.lineWidth = 3;
  const bh = 24;
  const bw = 56;
  for (let y = 0; y < size; y += bh) {
    const offset = (y / bh) % 2 === 0 ? 0 : bw / 2;
    for (let x = -bw; x < size + bw; x += bw) {
      ctx.fillStyle = (x + y) % 5 === 0 ? '#6c2e0b' : '#853e14';
      ctx.fillRect(x + offset + 2, y + 2, bw - 4, bh - 4);
      ctx.strokeRect(x + offset, y, bw, bh);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createWoodTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3e2412';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#27150a';
  ctx.lineWidth = 1.5;
  for (let y = 0; y < size; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y * 0.08) * 3);
    ctx.lineTo(size, y + Math.sin(y * 0.08) * 3);
    ctx.stroke();
  }
  ctx.strokeStyle = '#180c05';
  ctx.lineWidth = 4;
  for (let x = 0; x < size; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createSandTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#d4b483';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? '#c4a26e' : '#e6caa0';
    ctx.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createGridTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#060d1a';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#0891b2';
  ctx.lineWidth = 2;
  const step = 32;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Environment Builders ──────────────────────────────────────────────────────

interface RoomDimensions {
  width: number;
  height: number;
  depth: number;
}

/**
 * Builds an expansive enclosed room shell where the virtual environment extends
 * comfortably past screen bezels so no black voids appear during head movement.
 */
function createRoomShell(
  group: THREE.Group,
  dim: RoomDimensions,
  materials: {
    floor: THREE.Material;
    ceiling: THREE.Material;
    wall: THREE.Material;
    back: THREE.Material;
  },
) {
  // Generous bounds encompassing the entire off-axis viewing pyramid at any realistic eye position
  const roomW = Math.max(500, dim.width * 6);
  const roomH = Math.max(350, dim.height * 6);
  const roomD = Math.max(450, dim.depth * 3);

  const hw = roomW / 2;
  const hh = roomH / 2;

  materials.floor.side = THREE.DoubleSide;
  materials.ceiling.side = THREE.DoubleSide;
  materials.wall.side = THREE.DoubleSide;
  materials.back.side = THREE.DoubleSide;

  // Floor at -hh
  const floorGeo = new THREE.PlaneGeometry(roomW, roomD);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(0, -hh, -roomD / 2);
  group.add(new THREE.Mesh(floorGeo, materials.floor));

  // Ceiling at +hh
  const ceilGeo = new THREE.PlaneGeometry(roomW, roomD);
  ceilGeo.rotateX(Math.PI / 2);
  ceilGeo.translate(0, hh, -roomD / 2);
  group.add(new THREE.Mesh(ceilGeo, materials.ceiling));

  // Left Wall at -hw
  const leftGeo = new THREE.PlaneGeometry(roomD, roomH);
  leftGeo.rotateY(Math.PI / 2);
  leftGeo.translate(-hw, 0, -roomD / 2);
  group.add(new THREE.Mesh(leftGeo, materials.wall));

  // Right Wall at +hw
  const rightGeo = new THREE.PlaneGeometry(roomD, roomH);
  rightGeo.rotateY(-Math.PI / 2);
  rightGeo.translate(hw, 0, -roomD / 2);
  group.add(new THREE.Mesh(rightGeo, materials.wall));

  // Back Wall at -roomD
  const backGeo = new THREE.PlaneGeometry(roomW, roomH);
  backGeo.translate(0, 0, -roomD);
  group.add(new THREE.Mesh(backGeo, materials.back));
}

// ── Scene 1: Perspective Corridor (Guy Romm's Classic Window) ─────────────────

function buildCorridorScene(scene: THREE.Scene, dim: RoomDimensions) {
  const group = new THREE.Group();

  const floorTex = createCheckeredTexture();
  floorTex.repeat.set(20, 20);
  const wallTex = createBrickTexture();
  wallTex.repeat.set(20, 16);
  const woodTex = createWoodTexture();
  woodTex.repeat.set(16, 20);

  createRoomShell(group, dim, {
    floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 }),
    ceiling: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 }),
    wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8 }),
    back: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8 }),
  });

  const hw = dim.width / 2;
  const hh = dim.height / 2;

  // 1. Classic Study Desk on Left
  const deskGroup = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6d3b14, roughness: 0.5 });
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(26, 2, 36), woodMat);
  deskTop.position.set(0, 15, 0);
  deskGroup.add(deskTop);

  const legGeo = new THREE.BoxGeometry(1.8, 15, 1.8);
  const legPositions = [
    [-11, 7.5, -16],
    [11, 7.5, -16],
    [-11, 7.5, 16],
    [11, 7.5, 16],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(lx, ly, lz);
    deskGroup.add(leg);
  }

  // Book on desk
  const book = new THREE.Mesh(
    new THREE.BoxGeometry(8, 1.2, 11),
    new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 }),
  );
  book.position.set(-2, 16.6, 2);
  book.rotation.y = 0.2;
  deskGroup.add(book);

  deskGroup.position.set(-hw * 0.7, -hh * 0.8, -dim.depth * 0.4);
  group.add(deskGroup);

  // 2. Leather Chair on Right
  const chairGroup = new THREE.Group();
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.4 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 16), chairMat);
  seat.position.set(0, 11, 0);
  chairGroup.add(seat);

  const backRest = new THREE.Mesh(new THREE.BoxGeometry(16, 18, 1.8), chairMat);
  backRest.position.set(0, 20, -7);
  chairGroup.add(backRest);

  const chairLegGeo = new THREE.BoxGeometry(1.4, 11, 1.4);
  const cLegPositions = [
    [-6.5, 5.5, -6.5],
    [6.5, 5.5, -6.5],
    [-6.5, 5.5, 6.5],
    [6.5, 5.5, 6.5],
  ];
  for (const [cx, cy, cz] of cLegPositions) {
    const cleg = new THREE.Mesh(chairLegGeo, woodMat);
    cleg.position.set(cx, cy, cz);
    chairGroup.add(cleg);
  }
  chairGroup.position.set(hw * 0.7, -hh * 0.8, -dim.depth * 0.6);
  chairGroup.rotation.y = -0.35;
  group.add(chairGroup);

  // 3. Hanging Brass Pendant Lamp
  const lampGroup = new THREE.Group();
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.85,
    roughness: 0.2,
  });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(9, 6, 24, 1, true), shadeMat);
  shade.rotation.x = Math.PI;
  lampGroup.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfef08a }),
  );
  bulb.position.y = -1;
  lampGroup.add(bulb);

  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 38),
    new THREE.MeshBasicMaterial({ color: 0x18181b }),
  );
  cord.position.y = 19;
  lampGroup.add(cord);

  lampGroup.position.set(0, hh * 0.7, -dim.depth * 0.5);
  group.add(lampGroup);

  // Point light from lamp
  const lampLight = new THREE.PointLight(0xfffbeb, 2.8, 500);
  lampLight.decay = 0;
  lampLight.position.set(0, hh * 0.65, -dim.depth * 0.5);
  group.add(lampLight);

  // 4. Floating / Reflective Chrome Sphere (Guy Romm's depth test object)
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(8, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.9,
      roughness: 0.05,
    }),
  );
  sphere.position.set(0, 0, -dim.depth * 0.6);
  group.add(sphere);

  // 5. Paintings on Side Walls (peer at them when moving sideways)
  const frameGeo = new THREE.BoxGeometry(2, 24, 30);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.5 });
  const leftPainting = new THREE.Mesh(frameGeo, frameMat);
  leftPainting.position.set(-hw * 0.85, 4, -dim.depth * 0.45);
  group.add(leftPainting);

  const rightPainting = new THREE.Mesh(frameGeo, frameMat);
  rightPainting.position.set(hw * 0.85, 4, -dim.depth * 0.55);
  group.add(rightPainting);

  // General bright daylighting
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
  dirLight.position.set(15, hh + 40, 20);
  group.add(dirLight);

  const amb = new THREE.AmbientLight(0xffffff, 1.4);
  group.add(amb);

  scene.add(group);
  return {
    group,
    update: () => {
      sphere.rotation.y += 0.01;
    },
  };
}

// ── Scene 2: Living Fish Tank / Aquarium ──────────────────────────────────────

interface Fish {
  mesh: THREE.Group;
  tail: THREE.Mesh;
  speed: number;
  direction: number;
  centerZ: number;
  phase: number;
}

function buildAquariumScene(scene: THREE.Scene, dim: RoomDimensions) {
  const group = new THREE.Group();
  const hw = dim.width / 2;
  const hh = dim.height / 2;

  const sandTex = createSandTexture();
  sandTex.repeat.set(24, 24);

  const oceanWallMat = new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    roughness: 0.3,
    metalness: 0.1,
  });

  createRoomShell(group, dim, {
    floor: new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.7 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 }),
    wall: oceanWallMat,
    back: new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.4 }),
  });

  // Atmospheric oceanic fog
  scene.fog = new THREE.Fog(0x0284c7, 100, 480);

  // Sunlight filtering down through water surface
  const sunLight = new THREE.DirectionalLight(0xe0f2fe, 2.6);
  sunLight.position.set(0, hh + 50, -dim.depth * 0.3);
  group.add(sunLight);

  // Animated water caustics light
  const causticLight = new THREE.PointLight(0x38bdf8, 2.4, 500);
  causticLight.decay = 0;
  causticLight.position.set(0, hh * 0.8, -dim.depth * 0.4);
  group.add(causticLight);

  const amb = new THREE.AmbientLight(0x38bdf8, 1.6);
  group.add(amb);

  // 1. Coral Pillars & Sea Rocks
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
  const coralMatPink = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.6 });
  const coralMatTeal = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.6 });

  const rockPositions = [
    [-hw * 0.7, -hh * 0.55, -dim.depth * 0.35, 11],
    [-hw * 0.4, -hh * 0.65, -dim.depth * 0.65, 8],
    [hw * 0.6, -hh * 0.5, -dim.depth * 0.45, 12],
    [hw * 0.3, -hh * 0.65, -dim.depth * 0.75, 9],
  ];
  for (const [rx, ry, rz, s] of rockPositions) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), rockMat);
    rock.position.set(rx, ry, rz);
    rock.scale.set(1.2, 0.9, 1);
    group.add(rock);

    // Coral branch on rock
    const coralGeo = new THREE.CylinderGeometry(1.0, 2.2, 11, 6);
    const coral = new THREE.Mesh(coralGeo, Math.random() > 0.5 ? coralMatPink : coralMatTeal);
    coral.position.set(rx, ry + s * 0.7, rz);
    coral.rotation.z = (Math.random() - 0.5) * 0.5;
    group.add(coral);
  }

  // 2. Animated Tropical Fish swimming across the visible viewport
  const fishes: Fish[] = [];
  const fishColors = [
    { body: 0xf97316, stripe: 0xffffff }, // Clownfish
    { body: 0x0284c7, stripe: 0xfacc15 }, // Blue Tang
    { body: 0xec4899, stripe: 0xffffff }, // Pink Anthias
    { body: 0x10b981, stripe: 0x064e3b }, // Emerald Goby
    { body: 0xfbbf24, stripe: 0x06b6d4 }, // Sunburst Tetra
    { body: 0xa855f7, stripe: 0xffffff }, // Purple Firefish
    { body: 0xef4444, stripe: 0xffedd5 }, // Flame Angelfish
  ];

  for (let i = 0; i < fishColors.length; i++) {
    const fGroup = new THREE.Group();
    const col = fishColors[i];

    // Fish body
    const bodyGeo = new THREE.SphereGeometry(3, 16, 12);
    bodyGeo.scale(1.8, 1, 0.45);
    const bodyMat = new THREE.MeshStandardMaterial({ color: col.body, roughness: 0.35 });
    fGroup.add(new THREE.Mesh(bodyGeo, bodyMat));

    // Decorative stripe
    const stripeGeo = new THREE.CylinderGeometry(1.6, 1.6, 1.2, 16);
    stripeGeo.scale(0.8, 1.5, 0.48);
    fGroup.add(new THREE.Mesh(stripeGeo, new THREE.MeshBasicMaterial({ color: col.stripe })));

    // Oscillating tail fin
    const tailGeo = new THREE.ConeGeometry(2.2, 3.2, 3);
    tailGeo.rotateZ(Math.PI / 2);
    tailGeo.scale(0.2, 1, 1.4);
    const tail = new THREE.Mesh(
      tailGeo,
      new THREE.MeshStandardMaterial({ color: col.body, transparent: true, opacity: 0.85 }),
    );
    tail.position.set(-4.8, 0, 0);
    fGroup.add(tail);

    const fScale = 0.9 + Math.random() * 0.35;
    fGroup.scale.set(fScale, fScale, fScale);

    // Initial position centered in the viewable portal area
    const initX = (Math.random() - 0.5) * (dim.width * 0.85);
    const initY = (Math.random() - 0.5) * (dim.height * 0.7);
    const initZ = -dim.depth * (0.25 + (i / fishColors.length) * 0.55);
    fGroup.position.set(initX, initY, initZ);

    group.add(fGroup);
    fishes.push({
      mesh: fGroup,
      tail,
      speed: 0.32 + Math.random() * 0.3,
      direction: Math.random() > 0.5 ? 1 : -1,
      centerZ: initZ,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // 3. Rising Translucent Bubbles
  const bubbleCount = 55;
  const bubblePositions = new Float32Array(bubbleCount * 3);
  for (let b = 0; b < bubbleCount; b++) {
    bubblePositions[b * 3] = (Math.random() - 0.5) * dim.width * 1.5;
    bubblePositions[b * 3 + 1] = -hh * 0.7 + Math.random() * dim.height * 2;
    bubblePositions[b * 3 + 2] = -Math.random() * dim.depth * 1.5;
  }
  const bubbleGeo = new THREE.BufferGeometry();
  bubbleGeo.setAttribute('position', new THREE.Float32BufferAttribute(bubblePositions, 3));
  const bubbles = new THREE.Points(
    bubbleGeo,
    new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 1.6,
      transparent: true,
      opacity: 0.8,
    }),
  );
  group.add(bubbles);

  scene.add(group);

  return {
    group,
    update: () => {
      const time = performance.now() * 0.003;

      // Caustic flicker
      causticLight.intensity = 2.4 + Math.sin(time * 2.5) * 0.6 + Math.cos(time * 4) * 0.4;

      // Animate swimming fish
      for (const fish of fishes) {
        fish.mesh.position.x += fish.speed * fish.direction;
        fish.mesh.position.y += Math.sin(time + fish.phase) * 0.09;
        fish.tail.rotation.y = Math.sin(time * 8 + fish.phase) * 0.45;

        const bound = hw * 0.95;
        if (fish.mesh.position.x > bound && fish.direction > 0) {
          fish.direction = -1;
          fish.mesh.rotation.y = Math.PI;
        } else if (fish.mesh.position.x < -bound && fish.direction < 0) {
          fish.direction = 1;
          fish.mesh.rotation.y = 0;
        }
      }

      // Rising bubbles
      const pos = bubbleGeo.attributes.position.array as Float32Array;
      for (let b = 0; b < bubbleCount; b++) {
        pos[b * 3 + 1] += 0.3;
        if (pos[b * 3 + 1] > hh * 0.8) {
          pos[b * 3 + 1] = -hh * 0.7;
          pos[b * 3] = (Math.random() - 0.5) * dim.width * 1.5;
        }
      }
      bubbleGeo.attributes.position.needsUpdate = true;
    },
  };
}

// ── Scene 3: Sci-Fi Neon Chamber ──────────────────────────────────────────────

function buildPortalScene(scene: THREE.Scene, dim: RoomDimensions) {
  const group = new THREE.Group();
  const hw = dim.width / 2;
  const hh = dim.height / 2;

  const gridTex = createGridTexture();
  gridTex.repeat.set(24, 24);

  const neonWallMat = new THREE.MeshStandardMaterial({
    map: gridTex,
    roughness: 0.3,
    metalness: 0.8,
  });

  createRoomShell(group, dim, {
    floor: neonWallMat,
    ceiling: neonWallMat,
    wall: neonWallMat,
    back: neonWallMat,
  });

  // Glowing central icosahedron core
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0x083344,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(12, 2), coreMat);
  core.position.set(0, 0, -dim.depth * 0.55);
  group.add(core);

  // Concentric neon rings receding into depth
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const isCyan = i % 2 === 0;
    const rMat = new THREE.MeshBasicMaterial({
      color: isCyan ? 0x22d3ee : 0xf43f5e,
      transparent: true,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(15 + i * 4.5, 0.75, 8, 48), rMat);
    ring.position.set(0, 0, -18 - i * 18);
    group.add(ring);
    rings.push(ring);
  }

  // Orbiting cyber cubes
  const cubes: THREE.Mesh[] = [];
  const cubeGeo = new THREE.BoxGeometry(4.5, 4.5, 4.5);
  const cubeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.9,
    roughness: 0.2,
  });
  for (let c = 0; c < 6; c++) {
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    group.add(cube);
    cubes.push(cube);
  }

  // Accent lights with zero decay
  const lightCyan = new THREE.PointLight(0x22d3ee, 3.2, 500);
  lightCyan.decay = 0;
  lightCyan.position.set(-hw * 0.6, hh * 0.5, -25);
  group.add(lightCyan);

  const lightPink = new THREE.PointLight(0xf43f5e, 3.2, 500);
  lightPink.decay = 0;
  lightPink.position.set(hw * 0.6, -hh * 0.5, -dim.depth * 0.6);
  group.add(lightPink);

  const amb = new THREE.AmbientLight(0xffffff, 1.3);
  group.add(amb);

  scene.add(group);

  return {
    group,
    update: () => {
      const t = performance.now() * 0.001;
      core.rotation.y += 0.012;
      core.rotation.x = Math.sin(t * 0.5) * 0.25;

      for (let i = 0; i < rings.length; i++) {
        rings[i].rotation.z += 0.009 * (i % 2 === 0 ? 1 : -1);
      }

      for (let c = 0; c < cubes.length; c++) {
        const angle = t * 0.8 + (c * Math.PI * 2) / cubes.length;
        const radius = 26 + c * 3;
        cubes[c].position.set(
          Math.cos(angle) * radius,
          Math.sin(angle) * (radius * 0.6),
          -dim.depth * 0.55 + Math.sin(t + c) * 12,
        );
        cubes[c].rotation.x += 0.02;
        cubes[c].rotation.y += 0.03;
      }
    },
  };
}

// ── Isometric Debug View Canvas (Guy Romm's Visualizer) ───────────────────────

function drawDebugView(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  head: { x: number; y: number; z: number },
  screenDim: { widthCm: number; heightCm: number },
) {
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = 'rgba(7, 13, 24, 0.95)';
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height * 0.55;
  const scale = 0.55; // cm to canvas px

  // Isometric projection: 30 deg angle
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);

  function toIso(x: number, y: number, z: number) {
    const isoX = (x - z) * cos30 * scale;
    const isoY = ((x + z) * sin30 - y) * scale;
    return { x: cx + isoX, y: cy + isoY };
  }

  // 1. Grid
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)';
  ctx.lineWidth = 1;
  for (let g = -100; g <= 100; g += 25) {
    const s1 = toIso(g, 0, -80);
    const e1 = toIso(g, 0, 100);
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(e1.x, e1.y);
    ctx.stroke();

    const s2 = toIso(-100, 0, g);
    const e2 = toIso(100, 0, g);
    ctx.beginPath();
    ctx.moveTo(s2.x, s2.y);
    ctx.lineTo(e2.x, e2.y);
    ctx.stroke();
  }

  // 2. Physical Monitor (z = 0)
  const hw = screenDim.widthCm / 2;
  const hh = screenDim.heightCm / 2;
  const scCorners = [
    toIso(-hw, -hh, 0),
    toIso(hw, -hh, 0),
    toIso(hw, hh, 0),
    toIso(-hw, hh, 0),
  ];

  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(scCorners[0].x, scCorners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(scCorners[i].x, scCorners[i].y);
  ctx.closePath();
  ctx.stroke();

  // 3. Head Position (Viewer)
  const viewer = toIso(head.x, head.y, head.z);

  // Frustum lines connecting head to 4 screen corners
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.5)';
  ctx.lineWidth = 1.2;
  for (const c of scCorners) {
    ctx.beginPath();
    ctx.moveTo(viewer.x, viewer.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }

  // Viewer dot
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(viewer.x, viewer.y, 6, 0, Math.PI * 2);
  ctx.fill();

  // Labels
  ctx.fillStyle = '#22d3ee';
  ctx.font = '10px monospace';
  ctx.fillText('Screen (z=0)', scCorners[1].x + 4, scCorners[1].y);
  ctx.fillStyle = '#f43f5e';
  ctx.fillText('You', viewer.x + 8, viewer.y - 2);

  // Position readout
  ctx.fillStyle = '#f1f5f9';
  ctx.fillText(`Head X: ${head.x.toFixed(1)} cm`, 10, 16);
  ctx.fillText(`Head Y: ${head.y.toFixed(1)} cm`, 10, 30);
  ctx.fillText(`Head Z: ${head.z.toFixed(1)} cm`, 10, 44);
}

// ── Main React Component ──────────────────────────────────────────────────────

export function PortalCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);

  const sceneVariant = useAppStore((s) => s.scene);
  const debug = useAppStore((s) => s.debug);

  useEffect(() => {
    if (!host.current) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.current.clientWidth, host.current.clientHeight);
    host.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 5000);

    const { calibration } = useAppStore.getState();
    const aspect =
      host.current.clientHeight > 0
        ? host.current.clientWidth / host.current.clientHeight
        : calibration.widthCm / calibration.heightCm;

    const roomDim: RoomDimensions = {
      width: Math.max(calibration.widthCm, calibration.heightCm * aspect),
      height: calibration.heightCm,
      depth: 160,
    };

    let sceneInstance: { group: THREE.Group; update: () => void };
    if (sceneVariant === 'corridor') {
      scene.background = new THREE.Color(0x1c1917);
      renderer.setClearColor(0x1c1917, 1.0);
      sceneInstance = buildCorridorScene(scene, roomDim);
    } else if (sceneVariant === 'portal') {
      scene.background = new THREE.Color(0x060b14);
      renderer.setClearColor(0x060b14, 1.0);
      sceneInstance = buildPortalScene(scene, roomDim);
    } else {
      scene.background = new THREE.Color(0x0284c7);
      renderer.setClearColor(0x0284c7, 1.0);
      sceneInstance = buildAquariumScene(scene, roomDim);
    }

    const resize = () => {
      if (!host.current) return;
      const w = host.current.clientWidth;
      const h = host.current.clientHeight;
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', resize);
    resize();

    // Render loop
    renderer.setAnimationLoop(() => {
      sceneInstance.update();

      const state = useAppStore.getState();
      const { tracking, calibration: calib, stereoscopic } = state;
      const curAspect =
        host.current && host.current.clientHeight > 0
          ? host.current.clientWidth / host.current.clientHeight
          : calib.widthCm / calib.heightCm;

      if (!stereoscopic) {
        // Normal single-pass off-axis perspective: Three.js automatically clears to scene.background
        renderer.autoClear = true;
        updateOffAxisProjection(camera, tracking, calib, curAspect, 0);
        renderer.render(scene, camera);
      } else {
        // Red / Cyan Stereoscopic 3D Anaglyph Mode
        renderer.autoClear = false;
        if (scene.background instanceof THREE.Color) {
          renderer.setClearColor(scene.background, 1.0);
        }
        renderer.clear();

        // 1. Left Eye Pass (Red channel)
        updateOffAxisProjection(camera, tracking, calib, curAspect, -EYE_SEPARATION_CM / 2);
        const gl = renderer.getContext();
        gl.colorMask(true, false, false, true);
        renderer.render(scene, camera);

        // 2. Right Eye Pass (Cyan channel: Green + Blue)
        renderer.clearDepth();
        updateOffAxisProjection(camera, tracking, calib, curAspect, +EYE_SEPARATION_CM / 2);
        gl.colorMask(false, true, true, true);
        renderer.render(scene, camera);

        // Restore color mask
        gl.colorMask(true, true, true, true);
      }

      // Draw isometric debug map if active
      if (debugCanvasRef.current && state.debug) {
        const dCtx = debugCanvasRef.current.getContext('2d');
        if (dCtx) {
          drawDebugView(
            dCtx,
            debugCanvasRef.current.width,
            debugCanvasRef.current.height,
            tracking,
            calib,
          );
        }
      }
    });

    return () => {
      window.removeEventListener('resize', resize);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      host.current?.removeChild(renderer.domElement);
    };
  }, [sceneVariant]);

  return (
    <div ref={host} className="portal-canvas" aria-label="Head-tracked 3D portal">
      {debug && (
        <canvas
          ref={debugCanvasRef}
          className="isometric-debug-canvas"
          width={280}
          height={200}
        />
      )}
    </div>
  );
}
