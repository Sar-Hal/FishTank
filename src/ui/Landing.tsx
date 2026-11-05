import { DEFAULT_CALIBRATION, useAppStore } from '../state/appStore';
import { DISPLAY_PRESETS, guessPresetIndex } from './displayPresets';

export function Landing() {
  const setStage = useAppStore((state) => state.setStage);
  const setCalibration = useAppStore((state) => state.setCalibration);
  const calibration = useAppStore((state) => state.calibration);

  const detected = DISPLAY_PRESETS[guessPresetIndex()];

  const start = () => {
    const atDefaults =
      calibration.widthCm === DEFAULT_CALIBRATION.widthCm &&
      calibration.heightCm === DEFAULT_CALIBRATION.heightCm;
    if (atDefaults && detected.widthCm > 0) {
      setCalibration({ widthCm: detected.widthCm, heightCm: detected.heightCm });
    }
    setStage('experience');
  };

  return (
    <main className="page page--landing">
      <div className="landing-glow" aria-hidden="true" />
      <div className="landing-inner">
        <span className="eyebrow">
          <span className="pulse-dot" />
          Real-time spatial window
        </span>

        <h1 className="landing-title">
          FISH<span>TANK</span>
        </h1>

        <p className="landing-lead">Your monitor, turned inside out.</p>

        <p className="landing-copy">
          Move your head and the screen becomes a window. Powered by on-device face
          tracking and Kooima off-axis projection — no headset, no install, no data
          leaving your machine.
        </p>

        <div className="feature-row">
          <span className="feature-chip">⚡ 60 fps face tracking</span>
          <span className="feature-chip">🔒 100% on-device</span>
          <span className="feature-chip">🥽 Red / cyan stereo</span>
          <span className="feature-chip">📐 Dynamic frustum</span>
        </div>

        <div className="landing-actions">
          <button className="btn btn--primary" onClick={start}>
            Enter the portal <span aria-hidden="true">→</span>
          </button>
          <button className="btn btn--ghost" onClick={() => setStage('calibration')}>
            Display setup
          </button>
        </div>

        <p className="detected-line">
          Detected display: <strong>{detected.label}</strong>
          {detected.widthCm > 0 && (
            <span>
              {' '}
              · {detected.widthCm} × {detected.heightCm} cm
            </span>
          )}
        </p>
      </div>

      <footer className="landing-footer">
        <span>Best viewed in Chrome or Edge</span>
        <span className="landing-footer-dot" />
        <span>Webcam required</span>
      </footer>
    </main>
  );
}
