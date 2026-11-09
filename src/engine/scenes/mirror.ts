import * as THREE from 'three';
import { screenCaptureService } from './screenCapture';
import { createCursorTexture, createScreenshareTexture } from './screenShareTexture';
import type { Environment } from './types';

/**
 * "Infinity" — a screenshare inside a screenshare inside a screenshare.
 *
 * A giant holographic display floats in a dark gallery. Behind it, seven echo
 * panels repeat the same share, shrinking with depth. The panels use additive
 * rim strips and tinted content layers so the bright UI shines through into depth,
 * while solid bezels keep every echo reading as a physical screen.
 *
 * Supports live screensharing via navigator.mediaDevices.getDisplayMedia:
 * when the user shares their screen or FishTank tab, it creates an infinite
 * feedback loop (Droste effect) that moves and skews with perspective head tracking!
 */

const ROOM = { width: 760, height: 360, depth: 1600 };
const FLOOR_Y = -ROOM.height / 2;
const CEILING_Y = ROOM.height / 2;
const BACK_Z = -ROOM.depth;

const MAIN = { z: -250, width: 244 };
const ECHO_COUNT = 7;
const ECHO_GAP = 170;
const ECHO_SCALE = 0.72;
const SCREEN_ASPECT = 9 / 16;

interface EchoScreen {
  group: THREE.Group;
  content: THREE.MeshBasicMaterial;
  rim: THREE.MeshBasicMaterial;
  baseOpacity: number;
  phase: number;
  isMain?: boolean;
}

function screenHeight(width: number): number {
  return width * SCREEN_ASPECT;
}

function buildScreen(
  width: number,
  tint: THREE.Color,
  opacity: number,
  texture: THREE.Texture,
  isMain = false,
): { group: THREE.Group; echo: EchoScreen } {
  const group = new THREE.Group();
  const height = screenHeight(width);
  const bezel = Math.max(1.2, width * 0.019);
  const depth = Math.max(2.4, bezel * 1.5);

  const contentMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: opacity < 1,
    opacity,
    color: isMain ? new THREE.Color(0xffffff) : tint.clone().lerp(new THREE.Color(0xffffff), 0.55),
    blending: THREE.NormalBlending,
    depthWrite: isMain,
    toneMapped: false,
  });
  const content = new THREE.Mesh(new THREE.PlaneGeometry(width, height), contentMaterial);
  content.position.z = 0.7;
  group.add(content);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x02060c,
    metalness: 0.7,
    roughness: 0.4,
    emissive: tint,
    emissiveIntensity: 0.02,
  });
  const topBar = new THREE.Mesh(
    new THREE.BoxGeometry(width + bezel * 2, bezel, depth),
    frameMaterial,
  );
  topBar.position.y = height / 2 + bezel / 2;
  group.add(topBar);

  const bottomBar = topBar.clone();
  bottomBar.position.y = -height / 2 - bezel / 2;
  group.add(bottomBar);

  const sideGeometry = new THREE.BoxGeometry(bezel, height, depth);
  for (const side of [-1, 1]) {
    const bar = new THREE.Mesh(sideGeometry, frameMaterial);
    bar.position.x = side * (width / 2 + bezel / 2);
    group.add(bar);
  }

  // Thin additive strips on the inside edge of the bezel.
  const rim = Math.max(0.6, width * 0.0055);
  const rimMaterial = new THREE.MeshBasicMaterial({
    color: tint,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const rimDepth = 0.5;
  const rimGeometryX = new THREE.BoxGeometry(width, rim, rimDepth);
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(rimGeometryX, rimMaterial);
    strip.position.set(0, (side * height) / 2, depth / 2 + 0.25);
    group.add(strip);
  }
  const rimGeometryY = new THREE.BoxGeometry(rim, height, rimDepth);
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(rimGeometryY, rimMaterial);
    strip.position.set((side * width) / 2, 0, depth / 2 + 0.25);
    group.add(strip);
  }

  return {
    group,
    echo: {
      group,
      content: contentMaterial,
      rim: rimMaterial,
      baseOpacity: opacity,
      phase: Math.random() * Math.PI * 2,
      isMain,
    },
  };
}

