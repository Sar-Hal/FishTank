import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Calibration, SceneId } from '../state/appStore';
import type { HeadPose } from '../tracking/types';
import { applyOffAxisProjection, EYE_SEPARATION_CM } from './OffAxisCamera';
import { createAquarium } from './scenes/aquarium';
import { createCorridor } from './scenes/corridor';
import { createCyber } from './scenes/cyber';
import { createMirror } from './scenes/mirror';
import { disposeObject } from './scenes/utils';
import type { Environment } from './scenes/types';

export interface PortalEngineOptions {
  onFps?: (fps: number) => void;
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
    this.scene.fog = environment.fog;
    this.syncFeedback();
  }

  setCalibration(calibration: Calibration): void {
    this.calibration = { ...calibration };
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
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    // Re-apply the pixel ratio so browser zoom / monitor scaling changes stay
    // crisp instead of rendering at a stale resolution.
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, true);
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
    feedback(this.frameTexture, aspect);
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

    if (!this.stereo) {
      this.renderer.autoClear = true;
      applyOffAxisProjection(this.camera, this.pose, this.calibration, aspect);
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
        this.calibration,
        aspect,
        -EYE_SEPARATION_CM / 2,
      );
      gl.colorMask(true, false, false, true);
      this.renderer.render(this.scene, this.camera);

      this.renderer.clearDepth();
      applyOffAxisProjection(
        this.camera,
        this.pose,
        this.calibration,
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
