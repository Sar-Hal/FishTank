import { create } from 'zustand';
import type { HeadPose } from '../tracking/types';

export interface TelemetryState {
  pose: HeadPose;
  visible: boolean;
  calibrated: boolean;
  faceWidth: number;
  /** Frames per second rendered by the WebGL engine. */
  renderFps: number;
  /** Frames per second processed by the face detector. */
  trackFps: number;
}

/**
 * High-frequency tracking data lives here rather than in the app store.
 * The experience writes to it at a throttled rate (~10 Hz) so the HUD can
 * update without re-rendering React on every camera frame.
 */
export const useTelemetryStore = create<TelemetryState>(() => ({
  pose: { x: 0, y: 0, z: 60 },
  visible: false,
  calibrated: false,
  faceWidth: 0,
  renderFps: 0,
  trackFps: 0,
}));
