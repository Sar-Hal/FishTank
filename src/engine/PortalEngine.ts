import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { orientCalibration, type Calibration, type SceneId } from '../state/appStore';
import type { HeadPose } from '../tracking/types';
import { applyOffAxisProjection, EYE_SEPARATION_CM } from './OffAxisCamera';
import { createAquarium } from './scenes/aquarium';
import { createCorridor } from './scenes/corridor';
import { createCyber } from './scenes/cyber';
import { createMirror } from './scenes/mirror';
import { disposeObject } from './scenes/utils';
import type { Environment, SceneWindow } from './scenes/types';

export interface PortalEngineOptions {
  onFps?: (fps: number) => void;
}

const PORTRAIT_OVERFILL = 1.4;

/**
 * Scale that makes `window` fill a screen `heightCm` tall. On a tall, narrow
 * (portrait) screen it is limited by the width instead, so the scene isn't
 * squeezed into a thin vertical strip; the floor still sits on the bottom edge.
 */
export function windowScale(window: SceneWindow, heightCm: number, widthCm = Infinity): number {
  const span = window.top - window.bottom;
  if (!(span > 0) || !(heightCm > 0)) return 1;
  // Allow the slice to be up to 1.4× wider than the screen: scenes are wide,
  // so trimming their sides lets them fill more of a tall screen.
  return Math.min(heightCm, widthCm * PORTRAIT_OVERFILL) / span;
}

const createEnvironment = (sceneId: SceneId): Environment => {
  switch (sceneId) {
    case 'corridor':
      return createCorridor();
    case 'cyber':
      return createCyber();
    case 'mirror':
      return createMirror();
    case 'aquarium':
    default:
      return createAquarium();
  }
};

/**
 * Owns the WebGL renderer, scene, camera and animation loop.
 *
 * The engine is deliberately outside React: it is created once per experience
 * mount with a captured container element, and disposed by the effect cleanup.
 * Scene, stereo and calibration changes are pushed in through setters instead
 * of remounting the component (and the canvas).
 */
