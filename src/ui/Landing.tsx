import { hasSavedCalibration, SCENES, useAppStore } from '../state/appStore';
import type { SceneId } from '../state/appStore';
import { DISPLAY_PRESETS, guessPresetIndex } from './displayPresets';

const STEPS = [
  { icon: '📷', title: 'Allow your camera', text: 'It only looks for your face. Nothing is recorded or uploaded.' },
  { icon: '🪑', title: 'Sit back a little', text: 'About 45 cm away, roughly the length of your forearm and hand.' },
  { icon: '👀', title: 'Move your head', text: 'Lean left, right, up and down to peek around inside the screen.' },
];

export function Landing() {
  const setStage = useAppStore((state) => state.setStage);
  const setScene = useAppStore((state) => state.setScene);
  const setCalibration = useAppStore((state) => state.setCalibration);
  const scene = useAppStore((state) => state.scene);

  const start = (sceneId: SceneId = scene) => {
    // First visit: guess the screen size so things look right without setup.
    if (!hasSavedCalibration()) {
      const detected = DISPLAY_PRESETS[guessPresetIndex()];
      if (detected.widthCm > 0) {
        setCalibration({ widthCm: detected.widthCm, heightCm: detected.heightCm });
      }
    }
    setScene(sceneId);
    setStage('experience');
  };

  return (
    <main className="landing">
      <div className="landing-bubbles" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ ['--i' as string]: i }} />
        ))}
      </div>

      <div className="landing-inner">
        <div className="landing-fish" aria-hidden="true">
          🐠
        </div>
        <h1 className="landing-title">
          Fish <span>Tank</span>
        </h1>
        <p className="landing-lead">Turn your screen into a window you can peek through.</p>

        <button className="btn btn--primary btn--big" onClick={() => start()}>
          Let&apos;s go <span aria-hidden="true">→</span>
        </button>

        <ol className="steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="step">
              <span className="step-icon" aria-hidden="true">
                {step.icon}
              </span>
              <span className="step-number">{index + 1}</span>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="landing-scenes">
          <span className="landing-scenes-label">Or jump straight into</span>
          <div className="landing-scene-row">
            {SCENES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="landing-scene"
                onClick={() => start(item.id)}
                title={item.hint}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="landing-footer">
        Works best in Chrome or Edge, with a webcam. 🔒 Everything stays on your device.
      </footer>
    </main>
  );
}
