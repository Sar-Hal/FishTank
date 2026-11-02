import { useState } from 'react';
import { Experience } from './components/Experience';
import { useAppStore } from './store';

// ── Screen size presets ────────────────────────────────────────────────────────
const PRESETS = [
  { label: '13" Laptop',       widthCm: 28.7, heightCm: 17.9 },
  { label: '14" Laptop',       widthCm: 30.9, heightCm: 19.3 },
  { label: '15.6" Laptop',     widthCm: 34.5, heightCm: 19.4 },
  { label: '16" Laptop',       widthCm: 35.4, heightCm: 22.2 },
  { label: '23" / 24" Monitor',widthCm: 52.7, heightCm: 29.6 },
  { label: '27" Monitor',      widthCm: 59.8, heightCm: 33.6 },
  { label: '32" Monitor',      widthCm: 70.7, heightCm: 39.8 },
  { label: '34" Ultrawide',    widthCm: 79.8, heightCm: 33.5 },
  { label: 'Custom…',          widthCm: 0,    heightCm: 0 },
] as const;

/** Guess the best preset from the screen's CSS pixel width.
 *  This is approximate — the user can always override. */
function guessPresetIndex(): number {
  const w = window.screen.width;
  // CSS pixel widths roughly correlate to display class:
  if (w <= 1440) return 0;  // small laptop
  if (w <= 1600) return 1;  // 14"
  if (w <= 1800) return 2;  // 15.6"
  if (w <= 1920) return 3;  // 16" laptop or 24" monitor — pick 24" for external
  if (w <= 2560) return 4;  // 24"
  return 5;                 // 27" or larger
}

function Landing() {
  const setStage = useAppStore((s) => s.setStage);
  const setCalibration = useAppStore((s) => s.setCalibration);

  const startAuto = () => {
    const idx = guessPresetIndex();
    const p = PRESETS[idx];
    if (p.widthCm > 0) {
      setCalibration({
        widthCm: p.widthCm,
        heightCm: p.heightCm,
        cameraOffsetYCm: p.heightCm / 2,
      });
    }
    setStage('experience');
  };

  return (
    <main className="landing">
      <div className="glow" />
      <div className="eyebrow">◈ REAL-TIME SPATIAL DISPLAY</div>
      <h1>WINDOW<span>—</span></h1>
      <p className="subtitle">Perspective-Correct 3D Head-Tracked Display</p>
      <p className="intro">
        Turn your monitor into an authentic 3D window into another room. Move your head to peer
        around corners with true motion parallax and stereoscopic depth.
      </p>
      <div className="features">
        <span>◉ BLAZEFACE 60FPS TRACKING</span>
        <span>◉ AUTO-DISTANCE CALIBRATION</span>
        <span>◉ RED/CYAN 3D STEREO</span>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <button className="primary" onClick={startAuto}>
          Start Experience <span>→</span>
        </button>
        <button
          className="secondary-btn"
          onClick={() => setStage('calibration')}
        >
          Calibrate Screen Size
        </button>
      </div>
      <p className="permission">Webcam runs 100% locally in your browser to estimate eye position. No video is ever stored or uploaded.</p>
    </main>
  );
}


