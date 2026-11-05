import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyOffAxisProjection, EYE_SEPARATION_CM } from './OffAxisCamera';

const calibration = { widthCm: 53, heightCm: 30 };
const aspect = 16 / 9;
const halfHeight = calibration.heightCm / 2;
const halfWidth = halfHeight * aspect;

function makeCamera() {
  return new THREE.PerspectiveCamera(45, aspect, 1, 2500);
}

function project(camera: THREE.PerspectiveCamera, x: number, y: number, z: number) {
  const point = new THREE.Vector3(x, y, z).project(camera);
  return { x: point.x, y: point.y, z: point.z };
}

describe('applyOffAxisProjection', () => {
  it('maps the physical screen corners to the viewport corners', () => {
    const camera = makeCamera();
    applyOffAxisProjection(camera, { x: 0, y: 0, z: 60 }, calibration, aspect);

    const lowerLeft = project(camera, -halfWidth, -halfHeight, 0);
    const upperRight = project(camera, halfWidth, halfHeight, 0);

    expect(lowerLeft.x).toBeCloseTo(-1, 6);
    expect(lowerLeft.y).toBeCloseTo(-1, 6);
    expect(upperRight.x).toBeCloseTo(1, 6);
    expect(upperRight.y).toBeCloseTo(1, 6);
  });

  it('keeps the screen corners fixed when the viewer moves', () => {
    const camera = makeCamera();
    applyOffAxisProjection(camera, { x: 12, y: -7, z: 48 }, calibration, aspect);

    expect(project(camera, -halfWidth, -halfHeight, 0).x).toBeCloseTo(-1, 6);
    expect(project(camera, -halfWidth, -halfHeight, 0).y).toBeCloseTo(-1, 6);
    expect(project(camera, halfWidth, halfHeight, 0).x).toBeCloseTo(1, 6);
    expect(project(camera, halfWidth, halfHeight, 0).y).toBeCloseTo(1, 6);
  });

  it('places the camera at the eye position with no rotation', () => {
    const camera = makeCamera();
    applyOffAxisProjection(camera, { x: 5, y: 3, z: 55 }, calibration, aspect);

    expect(camera.position.x).toBeCloseTo(5);
    expect(camera.position.y).toBeCloseTo(3);
    expect(camera.position.z).toBeCloseTo(55);
    expect(camera.quaternion.x).toBeCloseTo(0);
    expect(camera.quaternion.y).toBeCloseTo(0);
    expect(camera.quaternion.z).toBeCloseTo(0);
    expect(camera.quaternion.w).toBeCloseTo(1);
  });

  it('applies a stereo eye offset without changing the screen anchors', () => {
    const camera = makeCamera();
    applyOffAxisProjection(
      camera,
      { x: 0, y: 0, z: 60 },
      calibration,
      aspect,
      EYE_SEPARATION_CM / 2,
    );

    expect(camera.position.x).toBeCloseTo(EYE_SEPARATION_CM / 2);
    expect(project(camera, -halfWidth, -halfHeight, 0).x).toBeCloseTo(-1, 6);
    expect(project(camera, halfWidth, halfHeight, 0).x).toBeCloseTo(1, 6);
  });

  it('clamps the eye distance to avoid a degenerate frustum', () => {
    const camera = makeCamera();
    applyOffAxisProjection(camera, { x: 0, y: 0, z: -20 }, calibration, aspect);
    expect(camera.position.z).toBeGreaterThanOrEqual(15);
  });
});
