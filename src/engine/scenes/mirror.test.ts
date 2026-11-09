// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screenCaptureService } from './screenCapture';

describe('screenCaptureService', () => {
  it('reports initial inactive state and allows subscription', () => {
    let capturedState = screenCaptureService.getState();
    const unsub = screenCaptureService.subscribe((state) => {
      capturedState = state;
    });

    expect(capturedState.active).toBe(false);
    expect(capturedState.stream).toBeNull();
    expect(capturedState.texture).toBeNull();

    unsub();
  });

  it('stops cleanly when stop is called', () => {
    screenCaptureService.stop();
    expect(screenCaptureService.getState().active).toBe(false);
  });
});
