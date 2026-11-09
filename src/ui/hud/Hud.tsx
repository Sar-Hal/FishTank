import { useEffect, useState } from 'react';
import { screenCaptureService, type ScreenCaptureState } from '../../engine/scenes/screenCapture';
import { SCENES, useAppStore } from '../../state/appStore';
import type { SceneId } from '../../state/appStore';
import type { TrackingStatus } from '../../tracking/types';
import { CameraPip, type PipDetection } from './CameraPip';
import { DebugView } from './DebugView';
import { TelemetryPanel } from './TelemetryPanel';
import { exitFullscreenIfNeeded, toggleFullscreen } from './fullscreen';

interface HudProps {
  hidden: boolean;
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
  | 'screenshare'
  | 'hide'
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
      {name === 'screenshare' && (
        <>
          <rect x="2.5" y="3.5" width="19" height="13" rx="2" {...common} />
          <path d="M8 20.5h8M12 16.5v4M12 7.5v5M9.5 9.8 12 7.5l2.5 2.3" {...common} />
        </>
      )}
      {name === 'hide' && (
        <>
          <path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12Z" {...common} />
          <circle cx="12" cy="12" r="2.7" {...common} />
          <path d="M4.2 4.2l15.6 15.6" {...common} />
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
  hidden,
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
  const setUiHidden = useAppStore((state) => state.setUiHidden);
  const setStage = useAppStore((state) => state.setStage);

  const [screenCapture, setScreenCapture] = useState<ScreenCaptureState>(() =>
    screenCaptureService.getState(),
  );

  useEffect(() => {
    return screenCaptureService.subscribe(setScreenCapture);
  }, []);

  const meta = STATUS_META[status];

  const leaveTo = (stage: 'landing' | 'calibration') => {
    void exitFullscreenIfNeeded();
    setStage(stage);
  };

  const handleSelectScene = (sceneId: SceneId) => {
    setScene(sceneId);
    if (sceneId === 'mirror' && !screenCapture.active) {
      void screenCaptureService.start();
    }
  };

  const toggleScreenCapture = () => {
    if (screenCapture.active) {
      screenCaptureService.stop();
    } else {
      void screenCaptureService.start();
    }
  };

  return (
    <div
      className={`hud ${hidden ? 'hud--hidden' : ''}`}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
    >
      <div className="hud-top">
        <div className="hud-brand glass">
          <span className="hud-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
              <rect
                x="3"
                y="5"
                width="26"
                height="22"
                rx="6"
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
          {scene === 'mirror' && (
            <button
              type="button"
              className={`hud-button ${screenCapture.active ? 'is-active is-live' : ''}`}
              onClick={toggleScreenCapture}
              title={
                screenCapture.active
                  ? 'Stop screenshare'
                  : 'Share screen for infinite feedback (P)'
              }
              aria-label="Toggle screenshare"
            >
              <Icon name="screenshare" />
            </button>
          )}
          <button
            type="button"
            className="hud-button"
            onClick={() => setUiHidden(true)}
            title="Hide everything but the scene (H)"
            aria-label="Hide all controls"
          >
            <Icon name="hide" />
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
              <kbd>1</kbd>–<kbd>4</kbd> scenes
            </span>
            {scene === 'mirror' && (
              <span>
                <kbd>P</kbd> {screenCapture.active ? 'stop share' : 'share screen'}
              </span>
            )}
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
            <span>
              <kbd>H</kbd> hide UI
            </span>
          </div>

          <div className="hud-scene-container">
            {scene === 'mirror' && (
              <div className="hud-screenshare-bar glass">
                {screenCapture.active ? (
                  <>
                    <span className="hud-screenshare-live">
                      <span className="rec-dot" /> LIVE TUNNEL
                    </span>
                    <button
                      type="button"
                      className="hud-screenshare-btn hud-screenshare-btn--stop"
                      onClick={() => screenCaptureService.stop()}
                      title="Stop screensharing"
                    >
                      Stop Share
                    </button>
                  </>
                ) : (
                  <>
                    <span className="hud-screenshare-hint">
                      Infinite Portal
                    </span>
                    <button
                      type="button"
                      className="hud-screenshare-btn hud-screenshare-btn--start"
                      onClick={() => void screenCaptureService.start()}
                      title="Share your screen or this window for infinite recursion"
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
                        <path d="M8 20.5h8M12 16.5v4M12 7.5v5M9.5 9.8 12 7.5l2.5 2.3" />
                      </svg>
                      Share Screen / Window
                    </button>
                  </>
                )}
              </div>
            )}

            <nav className="scene-dock glass" aria-label="Scene selector">
              {SCENES.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`scene-button ${scene === item.id ? 'is-active' : ''}`}
                  onClick={() => handleSelectScene(item.id)}
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
          </div>

          <div className="hud-camera-slot">
            <CameraPip stream={stream} detectionRef={detectionRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
