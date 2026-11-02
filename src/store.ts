import { create } from 'zustand';
import type { ScreenCalibration } from './rendering/OffAxisCamera';
import type { TrackingPoint } from './tracking/tracking';

export type SceneMode = 'aquarium' | 'corridor' | 'portal';

type AppState = {
  stage: 'landing' | 'calibration' | 'experience';
  calibration: ScreenCalibration;
  tracking: TrackingPoint;
  scene: SceneMode;
  debug: boolean;
  stereoscopic: boolean;
  calibrateTrigger: number;
  setStage: (stage: AppState['stage']) => void;
  setCalibration: (value: Partial<ScreenCalibration>) => void;
  setTracking: (tracking: TrackingPoint) => void;
  setScene: (scene: SceneMode) => void;
  setDebug: (debug: boolean) => void;
  setStereoscopic: (stereoscopic: boolean) => void;
  requestCalibration: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  stage: 'landing',
  // Defaults for a standard desktop / laptop setup:
  // width: ~53cm (24"), height: ~30cm, distance: ~65cm, sensitivity: 1.0
  calibration: {
    widthCm: 53.0,
    heightCm: 30.0,
    distanceCm: 65.0,
    sensitivity: 1.0,
    cameraOffsetYCm: 15.0, // Top bezel offset (half of screen height)
  },
  tracking: {
    x: 0,
    y: 0,
    z: 65, // In physical cm from screen
    visible: false,
    faceWidthNorm: 0,
    rawEyeX: 0,
    rawEyeY: 0,
  },
  scene: 'aquarium',
  debug: false,
  stereoscopic: false,
  calibrateTrigger: 0,
  setStage: (stage) => set({ stage }),
  setCalibration: (value) => set((state) => ({ calibration: { ...state.calibration, ...value } })),
  setTracking: (tracking) => set({ tracking }),
  setScene: (scene) => set({ scene }),
  setDebug: (debug) => set({ debug }),
  setStereoscopic: (stereoscopic) => set({ stereoscopic }),
  requestCalibration: () => set((state) => ({ calibrateTrigger: state.calibrateTrigger + 1 })),
}));


