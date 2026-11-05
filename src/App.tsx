import { useState } from 'react';
import { Experience } from './components/Experience';
import { useAppStore } from './store';

// ── Screen size presets ────────────────────────────────────────────────────────
const PRESETS = [
  { label: '13" Laptop',        widthCm: 28.7, heightCm: 17.9 },
  { label: '14" Laptop',        widthCm: 30.9, heightCm: 19.3 },
  { label: '15.6" Laptop',      widthCm: 34.5, heightCm: 19.4 },
  { label: '16" Laptop',        widthCm: 35.4, heightCm: 22.2 },
  { label: '23" / 24" Monitor', widthCm: 52.7, heightCm: 29.6 },
  { label: '27" Monitor',       widthCm: 59.8, heightCm: 33.6 },
  { label: '32" Monitor',       widthCm: 70.7, heightCm: 39.8 },
  { label: '34" Ultrawide',     widthCm: 79.8, heightCm: 33.5 },
  { label: 'Custom…',           widthCm: 0,    heightCm: 0 },
] as const;

/** Guess best screen preset from screen resolution */
function guessPresetIndex(): number {
  const w = window.screen.width;
  if (w <= 1440) return 0;
  if (w <= 1600) return 1;
  if (w <= 1800) return 2;
  if (w <= 1920) return 4; // 24" desktop monitor
  if (w <= 2560) return 5; // 27" monitor
  return 6;                // 32" or ultrawide
}

function Landing() {
  const setStage = useAppStore((s) => s.setStage);
  const setCalibration = useAppStore((s) => s.setCalibration);

  const bestPreset = PRESETS[guessPresetIndex()];

  const startAuto = () => {
    if (bestPreset.widthCm > 0) {
      setCalibration({
        widthCm: bestPreset.widthCm,
        heightCm: bestPreset.heightCm,
        cameraOffsetYCm: 0, // Centered neutral viewpoint
      });
    }
    setStage('experience');
  };

  return (
    <main className="landing-page">
      <div className="landing-ambient-glow" />
      <div className="landing-content">
        <div className="spatial-badge">
          <span className="badge-pulse" />
          <span>REAL-TIME SPATIAL PORTAL</span>
        </div>

        <h1 className="landing-title">
          WINDOW <span className="title-gradient">3D</span>
        </h1>

        <p className="landing-subtitle">
          Turn your monitor into an authentic perspective-correct 3D window into another room.
        </p>

        <p className="landing-description">
          Move your head to peer around corners with genuine motion parallax and depth.
          Powered by lightweight 60 FPS on-device computer vision and Kooima off-axis projection.
        </p>

        <div className="feature-tags">
          <span className="ftag">⚡ 60 FPS BlazeFace Tracking</span>
          <span className="ftag">🔒 100% Private &amp; On-Device</span>
          <span className="ftag">🥽 Red/Cyan 3D Stereo</span>
          <span className="ftag">📐 Dynamic Off-Axis Frustum</span>
        </div>

        <div className="landing-actions">
          <button className="cta-primary-btn" onClick={startAuto}>
            <span>ENTER 3D PORTAL</span>
            <span className="btn-arrow">→</span>
          </button>
          <button
            className="cta-secondary-btn"
            onClick={() => setStage('calibration')}
          >
            ⚙️ Display Settings
          </button>
        </div>

        <div className="landing-specs">
          <span className="spec-indicator" />
          <span>Auto-detected: <b>{bestPreset.label}</b> ({bestPreset.widthCm} × {bestPreset.heightCm} cm)</span>
        </div>
      </div>
    </main>
  );
}

