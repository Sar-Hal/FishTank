import { useTelemetryStore } from '../../state/telemetryStore';
import type { TrackingStatus } from '../../tracking/types';

interface TelemetryPanelProps {
  status: TrackingStatus;
  statusMessage: string;
}

const format = (value: number) => {
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  return rounded.toFixed(1);
};

export function TelemetryPanel({ status, statusMessage }: TelemetryPanelProps) {
  const pose = useTelemetryStore((state) => state.pose);
  const visible = useTelemetryStore((state) => state.visible);
  const calibrated = useTelemetryStore((state) => state.calibrated);
  const faceWidth = useTelemetryStore((state) => state.faceWidth);
  const renderFps = useTelemetryStore((state) => state.renderFps);
  const trackFps = useTelemetryStore((state) => state.trackFps);

  const searching = status === 'tracking' || status === 'starting' || status === 'loading-model';

  return (
    <section className="telemetry glass" aria-label="Head tracking telemetry">
      <header className="telemetry-header">
        <span>Head telemetry</span>
        <span className={`telemetry-state ${visible ? 'is-live' : searching ? 'is-searching' : ''}`}>
          <span className="telemetry-state-dot" />
          {visible ? 'Locked' : searching ? 'Searching' : 'Offline'}
        </span>
      </header>

      <div className="telemetry-grid">
        <div className="telemetry-cell">
          <span>X</span>
          <strong>{format(pose.x)}</strong>
          <small>cm</small>
        </div>
        <div className="telemetry-cell">
          <span>Y</span>
          <strong>{format(pose.y)}</strong>
          <small>cm</small>
        </div>
        <div className="telemetry-cell">
          <span>Z</span>
          <strong>{format(pose.z)}</strong>
          <small>cm</small>
        </div>
      </div>

      <div className="telemetry-meta">
        <span>{visible ? `Face ${(faceWidth * 100).toFixed(1)}%` : calibrated ? 'Baseline set' : 'No baseline'}</span>
        <span>{Math.round(renderFps)} fps render</span>
        <span>{Math.round(trackFps)} fps cam</span>
      </div>

      <p className="telemetry-message" title={statusMessage}>
        {statusMessage}
      </p>
    </section>
  );
}
