import type { CalibrationLike, FaceSample, TrackedPose } from './types';

const MIN_FACE_WIDTH = 0.04;
const AUTO_BASELINE_MIN = 0.06;
const MIN_DISTANCE_CM = 25;
const MAX_DISTANCE_CM = 220;
const MAX_HISTORY = 120;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface HistoryEntry {
  x: number;
  y: number;
  z: number;
  t: number;
}

/**
 * Converts MediaPipe face detections into a physical head pose in centimetres.
 *
 * The tracker uses the apparent face width to estimate distance (like the
 * classic "fish tank" demos) and maps the face's normalised screen position to
 * physical offsets. The first clear detection establishes a baseline unless
 * the user explicitly recalibrates.
 */
export class HeadTracker {
  private baselineFaceWidth: number | null = null;
  private centerFaceX = 0.5;
  private centerFaceY = 0.5;
  private lastSample: FaceSample | null = null;
  private history: HistoryEntry[] = [];
  private smoothPosition = { x: 0, y: 0, z: 60 };
  private missingFrames = 0;
  private hasTracked = false;
  private readonly smoothingWindowMs: number;

  constructor(smoothingWindowMs = 180) {
    this.smoothingWindowMs = clamp(smoothingWindowMs, 0, 1000);
  }

  get isCalibrated(): boolean {
    return this.baselineFaceWidth !== null;
  }

  get baseline(): number | null {
    return this.baselineFaceWidth;
  }

  get lastFaceSample(): FaceSample | null {
    return this.lastSample;
  }

  /** True when the most recently processed frame contained a usable face. */
  get hasFace(): boolean {
    return this.hasTracked && this.missingFrames === 0;
  }

  /**
   * Snap the current (or supplied) face position as the neutral viewpoint.
   * With no explicit sample, a visible face is used; otherwise the tracker
   * resets to auto-baseline mode.
   */
  calibrate(sample?: FaceSample | null): void {
    const target =
      sample === undefined ? (this.hasFace ? this.lastSample : null) : sample;
    const valid = Boolean(target && target.faceWidth >= MIN_FACE_WIDTH);

    if (target && valid) {
      this.centerFaceX = target.faceX;
      this.centerFaceY = target.faceY;
      this.baselineFaceWidth = target.faceWidth;
    } else {
      this.centerFaceX = 0.5;
      this.centerFaceY = 0.5;
      this.baselineFaceWidth = null;
    }

    this.hasTracked = valid;
    this.history = [];
    this.missingFrames = 0;
    this.smoothPosition = { x: 0, y: 0, z: this.smoothPosition.z };
  }

  update(
    sample: FaceSample | null,
    calibration: CalibrationLike,
    now = performance.now(),
  ): TrackedPose {
    const distanceCm = clamp(calibration.distanceCm, MIN_DISTANCE_CM, MAX_DISTANCE_CM);

    if (!sample || sample.faceWidth < MIN_FACE_WIDTH) {
      this.missingFrames += 1;

      if (!this.hasTracked) {
        // Before the first detection there is nothing to ease from; sit at the
        // calibrated viewing distance so the initial view is already correct.
        this.smoothPosition = { x: 0, y: 0, z: distanceCm };
      } else {
        // Ease back toward the neutral viewpoint while the face is out of view.
        const returnFactor = Math.min(0.3, this.missingFrames * 0.03);
        this.smoothPosition = {
          x: this.smoothPosition.x + (0 - this.smoothPosition.x) * returnFactor,
          y: this.smoothPosition.y + (0 - this.smoothPosition.y) * returnFactor,
          z: this.smoothPosition.z + (distanceCm - this.smoothPosition.z) * returnFactor,
        };
      }

      return { ...this.smoothPosition, visible: false, faceWidth: 0 };
    }

    this.hasTracked = true;
    this.missingFrames = 0;
    this.lastSample = sample;

    // Establish an automatic baseline on the first clear detection.
    if (this.baselineFaceWidth === null && sample.faceWidth >= AUTO_BASELINE_MIN) {
      this.baselineFaceWidth = sample.faceWidth;
      this.centerFaceX = sample.faceX;
      this.centerFaceY = sample.faceY;
    }

    const baseline = this.baselineFaceWidth ?? sample.faceWidth;

    // Distance from apparent face size.
    const rawDistance = (baseline / sample.faceWidth) * distanceCm;
    const z = clamp(rawDistance, MIN_DISTANCE_CM, MAX_DISTANCE_CM);

    // Raw camera frames are unmirrored: moving right decreases faceX.
    const horizontalOffset = sample.faceX - this.centerFaceX;
    const verticalOffset = this.centerFaceY - sample.faceY;
    const sensitivity = clamp(calibration.sensitivity, 0.2, 4);

    const x = -horizontalOffset * calibration.widthCm * sensitivity;
    const y = verticalOffset * calibration.heightCm * sensitivity;

    this.history.push({ x, y, z, t: now });

    const cutoff = now - this.smoothingWindowMs;
    while (this.history.length > 0 && this.history[0].t < cutoff) {
      this.history.shift();
    }
    while (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }

    let totalWeight = 0;
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;

    for (const entry of this.history) {
      const weight = Math.max(0.01, 1 - (now - entry.t) / Math.max(1, this.smoothingWindowMs));
      sumX += entry.x * weight;
      sumY += entry.y * weight;
      sumZ += entry.z * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      this.smoothPosition = {
        x: sumX / totalWeight,
        y: sumY / totalWeight,
        z: sumZ / totalWeight,
      };
    }

    return { ...this.smoothPosition, visible: true, faceWidth: sample.faceWidth };
  }
}
