export type TrackingPoint = {
  x: number; // Head offset in cm from screen center (right = +X, left = -X)
  y: number; // Head offset in cm from screen center (up = +Y, down = -Y)
  z: number; // Head distance in cm from screen surface (e.g. 65 cm)
  visible: boolean;
  faceWidthNorm: number;
  rawEyeX: number;
  rawEyeY: number;
};

export const DEFAULT_TRACKING: TrackingPoint = {
  x: 0,
  y: 0,
  z: 65,
  visible: false,
  faceWidthNorm: 0,
  rawEyeX: 0.5,
  rawEyeY: 0.5,
};

interface HistoryEntry {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export class HeadTracker {
  private baselineFaceWidth: number | null = null;
  private centerFaceX: number = 0.5;
  private centerFaceY: number = 0.5;
  private lastFaceX: number = 0.5;
  private lastFaceY: number = 0.5;
  private lastFaceWidth: number = 0.2;
  private positionHistory: HistoryEntry[] = [];
  private smoothingWindowMs: number = 200; // 200ms time-weighted window
  private currentPosition: TrackingPoint = { ...DEFAULT_TRACKING };
  private invisibleFrames: number = 0;

  constructor(smoothingWindowMs = 200) {
    this.smoothingWindowMs = smoothingWindowMs;
  }

  /**
   * Reset calibration: snaps the current user face position as the neutral center,
   * and sets current face width as the baseline for the calibrated distance.
   */
  public calibrate(faceX?: number, faceY?: number, faceWidth?: number) {
    const fx = faceX !== undefined ? faceX : this.lastFaceX;
    const fy = faceY !== undefined ? faceY : this.lastFaceY;
    const fw = faceWidth !== undefined ? faceWidth : this.lastFaceWidth;

    if (fw > 0.04) {
      this.centerFaceX = fx;
      this.centerFaceY = fy;
      this.baselineFaceWidth = fw;
    } else {
      this.baselineFaceWidth = null;
      this.centerFaceX = 0.5;
      this.centerFaceY = 0.5;
    }
    this.positionHistory = [];
    this.currentPosition.x = 0;
    this.currentPosition.y = 0;
    this.currentPosition.z = 60;
  }

  public get isCalibrated(): boolean {
    return this.baselineFaceWidth !== null;
  }

  /**
   * Process a detected face bounding box and keypoints.
   * - faceX, faceY: normalized [0, 1] center of detected face
   * - faceWidth: normalized [0, 1] width of face bounding box
   * - screenWidthCm, screenHeightCm, calibratedDistanceCm, cameraOffsetYCm, sensitivity
   */
  public update(
    detection: { faceX: number; faceY: number; faceWidth: number } | null,
    calibration: {
      widthCm: number;
      heightCm: number;
      distanceCm: number;
      cameraOffsetYCm?: number;
      sensitivity: number;
    },
    currentTime = performance.now(),
  ): TrackingPoint {
    const { widthCm, heightCm, distanceCm, cameraOffsetYCm = 0, sensitivity = 1.0 } = calibration;

    if (!detection || detection.faceWidth < 0.04) {
      // Face not detected — smoothly decay towards neutral center (0, 0, distanceCm)
      this.invisibleFrames++;
      const returnFactor = Math.min(0.08, this.invisibleFrames * 0.001);
      this.currentPosition = {
        x: this.currentPosition.x + (0 - this.currentPosition.x) * returnFactor,
        y: this.currentPosition.y + (cameraOffsetYCm - this.currentPosition.y) * returnFactor,
        z: this.currentPosition.z + (distanceCm - this.currentPosition.z) * returnFactor,
        visible: false,
        faceWidthNorm: 0,
        rawEyeX: 0.5,
        rawEyeY: 0.5,
      };
      return { ...this.currentPosition };
    }

    this.invisibleFrames = 0;
    const { faceX, faceY, faceWidth } = detection;
    this.lastFaceX = faceX;
    this.lastFaceY = faceY;
    this.lastFaceWidth = faceWidth;

    // Auto-calibrate baseline on the first clear face detection
    if (this.baselineFaceWidth === null && faceWidth > 0.06) {
      this.baselineFaceWidth = faceWidth;
      this.centerFaceX = faceX;
      this.centerFaceY = faceY;
    }

    const baseline = this.baselineFaceWidth ?? faceWidth;

    // 1. Z Distance via face width ratio (Guy Romm's method)
    // Larger face in frame = closer to camera.
    const rawDistance = (baseline / faceWidth) * distanceCm;
    const clampedDistance = Math.min(250, Math.max(25, rawDistance));

    // 2. X & Y Positions relative to screen center (in cm)
    // Mirrored camera: user moving right moves face to right (faceX > centerFaceX)
    const horizOffset = faceX - this.centerFaceX;
    const vertOffset = this.centerFaceY - faceY; // positive when user moves head up

    // Physical centimeters on the screen plane scaled by sensitivity
    const rawX = -horizOffset * widthCm * sensitivity;
    const rawY = vertOffset * heightCm * sensitivity + (cameraOffsetYCm || 0);

    // 3. Time-weighted Moving Average (200ms window)
    this.positionHistory.push({
      x: rawX,
      y: rawY,
      z: clampedDistance,
      timestamp: currentTime,
    });

    // Remove entries older than smoothing window
    const cutoff = currentTime - this.smoothingWindowMs;
    while (this.positionHistory.length > 0 && this.positionHistory[0].timestamp < cutoff) {
      this.positionHistory.shift();
    }

    // Weighted average: newest samples have linear weight up to 1.0
    let totalWeight = 0;
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;

    for (let i = 0; i < this.positionHistory.length; i++) {
      const entry = this.positionHistory[i];
      const age = currentTime - entry.timestamp;
      const weight = Math.max(0.01, 1 - age / this.smoothingWindowMs);
      sumX += entry.x * weight;
      sumY += entry.y * weight;
      sumZ += entry.z * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      this.currentPosition = {
        x: sumX / totalWeight,
        y: sumY / totalWeight,
        z: sumZ / totalWeight,
        visible: true,
        faceWidthNorm: faceWidth,
        rawEyeX: faceX,
        rawEyeY: faceY,
      };
    }

    return { ...this.currentPosition };
  }
}

