import { useEffect, useRef } from 'react';
import { useAppStore } from '../../state/appStore';
import type { FaceBox } from '../../tracking/types';

export interface PipDetection {
  box: FaceBox | null;
  videoWidth: number;
  videoHeight: number;
}

interface CameraPipProps {
  stream: MediaStream | null;
  detectionRef: { current: PipDetection | null };
}

/**
 * Draw the face box over the mirrored camera preview.
 *
 * MediaPipe reports coordinates in the raw (unmirrored) video frame, while the
 * preview is flipped with CSS. We mirror the mapping here so the reticle lands
 * on the face rather than on its reflection.
 */
export function drawReticle(
  canvas: HTMLCanvasElement,
  box: FaceBox | null,
  videoWidth: number,
  videoHeight: number,
): void {
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (cssWidth <= 0 || cssHeight <= 0) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.round(cssWidth * dpr);
  const targetHeight = Math.round(cssHeight * dpr);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  if (!box || videoWidth <= 0 || videoHeight <= 0) return;

  // Match the object-fit: cover mapping used by the preview video.
  const videoAspect = videoWidth / videoHeight;
  const canvasAspect = cssWidth / cssHeight;
  let drawWidth: number;
  let drawHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (videoAspect > canvasAspect) {
    drawHeight = cssHeight;
    drawWidth = cssHeight * videoAspect;
    offsetX = (cssWidth - drawWidth) / 2;
    offsetY = 0;
  } else {
    drawWidth = cssWidth;
    drawHeight = cssWidth / videoAspect;
    offsetX = 0;
    offsetY = (cssHeight - drawHeight) / 2;
  }

  const rawX = offsetX + (box.originX / videoWidth) * drawWidth;
  const rawY = offsetY + (box.originY / videoHeight) * drawHeight;
  const boxWidth = (box.width / videoWidth) * drawWidth;
  const boxHeight = (box.height / videoHeight) * drawHeight;
  const x = cssWidth - (rawX + boxWidth);
  const y = rawY;

  const pad = Math.max(5, Math.min(cssWidth, cssHeight) * 0.025);
  const left = x - pad;
  const top = y - pad;
  const right = x + boxWidth + pad;
  const bottom = y + boxHeight + pad;
  const corner = Math.max(9, Math.min(boxWidth, boxHeight) * 0.24);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, cssWidth, cssHeight);
  ctx.clip();

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.95)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(34, 211, 238, 0.7)';
  ctx.shadowBlur = 9;

  ctx.beginPath();
  // Top-left
  ctx.moveTo(left, top + corner);
  ctx.lineTo(left, top);
  ctx.lineTo(left + corner, top);
  // Top-right
  ctx.moveTo(right - corner, top);
  ctx.lineTo(right, top);
  ctx.lineTo(right, top + corner);
  // Bottom-right
  ctx.moveTo(right, bottom - corner);
  ctx.lineTo(right, bottom);
  ctx.lineTo(right - corner, bottom);
  // Bottom-left
  ctx.moveTo(left + corner, bottom);
  ctx.lineTo(left, bottom);
  ctx.lineTo(left, bottom - corner);
  ctx.stroke();

  // Centre dot
  ctx.shadowBlur = 6;
  ctx.fillStyle = 'rgba(165, 243, 252, 0.95)';
  ctx.beginPath();
  ctx.arc(left + (right - left) / 2, top + (bottom - top) / 2, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function CameraPip({ stream, detectionRef }: CameraPipProps) {
  const collapsed = useAppStore((state) => state.pipCollapsed);
  const setPipCollapsed = useAppStore((state) => state.setPipCollapsed);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.srcObject = stream;
    if (stream) {
      void video.play().catch(() => undefined);
    }

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    let frame = 0;

    const loop = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const detection = detectionRef.current;
        if (detection) {
          drawReticle(canvas, detection.box, detection.videoWidth, detection.videoHeight);
        } else {
          drawReticle(canvas, null, 0, 0);
        }
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [detectionRef]);

  return (
    <aside className={`camera-pip glass ${collapsed ? 'camera-pip--collapsed' : ''}`}>
      <header className="pip-header">
        <span className={`pip-live-dot ${stream ? 'is-live' : ''}`} aria-hidden="true" />
        <span className="pip-title">Camera</span>
        <span className="pip-sub">{stream ? 'Live' : 'Offline'}</span>
        <button
          type="button"
          className="pip-toggle"
          onClick={() => setPipCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand camera preview' : 'Collapse camera preview'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand camera preview' : 'Collapse camera preview'}
        >
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <path
              d={collapsed ? 'M5 12l5-5 5 5' : 'M5 8l5 5 5-5'}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <div className="pip-body" aria-hidden={collapsed}>
        <video ref={videoRef} className="pip-video" muted autoPlay playsInline />
        <canvas ref={canvasRef} className="pip-reticle" />
        <span className="pip-hint">Face tracking</span>
      </div>
    </aside>
  );
}
