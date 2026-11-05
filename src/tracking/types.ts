export interface HeadPose {
  /** Horizontal offset from the screen centre in cm (positive = right). */
  x: number;
  /** Vertical offset from the screen centre in cm (positive = up). */
  y: number;
  /** Eye distance in front of the screen plane in cm. */
  z: number;
}

export interface FaceSample {
  /** Normalised [0, 1] horizontal centre of the face in the raw camera frame. */
  faceX: number;
  /** Normalised [0, 1] vertical centre of the face in the raw camera frame. */
  faceY: number;
  /** Normalised [0, 1] width of the face bounding box. */
  faceWidth: number;
  /** `performance.now()` timestamp for the sample. */
  timestamp: number;
}

export interface TrackedPose extends HeadPose {
  visible: boolean;
  faceWidth: number;
}

export interface CalibrationLike {
  widthCm: number;
  heightCm: number;
  distanceCm: number;
  sensitivity: number;
}

export type TrackingStatus =
  | 'idle'
  | 'starting'
  | 'requesting-camera'
  | 'loading-model'
  | 'tracking'
  | 'camera-error'
  | 'model-error'
  | 'stopped';

export interface FaceBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export const NEUTRAL_POSE: HeadPose = { x: 0, y: 0, z: 60 };
