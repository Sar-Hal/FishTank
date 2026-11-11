import { useCallback, useEffect, useRef, useState } from 'react';
import { PortalEngine } from '../engine/PortalEngine';
import { orientCalibration, useAppStore } from '../state/appStore';
import type { SceneId } from '../state/appStore';
import { useTelemetryStore } from '../state/telemetryStore';
import { FaceTrackingService } from '../tracking/FaceTrackingService';
import { HeadTracker } from '../tracking/HeadTracker';
import type { TrackingStatus } from '../tracking/types';
import { Hud } from './hud/Hud';
import type { PipDetection } from './hud/CameraPip';
import { toggleFullscreen } from './hud/fullscreen';

interface TrackingState {
  status: TrackingStatus;
  message: string;
}

const INITIAL_STATUS: TrackingState = {
  status: 'starting',
  message: 'Preparing the camera…',
};

/** Calibration with width/height matched to how the device is currently held. */
const currentScreen = () =>
  orientCalibration(
    useAppStore.getState().calibration,
    window.innerWidth / Math.max(1, window.innerHeight),
  );

const SCENE_KEYS: Record<string, SceneId> = {
  '1': 'aquarium',
  '2': 'corridor',
  '3': 'cyber',
  '4': 'mirror',
};

export function Experience() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PortalEngine | null>(null);
  const trackerRef = useRef<HeadTracker | null>(null);
  const detectionRef = useRef<PipDetection | null>(null);

  const [tracking, setTracking] = useState<TrackingState>(INITIAL_STATUS);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const calibration = useAppStore((state) => state.calibration);
  const scene = useAppStore((state) => state.scene);
  const stereo = useAppStore((state) => state.stereo);
  const uiHidden = useAppStore((state) => state.uiHidden);

  // Engine + tracking lifecycle. This effect is intentionally declared first so
  // the engine exists before the setters below run. The host element is
  // captured in a local variable: React 19 StrictMode tears the effect down
  // without clearing the ref, and the engine must be able to remove its own
  // canvas even then.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const initial = useAppStore.getState();
    const tracker = new HeadTracker(180);
    trackerRef.current = tracker;

    useTelemetryStore.setState({
      pose: { x: 0, y: 0, z: initial.calibration.distanceCm },
      visible: false,
      calibrated: false,
      faceWidth: 0,
      renderFps: 0,
      trackFps: 0,
    });

    const engine = new PortalEngine(host, initial.calibration, initial.scene, {
      onFps: (fps) => useTelemetryStore.setState({ renderFps: fps }),
    });
    engineRef.current = engine;

    let lastTelemetryAt = 0;

    const service = new FaceTrackingService({
      onSample: (sample) => {
        const now = sample?.timestamp ?? performance.now();
        const pose = tracker.update(sample, currentScreen(), now);
        engine.setHeadPose(pose);

        if (now - lastTelemetryAt >= 100) {
          lastTelemetryAt = now;
          useTelemetryStore.setState({
            pose,
            visible: pose.visible,
            calibrated: tracker.isCalibrated,
            faceWidth: pose.faceWidth,
          });
        }
      },
      onDetection: (box, videoWidth, videoHeight) => {
        detectionRef.current = { box, videoWidth, videoHeight };
      },
      onStatus: (status, message) => {
        setTracking({ status, message });
      },
      onError: (message) => {
        setError(message);
      },
      onStream: (mediaStream) => {
        setStream(mediaStream);
      },
      onFps: (fps) => {
        useTelemetryStore.setState({ trackFps: fps });
      },
    });

    // Privacy: the camera runs only while this tab is visible and tracking is
    // switched on. Both pause() and resume() are safe to call repeatedly.
    const cameraWanted = () => useAppStore.getState().trackingEnabled && !document.hidden;
    const syncCamera = () => {
      if (cameraWanted()) service.resume();
      else service.pause();
    };

    // Respect the switch from the very first frame, even after leaving and
    // re-entering: never open the camera if it is switched off.
    if (cameraWanted()) void service.start();
    else service.pause();
    document.addEventListener('visibilitychange', syncCamera);
    const unsubscribe = useAppStore.subscribe(syncCamera);

    return () => {
      document.removeEventListener('visibilitychange', syncCamera);
      unsubscribe();
      service.stop();
      engine.dispose();
      engineRef.current = null;
      trackerRef.current = null;
      detectionRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setCalibration(calibration);
  }, [calibration]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.sceneId !== scene) engine.setScene(scene);
  }, [scene]);

  useEffect(() => {
    engineRef.current?.setStereo(stereo);
  }, [stereo]);

  const recenter = useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;

    const hasFace = tracker.hasFace;
    tracker.calibrate(hasFace ? undefined : null);
    const pose = tracker.update(
      hasFace ? tracker.lastFaceSample : null,
      currentScreen(),
      performance.now(),
    );
    engineRef.current?.setHeadPose(pose);
    useTelemetryStore.setState({
      pose,
      visible: pose.visible,
      calibrated: tracker.isCalibrated,
      faceWidth: pose.faceWidth,
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      // Leave keys alone while typing into a field. Checkboxes and sliders keep
      // focus after being clicked, so they must not swallow shortcuts like Esc.
      const target = event.target as HTMLElement | null;
      const inputType = (target as HTMLInputElement | null)?.type;
      const typing =
        target &&
        (target.isContentEditable ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          (target.tagName === 'INPUT' && inputType !== 'checkbox' && inputType !== 'range'));
      if (typing) return;

      const state = useAppStore.getState();
      const key = event.key.toLowerCase();

      if (key in SCENE_KEYS) {
        state.setScene(SCENE_KEYS[key]);
      } else if (key === 'c') {
        recenter();
      } else if (key === 'h') {
        state.toggleUiHidden();
      } else if (key === 'escape' && state.settingsOpen) {
        state.setSettingsOpen(false);
      } else if (key === 'escape' && state.uiHidden) {
        state.setUiHidden(false);
      } else if (key === 'o') {
        state.setSettingsOpen(!state.settingsOpen);
      } else if (key === 's') {
        state.setStereo(!state.stereo);
      } else if (key === 'd') {
        state.setStats(!state.stats);
      } else if (key === 'f') {
        void toggleFullscreen();
      } else if (key === 'm') {
        state.setPipCollapsed(!state.pipCollapsed);
      } else {
        return;
      }

      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [recenter]);

  return (
    <div className="experience">
      <div
        ref={hostRef}
        className="engine-host"
        onPointerDown={() => {
          // Tapping the scene brings hidden controls back, or closes settings.
          const state = useAppStore.getState();
          if (state.uiHidden) state.setUiHidden(false);
          else if (state.settingsOpen) state.setSettingsOpen(false);
        }}
      />
      <Hud
        hidden={uiHidden}
        status={tracking.status}
        statusMessage={tracking.message}
        error={error}
        stream={stream}
        detectionRef={detectionRef}
        onRecenter={recenter}
        onDismissError={() => setError(null)}
      />
      {uiHidden && (
        <div className="immersive-hint" role="status">
          Tap anywhere or press <kbd>H</kbd> to bring the controls back
        </div>
      )}
    </div>
  );
}
