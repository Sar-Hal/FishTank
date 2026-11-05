import * as THREE from 'three';
import type { Environment } from './types';
import { createGridTexture, createHoloTexture } from './textures';

const CHAMBER = { width: 640, height: 240, depth: 900 };
const FLOOR_Y = -CHAMBER.height / 2;
const CEILING_Y = CHAMBER.height / 2;
const BACK_Z = -CHAMBER.depth;

function createShellMaterial(repeatX: number, repeatY: number): THREE.MeshStandardMaterial {
  const texture = createGridTexture();
  texture.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0x9ecdd8,
    emissive: 0x0e7490,
    emissiveMap: texture,
    emissiveIntensity: 0.36,
    roughness: 0.32,
    metalness: 0.72,
  });
}

export function createCyber(): Environment {
  const group = new THREE.Group();

  const floorMaterial = createShellMaterial(4, 7);
  const ceilingMaterial = createShellMaterial(4, 7);
  const backMaterial = createShellMaterial(4, 2);
  const sideMaterial = createShellMaterial(5, 2);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(CHAMBER.width, CHAMBER.depth),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, FLOOR_Y, -CHAMBER.depth / 2);
  group.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(CHAMBER.width, CHAMBER.depth),
    ceilingMaterial,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEILING_Y, -CHAMBER.depth / 2);
  group.add(ceiling);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(CHAMBER.depth, CHAMBER.height), sideMaterial);
    wall.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(side * (CHAMBER.width / 2), 0, -CHAMBER.depth / 2);
    group.add(wall);
  }

  const back = new THREE.Mesh(new THREE.PlaneGeometry(CHAMBER.width, CHAMBER.height), backMaterial);
  back.position.set(0, 0, BACK_Z);
  group.add(back);

  // ── Dais ────────────────────────────────────────────────────────────────
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(130, 140, 8, 64),
    new THREE.MeshStandardMaterial({
      color: 0x071a24,
      metalness: 0.8,
      roughness: 0.35,
      emissive: 0x0e7490,
      emissiveIntensity: 0.14,
    }),
  );
  dais.position.set(0, FLOOR_Y + 4, -650);
  group.add(dais);

  const daisRing = new THREE.Mesh(
    new THREE.TorusGeometry(110, 1.2, 8, 80),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  daisRing.rotation.x = -Math.PI / 2;
  daisRing.position.set(0, FLOOR_Y + 8.4, -650);
  group.add(daisRing);

  // ── Reactor core ────────────────────────────────────────────────────────
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(30, 2),
    new THREE.MeshStandardMaterial({
      color: 0x0e7490,
      emissive: 0x0891b2,
      emissiveIntensity: 0.75,
      metalness: 0.4,
      roughness: 0.26,
      flatShading: true,
    }),
  );
  core.position.set(0, 0, -390);
  group.add(core);

  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(33, 1),
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      wireframe: true,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  wire.position.copy(core.position);
  group.add(wire);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(52, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.045,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.position.copy(core.position);
  group.add(halo);

  const coreLight = new THREE.PointLight(0x22d3ee, 3.8, 800, 0);
  coreLight.position.copy(core.position);
  group.add(coreLight);

  // ── Ring tunnel ─────────────────────────────────────────────────────────
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i += 1) {
    const radius = 58 + i * 21;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 1.5, 8, 76),
      new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xf43f5e : 0x22d3ee,
        transparent: true,
        opacity: Math.max(0.16, 0.72 - i * 0.06),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.position.set(0, 0, -205 - i * 68);
    ring.rotation.z = Math.random() * Math.PI;
    group.add(ring);
    rings.push(ring);
  }

  // Large static halo rings on the back wall.
  for (const [radius, z, color, opacity] of [
    [165, -760, 0x22d3ee, 0.28],
    [215, -795, 0xf43f5e, 0.16],
  ] as Array<[number, number, number, number]>) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 1.1, 6, 96),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.position.set(0, 0, z);
    group.add(ring);
  }

  // ── Orbiting cubes ──────────────────────────────────────────────────────
  const cubes: THREE.Mesh[] = [];
  const cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0e7490,
    emissiveIntensity: 0.72,
    metalness: 0.88,
    roughness: 0.16,
  });
  for (let i = 0; i < 9; i += 1) {
    const size = 8 + (i % 3) * 2.2;
    const cube = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), cubeMaterial);
    group.add(cube);
    cubes.push(cube);
  }

  // ── Holographic panels ──────────────────────────────────────────────────
  const holoTexture = createHoloTexture();
  const panels: THREE.Mesh[] = [];
  for (const [x, y, width] of [
    [-175, 12, 88],
    [172, 32, 76],
    [-150, 78, 54],
  ] as Array<[number, number, number]>) {
    const material = new THREE.MeshBasicMaterial({
      map: holoTexture,
      transparent: true,
      opacity: 0.88,
      color: 0xbaf7ff,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.62), material);
    panel.position.set(x, y, BACK_Z + 3);
    group.add(panel);
    panels.push(panel);
  }

  // ── Energy pylons ───────────────────────────────────────────────────────
  const pylonMaterial = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (let i = 0; i < 4; i += 1) {
    const pylon = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.6, CHAMBER.height, 8),
      pylonMaterial,
    );
    pylon.position.set(-240 + i * 160, 0, -260 - i * 150);
    group.add(pylon);
  }

  // ── Floating particles ──────────────────────────────────────────────────
  const particleCount = 260;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleSpeeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i += 1) {
    particlePositions[i * 3] = (Math.random() - 0.5) * CHAMBER.width * 0.9;
    particlePositions[i * 3 + 1] = FLOOR_Y + Math.random() * CHAMBER.height;
    particlePositions[i * 3 + 2] = -50 - Math.random() * (CHAMBER.depth - 100);
    particleSpeeds[i] = 1.2 + Math.random() * 4.5;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0x9ff5ff,
      size: 1.7,
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(particles);

  // ── Lighting ────────────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0x7dd3fc, 0.45);
  group.add(ambient);

  const keyLight = new THREE.PointLight(0x22d3ee, 3.6, 1100, 0);
  keyLight.position.set(-170, 100, -220);
  group.add(keyLight);

  const rimLight = new THREE.PointLight(0xf43f5e, 3.6, 1100, 0);
  rimLight.position.set(190, -90, -520);
  group.add(rimLight);

  return {
    group,
    background: new THREE.Color(0x030712),
    fog: new THREE.Fog(0x030712, 480, 1600),
    update: (dt, elapsed) => {
      core.rotation.y += dt * 0.32;
      core.rotation.x = Math.sin(elapsed * 0.45) * 0.28;
      wire.rotation.y -= dt * 0.2;
      wire.rotation.z = Math.sin(elapsed * 0.3) * 0.25;
      halo.scale.setScalar(1 + Math.sin(elapsed * 1.8) * 0.045);

      for (let i = 0; i < rings.length; i += 1) {
        rings[i].rotation.z += dt * 0.15 * (i % 2 === 0 ? 1 : -1);
        rings[i].rotation.x = Math.sin(elapsed * 0.25 + i) * 0.1;
      }

      for (let i = 0; i < cubes.length; i += 1) {
        const angle = elapsed * 0.4 + (i / cubes.length) * Math.PI * 2;
        const radius = 68 + (i % 4) * 20;
        cubes[i].position.set(
          Math.cos(angle) * radius,
          Math.sin(angle * 1.15) * radius * 0.46,
          -390 + Math.sin(elapsed * 0.7 + i) * 55,
        );
        cubes[i].rotation.x += dt * 0.55;
        cubes[i].rotation.y += dt * 0.8;
      }

      keyLight.intensity = 3.3 + Math.sin(elapsed * 1.7) * 0.45;
      rimLight.intensity = 3.3 + Math.cos(elapsed * 2.2) * 0.45;
      coreLight.intensity = 3.4 + Math.sin(elapsed * 3.1) * 0.55;

      for (let i = 0; i < panels.length; i += 1) {
        const material = panels[i].material as THREE.MeshBasicMaterial;
        material.opacity = 0.78 + Math.sin(elapsed * 2.4 + i * 1.7) * 0.1;
      }

      const position = particleGeometry.attributes.position as THREE.BufferAttribute;
      const array = position.array as Float32Array;
      for (let i = 0; i < particleCount; i += 1) {
        array[i * 3 + 1] += particleSpeeds[i] * dt;
        array[i * 3] += Math.sin(elapsed * 0.8 + i) * dt * 0.7;
        if (array[i * 3 + 1] > CEILING_Y) {
          array[i * 3 + 1] = FLOOR_Y;
          array[i * 3] = (Math.random() - 0.5) * CHAMBER.width * 0.9;
        }
      }
      position.needsUpdate = true;
    },
  };
}
