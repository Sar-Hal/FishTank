import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceBox, FaceSample, TrackingStatus } from './types';

const LOCAL_WASM = '/wasm';
const LOCAL_MODEL = '/models/blaze_face_short_range.tflite';

const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm';
const CDN_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

const MIN_DETECTION_CONFIDENCE = 0.4;

export interface FaceTrackingCallbacks {
  /** Called on every processed camera frame. `null` means no face was found. */
  onSample: (sample: FaceSample | null) => void;
  /** Raw bounding box in video pixels, for the picture-in-picture reticle. */
  onDetection?: (box: FaceBox | null, videoWidth: number, videoHeight: number) => void;
  onStatus: (status: TrackingStatus, message: string) => void;
  onError?: (message: string) => void;
  onStream?: (stream: MediaStream | null) => void;
  onFps?: (fps: number) => void;
}

/**
 * Owns the webcam stream and the MediaPipe face detector.
 *
 * The detection video is kept inside the service (hidden), so the camera
 * preview can be minimised or re-rendered by React without affecting tracking.
 */
export class FaceTrackingService {
  private readonly video: HTMLVideoElement;
  private readonly callbacks: FaceTrackingCallbacks;
  private detector: FaceDetector | null = null;
  private stream: MediaStream | null = null;
  private rafId = 0;
  private stopped = false;
  private starting = false;
  private lastVideoTime = -1;
  private frames = 0;
  private fpsStartedAt = 0;

  constructor(callbacks: FaceTrackingCallbacks) {
    this.callbacks = callbacks;
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.setAttribute('aria-hidden', 'true');
    this.video.style.cssText =
      'position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;';
    document.body.appendChild(this.video);
  }

  get mediaStream(): MediaStream | null {
    return this.stream;
  }

  async start(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    this.stopped = false;

    // ── 1. Camera ──────────────────────────────────────────────────────────
    this.callbacks.onStatus('requesting-camera', 'Requesting camera…');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
    } catch (error) {
      console.error('Camera access failed:', error);
      if (this.stopped) return;
      const message = "Fish Tank can't use your camera, so the view won't follow your head. Allow the camera in your browser's address bar, then reload.";
      this.callbacks.onStatus('camera-error', 'Camera unavailable');
      this.callbacks.onError?.(message);
      this.callbacks.onSample(null);
      return;
    }

    if (this.stopped) {
      this.stopStream();
      return;
    }

    this.video.srcObject = this.stream;
    this.callbacks.onStream?.(this.stream);
    await this.video.play().catch(() => undefined);

    if (this.stopped) {
      this.stopStream();
      return;
    }

    // ── 2. Vision model ────────────────────────────────────────────────────
    this.callbacks.onStatus('loading-model', 'Loading vision model…');
    try {
      this.detector = await this.createDetector();
    } catch (error) {
      console.error('Face tracking model failed to load:', error);
      if (this.stopped) return;
      const message = "Head tracking couldn't start, so the view will stay still. Try reloading the page.";
      this.callbacks.onStatus('model-error', 'Tracking unavailable');
      this.callbacks.onError?.(message);
      this.callbacks.onSample(null);
      return;
    }

    if (this.stopped) {
      this.detector.close();
      this.detector = null;
      this.stopStream();
      return;
    }

    // ── 3. Detection loop ──────────────────────────────────────────────────
    this.callbacks.onStatus('tracking', 'Tracking active');
    this.frames = 0;
    this.fpsStartedAt = performance.now();
    this.loop();
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    cancelAnimationFrame(this.rafId);

    try {
      this.detector?.close();
    } catch {
      // Ignore close errors during teardown.
    }
    this.detector = null;

    this.stopStream();

    this.video.pause();
    this.video.srcObject = null;
    this.video.remove();
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.callbacks.onStream?.(null);
  }

  private async createDetector(): Promise<FaceDetector> {
    let vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

    try {
      vision = await FilesetResolver.forVisionTasks(LOCAL_WASM);
    } catch (error) {
      console.warn('Local MediaPipe WASM unavailable, falling back to CDN.', error);
      vision = await FilesetResolver.forVisionTasks(CDN_WASM);
    }

    const attempts: Array<{ modelAssetPath: string; delegate: 'GPU' | 'CPU' }> = [
      { modelAssetPath: LOCAL_MODEL, delegate: 'GPU' },
      { modelAssetPath: LOCAL_MODEL, delegate: 'CPU' },
      { modelAssetPath: CDN_MODEL, delegate: 'CPU' },
    ];

    let lastError: unknown = null;
    for (const attempt of attempts) {
      try {
        return await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: attempt.modelAssetPath,
            delegate: attempt.delegate,
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: MIN_DETECTION_CONFIDENCE,
        });
      } catch (error) {
        lastError = error;
        console.warn(
          `Face detector failed (${attempt.delegate}, ${attempt.modelAssetPath}), trying next option.`,
          error,
        );
      }
    }

    throw lastError ?? new Error('No face detector configuration succeeded.');
  }

  private loop = (): void => {
    if (this.stopped) return;

    if (this.detector && this.video.readyState >= 2) {
      // Only run detection when the camera has produced a new frame.
      if (this.video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.video.currentTime;
        this.detect();
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private detect(): void {
    if (!this.detector) return;

    const now = performance.now();
    let box: FaceBox | null = null;
    let videoWidth = this.video.videoWidth || 640;
    let videoHeight = this.video.videoHeight || 480;

    try {
      const result = this.detector.detectForVideo(this.video, now);
      box = result.detections[0]?.boundingBox ?? null;
      if (result.detections[0]) {
        videoWidth = this.video.videoWidth || videoWidth;
        videoHeight = this.video.videoHeight || videoHeight;
      }
    } catch (error) {
      console.warn('Face detection frame failed:', error);
      return;
    }

    if (box) {
      this.callbacks.onSample({
        faceX: (box.originX + box.width / 2) / videoWidth,
        faceY: (box.originY + box.height / 2) / videoHeight,
        faceWidth: box.width / videoWidth,
        timestamp: now,
      });
    } else {
      this.callbacks.onSample(null);
    }

    this.callbacks.onDetection?.(box, videoWidth, videoHeight);

    this.frames += 1;
    const elapsed = now - this.fpsStartedAt;
    if (elapsed >= 1000) {
      this.callbacks.onFps?.((this.frames * 1000) / elapsed);
      this.frames = 0;
      this.fpsStartedAt = now;
    }
  }
}
