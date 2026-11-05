import * as THREE from 'three';
import type { HeadPose } from '../tracking/types';

/** Average human inter-pupillary distance in centimetres. */
export const EYE_SEPARATION_CM = 6.3;

const MIN_EYE_DISTANCE_CM = 15;

/**
 * Apply Kooima-style generalised perspective projection.
 *
 * The physical screen lives at z = 0 and spans
 * [-widthCm / 2, widthCm / 2] × [-heightCm / 2, heightCm / 2].
 * The virtual world sits behind the screen at negative z, and the eye sits in
 * front of it at positive z. The frustum is skewed so that the screen corners
 * always land exactly on the viewport corners — i.e. the monitor becomes a
 * window, not a picture.
 *
 * `aspectRatio` is the canvas aspect (width / height). The horizontal
 * half-extent is derived from the vertical extent and the canvas aspect so the
 * image always fills the viewport without distortion.
 */
export function applyOffAxisProjection(
  camera: THREE.PerspectiveCamera,
  pose: HeadPose,
  calibration: { widthCm: number; heightCm: number },
  aspectRatio: number,
  eyeOffsetCm = 0,
  near = 1,
  far = 2500,
): void {
  const halfHeight = calibration.heightCm / 2;
  const halfWidth =
    aspectRatio > 0 ? halfHeight * aspectRatio : calibration.widthCm / 2;

  const eyeX = pose.x + eyeOffsetCm;
  const eyeY = pose.y;
  const eyeZ = Math.max(MIN_EYE_DISTANCE_CM, pose.z);

  const scale = near / eyeZ;
  const left = (-halfWidth - eyeX) * scale;
  const right = (halfWidth - eyeX) * scale;
  const bottom = (-halfHeight - eyeY) * scale;
  const top = (halfHeight - eyeY) * scale;

  camera.near = near;
  camera.far = far;
  camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  camera.position.set(eyeX, eyeY, eyeZ);
  camera.quaternion.set(0, 0, 0, 1);
  camera.updateMatrixWorld(true);
}
