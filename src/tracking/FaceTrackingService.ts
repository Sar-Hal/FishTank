import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceBox, FaceSample, TrackingStatus } from './types';

// Everything the tracker needs is served from this site. There is deliberately
// no CDN fallback: pulling code from a third party while the camera is on would
// let that third party run code next to the video.
const LOCAL_WASM = '/wasm';
const LOCAL_MODEL = '/models/blaze_face_short_range.tflite';

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
  private paused = false;
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

  /** True once the service is shut down for good, or the camera is paused. */
  private get inactive(): boolean {
    return this.stopped || this.paused;
  }

  async start(): Promise<void> {
    if (this.starting || this.stopped) return;
    this.starting = true;
    this.paused = false;
    try {
      await this.run();
    } finally {
      this.starting = false;
    }
  }

  /**
   * Turn the camera off completely (the browser's camera light goes out) while
   * keeping the loaded model, so `resume()` is quick.
   */
  pause(): void {
    if (this.stopped || this.paused) return;
    this.paused = true;
    cancelAnimationFrame(this.rafId);
    this.stopStream();
    this.video.pause();
    this.video.srcObject = null;
    this.lastVideoTime = -1;
    this.callbacks.onSample(null);
    this.callbacks.onDetection?.(null, 640, 480);
    this.callbacks.onStatus('stopped', 'Camera off');
  }

  /** Turn the camera back on after `pause()`. Does nothing if not paused. */
  resume(): void {
    if (this.stopped || !this.paused) return;
    // Clear the flag first: if a start is still in flight it will carry on.
    this.paused = false;
    void this.start();
  }

  private async run(): Promise<void> {
    // ── 1. Camera ──────────────────────────────────────────────────────────
    this.callbacks.onStatus('requesting-camera', 'Requesting camera…');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
    } catch (error) {
      console.error('Camera access failed:', error);
      if (this.inactive) return;
      const message =
        "Fish Tank can't use your camera, so the view won't follow your head. Allow the camera in your browser's address bar, then reload.";
      this.callbacks.onStatus('camera-error', 'Camera unavailable');
      this.callbacks.onError?.(message);
      this.callbacks.onSample(null);
      return;
    }

    if (this.inactive) {
      this.stopStream();
      return;
    }

    this.video.srcObject = this.stream;
    this.callbacks.onStream?.(this.stream);
    await this.video.play().catch(() => undefined);

    if (this.inactive) {
      this.stopStream();
      return;
    }

    // ── 2. Vision model (loaded once, kept across pauses) ──────────────────
    if (!this.detector) {
      this.callbacks.onStatus('loading-model', 'Loading vision model…');
      let detector: FaceDetector;
      try {
        detector = await this.createDetector();
      } catch (error) {
        console.error('Face tracking model failed to load:', error);
        if (this.inactive) return;
        const message =
          "Head tracking couldn't start, so the view will stay still. Try reloading the page.";
        this.stopStream();
        this.callbacks.onStatus('model-error', 'Tracking unavailable');
        this.callbacks.onError?.(message);
        this.callbacks.onSample(null);
        return;
      }

      if (this.stopped) {
        detector.close();
        this.stopStream();
        return;
      }
      this.detector = detector;
      if (this.paused) {
        this.stopStream();
        return;
      }
    }

    // A pause/resume during model loading closes the stream; reopen it.
    if (!this.stream) {
      await this.run();
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
    const vision = await FilesetResolver.forVisionTasks(LOCAL_WASM);

    const attempts: Array<{ modelAssetPath: string; delegate: 'GPU' | 'CPU' }> = [
      { modelAssetPath: LOCAL_MODEL, delegate: 'GPU' },
      { modelAssetPath: LOCAL_MODEL, delegate: 'CPU' },
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
    if (this.inactive) return;

    if (this.detector && !this.paused && this.video.readyState >= 2) {
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