export class PortalEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly environmentMap: THREE.Texture;
  private readonly options: PortalEngineOptions;
  private readonly resizeObserver: ResizeObserver;

  private environment: Environment | null = null;
  private calibration: Calibration;
  private pose: HeadPose;
  private activeSceneId: SceneId;
  private stereo = false;
  private disposed = false;

  /** Copy of the last rendered frame, for scenes that show the screen inside itself. */
  private frameTexture: THREE.FramebufferTexture | null = null;
  private readonly drawingBufferSize = new THREE.Vector2();

  private rafId = 0;
  private lastFrameTime = 0;
  private fpsFrames = 0;
  private fpsWindowStart = 0;

  constructor(
    container: HTMLElement,
    calibration: Calibration,
    sceneId: SceneId,
    options: PortalEngineOptions = {},
  ) {
    this.container = container;
    this.calibration = { ...calibration };
    this.pose = { x: 0, y: 0, z: calibration.distanceCm };
    this.activeSceneId = sceneId;
    this.options = options;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.canvas = this.renderer.domElement;
    this.canvas.className = 'engine-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.container.replaceChildren(this.canvas);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.environmentMap;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 2500);

    this.resize();
    this.setScene(sceneId);

    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.container);
    window.addEventListener('resize', this.resize);

    this.lastFrameTime = performance.now();
    this.fpsWindowStart = this.lastFrameTime;
    this.rafId = requestAnimationFrame(this.frame);
  }

  get sceneId(): SceneId {
    return this.activeSceneId;
  }

  setScene(sceneId: SceneId): void {
    if (this.disposed) return;
    this.activeSceneId = sceneId;

    if (this.environment) {
      this.environment.dispose?.();
      this.scene.remove(this.environment.group);
      disposeObject(this.environment.group);
      this.environment = null;
    }

    const environment = createEnvironment(sceneId);
    this.environment = environment;
    this.scene.add(environment.group);
    this.scene.background = environment.background;
    this.fitEnvironment();
    this.syncFeedback();
  }

  setCalibration(calibration: Calibration): void {
    this.calibration = { ...calibration };
    this.fitEnvironment();
    this.syncFeedback();
  }

  /**
   * Scale scenes that declare a `window` so it fills the real screen. Things
   * that don't scale with the group (fog, light reach, point sizes) are scaled
   * from their original values so this can be re-run when calibration changes.
   */
  private fitEnvironment(): void {
    const environment = this.environment;
    if (!environment) return;

    const screen = orientCalibration(this.calibration, this.aspect());
    const window = environment.window;
    const scale = window ? windowScale(window, screen.heightCm, screen.widthCm) : 1;
    const group = environment.group;
    group.scale.setScalar(scale);
    // Pin the window's bottom (the floor) to the screen's bottom edge.
    group.position.y = window ? -screen.heightCm / 2 - window.bottom * scale : 0;

    group.traverse((object) => {
      if (object instanceof THREE.PointLight || object instanceof THREE.SpotLight) {
        object.userData.baseDistance ??= object.distance;
        object.distance = object.userData.baseDistance * scale;
      } else if (object instanceof THREE.Points) {
        const material = object.material as THREE.PointsMaterial;
        material.userData.baseSize ??= material.size;
        material.size = material.userData.baseSize * scale;
      }
    });

    const fog = environment.fog;
    // Fog is measured from the eye, but scenes are designed with distances from
    // the glass, so add the viewing distance back on after scaling.
    const eye = scale === 1 ? 0 : this.calibration.distanceCm;
    this.scene.fog = fog
      ? new THREE.Fog(fog.color, eye + fog.near * scale, eye + fog.far * scale)
      : null;
  }

  setStereo(stereo: boolean): void {
    this.stereo = stereo;
  }

  setHeadPose(pose: HeadPose): void {
    this.pose = { ...pose };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.resize);

    if (this.environment) {
      this.environment.dispose?.();
      this.scene.remove(this.environment.group);
      disposeObject(this.environment.group);
      this.environment = null;
    }

    this.frameTexture?.dispose();
    this.frameTexture = null;
    this.scene.environment = null;
    this.environmentMap.dispose();
    this.scene.clear();
    this.renderer.dispose();

    // Remove through the captured container rather than a React ref, which may
    // already be null during StrictMode's simulated unmount.
    this.canvas.remove();
  }

  private resize = (): void => {
    if (this.disposed) return;

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    // Phones have very dense screens; 1.5× looks the same there and keeps the
    // frame rate (and battery) healthy.
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);

    // Re-apply the pixel ratio so browser zoom / monitor scaling changes stay
    // crisp instead of rendering at a stale resolution.
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, true);
    // Rotating a phone swaps the screen's width and height.
    this.fitEnvironment();
    this.syncFeedback();
  };

  /**
   * Keep the frame-copy texture the same size as the canvas and hand it to
   * scenes that want it. Scenes without a feedback hook cost nothing.
   */
  private syncFeedback(): void {
    const feedback = this.environment?.feedback;
    if (!feedback) {
      this.frameTexture?.dispose();
      this.frameTexture = null;
      return;
    }

    this.renderer.getDrawingBufferSize(this.drawingBufferSize);
    const width = Math.max(1, Math.floor(this.drawingBufferSize.x));
    const height = Math.max(1, Math.floor(this.drawingBufferSize.y));

    if (
      !this.frameTexture ||
      this.frameTexture.image.width !== width ||
      this.frameTexture.image.height !== height
    ) {
      this.frameTexture?.dispose();
      this.frameTexture = new THREE.FramebufferTexture(width, height);
      this.frameTexture.minFilter = THREE.LinearFilter;
      this.frameTexture.magFilter = THREE.LinearFilter;
    }

    const aspect =
      Math.max(1, this.container.clientWidth) / Math.max(1, this.container.clientHeight);
    feedback(this.frameTexture, {
      aspect,
      heightCm: orientCalibration(this.calibration, aspect).heightCm,
    });
  }

  private aspect(): number {
    return Math.max(1, this.container.clientWidth) / Math.max(1, this.container.clientHeight);
  }

  private frame = (now: number): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.frame);

    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;
    const elapsed = now / 1000;

    this.environment?.update(dt, elapsed);
    this.renderFrame();

    // Grab what was just drawn so next frame can show it on the in-scene screen.
    if (this.frameTexture && this.environment?.feedback) {
      this.renderer.copyFramebufferToTexture(this.frameTexture);
    }

    this.fpsFrames += 1;
    const fpsElapsed = now - this.fpsWindowStart;
    if (fpsElapsed >= 1000) {
      this.options.onFps?.((this.fpsFrames * 1000) / fpsElapsed);
      this.fpsFrames = 0;
      this.fpsWindowStart = now;
    }
  };

  private renderFrame(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;
    const screen = orientCalibration(this.calibration, aspect);

    if (!this.stereo) {
      this.renderer.autoClear = true;
      applyOffAxisProjection(this.camera, this.pose, screen, aspect);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Red/cyan anaglyph: render the left eye into the red channel and the
    // right eye into green + blue. The screen stays anchored for both eyes.
    const gl = this.renderer.getContext();
    const background = this.scene.background;
    this.renderer.autoClear = false;
    if (background instanceof THREE.Color) {
      this.renderer.setClearColor(background, 1);
    }
    this.renderer.clear(true, true, true);

    try {
      applyOffAxisProjection(
        this.camera,
        this.pose,
        screen,
        aspect,
        -EYE_SEPARATION_CM / 2,
      );
      gl.colorMask(true, false, false, true);
      this.renderer.render(this.scene, this.camera);

      this.renderer.clearDepth();
      applyOffAxisProjection(
        this.camera,
        this.pose,
        screen,
        aspect,
        EYE_SEPARATION_CM / 2,
      );
      gl.colorMask(false, true, true, true);
      this.renderer.render(this.scene, this.camera);
    } finally {
      gl.colorMask(true, true, true, true);
      this.renderer.autoClear = true;
    }
  }
}
