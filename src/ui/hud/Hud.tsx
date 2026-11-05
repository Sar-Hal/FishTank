import { SCENES, useAppStore } from '../../state/appStore';
import type { TrackingStatus } from '../../tracking/types';
import { CameraPip, type PipDetection } from './CameraPip';
import { DebugView } from './DebugView';
import { TelemetryPanel } from './TelemetryPanel';
import { exitFullscreenIfNeeded, toggleFullscreen } from './fullscreen';

interface HudProps {
  status: TrackingStatus;
  statusMessage: string;
  error: string | null;
  stream: MediaStream | null;
  detectionRef: { current: PipDetection | null };
  onRecenter: () => void;
  onDismissError: () => void;
}

type Tone = 'live' | 'busy' | 'error' | 'idle';

const STATUS_META: Record<TrackingStatus, { label: string; tone: Tone; busy?: boolean }> = {
  idle: { label: 'Idle', tone: 'idle' },
  starting: { label: 'Starting', tone: 'busy', busy: true },
  'requesting-camera': { label: 'Camera permission', tone: 'busy', busy: true },
  'loading-model': { label: 'Loading vision model', tone: 'busy', busy: true },
  tracking: { label: 'Tracking active', tone: 'live' },
  'camera-error': { label: 'Camera unavailable', tone: 'error' },
  'model-error': { label: 'Tracking offline', tone: 'error' },
  stopped: { label: 'Paused', tone: 'idle' },
};

type IconName =
  | 'recenter'
  | 'stereo'
  | 'debug'
  | 'camera'
  | 'fullscreen'
  | 'settings'
  | 'exit';

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {name === 'recenter' && (
        <>
          <circle cx="12" cy="12" r="6.2" {...common} />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" {...common} />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </>
      )}
      {name === 'stereo' && (
        <>
          <rect x="2.4" y="8" width="8" height="7.4" rx="3.4" {...common} />
          <rect x="13.6" y="8" width="8" height="7.4" rx="3.4" {...common} />
          <path d="M10.4 11.4h3.2" {...common} />
        </>
      )}
      {name === 'debug' && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="3" {...common} />
          <path d="M9 3v18M15 3v18M3 9h18M3 15h18" {...common} opacity="0.55" />
        </>
      )}
      {name === 'camera' && (
        <>
          <rect x="2.6" y="6.5" width="13.2" height="11" rx="2.6" {...common} />
          <path d="M15.8 10.5l4.3-2.4a.6.6 0 0 1 .9.5v6.8a.6.6 0 0 1-.9.5l-4.3-2.4" {...common} />
        </>
      )}
      {name === 'fullscreen' && (
        <path
          d="M8.5 3.5h-5v5M15.5 3.5h5v5M20.5 15.5v5h-5M3.5 15.5v5h5"
          {...common}
        />
      )}
      {name === 'settings' && (
        <>
          <path d="M4 7h10M18 7h2M4 17h2M10 17h10" {...common} />
          <circle cx="16" cy="7" r="2.2" {...common} />
          <circle cx="8" cy="17" r="2.2" {...common} />
        </>
      )}
      {name === 'exit' && (
        <>
          <path d="M14.5 4.5h4.2v15h-4.2" {...common} />
          <path d="M10 8.2 6.2 12l3.8 3.8M6.2 12H16" {...common} />
        </>
      )}
    </svg>
  );
}

