import { describe, expect, it } from 'vitest';
import { HeadTracker } from './HeadTracker';
import type { CalibrationLike } from './types';

const calibration: CalibrationLike = {
  widthCm: 53,
  heightCm: 30,
  distanceCm: 65,
  sensitivity: 1,
};

const sample = (faceX: number, faceY: number, faceWidth: number, timestamp: number) => ({
  faceX,
  faceY,
  faceWidth,
  timestamp,
});

describe('HeadTracker', () => {
  it('decays toward the neutral distance when no face is present', () => {
    const tracker = new HeadTracker();
    const result = tracker.update(null, calibration, 100);
    expect(result.visible).toBe(false);
    expect(result.z).toBeCloseTo(65, 0);
  });

  it('auto-calibrates its baseline on the first clear face', () => {
    const tracker = new HeadTracker();
    expect(tracker.isCalibrated).toBe(false);

    const result = tracker.update(sample(0.5, 0.5, 0.2, 100), calibration, 100);
    expect(tracker.isCalibrated).toBe(true);
    expect(result.visible).toBe(true);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(65);
  });

  it('estimates a closer distance when the face gets wider', () => {
    const tracker = new HeadTracker();
    tracker.update(sample(0.5, 0.5, 0.2, 100), calibration, 100);

    const result = tracker.update(sample(0.5, 0.5, 0.3, 400), calibration, 400);
    // (0.2 / 0.3) * 65 = 43.33
    expect(result.z).toBeCloseTo(43.33, 0);
  });

  it('mirrors horizontal movement correctly', () => {
    const tracker = new HeadTracker();
    tracker.update(sample(0.5, 0.5, 0.2, 100), calibration, 100);

    // Raw camera coordinates: moving to the user's right moves the face left.
    const result = tracker.update(sample(0.4, 0.5, 0.2, 400), calibration, 400);
    expect(result.x).toBeGreaterThan(0);
    expect(result.x).toBeCloseTo(0.1 * 53, 0);
  });

  it('moves up in screen space when the face moves up in the frame', () => {
    const tracker = new HeadTracker();
    tracker.update(sample(0.5, 0.5, 0.2, 100), calibration, 100);

    const result = tracker.update(sample(0.5, 0.4, 0.2, 400), calibration, 400);
    expect(result.y).toBeGreaterThan(0);
    expect(result.y).toBeCloseTo(0.1 * 30, 0);
  });

  it('applies the sensitivity multiplier', () => {
    const tracker = new HeadTracker();
    tracker.update(sample(0.5, 0.5, 0.2, 100), calibration, 100);

    const result = tracker.update(sample(0.4, 0.5, 0.2, 400), { ...calibration, sensitivity: 2 }, 400);
    expect(result.x).toBeCloseTo(0.1 * 53 * 2, 0);
  });

  it('eases back toward the centre when the face is lost', () => {
    const tracker = new HeadTracker();
    tracker.update(sample(0.5, 0.5, 0.2, 100), calibration, 100);
    const offCentre = tracker.update(sample(0.7, 0.3, 0.2, 150), calibration, 150);
    expect(Math.abs(offCentre.x)).toBeGreaterThan(1);

    let result = tracker.update(null, calibration, 200);
    for (let t = 200; t <= 1400; t += 100) {
      result = tracker.update(null, calibration, t);
    }

    expect(result.visible).toBe(false);
    expect(Math.abs(result.x)).toBeLessThan(1);
    expect(Math.abs(result.y)).toBeLessThan(1);
  });

  it('recenters on the current face when manually calibrated', () => {
    const tracker = new HeadTracker();
    tracker.update(sample(0.65, 0.5, 0.2, 100), calibration, 100);

    tracker.calibrate();
    const result = tracker.update(sample(0.65, 0.5, 0.2, 150), calibration, 150);

    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it('resets to auto-baseline when calibrated without a face', () => {
    const tracker = new HeadTracker();
    tracker.update(sample(0.5, 0.5, 0.2, 100), calibration, 100);
    expect(tracker.isCalibrated).toBe(true);

    tracker.calibrate(null);
    expect(tracker.isCalibrated).toBe(false);
  });

  it('falls back to auto-baseline when recentered after the face is lost', () => {
    const tracker = new HeadTracker();
    tracker.update(sample(0.65, 0.5, 0.2, 100), calibration, 100);
    tracker.update(null, calibration, 200);
    expect(tracker.hasFace).toBe(false);

    tracker.calibrate();
    expect(tracker.isCalibrated).toBe(false);
  });
});
