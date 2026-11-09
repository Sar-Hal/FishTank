import * as THREE from 'three';

export interface ScreenCaptureState {
  active: boolean;
  stream: MediaStream | null;
  video: HTMLVideoElement | null;
  texture: THREE.VideoTexture | null;
  aspect: number;
}

type Listener = (state: ScreenCaptureState) => void;

class ScreenCaptureService {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private texture: THREE.VideoTexture | null = null;
  private aspect = 9 / 16;
  private listeners = new Set<Listener>();

  getState(): ScreenCaptureState {
    return {
      active: Boolean(this.stream && this.stream.active && this.texture),
      stream: this.stream,
      video: this.video,
      texture: this.texture,
      aspect: this.aspect,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[ScreenCapture] Listener error:', err);
      }
    }
  }

  async start(): Promise<THREE.VideoTexture | null> {
    if (this.texture && this.stream?.active) {
      return this.texture;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      console.warn('[ScreenCapture] getDisplayMedia is not supported in this browser.');
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 60, max: 60 },
        },
        audio: false,
      });

      this.cleanup();

      this.stream = stream;

      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      // Wait until metadata / dimensions are ready
      await new Promise<void>((resolve) => {
        const onLoaded = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          resolve();
        };
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          resolve();
        } else {
          video.addEventListener('loadedmetadata', onLoaded);
        }
      });

      await video.play().catch((e) => {
        console.warn('[ScreenCapture] video.play() warning:', e);
      });

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        this.aspect = video.videoHeight / video.videoWidth;
      }

      this.video = video;

      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      this.texture = texture;

      // Listen for when user stops screen share from browser controls
      const [track] = stream.getVideoTracks();
      if (track) {
        track.onended = () => {
          this.stop();
        };
      }

      this.notify();
      return texture;
    } catch (err) {
      const error = err as Error;
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        console.warn('[ScreenCapture] Capture request failed:', error);
      }
      return null;
    }
  }

  private cleanup(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video.remove();
      this.video = null;
    }
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
  }

  stop(): void {
    this.cleanup();
    this.notify();
  }
}

export const screenCaptureService = new ScreenCaptureService();