export function Hud({
  status,
  statusMessage,
  error,
  stream,
  detectionRef,
  onRecenter,
  onDismissError,
}: HudProps) {
  const scene = useAppStore((state) => state.scene);
  const setScene = useAppStore((state) => state.setScene);
  const stereo = useAppStore((state) => state.stereo);
  const setStereo = useAppStore((state) => state.setStereo);
  const debug = useAppStore((state) => state.debug);
  const setDebug = useAppStore((state) => state.setDebug);
  const pipCollapsed = useAppStore((state) => state.pipCollapsed);
  const setPipCollapsed = useAppStore((state) => state.setPipCollapsed);
  const setStage = useAppStore((state) => state.setStage);

  const meta = STATUS_META[status];

  const leaveTo = (stage: 'landing' | 'calibration') => {
    void exitFullscreenIfNeeded();
    setStage(stage);
  };

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-brand glass">
          <span className="hud-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="24" height="24">
              <path
                d="M4 16c5-6.5 12-6.5 17 0-5 6.5-12 6.5-17 0Z"
                fill="rgba(34,211,238,0.18)"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M21 16l6-4v8l-6-4Z" fill="currentColor" opacity="0.75" />
              <circle cx="10.5" cy="15" r="1.5" fill="currentColor" />
              <path d="M15 6v1.5M15 24.5V26" stroke="currentColor" strokeWidth="1.3" opacity="0.5" />
            </svg>
          </span>
          <span className="hud-brand-text">
            <strong>Fish Tank</strong>
            <small>head-tracked window</small>
          </span>
        </div>

        <div
          className={`status-pill status-pill--${meta.tone}`}
          title={statusMessage}
          aria-live="polite"
        >
          <span
            className={`status-dot ${meta.busy ? 'status-dot--busy' : ''} ${meta.tone === 'live' ? 'status-dot--live' : ''} ${meta.tone === 'error' ? 'status-dot--error' : ''}`}
          />
          <span>{meta.label}</span>
        </div>

        <div className="hud-controls glass">
          <button
            type="button"
            className="hud-button"
            onClick={() => onRecenter()}
            title="Recenter the view (C)"
            aria-label="Recenter the view"
          >
            <Icon name="recenter" />
          </button>
          <button
            type="button"
            className={`hud-button ${stereo ? 'is-active' : ''}`}
            onClick={() => setStereo(!stereo)}
            title="Red / cyan stereo (S)"
            aria-label="Toggle red cyan stereo"
            aria-pressed={stereo}
          >
            <Icon name="stereo" />
          </button>
          <button
            type="button"
            className={`hud-button ${debug ? 'is-active' : ''}`}
            onClick={() => setDebug(!debug)}
            title="Frustum debug view (D)"
            aria-label="Toggle frustum debug view"
            aria-pressed={debug}
          >
            <Icon name="debug" />
          </button>
          <button
            type="button"
            className={`hud-button ${!pipCollapsed ? 'is-active' : ''}`}
            onClick={() => setPipCollapsed(!pipCollapsed)}
            title="Camera preview (M)"
            aria-label="Toggle camera preview"
            aria-pressed={!pipCollapsed}
          >
            <Icon name="camera" />
          </button>

          <span className="hud-divider" aria-hidden="true" />

          <button
            type="button"
            className="hud-button"
            onClick={() => void toggleFullscreen()}
            title="Fullscreen (F)"
            aria-label="Toggle fullscreen"
          >
            <Icon name="fullscreen" />
          </button>
          <button
            type="button"
            className="hud-button"
            onClick={() => leaveTo('calibration')}
            title="Display settings"
            aria-label="Open display settings"
          >
            <Icon name="settings" />
          </button>
          <button
            type="button"
            className="hud-button hud-button--danger"
            onClick={() => leaveTo('landing')}
            title="Exit the experience"
            aria-label="Exit the experience"
          >
            <Icon name="exit" />
          </button>
        </div>
      </div>

      <div className="hud-main">
        {error && (
          <div className="hud-error glass" role="alert">
            <span className="hud-error-icon" aria-hidden="true">
              !
            </span>
            <p>{error}</p>
            <button
              type="button"
              className="hud-error-dismiss"
              onClick={onDismissError}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        <div className="hud-left-stack">
          {debug && <DebugView />}
          <TelemetryPanel status={status} statusMessage={statusMessage} />
        </div>

        <div className="hud-bottom">
          <div className="hud-shortcuts" aria-hidden="true">
            <span>
              <kbd>1</kbd>–<kbd>3</kbd> scenes
            </span>
            <span>
              <kbd>C</kbd> recenter
            </span>
            <span>
              <kbd>S</kbd> stereo
            </span>
            <span>
              <kbd>D</kbd> debug
            </span>
            <span>
              <kbd>F</kbd> fullscreen
            </span>
            <span>
              <kbd>M</kbd> camera
            </span>
          </div>

          <nav className="scene-dock glass" aria-label="Scene selector">
            {SCENES.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`scene-button ${scene === item.id ? 'is-active' : ''}`}
                onClick={() => setScene(item.id)}
                aria-label={`${item.label} scene`}
                aria-pressed={scene === item.id}
                title={`${item.label} — ${item.hint}`}
              >
                <span className="scene-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="scene-label">{item.label}</span>
                <span className="scene-key" aria-hidden="true">
                  {index + 1}
                </span>
              </button>
            ))}
          </nav>

          <div className="hud-camera-slot">
            <CameraPip stream={stream} detectionRef={detectionRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
