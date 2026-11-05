import { create } from 'zustand';

export type Stage = 'landing' | 'calibration' | 'experience';
export type SceneId = 'aquarium' | 'corridor' | 'cyber';

export interface Calibration {
  /** Physical width of the display in centimetres. */
  widthCm: number;
  /** Physical height of the display in centimetres. */
  heightCm: number;
  /** Expected eye-to-screen distance in centimetres. */
  distanceCm: number;
  /** Multiplier applied to head movement (1 = physically accurate). */
  sensitivity: number;
}

export const DEFAULT_CALIBRATION: Calibration = {
  widthCm: 53,
  heightCm: 30,
  distanceCm: 60,
  sensitivity: 1,
};

export const SCENES: ReadonlyArray<{
  id: SceneId;
  label: string;
  icon: string;
  hint: string;
}> = [
  { id: 'aquarium', label: 'Aquarium', icon: '🐠', hint: 'A living coral reef' },
  { id: 'corridor', label: 'Corridor', icon: '🏛️', hint: 'A study in warm light' },
  { id: 'cyber', label: 'Cyber', icon: '⚡', hint: 'A neon reactor chamber' },
];

interface AppState {
  stage: Stage;
  calibration: Calibration;
  scene: SceneId;
  stereo: boolean;
  debug: boolean;
  pipCollapsed: boolean;
  setStage: (stage: Stage) => void;
  setCalibration: (value: Partial<Calibration>) => void;
  setScene: (scene: SceneId) => void;
  setStereo: (stereo: boolean) => void;
  setDebug: (debug: boolean) => void;
  setPipCollapsed: (collapsed: boolean) => void;
}

const STORAGE_KEY = 'fishtank:settings:v1';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isSceneId = (value: unknown): value is SceneId =>
  value === 'aquarium' || value === 'corridor' || value === 'cyber';

type PersistedSettings = Pick<AppState, 'calibration' | 'scene'>;

function loadSettings(): Partial<PersistedSettings> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    const saved = parsed.calibration;

    const calibration: Calibration | undefined =
      saved &&
      isFiniteNumber(saved.widthCm) &&
      isFiniteNumber(saved.heightCm) &&
      isFiniteNumber(saved.distanceCm) &&
      isFiniteNumber(saved.sensitivity)
        ? {
            widthCm: clamp(saved.widthCm, 10, 300),
            heightCm: clamp(saved.heightCm, 6, 200),
            distanceCm: clamp(saved.distanceCm, 20, 200),
            sensitivity: clamp(saved.sensitivity, 0.3, 3),
          }
        : undefined;

    return {
      ...(calibration ? { calibration } : {}),
      ...(isSceneId(parsed.scene) ? { scene: parsed.scene } : {}),
    };
  } catch {
    return {};
  }
}

function persistSettings(calibration: Calibration, scene: SceneId) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ calibration, scene }));
  } catch {
    // Storage can be unavailable (private mode, quota). Persistence is optional.
  }
}

const saved = loadSettings();

export const useAppStore = create<AppState>((set) => ({
  stage: 'landing',
  calibration: saved.calibration ?? DEFAULT_CALIBRATION,
  scene: saved.scene ?? 'aquarium',
  stereo: false,
  debug: false,
  pipCollapsed: false,

  setStage: (stage) => set({ stage }),

  setCalibration: (value) =>
    set((state) => {
      const calibration = { ...state.calibration, ...value };
      persistSettings(calibration, state.scene);
      return { calibration };
    }),

  setScene: (scene) =>
    set((state) => {
      persistSettings(state.calibration, scene);
      return { scene };
    }),

  setStereo: (stereo) => set({ stereo }),
  setDebug: (debug) => set({ debug }),
  setPipCollapsed: (pipCollapsed) => set({ pipCollapsed }),
}));
