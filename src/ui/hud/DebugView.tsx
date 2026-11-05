import { useEffect, useRef } from 'react';
import { useAppStore } from '../../state/appStore';
import { useTelemetryStore } from '../../state/telemetryStore';

const PADDING = 16;

interface Point3 {
  x: number;
  y: number;
  z: number;
}

interface Point2 {
  x: number;
  y: number;
}

/**
 * Oblique three-quarter projection. The x shear gives the screen plane a
 * slight axonometric tilt while keeping the eye near the horizontal centre,
 * so the diagram uses the panel width instead of collapsing into a corner.
 */
function isometric(point: Point3): Point2 {
  return {
    x: point.x + point.z * 0.3,
    y: point.x * 0.18 - point.y + point.z * 0.55,
  };
}

/**
 * Small isometric schematic of the physical setup: the screen plane at z = 0,
 * the eye in front of it, and the frustum connecting the two. Everything is in
 * centimetres so the diagram reflects the calibrated room scale.
 */
export function DebugView() {
  const pose = useTelemetryStore((state) => state.pose);
  const calibration = useAppStore((state) => state.calibration);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width <= 0 || height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.round(width * dpr);
      const targetHeight = Math.round(height * dpr);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const halfWidth = calibration.widthCm / 2;
      const halfHeight = calibration.heightCm / 2;
      const eye: Point3 = { x: pose.x, y: pose.y, z: Math.max(1, pose.z) };

      const corners: Point3[] = [
        { x: -halfWidth, y: -halfHeight, z: 0 },
        { x: halfWidth, y: -halfHeight, z: 0 },
        { x: halfWidth, y: halfHeight, z: 0 },
        { x: -halfWidth, y: halfHeight, z: 0 },
      ];

      const projectedCorners = corners.map(isometric);
      const projectedEye = isometric(eye);
      const all = [...projectedCorners, projectedEye];

      const minX = Math.min(...all.map((point) => point.x));
      const maxX = Math.max(...all.map((point) => point.x));
      const minY = Math.min(...all.map((point) => point.y));
      const maxY = Math.max(...all.map((point) => point.y));
      const spanX = Math.max(1, maxX - minX);
      const spanY = Math.max(1, maxY - minY);

      const scale = Math.min(
        (width - PADDING * 2) / spanX,
        (height - PADDING * 2) / spanY,
      );
      const offsetX = width / 2 - ((minX + maxX) / 2) * scale;
      const offsetY = height / 2 - ((minY + maxY) / 2) * scale;

      const screen = projectedCorners.map((point) => ({
        x: point.x * scale + offsetX,
        y: point.y * scale + offsetY,
      }));
      const eyePoint = {
        x: projectedEye.x * scale + offsetX,
        y: projectedEye.y * scale + offsetY,
      };

      // Screen plane fill
      ctx.beginPath();
      ctx.moveTo(screen[0].x, screen[0].y);
      for (let i = 1; i < screen.length; i++) ctx.lineTo(screen[i].x, screen[i].y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(34, 211, 238, 0.07)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Screen grid (quarters horizontally, thirds vertically)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 1;
      const lerpCorner = (a: Point2, b: Point2, t: number) => ({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });
      for (const t of [0.25, 0.5, 0.75]) {
        const left = lerpCorner(screen[0], screen[3], t);
        const right = lerpCorner(screen[1], screen[2], t);
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
      }
      for (const t of [1 / 3, 2 / 3]) {
        const top = lerpCorner(screen[0], screen[1], t);
        const bottom = lerpCorner(screen[3], screen[2], t);
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.stroke();
      }

      // Frustum edges
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.lineWidth = 1;
      for (const corner of screen) {
        ctx.beginPath();
        ctx.moveTo(eyePoint.x, eyePoint.y);
        ctx.lineTo(corner.x, corner.y);
        ctx.stroke();
      }

      // Distance line from the eye to the screen plane.
      const planeBelowEye = isometric({ x: eye.x, y: eye.y, z: 0 });
      const target = {
        x: planeBelowEye.x * scale + offsetX,
        y: planeBelowEye.y * scale + offsetY,
      };
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.5)';
      ctx.beginPath();
      ctx.moveTo(eyePoint.x, eyePoint.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.restore();

      // Eye marker
      ctx.beginPath();
      ctx.arc(eyePoint.x, eyePoint.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244, 63, 94, 0.16)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(eyePoint.x, eyePoint.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fb7185';
      ctx.shadowColor = 'rgba(244, 63, 94, 0.9)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = 'rgba(251, 113, 133, 0.95)';
      ctx.fillText('EYE', eyePoint.x + 10, eyePoint.y + 3);

      ctx.fillStyle = 'rgba(103, 232, 249, 0.85)';
      ctx.fillText('SCREEN', screen[0].x + 4, screen[0].y - 6);

      // Z distance label near the dashed line.
      const midX = (eyePoint.x + target.x) / 2;
      const midY = (eyePoint.y + target.y) / 2;
      ctx.fillStyle = 'rgba(251, 113, 133, 0.8)';
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`${pose.z.toFixed(0)} cm`, midX + 6, midY);
    };

    draw();

    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [pose, calibration]);

  return (
    <section className="debug-view glass" aria-label="Isometric frustum debug view">
      <header className="debug-header">
        <span>Frustum</span>
        <span className="debug-tag">ISO</span>
      </header>
      <canvas ref={canvasRef} className="debug-canvas" />
      <div className="debug-readout">
        <span>
          X <strong>{pose.x.toFixed(1)}</strong>
        </span>
        <span>
          Y <strong>{pose.y.toFixed(1)}</strong>
        </span>
        <span>
          Z <strong>{pose.z.toFixed(1)}</strong>
        </span>
      </div>
    </section>
  );
}