function Calibration() {
  const calibration = useAppStore((s) => s.calibration);
  const setCalibration = useAppStore((s) => s.setCalibration);
  const setStage = useAppStore((s) => s.setStage);

  const [presetIdx, setPresetIdx] = useState(() => guessPresetIndex());
  const [cardPx, setCardPx] = useState(256);
  const [cardCalibrated, setCardCalibrated] = useState(false);

  const CARD_W_CM = 8.56;
  const CARD_H_CM = 5.4;

  function applyPreset(idx: number) {
    setPresetIdx(idx);
    const p = PRESETS[idx];
    if (p.widthCm > 0) {
      setCalibration({
        widthCm: p.widthCm,
        heightCm: p.heightCm,
        cameraOffsetYCm: 0,
      });
    }
  }

  function commitCardCalibration() {
    const cmPerPx = CARD_W_CM / cardPx;
    const widthCm = parseFloat((window.screen.width * cmPerPx).toFixed(1));
    const heightCm = parseFloat((window.screen.height * cmPerPx).toFixed(1));
    setCalibration({ widthCm, heightCm, cameraOffsetYCm: 0 });
    setCardCalibrated(true);
    setPresetIdx(PRESETS.length - 1);
  }

  const isCustom = PRESETS[presetIdx].widthCm === 0;

  return (
    <main className="calib-page">
      <div className="calib-panel">
        <div className="calib-header">
          <div className="spatial-badge">
            <span className="badge-pulse" />
            <span>DISPLAY CALIBRATION</span>
          </div>
          <h2>Tune Your Physical Display</h2>
          <p className="calib-muted">
            Matching your monitor's physical dimensions ensures 1:1 perspective projection accuracy.
          </p>
        </div>

        <div className="calib-group">
          <label className="calib-label-text">
            <span>MONITOR PRESET</span>
            <select
              className="calib-select-input"
              value={presetIdx}
              onChange={(e) => applyPreset(Number(e.target.value))}
            >
              {PRESETS.map((p, i) => (
                <option key={p.label} value={i}>{p.label}</option>
              ))}
            </select>
          </label>

          {isCustom && (
            <div className="calib-grid-custom">
              <label className="calib-input-wrap">
                <span>Width (cm)</span>
                <input
                  type="number"
                  value={calibration.widthCm}
                  onChange={(e) => setCalibration({ widthCm: Number(e.target.value) })}
                />
              </label>
              <label className="calib-input-wrap">
                <span>Height (cm)</span>
                <input
                  type="number"
                  value={calibration.heightCm}
                  onChange={(e) => setCalibration({ heightCm: Number(e.target.value) })}
                />
              </label>
            </div>
          )}

          <div className="detected-readout">
            Current dimension: <b>{calibration.widthCm} × {calibration.heightCm} cm</b>
          </div>
        </div>

        <div className="calib-group">
          <span className="calib-label-text">PRECISION CREDIT CARD RULER (OPTIONAL)</span>
          <p className="calib-muted-small">
            Hold a standard credit card against the screen and adjust the slider until the box matches exactly.
          </p>
          <div className="card-ruler-container">
            <div
              className="card-ruler-box"
              style={{ width: cardPx, aspectRatio: `${CARD_W_CM} / ${CARD_H_CM}` }}
            >
              <span>CREDIT CARD (8.56 × 5.4 CM)</span>
            </div>
            <input
              type="range"
              min={80}
              max={600}
              value={cardPx}
              onChange={(e) => {
                setCardPx(Number(e.target.value));
                setCardCalibrated(false);
              }}
              className="modern-range"
            />
            <button
              className={`lock-card-btn ${cardCalibrated ? 'locked' : ''}`}
              onClick={commitCardCalibration}
            >
              {cardCalibrated ? '✓ Locked In' : 'Lock In Card Calibration'}
            </button>
          </div>
        </div>

        <div className="calib-group">
          <label className="calib-slider-row">
            <span>SITTING DISTANCE</span>
            <b>{calibration.distanceCm} cm</b>
          </label>
          <input
            type="range"
            min={30}
            max={120}
            step={1}
            value={calibration.distanceCm}
            onChange={(e) => setCalibration({ distanceCm: Number(e.target.value) })}
            className="modern-range"
          />
        </div>

        <div className="calib-group">
          <label className="calib-slider-row">
            <span>TRACKING SENSITIVITY</span>
            <b>{calibration.sensitivity.toFixed(2)}×</b>
          </label>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.05}
            value={calibration.sensitivity}
            onChange={(e) => setCalibration({ sensitivity: Number(e.target.value) })}
            className="modern-range"
          />
        </div>

        <div className="calib-actions">
          <button className="cta-primary-btn" onClick={() => setStage('experience')}>
            <span>Launch Experience</span>
            <span className="btn-arrow">→</span>
          </button>
          <button className="cta-back-btn" onClick={() => setStage('landing')}>
            ← Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  const stage = useAppStore((s) => s.stage);
  return stage === 'landing' ? <Landing /> : stage === 'calibration' ? <Calibration /> : <Experience />;
}
