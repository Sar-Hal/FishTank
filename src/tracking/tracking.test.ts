import { describe, expect, it } from 'vitest';
import { HeadTracker, DEFAULT_TRACKING } from './tracking';

describe('HeadTracker', () => {
  const sampleCalib = {
    widthCm: 53,
    heightCm: 30,
    distanceCm: 65,
    cameraOffsetYCm: 15,
    sensitivity: 1.0,
  };

  it('returns default tracking when no detection is present', () => {
    const tracker = new HeadTracker();
    const result = tracker.update(null, sampleCalib, 100);
    expect(result.visible).toBe(false);
    expect(result.z).toBeCloseTo(sampleCalib.distanceCm);
  });

  it('auto-calibrates baseline on first valid face detection', () => {
    const tracker = new HeadTracker();
    expect(tracker.isCalibrated).toBe(false);

    // First frame with face at center
    const res1 = tracker.update({ faceX: 0.5, faceY: 0.5, faceWidth: 0.2 }, sampleCalib, 100);
    expect(tracker.isCalibrated).toBe(true);
    expect(res1.visible).toBe(true);
    expect(res1.x).toBeCloseTo(0);
    expect(res1.z).toBeCloseTo(65);
  });

  it('updates distance when user leans closer (larger face)', () => {
    const tracker = new HeadTracker();
    // Baseline detection at width = 0.2, distance = 65
    tracker.update({ faceX: 0.5, faceY: 0.5, faceWidth: 0.2 }, sampleCalib, 100);

    // User leans forward -> face becomes larger (0.3 in frame)
    // newDistance = (0.2 / 0.3) * 65 ≈ 43.33 cm
    const res2 = tracker.update({ faceX: 0.5, faceY: 0.5, faceWidth: 0.3 }, sampleCalib, 300);
    expect(res2.z).toBeLessThan(65);
    expect(res2.z).toBeCloseTo(43.33, 0);
  });

  it('updates horizontal and vertical offsets proportionally', () => {
    const tracker = new HeadTracker();
    // Calibrate at center
    tracker.update({ faceX: 0.5, faceY: 0.5, faceWidth: 0.2 }, sampleCalib, 100);

    // User shifts head to the right (face moves right in video frame)
    const res = tracker.update({ faceX: 0.6, faceY: 0.5, faceWidth: 0.2 }, sampleCalib, 300);
    // x should be negative in camera coordinates or shifted
    expect(Math.abs(res.x)).toBeGreaterThan(0);
  });

  it('gradually decays towards center when face is lost', () => {
    const tracker = new HeadTracker();
    tracker.update({ faceX: 0.7, faceY: 0.3, faceWidth: 0.2 }, sampleCalib, 100);

    // Face lost over multiple frames
    let last = DEFAULT_TRACKING;
    for (let t = 200; t < 1200; t += 100) {
      last = tracker.update(null, sampleCalib, t);
    }
    expect(last.visible).toBe(false);
    expect(Math.abs(last.x)).toBeLessThan(10);
  });

  it('manual calibration recenters the viewpoint to current face position', () => {
    const tracker = new HeadTracker();
    // User is sitting off-center at faceX = 0.65
    tracker.update({ faceX: 0.65, faceY: 0.5, faceWidth: 0.2 }, sampleCalib, 100);

    // User clicks "Center / Calibrate"
    tracker.calibrate(0.65, 0.5, 0.2);

    const res = tracker.update({ faceX: 0.65, faceY: 0.5, faceWidth: 0.2 }, sampleCalib, 150);
    expect(res.x).toBeCloseTo(0);
  });
});
