export interface DisplayPreset {
  label: string;
  widthCm: number;
  heightCm: number;
}

export const DISPLAY_PRESETS: readonly DisplayPreset[] = [
  { label: '13" Laptop', widthCm: 28.7, heightCm: 17.9 },
  { label: '14" Laptop', widthCm: 30.9, heightCm: 19.3 },
  { label: '15.6" Laptop', widthCm: 34.5, heightCm: 19.4 },
  { label: '16" Laptop', widthCm: 35.4, heightCm: 22.2 },
  { label: '23" / 24" Monitor', widthCm: 52.7, heightCm: 29.6 },
  { label: '27" Monitor', widthCm: 59.8, heightCm: 33.6 },
  { label: '32" Monitor', widthCm: 70.7, heightCm: 39.8 },
  { label: '34" Ultrawide', widthCm: 79.8, heightCm: 33.5 },
  { label: 'Custom…', widthCm: 0, heightCm: 0 },
];

export const CUSTOM_PRESET_INDEX = DISPLAY_PRESETS.length - 1;

/**
 * The physical pixel width is (CSS width × devicePixelRatio). This cancels out
 * browser zoom and OS scaling, so the guessed preset stays stable.
 */
function physicalScreenWidth(): number {
  if (typeof window === 'undefined') return 1920;
  return window.screen.width * (window.devicePixelRatio || 1);
}

export function guessPresetIndex(): number {
  const width = physicalScreenWidth();
  if (width <= 1500) return 0;
  if (width <= 1650) return 1;
  if (width <= 1850) return 2;
  if (width <= 2000) return 4;
  if (width <= 2600) return 5;
  if (width <= 2900) return 6;
  return 7;
}

export function findPresetIndex(widthCm: number, heightCm: number): number {
  const index = DISPLAY_PRESETS.findIndex(
    (preset) =>
      preset.widthCm > 0 &&
      Math.abs(preset.widthCm - widthCm) < 0.6 &&
      Math.abs(preset.heightCm - heightCm) < 0.6,
  );
  return index === -1 ? CUSTOM_PRESET_INDEX : index;
}