function createCeilingStrip(): THREE.Mesh {
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(5, 1, ROOM.depth * 0.78),
    new THREE.MeshBasicMaterial({
      color: 0x9ff5ff,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  strip.position.set(0, CEILING_Y - 3.4, -ROOM.depth * 0.46);
  return strip;
}

export function createMirror(): Environment {
  const group = new THREE.Group();
  const echoes: EchoScreen[] = [];

  // ── Gallery shell ──────────────────────────────────────────────────────
  // A dark, glossy floor. No grid texture here — the reflective floor should
  // recede quietly instead of drawing a horizon line through the artwork.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    new THREE.MeshStandardMaterial({
      color: 0x04070d,
      metalness: 0.92,
      roughness: 0.26,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, FLOOR_Y, -ROOM.depth / 2);
  group.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    new THREE.MeshStandardMaterial({ color: 0x04080e, metalness: 0.35, roughness: 0.72 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEILING_Y, -ROOM.depth / 2);
  group.add(ceiling);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x050a12,
    metalness: 0.55,
    roughness: 0.48,
  });
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.depth, ROOM.height), wallMaterial);
    wall.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(side * (ROOM.width / 2), 0, -ROOM.depth / 2);
    group.add(wall);
  }

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.height),
    new THREE.MeshStandardMaterial({ color: 0x03060b, metalness: 0.4, roughness: 0.62 }),
  );
  back.position.set(0, 0, BACK_Z);
  group.add(back);

  group.add(createCeilingStrip());

  // Wall seams and floor runway lines draw the eye into the tunnel.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      const seam = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, ROOM.height * 0.78),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x22d3ee : 0xf472b6,
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
          side: THREE.DoubleSide,
        }),
      );
      seam.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
      seam.position.set(side * (ROOM.width / 2 - 1.5), 0, -240 - i * 340);
      group.add(seam);
    }

    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, ROOM.depth - 260),
      new THREE.MeshBasicMaterial({
        color: side === -1 ? 0x22d3ee : 0xf472b6,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(side * 108, FLOOR_Y + 0.35, -ROOM.depth / 2 - 30);
    group.add(runway);
  }

  // Halos on the back wall.
  const halos: THREE.Mesh[] = [];
  for (const [radius, color, opacity] of [
    [292, 0x22d3ee, 0.22],
    [352, 0xf472b6, 0.1],
  ] as Array<[number, number, number]>) {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 1.5, 8, 128),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    halo.position.set(0, 0, BACK_Z + 8);
    group.add(halo);
    halos.push(halo);
  }

  // ── Screen stack ───────────────────────────────────────────────────────
  const shareTexture = createScreenshareTexture();
  const mainHeight = screenHeight(MAIN.width);

  const main = buildScreen(MAIN.width, new THREE.Color(0xdffbff), 0.96, shareTexture, true);
  main.group.position.z = MAIN.z;
  group.add(main.group);
  echoes.push(main.echo);

  for (let i = 1; i <= ECHO_COUNT; i += 1) {
    const width = MAIN.width * Math.pow(ECHO_SCALE, i);
    const hue = (188 + i * 21) / 360;
    const tint = new THREE.Color().setHSL(hue, 0.76, 0.68);
    const opacity = 0.8 * Math.pow(0.94, i);
    const echo = buildScreen(width, tint, opacity, shareTexture);
    echo.group.position.z = MAIN.z - i * ECHO_GAP;
    echo.group.rotation.z = Math.sin(i * 1.4) * 0.012 * i;
    group.add(echo.group);
    echoes.push(echo.echo);
  }

  // Cursor, scanline and LIVE light belong only to the front panel.
  const cursorTexture = createCursorTexture();
  const cursor = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({
      map: cursorTexture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  cursor.position.z = 1.6;
  main.group.add(cursor);

  const scanMaterial = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const scan = new THREE.Mesh(
    new THREE.PlaneGeometry(MAIN.width * 0.965, 1.4),
    scanMaterial,
  );
  scan.position.z = 1.3;
  main.group.add(scan);

  const liveMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4767,
    transparent: true,
    opacity: 0.95,
    toneMapped: false,
  });
  const liveLight = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 10), liveMaterial);
  liveLight.position.set(
    MAIN.width / 2 - 9,
    mainHeight / 2 + Math.max(1.2, MAIN.width * 0.019) + 1.8,
    3,
  );
  main.group.add(liveLight);

  // ── Screenshare subscription ──────────────────────────────────────────
  let isLiveActive = false;

  const unsubscribe = screenCaptureService.subscribe((capture) => {
    isLiveActive = capture.active && capture.texture !== null;
    const targetTexture = isLiveActive && capture.texture ? capture.texture : shareTexture;
    const aspectScale = isLiveActive ? capture.aspect / SCREEN_ASPECT : 1;

    for (const echo of echoes) {
      echo.content.map = targetTexture;
      echo.content.needsUpdate = true;
      echo.group.scale.y = aspectScale;
      if (echo.isMain) {
        echo.content.opacity = isLiveActive ? 1.0 : echo.baseOpacity;
        echo.content.color.setHex(isLiveActive ? 0xffffff : 0xdffbff);
      }
    }

    cursor.visible = !isLiveActive;
    scan.visible = !isLiveActive;
    liveMaterial.color.setHex(isLiveActive ? 0x10b981 : 0xff4767);
  });

  // ── Dust in the projector beam ─────────────────────────────────────────
  const particleCount = 300;
  const positions = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * ROOM.width * 0.82;
    positions[i * 3 + 1] = FLOOR_Y + Math.random() * ROOM.height;
    positions[i * 3 + 2] = -60 - Math.random() * (ROOM.depth - 120);
    speeds[i] = 2 + Math.random() * 8;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0x9ff5ff,
      size: 1.35,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  group.add(particles);

  // ── Lighting ───────────────────────────────────────────────────────────
  group.add(new THREE.AmbientLight(0x7dd3fc, 0.3));

  const keyLight = new THREE.PointLight(0x67e8f9, 3.4, 1000, 2);
  keyLight.position.set(-210, 110, -220);
  group.add(keyLight);

  const rimLight = new THREE.PointLight(0xf472b6, 2.7, 1100, 2);
  rimLight.position.set(230, 40, -760);
  group.add(rimLight);

  const backLight = new THREE.PointLight(0x818cf8, 2.2, 1200, 2);
  backLight.position.set(0, 0, -1320);
  group.add(backLight);

  return {
    group,
    background: new THREE.Color(0x03050a),
    fog: new THREE.Fog(0x03050a, 620, 2150),
    update: (dt, elapsed) => {
      if (isLiveActive) {
        const liveTex = screenCaptureService.getState().texture;
        if (liveTex) liveTex.needsUpdate = true;
      }

      for (let i = 0; i < echoes.length; i += 1) {
        const echo = echoes[i];
        if (echo.isMain && isLiveActive) {
          echo.content.opacity = 1.0;
        } else {
          const flicker = 0.93 + Math.sin(elapsed * (0.8 + i * 0.13) + echo.phase) * 0.055;
          echo.content.opacity = echo.baseOpacity * flicker;
        }
        echo.rim.opacity = 0.42 + Math.sin(elapsed * 1.4 + echo.phase) * 0.09;
      }

      if (!isLiveActive) {
        cursor.position.x = Math.sin(elapsed * 0.31) * MAIN.width * 0.33;
        cursor.position.y = Math.cos(elapsed * 0.23 + 1.1) * mainHeight * 0.24;

        const travel = (elapsed * 0.085 + 0.2) % 1;
        scan.position.y = mainHeight / 2 - travel * mainHeight;
        scanMaterial.opacity = Math.sin(travel * Math.PI) * 0.1;
      }

      liveMaterial.opacity = 0.7 + Math.sin(elapsed * 2.6) * 0.25;
      liveLight.scale.setScalar(1 + Math.sin(elapsed * 2.6) * 0.12);

      keyLight.intensity = 3.2 + Math.sin(elapsed * 0.9) * 0.35;
      rimLight.intensity = 2.5 + Math.cos(elapsed * 0.7) * 0.3;
      backLight.intensity = 2.1 + Math.sin(elapsed * 1.3) * 0.3;

      halos[0].rotation.z += dt * 0.03;
      halos[1].rotation.z -= dt * 0.022;
      halos[0].scale.setScalar(1 + Math.sin(elapsed * 0.55) * 0.012);

      const position = particleGeometry.attributes.position as THREE.BufferAttribute;
      const array = position.array as Float32Array;
      for (let i = 0; i < particleCount; i += 1) {
        array[i * 3 + 2] += speeds[i] * dt;
        array[i * 3] += Math.sin(elapsed * 0.35 + i) * dt * 0.35;
        if (array[i * 3 + 2] > 10) {
          array[i * 3 + 2] = -ROOM.depth + Math.random() * 120;
          array[i * 3] = (Math.random() - 0.5) * ROOM.width * 0.82;
          array[i * 3 + 1] = FLOOR_Y + Math.random() * ROOM.height;
        }
      }
      position.needsUpdate = true;
    },
    dispose: () => {
      unsubscribe();
      shareTexture.dispose();
      cursorTexture.dispose();
      screenCaptureService.stop();
    },
  };
}
