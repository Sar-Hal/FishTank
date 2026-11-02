import { useEffect, useRef, useState } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { PortalCanvas } from './PortalCanvas';
import { useAppStore } from '../store';
import { HeadTracker } from '../tracking/tracking';

// Locally hosted assets (instant load, zero CDN network dependency)
const LOCAL_WASM = '/wasm';
const LOCAL_MODEL = '/models/blaze_face_short_range.tflite';

// Fallback CDN endpoints in case local fails
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm';
const CDN_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

export function Experience() {
  const video = useRef<HTMLVideoElement>(null);
  const overlayCanvas = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<HeadTracker>(new HeadTracker(200));

  const [status, setStatus] = useState('Starting camera…');
  const [error, setError] = useState('');
  const [calibrated, setCalibrated] = useState(false);

  const setTracking = useAppStore((s) => s.setTracking);
  const tracking = useAppStore((s) => s.tracking);
  const debug = useAppStore((s) => s.debug);
  const setDebug = useAppStore((s) => s.setDebug);
  const scene = useAppStore((s) => s.scene);
  const setScene = useAppStore((s) => s.setScene);
  const stereoscopic = useAppStore((s) => s.stereoscopic);
  const setStereoscopic = useAppStore((s) => s.setStereoscopic);

  const handleManualCalibrate = () => {
    trackerRef.current.calibrate();
    setCalibrated(true);
    setStatus('Centered & Calibrated!');
    setTimeout(() => {
      setStatus('Tracking active');
    }, 1500);
  };

  useEffect(() => {
    let active = true;
    let stream: MediaStream | undefined;
    let frame = 0;
    const tracker = trackerRef.current;

    const run = async () => {
      // 1. Camera access
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false,
        });

        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play().catch(() => {});
      } catch (camErr) {
        console.error('Camera access failed:', camErr);
        setError('Camera permission denied. Please allow camera access in your browser.');
        setStatus('Fallback mode');
        const fallback = tracker.update(null, useAppStore.getState().calibration);
        setTracking(fallback);
        return;
      }

      // 2. Load Vision Model (Local first, CDN fallback, GPU with CPU fallback)
      let detector: FaceDetector;
      try {
        setStatus('Loading face tracking model…');

        // Resolve WASM files
        let vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
        try {
          vision = await FilesetResolver.forVisionTasks(LOCAL_WASM);
        } catch {
          console.warn('Local WASM failed, falling back to CDN WASM...');
          vision = await FilesetResolver.forVisionTasks(CDN_WASM);
        }

        // Create Detector (Try GPU first, then CPU)
        try {
          detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: { modelAssetPath: LOCAL_MODEL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            minDetectionConfidence: 0.4,
          });
        } catch (gpuErr) {
          console.warn('GPU delegate failed, trying CPU delegate with local model...', gpuErr);
          try {
            detector = await FaceDetector.createFromOptions(vision, {
              baseOptions: { modelAssetPath: LOCAL_MODEL, delegate: 'CPU' },
              runningMode: 'VIDEO',
              minDetectionConfidence: 0.4,
            });
          } catch (localModelErr) {
            console.warn('Local model failed, trying CDN model with CPU delegate...', localModelErr);
            detector = await FaceDetector.createFromOptions(vision, {
              baseOptions: { modelAssetPath: CDN_MODEL, delegate: 'CPU' },
              runningMode: 'VIDEO',
              minDetectionConfidence: 0.4,
            });
          }
        }

        setStatus('Tracking active');
        setError('');
      } catch (modelErr) {
        console.error('Vision model loading failed:', modelErr);
        setError('Face tracking model failed to load. Running in centered view.');
        setStatus('Fallback mode');
        const fallback = tracker.update(null, useAppStore.getState().calibration);
        setTracking(fallback);
        return;
      }

      // 3. Detection loop
      const tick = () => {
        if (!active || !video.current) return;

        const now = performance.now();
        const { calibration } = useAppStore.getState();

        try {
          if (video.current.readyState >= 2) {
            const result = detector.detectForVideo(video.current, now);
            const det = result.detections[0];

            // Draw bounding box on PiP overlay canvas
            if (overlayCanvas.current) {
              const ctx = overlayCanvas.current.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, overlayCanvas.current.width, overlayCanvas.current.height);
                if (det && det.boundingBox) {
                  const b = det.boundingBox;
                  ctx.strokeStyle = '#22d3ee';
                  ctx.lineWidth = 3;
                  ctx.strokeRect(b.originX, b.originY, b.width, b.height);

                  // Center dot
                  ctx.fillStyle = '#f43f5e';
                  ctx.beginPath();
                  ctx.arc(b.originX + b.width / 2, b.originY + b.height / 2, 5, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }

            if (det && det.boundingBox) {
              const b = det.boundingBox;
              const vw = video.current.videoWidth || 640;
              const vh = video.current.videoHeight || 480;

              // Normalized coordinates [0, 1]
              const faceX = (b.originX + b.width / 2) / vw;
              const faceY = (b.originY + b.height / 2) / vh;
              const faceWidth = b.width / vw;

              const point = tracker.update({ faceX, faceY, faceWidth }, calibration, now);
              setTracking(point);
              if (!calibrated && tracker.isCalibrated) {
                setCalibrated(true);
              }
            } else {
              const point = tracker.update(null, calibration, now);
              setTracking(point);
            }
          }
        } catch (detectErr) {
          console.warn('Frame detection warning:', detectErr);
        }

        frame = requestAnimationFrame(tick);
      };

      tick();
    };

    void run();

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [setTracking]);

  return (
    <main className="experience">
      <PortalCanvas key={`${scene}-${stereoscopic}`} />

      {/* Camera Picture-in-Picture with live face tracking box */}
      <div className="camera-pip-wrap">
        <video ref={video} className="camera-video" muted playsInline />
        <canvas ref={overlayCanvas} width={640} height={480} className="camera-overlay" />
        <div className="camera-pip-label">
          <span className={`status-dot ${tracking.visible ? 'live' : ''}`} />
          {tracking.visible ? 'TRACKING FACE' : 'SEARCHING FACE...'}
        </div>
      </div>

      {/* Floating Top Control Bar */}
      <div className="experience-bar">
        <div className="status-badge">
          <span className={`status-dot ${tracking.visible ? 'live' : ''}`} />
          <span>{status}</span>
        </div>

        {/* 🎯 One-click Calibrate / Center Button */}
        <button
          className="calibrate-btn"
          onClick={handleManualCalibrate}
          title="Sit comfortably and click to center the 3D window"
        >
          🎯 Center / Calibrate
        </button>

        {/* Scene Switcher */}
        <select
          value={scene}
          onChange={(e) => setScene(e.target.value as typeof scene)}
          aria-label="Scene"
        >
          <option value="aquarium">🐟 Living Aquarium</option>
          <option value="corridor">🚪 Classic Corridor</option>
          <option value="portal">⚡ Sci-Fi Chamber</option>
        </select>

        {/* 🥽 3D Glasses Anaglyph Mode */}
        <button
          className={`stereo-btn ${stereoscopic ? 'active' : ''}`}
          onClick={() => setStereoscopic(!stereoscopic)}
          title="Toggle Red/Cyan 3D Anaglyph Mode"
        >
          {stereoscopic ? '🥽 3D Glasses: ON' : '🥽 3D Glasses'}
        </button>

        {/* Debug 3D Frustum Visualizer */}
        <button
          className={debug ? 'active' : ''}
          onClick={() => setDebug(!debug)}
        >
          {debug ? 'Hide Debug' : 'Debug View'}
        </button>

        <button onClick={() => document.documentElement.requestFullscreen?.()}>
          Fullscreen
        </button>
      </div>

      {error && <div className="toast">{error}</div>}

      {/* Floating coordinates badge */}
      {debug && (
        <aside className="debug-panel">
          <strong>HEAD TRACKING (CM)</strong>
          <span>X (Horiz) <b>{tracking.x.toFixed(1)} cm</b></span>
          <span>Y (Vert) <b>{tracking.y.toFixed(1)} cm</b></span>
          <span>Z (Dist) <b>{tracking.z.toFixed(1)} cm</b></span>
          <span>Frustum <b>Kooima Off-Axis</b></span>
          <span>Stereo <b>{stereoscopic ? 'Red/Cyan' : 'Mono'}</b></span>
        </aside>
      )}
    </main>
  );
}
