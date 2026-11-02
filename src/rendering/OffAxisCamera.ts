import * as THREE from 'three';
import type { TrackingPoint } from '../tracking/tracking';

export type ScreenCalibration = {
  widthCm: number;
  heightCm: number;
  distanceCm: number;
  sensitivity: number;
  cameraOffsetYCm?: number;
};

/** Average human eye separation in cm */
export const EYE_SEPARATION_CM = 6.3;

/**
 * Compute an off-axis ("fish-tank") perspective projection matrix.
 *
 * The monitor surface is fixed at z = 0, spanning [-widthCm/2, widthCm/2] horizontally
 * and [-heightCm/2, heightCm/2] vertically.
 *
 * Virtual 3D objects exist behind the screen at negative z (z <= 0).
 * The user's eye is in front of the screen at positive z (z > 0).
 *
 * The camera position is set to the eye position with identity rotation.
 * The perspective frustum is skewed so that at distance = eyeZ (the screen plane),
 * the frustum matches the screen bezels.
 */
export function updateOffAxisProjection(
  camera: THREE.Camera,
  tracking: TrackingPoint,
  screen: ScreenCalibration,
  eyeOffsetCm = 0, // for stereoscopic vision (-EYE_SEPARATION/2 or +EYE_SEPARATION/2)
  near = 1.0,      // 1 cm in front of eye
  far = 5000.0,    // 50 meters back
) {
  const hw = screen.widthCm / 2;
  const hh = screen.heightCm / 2;

  // Eye position in cm
  const eyeX = tracking.x + eyeOffsetCm;
  const eyeY = tracking.y;
  const eyeZ = Math.max(15, tracking.z); // Clamp to at least 15 cm in front of screen

  // Scale factor to map screen boundaries onto the near clipping plane
  const scale = near / eyeZ;
  const left   = (-hw - eyeX) * scale;
  const right  = ( hw - eyeX) * scale;
  const bottom = (-hh - eyeY) * scale;
  const top    = ( hh - eyeY) * scale;

  camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  // Position the virtual camera at the eye position with zero rotation
  camera.position.set(eyeX, eyeY, eyeZ);
  camera.quaternion.set(0, 0, 0, 1);
  camera.updateMatrixWorld(true);
}


