import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { updateOffAxisProjection, EYE_SEPARATION_CM } from '../rendering/OffAxisCamera';
import { useAppStore } from '../store';

// ── Procedural Canvas Textures ────────────────────────────────────────────────

function createCheckeredTexture(size = 256, tiles = 4) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const tileSize = size / tiles;
  for (let y = 0; y < size; y += tileSize) {
    for (let x = 0; x < size; x += tileSize) {
      ctx.fillStyle = (x / tileSize + y / tileSize) % 2 === 0 ? '#f0f0f2' : '#23272e';
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createBrickTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6b301b';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#2d1810';
  ctx.lineWidth = 4;
  const bh = 32;
  const bw = 64;
  for (let y = 0; y < size; y += bh) {
    const offset = (y / bh) % 2 === 0 ? 0 : bw / 2;
    for (let x = -bw; x < size + bw; x += bw) {
      ctx.strokeRect(x + offset, y, bw, bh);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createWoodTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#4a2e16';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#321c0b';
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y * 0.1) * 2);
    ctx.lineTo(size, y + Math.sin(y * 0.1) * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#1d0f05';
  ctx.lineWidth = 3;
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

function createSandTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#c2a66e';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? '#b09459' : '#d9bd84';
    ctx.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createGridTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#050a14';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#1b3b5f';
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
 * Builds the enclosed room walls whose near edges align exactly with the screen bezels:
 * - Left wall at x = -width/2
 * - Right wall at x = +width/2
 * - Floor at y = -height/2
 * - Ceiling at y = +height/2
 * - Back wall at z = -depth
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
  const { width, height, depth } = dim;
  const hw = width / 2;
  const hh = height / 2;

  // Ensure double-sided rendering to prevent back-face culling
  materials.floor.side = THREE.DoubleSide;
  materials.ceiling.side = THREE.DoubleSide;
  materials.wall.side = THREE.DoubleSide;
  materials.back.side = THREE.DoubleSide;

  // Floor (y = -hh, spanning z from 0 to -depth)
  const floorGeo = new THREE.PlaneGeometry(width, depth);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(0, -hh, -depth / 2);
  const floor = new THREE.Mesh(floorGeo, materials.floor);
  group.add(floor);

  // Ceiling (y = +hh, spanning z from 0 to -depth)
  const ceilGeo = new THREE.PlaneGeometry(width, depth);
  ceilGeo.rotateX(Math.PI / 2);
  ceilGeo.translate(0, hh, -depth / 2);
  const ceiling = new THREE.Mesh(ceilGeo, materials.ceiling);
  group.add(ceiling);

  // Left Wall (x = -hw, spanning z from 0 to -depth)
  const leftGeo = new THREE.PlaneGeometry(depth, height);
  leftGeo.rotateY(Math.PI / 2);
  leftGeo.translate(-hw, 0, -depth / 2);
  const leftWall = new THREE.Mesh(leftGeo, materials.wall);
  group.add(leftWall);

  // Right Wall (x = +hw, spanning z from 0 to -depth)
  const rightGeo = new THREE.PlaneGeometry(depth, height);
  rightGeo.rotateY(-Math.PI / 2);
  rightGeo.translate(hw, 0, -depth / 2);
  const rightWall = new THREE.Mesh(rightGeo, materials.wall);
  group.add(rightWall);

  // Back Wall (z = -depth)
  const backGeo = new THREE.PlaneGeometry(width, height);
  backGeo.translate(0, 0, -depth);
  const backWall = new THREE.Mesh(backGeo, materials.back);
  group.add(backWall);
}


// ── Scene 1: Perspective Corridor (Guy Romm's Room) ───────────────────────────

function buildCorridorScene(scene: THREE.Scene, dim: RoomDimensions) {
  const group = new THREE.Group();

  const floorTex = createCheckeredTexture();
  floorTex.repeat.set(dim.width / 20, dim.depth / 20);
  const wallTex = createBrickTexture();
  wallTex.repeat.set(dim.depth / 25, dim.height / 20);
  const woodTex = createWoodTexture();
  woodTex.repeat.set(dim.width / 20, dim.depth / 30);

  createRoomShell(group, dim, {
    floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }),
    ceiling: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9 }),
    wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 }),
    back: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 }),
  });

  const hw = dim.width / 2;
  const hh = dim.height / 2;

  // 1. Table on the left side
  const tableGroup = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x824d28, roughness: 0.6 });
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(22, 1.8, 28), woodMat);
  tableTop.position.set(0, 14, 0);
  tableGroup.add(tableTop);

  const legGeo = new THREE.BoxGeometry(1.6, 14, 1.6);
  const legPositions = [
    [-9, 7, -12],
    [9, 7, -12],
    [-9, 7, 12],
    [9, 7, 12],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(lx, ly, lz);
    tableGroup.add(leg);
  }
  tableGroup.position.set(-hw * 0.45, -hh, -dim.depth * 0.35);
  group.add(tableGroup);

  // 2. Chair on the right side
  const chairGroup = new THREE.Group();
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x2e4860, roughness: 0.5 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(14, 1.4, 14), chairMat);
  seat.position.set(0, 10, 0);
  chairGroup.add(seat);

  const backRest = new THREE.Mesh(new THREE.BoxGeometry(14, 15, 1.2), chairMat);
  backRest.position.set(0, 17.5, -6.5);
  chairGroup.add(backRest);

  const chairLegGeo = new THREE.BoxGeometry(1.2, 10, 1.2);
  const cLegPositions = [
    [-5.5, 5, -5.5],
    [5.5, 5, -5.5],
    [-5.5, 5, 5.5],
    [5.5, 5, 5.5],
  ];
  for (const [cx, cy, cz] of cLegPositions) {
    const cleg = new THREE.Mesh(chairLegGeo, woodMat);
    cleg.position.set(cx, cy, cz);
    chairGroup.add(cleg);
  }
  chairGroup.position.set(hw * 0.45, -hh, -dim.depth * 0.65);
  chairGroup.rotation.y = -0.3;
  group.add(chairGroup);

  // 3. Hanging ceiling lamp
  const lampGroup = new THREE.Group();
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0xffb703,
    metalness: 0.8,
    roughness: 0.3,
  });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(8, 6, 16, 1, true), shadeMat);
  shade.rotation.x = Math.PI;
  lampGroup.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0 }),
  );
  bulb.position.y = -1;
  lampGroup.add(bulb);

  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 18),
    new THREE.MeshBasicMaterial({ color: 0x111111 }),
  );
  cord.position.y = 9;
  lampGroup.add(cord);

  lampGroup.position.set(0, hh - 18, -dim.depth * 0.4);
  group.add(lampGroup);

  // Point light from lamp (decay=0 ensures it doesn't extinguish)
  const lampLight = new THREE.PointLight(0xffe8a3, 2.5, 300);
  lampLight.decay = 0;
  lampLight.position.set(0, hh - 19, -dim.depth * 0.4);
  group.add(lampLight);

  // Directional sun/ceiling light from front
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  dirLight.position.set(20, hh + 40, 20);
  group.add(dirLight);

  // 4. Glossy reflective sphere resting on floor
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(7, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      metalness: 0.9,
      roughness: 0.1,
    }),
  );
  sphere.position.set(-hw * 0.1, -hh + 7, -dim.depth * 0.7);
  group.add(sphere);

  // General ambient lighting
  const amb = new THREE.AmbientLight(0xffffff, 1.3);
  group.add(amb);


  scene.add(group);
  return {
    group,
    update: () => {
      sphere.rotation.y += 0.01;
    },
  };
}

