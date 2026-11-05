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
  const [pipMinimized, setPipMinimized] = useState(false);

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
    setStatus('View Centered!');
    setTimeout(() => {
      setStatus('Tracking Active');
    }, 1500);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
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
        setStatus('Fallback Mode');
        const fallback = tracker.update(null, useAppStore.getState().calibration);
        setTracking(fallback);
        return;
      }

      // 2. Load Vision Model (Local first, CDN fallback, GPU with CPU fallback)
      let detector: FaceDetector;
      try {
        setStatus('Loading vision model…');

        let vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
        try {
          vision = await FilesetResolver.forVisionTasks(LOCAL_WASM);
        } catch {
          console.warn('Local WASM failed, falling back to CDN WASM...');
          vision = await FilesetResolver.forVisionTasks(CDN_WASM);
        }

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

        setStatus('Tracking Active');
        setError('');
      } catch (modelErr) {
        console.error('Vision model loading failed:', modelErr);
        setError('Face tracking model failed to load. Running in centered view.');
        setStatus('Fallback Mode');
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

            // Draw sci-fi reticle on PiP overlay canvas
            if (overlayCanvas.current) {
              const ctx = overlayCanvas.current.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, overlayCanvas.current.width, overlayCanvas.current.height);
                if (det && det.boundingBox) {
                  const b = det.boundingBox;
                  const corner = Math.min(b.width, b.height) * 0.25;

                  ctx.strokeStyle = '#22d3ee';
                  ctx.lineWidth = 2.5;

                  // Top-left corner bracket
                  ctx.beginPath();
                  ctx.moveTo(b.originX, b.originY + corner);
                  ctx.lineTo(b.originX, b.originY);
                  ctx.lineTo(b.originX + corner, b.originY);
                  ctx.stroke();

                  // Top-right corner bracket
                  ctx.beginPath();
                  ctx.moveTo(b.originX + b.width - corner, b.originY);
                  ctx.lineTo(b.originX + b.width, b.originY);
                  ctx.lineTo(b.originX + b.width, b.originY + corner);
                  ctx.stroke();

                  // Bottom-left corner bracket
                  ctx.beginPath();
                  ctx.moveTo(b.originX, b.originY + b.height - corner);
                  ctx.lineTo(b.originX, b.originY + b.height);
                  ctx.lineTo(b.originX + corner, b.originY + b.height);
                  ctx.stroke();

                  // Bottom-right corner bracket
                  ctx.beginPath();
                  ctx.moveTo(b.originX + b.width - corner, b.originY + b.height);
                  ctx.lineTo(b.originX + b.width, b.originY + b.height);
                  ctx.lineTo(b.originX + b.width, b.originY + b.height - corner);
                  ctx.stroke();

                  // Center reticle
                  const cx = b.originX + b.width / 2;
                  const cy = b.originY + b.height / 2;
                  ctx.fillStyle = '#f43f5e';
                  ctx.beginPath();
                  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
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

      {/* ── Modern Floating Island HUD ─────────────────────────────────────── */}
      <header className="hud-island">
        {/* Live Status Pill */}
        <div className="hud-status">
          <span className={`hud-dot ${tracking.visible ? 'live' : ''}`} />
          <span className="hud-status-text">{status}</span>
        </div>

        {/* 🎯 Quick Center / Calibrate */}
        <button
          className="hud-btn hud-btn-primary"
          onClick={handleManualCalibrate}
          title="Sit comfortably looking at screen center and click to recalibrate"
        >
          <span className="hud-btn-icon">🎯</span>
          <span>Center View</span>
        </button>

        {/* Segmented Scene Selector */}
        <div className="segmented-scenes" role="tablist" aria-label="3D Environments">
          <button
            className={`seg-btn ${scene === 'aquarium' ? 'active' : ''}`}
            onClick={() => setScene('aquarium')}
          >
            🐠 Aquarium
          </button>
          <button
            className={`seg-btn ${scene === 'corridor' ? 'active' : ''}`}
            onClick={() => setScene('corridor')}
          >
            🏛️ Corridor
          </button>
          <button
            className={`seg-btn ${scene === 'portal' ? 'active' : ''}`}
            onClick={() => setScene('portal')}
          >
            ⚡ Cyber
          </button>
        </div>

        {/* 🥽 3D Glasses Stereo Mode */}
        <button
          className={`hud-btn hud-btn-stereo ${stereoscopic ? 'active' : ''}`}
          onClick={() => setStereoscopic(!stereoscopic)}
          title="Toggle Red/Cyan 3D Anaglyph Stereoscopic Mode"
        >
          <span className="hud-btn-icon">🥽</span>
          <span>{stereoscopic ? '3D Active' : '3D Glasses'}</span>
        </button>

        {/* Frustum Debug Visualizer */}
        <button
          className={`hud-btn ${debug ? 'active' : ''}`}
          onClick={() => setDebug(!debug)}
          title="Toggle Isometric 3D Frustum Visualizer"
        >
          <span className="hud-btn-icon">📐</span>
          <span>Frustum</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          className="hud-btn"
          onClick={toggleFullscreen}
          title="Toggle Edge-to-Edge Fullscreen"
        >
          <span className="hud-btn-icon">⛶</span>
        </button>
      </header>

      {/* ── Collapsible Picture-in-Picture Camera ──────────────────────────── */}
      <div className={`camera-pip ${pipMinimized ? 'minimized' : ''}`}>
        <div className="pip-header">
          <div className="pip-title">
            <span className={`hud-dot ${tracking.visible ? 'live' : ''}`} />
            <span>{tracking.visible ? 'FACE TRACKED' : 'SEARCHING…'}</span>
          </div>
          <button
            className="pip-toggle"
            onClick={() => setPipMinimized(!pipMinimized)}
            title={pipMinimized ? 'Expand Camera Preview' : 'Minimize Camera'}
          >
            {pipMinimized ? '▲' : '▼'}
          </button>
        </div>
        {!pipMinimized && (
          <div className="pip-viewport">
            <video ref={video} className="pip-video" muted playsInline />
            <canvas ref={overlayCanvas} width={640} height={480} className="pip-overlay" />
          </div>
        )}
      </div>

      {/* ── Floating Coordinates Glass Card ───────────────────────────────── */}
      {debug && (
        <aside className="frustum-hud-card">
          <div className="hud-card-header">
            <strong>PERSPECTIVE TELEMETRY</strong>
            <button className="hud-card-close" onClick={() => setDebug(false)}>✕</button>
          </div>
          <div className="telemetry-grid">
            <div className="telemetry-row">
              <span className="t-label">Eye X (Horiz)</span>
              <span className="t-val">{tracking.x >= 0 ? `+${tracking.x.toFixed(1)}` : tracking.x.toFixed(1)} cm</span>
            </div>
            <div className="telemetry-row">
              <span className="t-label">Eye Y (Vert)</span>
              <span className="t-val">{tracking.y >= 0 ? `+${tracking.y.toFixed(1)}` : tracking.y.toFixed(1)} cm</span>
            </div>
            <div className="telemetry-row">
              <span className="t-label">Eye Z (Dist)</span>
              <span className="t-val">{tracking.z.toFixed(1)} cm</span>
            </div>
            <div className="telemetry-row">
              <span className="t-label">Frustum Model</span>
              <span className="t-val highlight">Kooima Off-Axis</span>
            </div>
            <div className="telemetry-row">
              <span className="t-label">Stereo Mode</span>
              <span className="t-val">{stereoscopic ? 'Red/Cyan Anaglyph' : 'Monocular'}</span>
            </div>
          </div>
        </aside>
      )}

      {error && <div className="toast-banner">{error}</div>}
    </main>
  );
}
