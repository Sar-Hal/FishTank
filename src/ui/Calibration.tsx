import { useState } from 'react';
import { DEFAULT_CALIBRATION, useAppStore } from '../state/appStore';
import {
  CUSTOM_PRESET_INDEX,
  DISPLAY_PRESETS,
  findPresetIndex,
} from './displayPresets';

const CARD_WIDTH_CM = 8.56;
const CARD_HEIGHT_CM = 5.4;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function Calibration() {
  const calibration = useAppStore((state) => state.calibration);
  const setCalibration = useAppStore((state) => state.setCalibration);
  const setStage = useAppStore((state) => state.setStage);

  const [presetIndex, setPresetIndex] = useState(() =>
    findPresetIndex(calibration.widthCm, calibration.heightCm),
  );
  const [cardPx, setCardPx] = useState(300);
  const [cardLocked, setCardLocked] = useState(false);

  const isCustom = presetIndex === CUSTOM_PRESET_INDEX;

  const applyPreset = (index: number) => {
    setPresetIndex(index);
    setCardLocked(false);
    const preset = DISPLAY_PRESETS[index];
    if (preset.widthCm > 0) {
      setCalibration({ widthCm: preset.widthCm, heightCm: preset.heightCm });
    }
  };

  const updateCustom = (key: 'widthCm' | 'heightCm', raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    setPresetIndex(CUSTOM_PRESET_INDEX);
    setCardLocked(false);
    setCalibration({ [key]: value });
  };

  const commitCardCalibration = () => {
    const cmPerPx = CARD_WIDTH_CM / cardPx;
    const widthCm = Number((window.screen.width * cmPerPx).toFixed(1));
    const heightCm = Number((window.screen.height * cmPerPx).toFixed(1));
    setCalibration({ widthCm, heightCm });
    setPresetIndex(CUSTOM_PRESET_INDEX);
    setCardLocked(true);
  };

  const resetDefaults = () => {
    setCalibration(DEFAULT_CALIBRATION);
    setPresetIndex(findPresetIndex(DEFAULT_CALIBRATION.widthCm, DEFAULT_CALIBRATION.heightCm));
    setCardLocked(false);
  };

  return (
    <main className="page page--calibration">
      <div className="calibration-card glass">
        <header className="calibration-header">
          <span className="eyebrow">
            <span className="pulse-dot" />
            Display calibration
          </span>
          <h1>Match the window to your screen</h1>
          <p>
            The projection is physically accurate only when the app knows your screen
            size and viewing distance. Defaults are fine to start with — refine them
            for the strongest depth illusion.
          </p>
        </header>

        <section className="field-group">
          <label className="field-label" htmlFor="monitor-preset">
            Monitor preset
          </label>
          <select
            id="monitor-preset"
            className="select"
            value={presetIndex}
            onChange={(event) => applyPreset(Number(event.target.value))}
          >
            {DISPLAY_PRESETS.map((preset, index) => (
              <option key={preset.label} value={index}>
                {preset.label}
              </option>
            ))}
          </select>

          {isCustom && (
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
                  onBlur={() =>
                    setCalibration({ widthCm: clamp(calibration.widthCm, 10, 300) })
                  }
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
                  onBlur={() =>
                    setCalibration({ heightCm: clamp(calibration.heightCm, 6, 200) })
                  }
                />
              </label>
            </div>
          )}

          <p className="field-note">
            Current: <strong>{calibration.widthCm} × {calibration.heightCm} cm</strong>
          </p>
        </section>

        <section className="field-group">
          <span className="field-label">Precision ruler (optional)</span>
          <p className="field-note">
            Hold a standard bank card against the screen and drag the slider until the
            dashed box matches it exactly. Then lock it in.
          </p>

          <div className="ruler">
            <div
              className="ruler-box"
              style={{ width: cardPx, aspectRatio: `${CARD_WIDTH_CM} / ${CARD_HEIGHT_CM}` }}
            >
              8.56 × 5.4 cm
            </div>
            <input
              className="range"
              type="range"
              min={100}
              max={620}
              value={cardPx}
              onChange={(event) => {
                setCardPx(Number(event.target.value));
                setCardLocked(false);
              }}
              aria-label="Credit card width in pixels"
            />
            <button
              type="button"
              className={`btn btn--small ${cardLocked ? 'btn--success' : 'btn--ghost'}`}
              onClick={commitCardCalibration}
            >
              {cardLocked ? '✓ Calibrated from card' : 'Lock in card size'}
            </button>
          </div>
        </section>

        <section className="field-group">
          <div className="slider-heading">
            <span className="field-label">Sitting distance</span>
            <strong>{calibration.distanceCm} cm</strong>
          </div>
          <input
            className="range"
            type="range"
            min={30}
            max={120}
            step={1}
            value={calibration.distanceCm}
            onChange={(event) =>
              setCalibration({ distanceCm: Number(event.target.value) })
            }
            aria-label="Sitting distance in centimetres"
          />
          <p className="field-note">
            Your natural eye-to-screen distance. Used to estimate depth from the face
            size.
          </p>
        </section>

        <section className="field-group">
          <div className="slider-heading">
            <span className="field-label">Motion sensitivity</span>
            <strong>{calibration.sensitivity.toFixed(2)}×</strong>
          </div>
          <input
            className="range"
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={calibration.sensitivity}
            onChange={(event) =>
              setCalibration({ sensitivity: Number(event.target.value) })
            }
            aria-label="Motion sensitivity"
          />
          <p className="field-note">
            Increase for more dramatic parallax, decrease if the view feels jittery.
          </p>
        </section>

        <footer className="calibration-actions">
          <button className="btn btn--ghost" onClick={() => setStage('landing')}>
            ← Back
          </button>
          <div className="calibration-actions-right">
            <button className="link-button" onClick={resetDefaults}>
              Reset defaults
            </button>
            <button className="btn btn--primary" onClick={() => setStage('experience')}>
              Launch experience <span aria-hidden="true">→</span>
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
