import { useEffect, useRef, useState } from 'react';
import { SCENES, useAppStore } from '../../state/appStore';
import { useTelemetryStore } from '../../state/telemetryStore';
import type { TrackingStatus } from '../../tracking/types';
import { SettingsPanel } from '../SettingsPanel';
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

function describeStatus(status: TrackingStatus, faceVisible: boolean): { label: string; tone: Tone } {
  switch (status) {
    case 'tracking':
      return faceVisible
        ? { label: 'Tracking you', tone: 'live' }
        : { label: 'Looking for you…', tone: 'busy' };
    case 'requesting-camera':
      return { label: 'Waiting for camera permission', tone: 'busy' };
    case 'loading-model':
    case 'starting':
      return { label: 'Warming up…', tone: 'busy' };
    case 'camera-error':
      return { label: 'No camera, still view', tone: 'error' };
    case 'model-error':
      return { label: 'Tracking failed, still view', tone: 'error' };
    default:
      return { label: 'Paused', tone: 'idle' };
  }
}

type IconName = 'recenter' | 'fullscreen' | 'hide' | 'settings' | 'home';

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
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
      {name === 'fullscreen' && (
        <path d="M8.5 3.5h-5v5M15.5 3.5h5v5M20.5 15.5v5h-5M3.5 15.5v5h5" {...common} />
      )}
      {name === 'hide' && (
        <>
          <path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12Z" {...common} />
          <circle cx="12" cy="12" r="2.7" {...common} />
          <path d="M4.2 4.2l15.6 15.6" {...common} />
        </>
      )}
      {name === 'settings' && (
        <>
          <path d="M4 7h10M18 7h2M4 17h2M10 17h10" {...common} />
          <circle cx="16" cy="7" r="2.2" {...common} />
          <circle cx="8" cy="17" r="2.2" {...common} />
        </>
      )}
      {name === 'home' && (
        <path d="M3.5 11 12 4l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5" {...common} />
      )}
    </svg>
  );
}

/**
 * Friendly tips shown in the middle of the screen while getting started.
 * Returns null when there is nothing worth saying.
 */
function useCoachTip(status: TrackingStatus): string | null {
  const visible = useTelemetryStore((state) => state.visible);
  const [phase, setPhase] = useState<'waiting' | 'found' | 'done'>('waiting');
  const [lostForAWhile, setLostForAWhile] = useState(false);
  const lostTimer = useRef<number | undefined>(undefined);

  // First time we see a face: celebrate for a few seconds, then get out of the way.
  useEffect(() => {
    if (visible && phase === 'waiting') setPhase('found');
  }, [visible, phase]);

  useEffect(() => {
    if (phase !== 'found') return;
    const timer = window.setTimeout(() => setPhase('done'), 5000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // If the face disappears for a few seconds, gently say so.
  useEffect(() => {
    window.clearTimeout(lostTimer.current);
    if (status === 'tracking' && !visible) {
      lostTimer.current = window.setTimeout(() => setLostForAWhile(true), 3000);
    } else {
      setLostForAWhile(false);
    }
    return () => window.clearTimeout(lostTimer.current);
  }, [status, visible]);

  if (phase === 'found') return '👋 Found you! Lean left and right to peek around.';
  if (lostForAWhile) return "🙈 Can't see you. Face the camera, with some light on your face.";
  if (status === 'requesting-camera') return '📷 Click “Allow” so Fish Tank can follow your head.';
  return null;
}

export function Hud({
  hidden,
  status,
  error,
  statusMessage,
  stream,
  detectionRef,
  onRecenter,
  onDismissError,
}: HudProps) {
  const scene = useAppStore((state) => state.scene);
  const setScene = useAppStore((state) => state.setScene);
  const stats = useAppStore((state) => state.stats);
  const settingsOpen = useAppStore((state) => state.settingsOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const setUiHidden = useAppStore((state) => state.setUiHidden);
  const setStage = useAppStore((state) => state.setStage);
  const faceVisible = useTelemetryStore((state) => state.visible);

  const meta = describeStatus(status, faceVisible);
  const tip = useCoachTip(status);

  const goHome = () => {
    void exitFullscreenIfNeeded();
    setStage('landing');
  };

  const buttons: Array<{ icon: IconName; label: string; key: string; onClick: () => void; active?: boolean }> = [
    { icon: 'recenter', label: 'Re-centre', key: 'C', onClick: onRecenter },
    { icon: 'fullscreen', label: 'Full screen', key: 'F', onClick: () => void toggleFullscreen() },
    { icon: 'hide', label: 'Hide', key: 'H', onClick: () => setUiHidden(true) },
    {
      icon: 'settings',
      label: 'Settings',
      key: 'O',
      onClick: () => setSettingsOpen(!settingsOpen),
      active: settingsOpen,
    },
    { icon: 'home', label: 'Home', key: '', onClick: goHome },
  ];

  return (
    <div
      className={`hud ${hidden ? 'hud--hidden' : ''}`}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
    >
      <div className="hud-top">
        <div className="hud-left">
          <span className="hud-brand glass">
            <span aria-hidden="true">🐠</span> Fish Tank
          </span>
          <span
            className={`status-pill glass status-pill--${meta.tone}`}
            title={statusMessage}
            aria-live="polite"
          >
            <span className="status-dot" />
            {meta.label}
          </span>
        </div>

        <div className="hud-controls glass">
          {buttons.map((button) => (
            <button
              key={button.label}
              type="button"
              className={`hud-button ${button.active ? 'is-active' : ''}`}
              onClick={button.onClick}
              title={button.key ? `${button.label} (${button.key})` : button.label}
              aria-pressed={button.active}
            >
              <Icon name={button.icon} />
              <span className="hud-button-label">{button.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="hud-error glass" role="alert">
          <p>{error}</p>
          <button type="button" className="icon-button" onClick={onDismissError} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {tip && !settingsOpen && (
        <div className="coach-tip glass" role="status" key={tip}>
          {tip}
        </div>
      )}

      {stats && (
        <div className="hud-stats">
          <DebugView />
          <TelemetryPanel status={status} statusMessage={statusMessage} />
        </div>
      )}

      <div className="hud-bottom">
        <nav className="scene-dock glass" aria-label="Choose a scene">
          {SCENES.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`scene-button ${scene === item.id ? 'is-active' : ''}`}
              onClick={() => setScene(item.id)}
              aria-pressed={scene === item.id}
              title={`${item.hint} (${index + 1})`}
            >
              <span className="scene-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="scene-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {status !== 'camera-error' && (
          <div className="hud-camera-slot">
            <CameraPip stream={stream} detectionRef={detectionRef} />
          </div>
        )}
      </div>

      <SettingsPanel onRecenter={onRecenter} />
    </div>
  );
}
