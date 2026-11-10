import * as THREE from 'three';
import type { Environment } from './types';

/**
 * "Infinity" — the screen, inside the screen, inside the screen…
 *
 * A dark gallery holds one framed screen. Every frame, the engine copies what
 * was just drawn on the real canvas and this scene paints it onto that virtual
 * screen. The result is an endless tunnel of screens (a Droste effect) that
 * bends as you move your head — with no screen-share permission needed.
 *
 * Each level is drawn slightly darker so the tunnel fades into black, and the
 * glowing rim slowly cycles colour so the nested frames form a rainbow tunnel.
 */

const ROOM = { width: 760, height: 360, depth: 1600 };
const FLOOR_Y = -ROOM.height / 2;
const CEILING_Y = ROOM.height / 2;
const BACK_Z = -ROOM.depth;

const SCREEN_Z = -240;
const SCREEN_WIDTH = 160;
const MAX_SCREEN_HEIGHT = 150;
/** Brightness kept per nesting level. Lower = shorter tunnel. */
const FEEDBACK_GAIN = 0.9;

const FEEDBACK_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The copied frame already holds final, display-ready colours. Writing them
// straight out (no tone mapping or colour-space conversion) reproduces the
// image exactly, apart from the deliberate darkening.
const FEEDBACK_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform float gain;
  uniform float hasMap;
  varying vec2 vUv;
  void main() {
    vec3 colour = texture2D(map, vUv).rgb * gain * hasMap;
    gl_FragColor = vec4(colour, 1.0);
  }
`;

interface ScreenParts {
  group: THREE.Group;
  rim: THREE.MeshBasicMaterial;
  geometries: THREE.BufferGeometry[];
  frame: THREE.Material;
}

/** Screen width and height for a given canvas aspect, kept to a sensible size. */
export function screenSize(aspect: number): { width: number; height: number } {
  const safeAspect = aspect > 0 && Number.isFinite(aspect) ? aspect : 16 / 9;
  let width = SCREEN_WIDTH;
  let height = width / safeAspect;
  if (height > MAX_SCREEN_HEIGHT) {
    height = MAX_SCREEN_HEIGHT;
    width = height * safeAspect;
  }
  return { width, height };
}

function buildScreen(aspect: number, content: THREE.ShaderMaterial): ScreenParts {
  const group = new THREE.Group();
  const { width, height } = screenSize(aspect);
  const bezel = Math.max(1.2, width * 0.02);
  const depth = bezel * 1.5;
  const geometries: THREE.BufferGeometry[] = [];

  const contentGeometry = new THREE.PlaneGeometry(width, height);
  geometries.push(contentGeometry);
  const contentMesh = new THREE.Mesh(contentGeometry, content);
  contentMesh.position.z = 0.7;
  group.add(contentMesh);

  const frame = new THREE.MeshStandardMaterial({
    color: 0x02060c,
    metalness: 0.7,
    roughness: 0.4,
  });

  const barX = new THREE.BoxGeometry(width + bezel * 2, bezel, depth);
  const barY = new THREE.BoxGeometry(bezel, height, depth);
  geometries.push(barX, barY);
  for (const side of [-1, 1]) {
    const horizontal = new THREE.Mesh(barX, frame);
    horizontal.position.y = side * (height / 2 + bezel / 2);
    group.add(horizontal);

    const vertical = new THREE.Mesh(barY, frame);
    vertical.position.x = side * (width / 2 + bezel / 2);
    group.add(vertical);
  }

  // Glowing strips on the inside edge of the bezel. These are what make each
  // nested level visible as a coloured ring.
  const rim = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const thickness = Math.max(0.8, width * 0.008);
  const rimX = new THREE.BoxGeometry(width, thickness, 0.5);
  const rimY = new THREE.BoxGeometry(thickness, height, 0.5);
  geometries.push(rimX, rimY);
  for (const side of [-1, 1]) {
    const top = new THREE.Mesh(rimX, rim);
    top.position.set(0, (side * height) / 2, depth / 2 + 0.25);
    group.add(top);

    const edge = new THREE.Mesh(rimY, rim);
    edge.position.set((side * width) / 2, 0, depth / 2 + 0.25);
    group.add(edge);
  }

  group.position.z = SCREEN_Z;
  return { group, rim, geometries, frame };
}

function disposeScreen(parts: ScreenParts): void {
  parts.geometries.forEach((geometry) => geometry.dispose());
  parts.rim.dispose();
  parts.frame.dispose();
}

export function createMirror(): Environment {
  const group = new THREE.Group();

  // ── Gallery shell ──────────────────────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    new THREE.MeshStandardMaterial({ color: 0x04070d, metalness: 0.92, roughness: 0.26 }),
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

  // Floor lines pull the eye toward the screen.
  for (const side of [-1, 1]) {
    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, ROOM.depth - 260),
      new THREE.MeshBasicMaterial({
        color: side === -1 ? 0x22d3ee : 0xf472b6,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(side * 108, FLOOR_Y + 0.35, -ROOM.depth / 2 - 30);
    group.add(runway);
  }

  // ── The screen that shows itself ───────────────────────────────────────
  const content = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
      gain: { value: FEEDBACK_GAIN },
      hasMap: { value: 0 },
    },
    vertexShader: FEEDBACK_VERTEX,
    fragmentShader: FEEDBACK_FRAGMENT,
  });

  let screenAspect = 16 / 9;
  let screen = buildScreen(screenAspect, content);
  group.add(screen.group);

  const feedback = (texture: THREE.Texture, aspect: number) => {
    content.uniforms.map.value = texture;
    content.uniforms.hasMap.value = 1;

    // Match the screen's shape to the canvas so each nested copy isn't stretched.
    if (Math.abs(aspect - screenAspect) > 0.005) {
      screenAspect = aspect;
      group.remove(screen.group);
      disposeScreen(screen);
      screen = buildScreen(screenAspect, content);
      group.add(screen.group);
    }
  };

  // ── Drifting dust ──────────────────────────────────────────────────────
  const particleCount = 240;
  const positions = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * ROOM.width * 0.82;
    positions[i * 3 + 1] = FLOOR_Y + Math.random() * ROOM.height;
    positions[i * 3 + 2] = -40 - Math.random() * (ROOM.depth - 120);
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

  const rimColour = new THREE.Color();

  return {
    group,
    background: new THREE.Color(0x000000),
    fog: new THREE.Fog(0x000000, 620, 2150),
    feedback,
    update: (dt, elapsed) => {
      rimColour.setHSL((elapsed * 0.06) % 1, 0.85, 0.6);
      screen.rim.color.copy(rimColour);
      rimLight.color.copy(rimColour);

      keyLight.intensity = 3.2 + Math.sin(elapsed * 0.9) * 0.35;

      const attribute = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i += 1) {
        let y = attribute.getY(i) + speeds[i] * dt;
        if (y > CEILING_Y) y = FLOOR_Y;
        attribute.setY(i, y);
      }
      attribute.needsUpdate = true;
    },
    dispose: () => {
      disposeScreen(screen);
      content.dispose();
    },
  };
}
