import { useState } from 'react';
import { DEFAULT_CALIBRATION, useAppStore } from '../state/appStore';
import {
  CUSTOM_PRESET_INDEX,
  DISPLAY_PRESETS,
  findPresetIndex,
  detectDevice,
  guessPresetIndex,
  typicalDistanceCm,
} from './displayPresets';

const CARD_WIDTH_CM = 8.56;
const CARD_HEIGHT_CM = 5.4;

const SHORTCUTS: Array<[string, string]> = [
  ['1 – 4', 'Switch scene'],
  ['C', 'Re-centre'],
  ['F', 'Full screen'],
  ['H', 'Hide controls'],
  ['O', 'Settings'],
  ['M', 'Camera preview'],
  ['S', '3D glasses mode'],
  ['D', 'Nerd stats'],
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle">
      <span className="toggle-text">
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  );
}

/**
 * Settings drawer shown on top of the live scene, so every change is visible
 * immediately instead of on a separate page.
 */
export function SettingsPanel({ onRecenter }: { onRecenter: () => void }) {
  const open = useAppStore((state) => state.settingsOpen);
  const setOpen = useAppStore((state) => state.setSettingsOpen);
  const calibration = useAppStore((state) => state.calibration);
  const setCalibration = useAppStore((state) => state.setCalibration);
  const trackingEnabled = useAppStore((state) => state.trackingEnabled);
  const setTrackingEnabled = useAppStore((state) => state.setTrackingEnabled);
  const stereo = useAppStore((state) => state.stereo);
  const setStereo = useAppStore((state) => state.setStereo);
  const stats = useAppStore((state) => state.stats);
  const setStats = useAppStore((state) => state.setStats);
  const pipCollapsed = useAppStore((state) => state.pipCollapsed);
  const setPipCollapsed = useAppStore((state) => state.setPipCollapsed);

  const [customMode, setCustomMode] = useState(false);
  const presetIndex = customMode
    ? CUSTOM_PRESET_INDEX
    : findPresetIndex(calibration.widthCm, calibration.heightCm);
  const detectedIndex = guessPresetIndex();
  const device = detectDevice();
  // Touch devices have no keyboard, and a bank card is wider than a phone.
  const isTouch = device !== 'computer';
  const [cardPx, setCardPx] = useState(300);
  const [cardLocked, setCardLocked] = useState(false);

  const applyPreset = (index: number) => {
    setCardLocked(false);
    const preset = DISPLAY_PRESETS[index];
    setCustomMode(preset.widthCm <= 0);
    if (preset.widthCm > 0) {
      setCalibration({ widthCm: preset.widthCm, heightCm: preset.heightCm });
    }
  };

  const updateCustom = (key: 'widthCm' | 'heightCm', raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return;
    setCardLocked(false);
    setCalibration({ [key]: value });
  };

  const lockCard = () => {
    const cmPerPx = CARD_WIDTH_CM / cardPx;
    setCalibration({
      widthCm: Number((window.screen.width * cmPerPx).toFixed(1)),
      heightCm: Number((window.screen.height * cmPerPx).toFixed(1)),
    });
    setCardLocked(true);
  };

  const resetDefaults = () => {
    const detected = DISPLAY_PRESETS[detectedIndex];
    setCalibration({
      ...DEFAULT_CALIBRATION,
      distanceCm: typicalDistanceCm(),
      ...(detected.widthCm > 0
        ? { widthCm: detected.widthCm, heightCm: detected.heightCm }
        : {}),
    });
    setCardLocked(false);
    setCustomMode(false);
  };

  return (
    <aside
      className={`settings glass ${open ? 'settings--open' : ''}`}
      aria-label="Settings"
      aria-hidden={!open || undefined}
      inert={!open || undefined}
    >
      <header className="settings-header">
        <h2>Settings</h2>
        <button
          type="button"
          className="icon-button"
          onClick={() => setOpen(false)}
          aria-label="Close settings"
          title="Close (Esc)"
        >
          ✕
        </button>
      </header>

      <div className="settings-body">
        <section className="setting">
          <div className="setting-heading">
            <span>How far you sit</span>
            <strong>{calibration.distanceCm} cm</strong>
          </div>
          <input
            className="range"
            type="range"
            min={25}
            max={100}
            step={1}
            value={calibration.distanceCm}
            onChange={(event) => setCalibration({ distanceCm: Number(event.target.value) })}
            aria-label="Distance from the screen in centimetres"
          />
          <div className="range-labels">
            <span>Closer · wider view</span>
            <span>Further · zoomed in</span>
          </div>
          <button type="button" className="link-button" onClick={onRecenter}>
            Sit where you like, then tap here to re-centre
          </button>
        </section>

        <section className="setting">
          <div className="setting-heading">
            <span>Movement strength</span>
            <strong>{calibration.sensitivity.toFixed(1)}×</strong>
          </div>
          <input
            className="range"
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={calibration.sensitivity}
            onChange={(event) => setCalibration({ sensitivity: Number(event.target.value) })}
            aria-label="Movement strength"
          />
          <div className="range-labels">
            <span>Calm</span>
            <span>Wild</span>
          </div>
        </section>

        <section className="setting">
          <label className="setting-heading" htmlFor="screen-size">
            <span>Your screen</span>
            <strong>
              {calibration.widthCm} × {calibration.heightCm} cm
            </strong>
          </label>
          <select
            id="screen-size"
            className="select"
            value={presetIndex}
            onChange={(event) => applyPreset(Number(event.target.value))}
          >
            {DISPLAY_PRESETS.map((preset, index) => (
              <option key={preset.label} value={index}>
                {preset.label}
                {index === detectedIndex ? ' (looks like yours)' : ''}
              </option>
            ))}
          </select>

          {presetIndex === CUSTOM_PRESET_INDEX && (
            <div className="field-row">
              <label className="field">
                <span>Width (cm)</span>
                <input
                  type="number"
                  min={10}
                  max={300}
                  step={0.1}
                  value={calibration.widthCm}
                  onChange={(event) => updateCustom('widthCm', event.target.value)}
                  onBlur={() => setCalibration({ widthCm: clamp(calibration.widthCm, 10, 300) })}
                />
              </label>
              <label className="field">
                <span>Height (cm)</span>
                <input
                  type="number"
                  min={6}
                  max={200}
                  step={0.1}
                  value={calibration.heightCm}
                  onChange={(event) => updateCustom('heightCm', event.target.value)}
                  onBlur={() => setCalibration({ heightCm: clamp(calibration.heightCm, 6, 200) })}
                />
              </label>
            </div>
          )}

          {device !== 'phone' && (
          <details className="ruler">
            <summary>Not sure? Measure it with a bank card</summary>
            <p>
              Hold any bank card against the screen and drag the slider until the box
              matches it.
            </p>
            <div
              className="ruler-box"
              style={{ width: cardPx, aspectRatio: `${CARD_WIDTH_CM} / ${CARD_HEIGHT_CM}` }}
            >
              💳
            </div>
            <input
              className="range"
              type="range"
              min={100}
              max={420}
              value={cardPx}
              onChange={(event) => {
                setCardPx(Number(event.target.value));
                setCardLocked(false);
              }}
              aria-label="Card width on screen"
            />
            <button
              type="button"
              className={`btn btn--small ${cardLocked ? 'btn--success' : 'btn--ghost'}`}
              onClick={lockCard}
            >
              {cardLocked ? '✓ Screen size saved' : 'It matches — save'}
            </button>
          </details>
          )}
        </section>

        <section className="setting setting--toggles">
          <Toggle
            label="Camera tracking"
            hint="Turn off to switch the camera off completely"
            checked={trackingEnabled}
            onChange={setTrackingEnabled}
          />
          <Toggle
            label="Show camera"
            hint="A small preview of what the camera sees"
            checked={!pipCollapsed}
            onChange={(value) => setPipCollapsed(!value)}
          />
          <Toggle
            label="3D glasses mode"
            hint="For red/blue paper 3D glasses"
            checked={stereo}
            onChange={setStereo}
          />
          <Toggle
            label="Nerd stats"
            hint="Head position numbers and a diagram"
            checked={stats}
            onChange={setStats}
          />
        </section>

        {!isTouch && (
        <section className="setting">
          <span className="setting-heading">
            <span>Keyboard shortcuts</span>
          </span>
          <dl className="shortcuts">
            {SHORTCUTS.map(([key, label]) => (
              <div key={key}>
                <dt>
                  <kbd>{key}</kbd>
                </dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </section>
        )}

        <p className="privacy-note">
          🔒 <strong>Your privacy:</strong> camera pictures are analysed inside this
          tab and thrown away straight after. Nothing is recorded, saved or sent
          anywhere. The camera switches off when you switch tabs, turn tracking off
          or leave. Only your screen size and settings are saved, on this device.
        </p>

        <button type="button" className="link-button settings-reset" onClick={resetDefaults}>
          Reset everything to defaults
        </button>
      </div>
    </aside>
  );
}