function Calibration() {
  const calibration = useAppStore((s) => s.calibration);
  const setCalibration = useAppStore((s) => s.setCalibration);
  const setStage = useAppStore((s) => s.setStage);

  const [presetIdx, setPresetIdx] = useState(() => guessPresetIndex());
  const [cardPx, setCardPx] = useState(256); // draggable credit-card width in CSS pixels
  const [cardCalibrated, setCardCalibrated] = useState(false);

  // Credit card physical dimensions (ISO 7810 ID-1): 85.6 mm × 54.0 mm
  const CARD_W_CM = 8.56;
  const CARD_H_CM = 5.4;

  function applyPreset(idx: number) {
    setPresetIdx(idx);
    const p = PRESETS[idx];
    if (p.widthCm > 0) setCalibration({ widthCm: p.widthCm, heightCm: p.heightCm });
  }

  /** Called when the user finishes dragging the card to the right size. */
  function commitCardCalibration() {
    // cardPx CSS pixels = CARD_W_CM centimetres of physical screen width
    const cmPerPx = CARD_W_CM / cardPx;
    const widthCm = parseFloat((window.screen.width * cmPerPx).toFixed(1));
    const heightCm = parseFloat((window.screen.height * cmPerPx).toFixed(1));
    setCalibration({ widthCm, heightCm });
    setCardCalibrated(true);
    setPresetIdx(PRESETS.length - 1); // switch selector to "Custom…"
  }

  const isCustom = PRESETS[presetIdx].widthCm === 0;

  return (
    <main className="calibration">
      <div className="panel">
        <div className="eyebrow">◈ SYSTEM CALIBRATION</div>
        <h2>Make the window yours.</h2>
        <p className="muted">These measurements make the projection physically accurate.</p>

        {/* ── Screen size ─────────────────────────────────────────────────── */}
        <div className="calib-section">
          <label className="calib-label">
            MONITOR SIZE
            <select
              className="calib-select"
              value={presetIdx}
              onChange={(e) => applyPreset(Number(e.target.value))}
            >
              {PRESETS.map((p, i) => (
                <option key={p.label} value={i}>{p.label}</option>
              ))}
            </select>
          </label>

          {isCustom && (
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label>
                Screen width
                <input type="number" value={calibration.widthCm}
                  onChange={(e) => setCalibration({ widthCm: Number(e.target.value) })} />
                <small>cm</small>
              </label>
              <label>
                Screen height
                <input type="number" value={calibration.heightCm}
                  onChange={(e) => setCalibration({ heightCm: Number(e.target.value) })} />
                <small>cm</small>
              </label>
            </div>
          )}

          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Detected: {calibration.widthCm} × {calibration.heightCm} cm
          </p>
        </div>

        {/* ── Credit-card calibration ──────────────────────────────────────── */}
        <div className="calib-section card-section">
          <p className="calib-label">VERIFY WITH A CREDIT CARD (optional)</p>
          <p className="muted" style={{ fontSize: 11 }}>
            Drag the right edge of the rectangle until it matches a real credit card held up to the screen, then press <em>Lock in</em>.
          </p>
          <div className="card-ruler-wrap">
            <div
              className="card-ruler"
              style={{ width: cardPx, aspectRatio: `${CARD_W_CM} / ${CARD_H_CM}` }}
            >
              <span className="card-label">credit card</span>
            </div>
            {/* simple drag handle */}
            <input
              type="range" min={80} max={600} value={cardPx}
              onChange={(e) => { setCardPx(Number(e.target.value)); setCardCalibrated(false); }}
              style={{ width: '100%', marginTop: 8, accentColor: '#7dffe1' }}
              aria-label="Resize card"
            />
            <button
              className={`calib-lock-btn ${cardCalibrated ? 'locked' : ''}`}
              onClick={commitCardCalibration}
            >
              {cardCalibrated ? '✓ Locked in' : 'Lock in'}
            </button>
          </div>
        </div>

        {/* ── Eye distance ─────────────────────────────────────────────────── */}
        <label className="range" style={{ marginTop: 20 }}>
          EYE-TO-SCREEN DISTANCE
          <input type="range" min={30} max={120} step={1} value={calibration.distanceCm}
            onChange={(e) => setCalibration({ distanceCm: Number(e.target.value) })} />
          <span>{calibration.distanceCm} cm</span>
        </label>

        {/* ── Sensitivity ──────────────────────────────────────────────────── */}
        <label className="range">
          TRACKING SENSITIVITY
          <input type="range" min={0.5} max={1.8} step={0.05} value={calibration.sensitivity}
            onChange={(e) => setCalibration({ sensitivity: Number(e.target.value) })} />
          <span>{calibration.sensitivity.toFixed(2)}×</span>
        </label>

        <button className="primary" style={{ marginTop: 28, width: '100%' }} onClick={() => setStage('experience')}>
          Enable camera <span>→</span>
        </button>
        <button className="text-button" onClick={() => setStage('experience')}>
          Continue in fallback mode
        </button>
      </div>
    </main>
  );
}

export default function App() {
  const stage = useAppStore((s) => s.stage);
  return stage === 'landing' ? <Landing /> : stage === 'calibration' ? <Calibration /> : <Experience />;
}
