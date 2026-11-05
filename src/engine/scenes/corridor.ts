import * as THREE from 'three';
import type { Environment } from './types';
import {
  createBrickTexture,
  createCheckerTexture,
  createDoorGlowTexture,
  createWoodTexture,
} from './textures';

const ROOM = { width: 560, height: 230, depth: 760 };
const FLOOR_Y = -ROOM.height / 2;
const CEILING_Y = ROOM.height / 2;
const BACK_Z = -ROOM.depth;

function addPainting(
  group: THREE.Group,
  frameMaterial: THREE.Material,
  position: THREE.Vector3,
  rotationY: number,
  color: number,
  width = 44,
  height = 56,
) {
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 6, height + 6, 2.4),
    frameMaterial,
  );
  frame.position.copy(position);
  frame.rotation.y = rotationY;
  group.add(frame);

  const normal = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
  const canvas = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82 }),
  );
  canvas.position.copy(position).addScaledVector(normal, 1.35);
  canvas.rotation.y = rotationY;
  group.add(canvas);
}

export function createCorridor(): Environment {
  const group = new THREE.Group();

  const floorTexture = createCheckerTexture();
  floorTexture.repeat.set(5, 7);
  const ceilingTexture = createWoodTexture();
  ceilingTexture.repeat.set(4, 7);
  const backWallTexture = createBrickTexture();
  backWallTexture.repeat.set(4, 2);
  const sideWallTexture = createBrickTexture();
  sideWallTexture.repeat.set(5, 2);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.38,
      metalness: 0.08,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, FLOOR_Y, -ROOM.depth / 2);
  group.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    new THREE.MeshStandardMaterial({ map: ceilingTexture, roughness: 0.78 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEILING_Y, -ROOM.depth / 2);
  group.add(ceiling);

  const sideWallMaterial = new THREE.MeshStandardMaterial({
    map: sideWallTexture,
    roughness: 0.85,
  });

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.depth, ROOM.height), sideWallMaterial);
    wall.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(side * (ROOM.width / 2), 0, -ROOM.depth / 2);
    group.add(wall);
  }

  const backWallMaterial = new THREE.MeshStandardMaterial({
    map: backWallTexture,
    roughness: 0.85,
  });
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.height),
    backWallMaterial,
  );
  backWall.position.set(0, 0, BACK_Z);
  group.add(backWall);

  // ── Wainscoting and rail ────────────────────────────────────────────────
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.52 });
  const panelHeight = 66;
  const wainscot = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, panelHeight),
    new THREE.MeshStandardMaterial({ color: 0x2d1a0d, roughness: 0.6 }),
  );
  wainscot.position.set(0, FLOOR_Y + panelHeight / 2, BACK_Z + 0.6);
  group.add(wainscot);

  const chairRail = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.width, 4, 3),
    woodMaterial,
  );
  chairRail.position.set(0, FLOOR_Y + panelHeight, BACK_Z + 2);
  group.add(chairRail);

  for (let i = 0; i < 10; i += 1) {
    const stile = new THREE.Mesh(new THREE.BoxGeometry(2, panelHeight - 10, 1.4), woodMaterial);
    stile.position.set(-252 + i * 56, FLOOR_Y + panelHeight / 2, BACK_Z + 1.6);
    group.add(stile);
  }

  // ── Glowing doorway ─────────────────────────────────────────────────────
  const doorway = new THREE.Group();
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x2a160b, roughness: 0.55 });
  const doorWidth = 104;
  const doorHeight = 195;

  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(11, doorHeight + 10, 22), frameMaterial);
    pillar.position.set(side * (doorWidth / 2 + 5.5), FLOOR_Y + doorHeight / 2, 6);
    doorway.add(pillar);
  }

  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth + 32, 13, 22),
    frameMaterial,
  );
  lintel.position.set(0, FLOOR_Y + doorHeight + 6.5, 6);
  doorway.add(lintel);

  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth + 32, 5, 30),
    woodMaterial,
  );
  threshold.position.set(0, FLOOR_Y + 2.5, 8);
  doorway.add(threshold);

  const glowTexture = createDoorGlowTexture();
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(doorWidth, doorHeight),
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: 0xfff2cf,
      toneMapped: false,
    }),
  );
  glow.position.set(0, FLOOR_Y + doorHeight / 2, 1.2);
  doorway.add(glow);

  const doorLight = new THREE.PointLight(0xffc477, 2.4, 650, 0);
  doorLight.position.set(0, FLOOR_Y + 95, 45);
  doorway.add(doorLight);

  const doorHalo = new THREE.Mesh(
    new THREE.PlaneGeometry(doorWidth + 40, doorHeight + 30),
    new THREE.MeshBasicMaterial({
      color: 0xffc477,
      transparent: true,
      opacity: 0.035,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  doorHalo.position.set(0, FLOOR_Y + doorHeight / 2, 0.8);
  doorway.add(doorHalo);

  doorway.position.z = BACK_Z;
  group.add(doorway);

  // ── Paintings and sconces ───────────────────────────────────────────────
  const paintingFrame = new THREE.MeshStandardMaterial({ color: 0x7c4a1d, roughness: 0.5 });
  addPainting(
    group,
    paintingFrame,
    new THREE.Vector3(-172, 28, BACK_Z + 3),
    0,
    0x0f766e,
  );
  addPainting(
    group,
    paintingFrame,
    new THREE.Vector3(172, 20, BACK_Z + 3),
    0,
    0x9f1239,
    52,
    66,
  );
  addPainting(
    group,
    paintingFrame,
    new THREE.Vector3(-ROOM.width / 2 + 3, 22, -360),
    Math.PI / 2,
    0x1d4ed8,
    54,
    40,
  );
  addPainting(
    group,
    paintingFrame,
    new THREE.Vector3(ROOM.width / 2 - 3, 8, -500),
    -Math.PI / 2,
    0xb45309,
    48,
    38,
  );

  const sconceMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9b06a,
    emissive: 0xf5b45f,
    emissiveIntensity: 1.6,
    roughness: 0.3,
  });
  for (const x of [-228, 228]) {
    const sconce = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12), sconceMaterial);
    sconce.position.set(x, 54, BACK_Z + 5);
    group.add(sconce);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(13, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffd28c,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.position.copy(sconce.position);
    group.add(halo);
  }

  // ── Desk ────────────────────────────────────────────────────────────────
  const desk = new THREE.Group();
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(112, 6, 56), woodMaterial);
  deskTop.position.y = 74;
  desk.add(deskTop);

  for (const [x, z] of [
    [-48, -21],
    [48, -21],
    [-48, 21],
    [48, 21],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(6, 74, 6), woodMaterial);
    leg.position.set(x, 37, z);
    desk.add(leg);
  }

  const book = new THREE.Mesh(
    new THREE.BoxGeometry(24, 4, 32),
    new THREE.MeshStandardMaterial({ color: 0x8f1d1d, roughness: 0.5 }),
  );
  book.position.set(-20, 79, 2);
  book.rotation.y = 0.22;
  desk.add(book);

  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5, 5, 11, 14),
    new THREE.MeshStandardMaterial({ color: 0xd8c7a1, roughness: 0.45 }),
  );
  mug.position.set(26, 82, -8);
  desk.add(mug);

  const deskLamp = new THREE.Group();
  const lampArm = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.3, 26, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.3 }),
  );
  lampArm.position.set(34, 87, 10);
  lampArm.rotation.z = -0.18;
  deskLamp.add(lampArm);
  const deskShade = new THREE.Mesh(
    new THREE.ConeGeometry(8, 10, 18, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.5,
      roughness: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  deskShade.position.set(32, 100, 10);
  deskShade.rotation.x = Math.PI;
  deskLamp.add(deskShade);
  const deskBulb = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4 }),
  );
  deskBulb.position.set(32, 95, 10);
  deskLamp.add(deskBulb);
  const deskLight = new THREE.PointLight(0xffcf8f, 0.9, 260, 0);
  deskLight.position.set(32, 94, 10);
  deskLamp.add(deskLight);
  desk.add(deskLamp);

  desk.position.set(-150, FLOOR_Y, -540);
  desk.rotation.y = 0.2;
  group.add(desk);

  // ── Chair ───────────────────────────────────────────────────────────────
  const chair = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: 0x1f3a5f, roughness: 0.55 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(52, 8, 52), leather);
  seat.position.y = 48;
  chair.add(seat);

  const backRest = new THREE.Mesh(new THREE.BoxGeometry(52, 64, 8), leather);
  backRest.position.set(0, 84, -22);
  chair.add(backRest);

  for (const [x, z] of [
    [-20, -20],
    [20, -20],
    [-20, 20],
    [20, 20],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(5, 48, 5), woodMaterial);
    leg.position.set(x, 24, z);
    chair.add(leg);
  }

  chair.position.set(138, FLOOR_Y, -600);
  chair.rotation.y = -0.62;
  group.add(chair);

  // ── Chrome sphere on a pedestal ─────────────────────────────────────────
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(17, 22, 50, 24),
    new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.55, roughness: 0.35 }),
  );
  pedestal.position.set(78, FLOOR_Y + 25, -455);
  group.add(pedestal);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(17, 48, 32),
    new THREE.MeshStandardMaterial({
      color: 0xcfe6ff,
      metalness: 1,
      roughness: 0.035,
      envMapIntensity: 1.5,
    }),
  );
  sphere.position.set(78, FLOOR_Y + 67, -455);
  group.add(sphere);

  // ── Pendant lamp ────────────────────────────────────────────────────────
  const lamp = new THREE.Group();
  const rose = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 3, 18),
    new THREE.MeshStandardMaterial({ color: 0x1c130c, roughness: 0.5 }),
  );
  rose.position.y = CEILING_Y - 1.5;
  lamp.add(rose);

  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 58, 6),
    new THREE.MeshBasicMaterial({ color: 0x16110c }),
  );
  cord.position.y = CEILING_Y - 30;
  lamp.add(cord);

  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(22, 18, 24, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.7,
      roughness: 0.24,
      side: THREE.DoubleSide,
    }),
  );
  shade.rotation.x = Math.PI;
  shade.position.y = CEILING_Y - 68;
  lamp.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(4.6, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4 }),
  );
  bulb.position.y = CEILING_Y - 77;
  lamp.add(bulb);

  const lampLight = new THREE.PointLight(0xffd9a0, 2.8, 900, 0);
  lampLight.position.set(0, CEILING_Y - 86, 0);
  lamp.add(lampLight);

  lamp.position.z = -410;
  group.add(lamp);

  // ── Ceiling beams ───────────────────────────────────────────────────────
  const beamMaterial = new THREE.MeshStandardMaterial({ color: 0x3c2412, roughness: 0.7 });
  for (const z of [-180, -360, -560]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROOM.width, 8, 12), beamMaterial);
    beam.position.set(0, CEILING_Y - 4, z);
    group.add(beam);
  }

  // ── Rug ─────────────────────────────────────────────────────────────────
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 150),
    new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.95 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, FLOOR_Y + 0.5, -530);
  group.add(rug);

  // ── Dust motes ──────────────────────────────────────────────────────────
  const dustCount = 170;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) {
    dustPositions[i * 3] = (Math.random() - 0.5) * ROOM.width;
    dustPositions[i * 3 + 1] = FLOOR_Y + Math.random() * ROOM.height;
    dustPositions[i * 3 + 2] = -40 - Math.random() * (ROOM.depth - 80);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: 0xffe9c2,
      size: 0.85,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  group.add(dust);

  // ── Lighting ────────────────────────────────────────────────────────────
  const hemisphere = new THREE.HemisphereLight(0xffe8c8, 0x1b120c, 1.15);
  group.add(hemisphere);

  const daylight = new THREE.DirectionalLight(0xfff2dd, 1.2);
  daylight.position.set(120, 320, 180);
  group.add(daylight);

  const backlight = new THREE.PointLight(0xffbd75, 0.9, 800, 0);
  backlight.position.set(0, 10, -620);
  group.add(backlight);

  return {
    group,
    background: new THREE.Color(0x120d08),
    fog: new THREE.Fog(0x120d08, 460, 1250),
    update: (dt, elapsed) => {
      sphere.rotation.y += dt * 0.25;
      sphere.rotation.x = Math.sin(elapsed * 0.2) * 0.12;

      lampLight.intensity = 2.6 + Math.sin(elapsed * 2.7) * 0.16 + Math.sin(elapsed * 7.3) * 0.07;
      doorLight.intensity = 2.25 + Math.sin(elapsed * 1.3) * 0.12;
      deskLight.intensity = 0.82 + Math.sin(elapsed * 3.1) * 0.05;

      const position = dustGeometry.attributes.position as THREE.BufferAttribute;
      const array = position.array as Float32Array;
      for (let i = 0; i < dustCount; i += 1) {
        array[i * 3 + 1] += dt * (1.4 + (i % 5) * 0.3);
        array[i * 3] += Math.sin(elapsed * 0.4 + i) * dt * 0.6;
        if (array[i * 3 + 1] > CEILING_Y) {
          array[i * 3 + 1] = FLOOR_Y;
          array[i * 3] = (Math.random() - 0.5) * ROOM.width;
        }
      }
      position.needsUpdate = true;
    },
  };
}