// ── Scene 2: Fish Tank / Aquarium ─────────────────────────────────────────────

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

  // Sandy bottom & water-tinted walls
  const sandTex = createSandTexture();
  sandTex.repeat.set(dim.width / 15, dim.depth / 15);

  const waterWallMat = new THREE.MeshStandardMaterial({
    color: 0x1b6ca8,
    roughness: 0.2,
    metalness: 0.1,
  });

  createRoomShell(group, dim, {
    floor: new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.6 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0x1f5e82, roughness: 0.3 }),
    wall: waterWallMat,
    back: new THREE.MeshStandardMaterial({ color: 0x0f4c75, roughness: 0.3 }),
  });

  // Soft distant water fog (no dense black soup)
  scene.fog = new THREE.Fog(0x0d3b66, 100, 350);

  // Sunlight filtering through the water surface
  const sunLight = new THREE.DirectionalLight(0xedf6f9, 2.4);
  sunLight.position.set(0, hh + 40, -dim.depth * 0.4);
  group.add(sunLight);

  // Water caustics point light (decay=0 ensures it doesn't vanish over distance)
  const causticLight = new THREE.PointLight(0x5eead4, 2.0, 300);
  causticLight.decay = 0;
  causticLight.position.set(0, hh - 2, -dim.depth / 2);
  group.add(causticLight);

  // Ambient fill light for vivid colors
  const amb = new THREE.AmbientLight(0x48bfe3, 1.4);
  group.add(amb);


  // 1. Underwater Rocks & Coral Pillars
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x2d3a3a, roughness: 0.9 });
  const rockPositions = [
    [-hw * 0.7, -hh + 5, -dim.depth * 0.4, 7],
    [-hw * 0.5, -hh + 4, -dim.depth * 0.7, 5],
    [hw * 0.6, -hh + 8, -dim.depth * 0.5, 9],
    [hw * 0.3, -hh + 4, -dim.depth * 0.8, 6],
  ];
  for (const [rx, ry, rz, s] of rockPositions) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), rockMat);
    rock.position.set(rx, ry, rz);
    rock.scale.set(1.2, 0.8, 1);
    group.add(rock);
  }

  // 2. Animated Swimming Fish
  const fishes: Fish[] = [];
  const fishColors = [
    { body: 0xff6b35, stripe: 0xffffff }, // Clownfish
    { body: 0x118ab2, stripe: 0xffd166 }, // Blue tang
    { body: 0xef476f, stripe: 0xffffff }, // Pink Anthias
    { body: 0x06d6a0, stripe: 0x073b4c }, // Emerald Goby
    { body: 0xff9f1c, stripe: 0x2ec4b6 }, // Orange Tetra
  ];

  for (let i = 0; i < 6; i++) {
    const fGroup = new THREE.Group();
    const col = fishColors[i % fishColors.length];

    // Fish body (stretched sphere)
    const bodyGeo = new THREE.SphereGeometry(3, 16, 12);
    bodyGeo.scale(1.8, 1, 0.45);
    const bodyMat = new THREE.MeshStandardMaterial({ color: col.body, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    fGroup.add(body);

    // White stripe
    const stripeGeo = new THREE.CylinderGeometry(1.6, 1.6, 1.2, 16);
    stripeGeo.scale(0.8, 1.5, 0.48);
    const stripe = new THREE.Mesh(stripeGeo, new THREE.MeshBasicMaterial({ color: col.stripe }));
    fGroup.add(stripe);

    // Tail fin (hinged for oscillation)
    const tailGeo = new THREE.ConeGeometry(2, 3, 3);
    tailGeo.rotateZ(Math.PI / 2);
    tailGeo.scale(0.2, 1, 1.4);
    const tailMat = new THREE.MeshStandardMaterial({
      color: col.body,
      transparent: true,
      opacity: 0.85,
    });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(-4.5, 0, 0);
    fGroup.add(tail);

    const fScale = 0.8 + Math.random() * 0.4;
    fGroup.scale.set(fScale, fScale, fScale);

    // Initial random position inside tank
    const initX = (Math.random() - 0.5) * (dim.width * 0.7);
    const initY = -hh * 0.5 + Math.random() * (dim.height * 0.8);
    const initZ = -dim.depth * (0.2 + Math.random() * 0.6);
    fGroup.position.set(initX, initY, initZ);

    group.add(fGroup);
    fishes.push({
      mesh: fGroup,
      tail,
      speed: 0.3 + Math.random() * 0.3,
      direction: Math.random() > 0.5 ? 1 : -1,
      centerZ: initZ,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // 3. Rising Bubbles
  const bubbleCount = 40;
  const bubblePositions = new Float32Array(bubbleCount * 3);
  for (let b = 0; b < bubbleCount; b++) {
    bubblePositions[b * 3] = (Math.random() - 0.5) * dim.width * 0.8;
    bubblePositions[b * 3 + 1] = -hh + Math.random() * dim.height;
    bubblePositions[b * 3 + 2] = -Math.random() * dim.depth;
  }
  const bubbleGeo = new THREE.BufferGeometry();
  bubbleGeo.setAttribute('position', new THREE.Float32BufferAttribute(bubblePositions, 3));
  const bubbles = new THREE.Points(
    bubbleGeo,
    new THREE.PointsMaterial({
      color: 0x99f6e4,
      size: 1.2,
      transparent: true,
      opacity: 0.7,
    }),
  );
  group.add(bubbles);

  scene.add(group);

  return {
    group,
    update: () => {
      const time = performance.now() * 0.003;

      // Caustic flicker
      causticLight.intensity = 4.5 + Math.sin(time * 3) * 0.8 + Math.cos(time * 5) * 0.5;

      // Animate fish swimming
      for (const fish of fishes) {
        fish.mesh.position.x += fish.speed * fish.direction;
        fish.mesh.position.y += Math.sin(time + fish.phase) * 0.08;

        // Tail waggle
        fish.tail.rotation.y = Math.sin(time * 8 + fish.phase) * 0.45;

        // Turn around at tank edges
        const bound = hw * 0.75;
        if (fish.mesh.position.x > bound && fish.direction > 0) {
          fish.direction = -1;
          fish.mesh.rotation.y = Math.PI;
        } else if (fish.mesh.position.x < -bound && fish.direction < 0) {
          fish.direction = 1;
          fish.mesh.rotation.y = 0;
        }
      }

      // Rise bubbles
      const pos = bubbleGeo.attributes.position.array as Float32Array;
      for (let b = 0; b < bubbleCount; b++) {
        pos[b * 3 + 1] += 0.25;
        if (pos[b * 3 + 1] > hh) {
          pos[b * 3 + 1] = -hh;
          pos[b * 3] = (Math.random() - 0.5) * dim.width * 0.8;
        }
      }
      bubbleGeo.attributes.position.needsUpdate = true;
    },
  };
}

// ── Scene 3: Sci-Fi Geometric Chamber ─────────────────────────────────────────

function buildPortalScene(scene: THREE.Scene, dim: RoomDimensions) {
  const group = new THREE.Group();
  const hw = dim.width / 2;
  const hh = dim.height / 2;

  const gridTex = createGridTexture();
  gridTex.repeat.set(dim.width / 15, dim.depth / 15);

  const neonWallMat = new THREE.MeshStandardMaterial({
    map: gridTex,
    roughness: 0.4,
    metalness: 0.7,
  });

  createRoomShell(group, dim, {
    floor: neonWallMat,
    ceiling: neonWallMat,
    wall: neonWallMat,
    back: neonWallMat,
  });

  // Glowing core
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x4df0ff,
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0x0d3c52,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 2), coreMat);
  core.position.set(0, 0, -dim.depth * 0.5);
  group.add(core);

  // Concentric neon rings
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const rMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0x22d3ee : 0xf43f5e,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(12 + i * 4, 0.6, 8, 48), rMat);
    ring.position.set(0, 0, -15 - i * 16);
    group.add(ring);
    rings.push(ring);
  }

  // Accent lights with zero decay
  const lightCyan = new THREE.PointLight(0x22d3ee, 3, 400);
  lightCyan.decay = 0;
  lightCyan.position.set(-hw * 0.5, hh * 0.5, -20);
  group.add(lightCyan);

  const lightPink = new THREE.PointLight(0xf43f5e, 3, 400);
  lightPink.decay = 0;
  lightPink.position.set(hw * 0.5, -hh * 0.5, -dim.depth * 0.6);
  group.add(lightPink);

  const amb = new THREE.AmbientLight(0xffffff, 1.2);
  group.add(amb);

  scene.add(group);


  return {
    group,
    update: () => {
      const t = performance.now() * 0.001;
      core.rotation.y += 0.01;
      core.rotation.x = Math.sin(t * 0.5) * 0.2;
      for (let i = 0; i < rings.length; i++) {
        rings[i].rotation.z += 0.008 * (i % 2 === 0 ? 1 : -1);
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
  ctx.fillStyle = 'rgba(6, 12, 22, 0.9)';
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
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
  ctx.lineWidth = 1;
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
    renderer.autoClear = false; // Required for anaglyph stereoscopic passes
    host.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040810);

    const camera = new THREE.PerspectiveCamera(45, 1, 1, 5000);

    const { calibration } = useAppStore.getState();
    const roomDim: RoomDimensions = {
      width: calibration.widthCm,
      height: calibration.heightCm,
      depth: 120, // 120 cm deep virtual room
    };

    let sceneInstance: { group: THREE.Group; update: () => void };
    if (sceneVariant === 'corridor') {
      scene.background = new THREE.Color(0x1e1b18);
      sceneInstance = buildCorridorScene(scene, roomDim);
    } else if (sceneVariant === 'portal') {
      scene.background = new THREE.Color(0x060b14);
      sceneInstance = buildPortalScene(scene, roomDim);
    } else {
      scene.background = new THREE.Color(0x0a3c5a);
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

      if (!stereoscopic) {
        // Normal single-pass off-axis perspective
        renderer.clear();
        updateOffAxisProjection(camera, tracking, calib, 0);
        renderer.render(scene, camera);
      } else {
        // Red / Cyan Stereoscopic 3D Anaglyph Mode (Guy Romm's stereoscopic effect)
        renderer.clear();

        // 1. Left Eye Pass (Red channel)
        updateOffAxisProjection(camera, tracking, calib, -EYE_SEPARATION_CM / 2);
        const gl = renderer.getContext();
        gl.colorMask(true, false, false, true);
        renderer.render(scene, camera);

        // 2. Right Eye Pass (Cyan channel: Green + Blue)
        renderer.clearDepth();
        updateOffAxisProjection(camera, tracking, calib, +EYE_SEPARATION_CM / 2);
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
