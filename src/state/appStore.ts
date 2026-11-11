import { create } from 'zustand';

export type Stage = 'landing' | 'experience';
export type SceneId = 'aquarium' | 'corridor' | 'cyber' | 'mirror';

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

/**
 * Most people sit 40–50 cm from a laptop. Using that as the starting distance
 * gives a wider field of view, so the scene doesn't feel zoomed in on launch.
 */
export const DEFAULT_CALIBRATION: Calibration = {
  widthCm: 34.5,
  heightCm: 19.4,
  distanceCm: 45,
  sensitivity: 1,
};

export const SCENES: ReadonlyArray<{
  id: SceneId;
  label: string;
  icon: string;
  hint: string;
}> = [
  { id: 'aquarium', label: 'Aquarium', icon: '🐠', hint: 'Fish swimming behind your screen' },
  { id: 'corridor', label: 'Study', icon: '📚', hint: 'A cosy study with a glowing doorway' },
  { id: 'cyber', label: 'Cyber', icon: '⚡', hint: 'A glowing sci-fi room' },
  { id: 'mirror', label: 'Infinity', icon: '🪞', hint: 'Your screen, inside your screen, forever' },
];

interface AppState {
  stage: Stage;
  calibration: Calibration;
  scene: SceneId;
  stereo: boolean;
  /** Master switch for the camera. Off means the camera is fully released. */
  trackingEnabled: boolean;
  /** Shows the head-position numbers and frustum diagram. */
  stats: boolean;
  pipCollapsed: boolean;
  settingsOpen: boolean;
  /** Hides every HUD element so only the scene remains. */
  uiHidden: boolean;
  setStage: (stage: Stage) => void;
  setCalibration: (value: Partial<Calibration>) => void;
  setScene: (scene: SceneId) => void;
  setStereo: (stereo: boolean) => void;
  setTrackingEnabled: (enabled: boolean) => void;
  setStats: (stats: boolean) => void;
  setPipCollapsed: (collapsed: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setUiHidden: (hidden: boolean) => void;
  toggleUiHidden: () => void;
}

// v2: the default sitting distance changed from 60 cm to 45 cm, so older saved
// settings are ignored rather than keeping the zoomed-in view.
const STORAGE_KEY = 'fishtank:settings:v2';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isSceneId = (value: unknown): value is SceneId =>
  value === 'aquarium' || value === 'corridor' || value === 'cyber' || value === 'mirror';

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
            distanceCm: clamp(saved.distanceCm, 25, 150),
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

/** False on a first visit, when the screen size should be guessed instead. */
export function hasSavedCalibration(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export const useAppStore = create<AppState>((set) => ({
  stage: 'landing',
  calibration: saved.calibration ?? DEFAULT_CALIBRATION,
  scene: saved.scene ?? 'aquarium',
  stereo: false,
  trackingEnabled: true,
  stats: false,
  pipCollapsed: false,
  settingsOpen: false,
  uiHidden: false,

  setStage: (stage) => set({ stage, settingsOpen: false, uiHidden: false }),

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
  setTrackingEnabled: (trackingEnabled) => set({ trackingEnabled }),
  setStats: (stats) => set({ stats }),
  setPipCollapsed: (pipCollapsed) => set({ pipCollapsed }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setUiHidden: (uiHidden) => set({ uiHidden, ...(uiHidden ? { settingsOpen: false } : {}) }),
  toggleUiHidden: () =>
    set((state) => ({ uiHidden: !state.uiHidden, settingsOpen: false })),
}));
