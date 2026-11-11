export interface DisplayPreset {
  label: string;
  /** Long side of the screen in cm (the app turns it to match how it's held). */
  widthCm: number;
  /** Short side of the screen in cm. */
  heightCm: number;
}

export type DeviceKind = 'phone' | 'tablet' | 'computer';

export const DISPLAY_PRESETS: readonly DisplayPreset[] = [
  { label: '13" Laptop', widthCm: 28.7, heightCm: 17.9 },
  { label: '14" Laptop', widthCm: 30.9, heightCm: 19.3 },
  { label: '15.6" Laptop', widthCm: 34.5, heightCm: 19.4 },
  { label: '16" Laptop', widthCm: 35.4, heightCm: 22.2 },
  { label: '23" / 24" Monitor', widthCm: 52.7, heightCm: 29.6 },
  { label: '27" Monitor', widthCm: 59.8, heightCm: 33.6 },
  { label: '32" Monitor', widthCm: 70.7, heightCm: 39.8 },
  { label: '34" Ultrawide', widthCm: 79.8, heightCm: 33.5 },
  { label: 'Small phone (5.8–6.1")', widthCm: 14.1, heightCm: 6.5 },
  { label: 'Large phone (6.5–6.9")', widthCm: 15.5, heightCm: 7.1 },
  { label: 'Tablet (10–11")', widthCm: 22.9, heightCm: 16.0 },
  { label: 'Large tablet (12–13")', widthCm: 26.5, heightCm: 19.5 },
  { label: 'Custom…', widthCm: 0, heightCm: 0 },
];

export const CUSTOM_PRESET_INDEX = DISPLAY_PRESETS.length - 1;

const indexOf = (label: string) => DISPLAY_PRESETS.findIndex((preset) => preset.label === label);

/**
 * Phones and tablets report a coarse (finger) pointer. Their CSS pixels are
 * roughly 0.018 cm each, which is close enough to tell a small phone from a
 * large one or a tablet.
 */
export function detectDevice(): DeviceKind {
  if (typeof window === 'undefined') return 'computer';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const touch = (navigator.maxTouchPoints ?? 0) > 0;
  if (!coarse || !touch) return 'computer';
  const shortSide = Math.min(window.screen.width, window.screen.height);
  return shortSide < 600 ? 'phone' : 'tablet';
}

const MOBILE_CM_PER_CSS_PX = 0.0182;

/** Typical eye-to-screen distance for each kind of device, in cm. */
export function typicalDistanceCm(device: DeviceKind = detectDevice()): number {
  if (device === 'phone') return 30;
  if (device === 'tablet') return 38;
  return 45;
}

/**
 * The physical pixel width is (CSS width × devicePixelRatio). This cancels out
 * browser zoom and OS scaling, so the guessed preset stays stable.
 */
function physicalScreenWidth(): number {
  if (typeof window === 'undefined') return 1920;
  return Math.max(window.screen.width, window.screen.height) * (window.devicePixelRatio || 1);
}

export function guessPresetIndex(): number {
  const device = detectDevice();
  if (device !== 'computer') {
    const longCm = Math.max(window.screen.width, window.screen.height) * MOBILE_CM_PER_CSS_PX;
    if (device === 'phone') {
      return indexOf(longCm < 14.8 ? 'Small phone (5.8–6.1")' : 'Large phone (6.5–6.9")');
    }
    return indexOf(longCm < 24.5 ? 'Tablet (10–11")' : 'Large tablet (12–13")');
  }

  const width = physicalScreenWidth();
  if (width <= 1500) return indexOf('13" Laptop');
  if (width <= 1650) return indexOf('14" Laptop');
  if (width <= 1850) return indexOf('15.6" Laptop');
  if (width <= 2000) return indexOf('23" / 24" Monitor');
  if (width <= 2600) return indexOf('27" Monitor');
  if (width <= 2900) return indexOf('32" Monitor');
  return indexOf('34" Ultrawide');
}

export function findPresetIndex(widthCm: number, heightCm: number): number {
  const long = Math.max(widthCm, heightCm);
  const short = Math.min(widthCm, heightCm);
  const index = DISPLAY_PRESETS.findIndex(
    (preset) =>
      preset.widthCm > 0 &&
      Math.abs(preset.widthCm - long) < 0.6 &&
      Math.abs(preset.heightCm - short) < 0.6,
  );
  return index === -1 ? CUSTOM_PRESET_INDEX : index;
}
