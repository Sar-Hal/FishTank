// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  FaceDetector: {
    createFromOptions: vi.fn(async () => ({
      detectForVideo: () => ({ detections: [] }),
      close: vi.fn(),
    })),
  },
}));

import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { FaceTrackingService } from './FaceTrackingService';

function fakeStream() {
  const track = { stop: vi.fn() };
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('FaceTrackingService privacy behaviour', () => {
  let streams: ReturnType<typeof fakeStream>[];
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    streams = [];
    getUserMedia = vi.fn(async () => {
      const next = fakeStream();
      streams.push(next);
      return next.stream;
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
    HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const create = () =>
    new FaceTrackingService({ onSample: vi.fn(), onStatus: vi.fn(), onStream: vi.fn() });

  it('only ever loads tracking files from this site', async () => {
    const service = create();
    await service.start();

    expect(FilesetResolver.forVisionTasks).toHaveBeenCalledWith('/wasm');
    const options = vi.mocked(FaceDetector.createFromOptions).mock.calls.map(
      (call) => call[1].baseOptions?.modelAssetPath,
    );
    expect(options.length).toBeGreaterThan(0);
    for (const path of options) expect(path?.startsWith('/')).toBe(true);
    service.stop();
  });

  it('turns the camera fully off on pause and back on at resume', async () => {
    const service = create();
    await service.start();
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    service.pause();
    expect(streams[0].track.stop).toHaveBeenCalled();

    service.resume();
    await flush();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    service.stop();
    expect(streams[1].track.stop).toHaveBeenCalled();
  });

  it('does not reopen the camera when resume is called while not paused', async () => {
    const service = create();
    await service.start();
    service.resume();
    await flush();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    service.stop();
  });

  it('releases a camera that arrives after it was paused', async () => {
    let release: (stream: MediaStream) => void = () => undefined;
    getUserMedia.mockImplementationOnce(
      () => new Promise<MediaStream>((resolve) => (release = resolve)),
    );
    const service = create();
    const starting = service.start();

    service.pause();
    const late = fakeStream();
    release(late.stream);
    await starting;

    // Ensure the camera is not left running when the permission prompt resolves late.
    expect(late.track.stop).toHaveBeenCalled();
    service.stop();
  });

  it('removes its hidden video element when stopped', async () => {
    const service = create();
    await service.start();
    expect(document.querySelectorAll('video').length).toBe(1);
    service.stop();
    expect(document.querySelectorAll('video').length).toBe(0);
  });
});
