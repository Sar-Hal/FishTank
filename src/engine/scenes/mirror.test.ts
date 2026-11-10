import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createMirror, screenSize } from './mirror';

describe('Infinity scene', () => {
  it('asks the engine for the previous frame instead of a screen share', () => {
    const mirror = createMirror();
    expect(typeof mirror.feedback).toBe('function');
    mirror.dispose?.();
  });

  it('shapes the virtual screen like the canvas', () => {
    const wide = screenSize(16 / 9);
    expect(wide.width / wide.height).toBeCloseTo(16 / 9, 5);

    const tall = screenSize(9 / 16);
    expect(tall.width / tall.height).toBeCloseTo(9 / 16, 5);
    expect(tall.height).toBeLessThanOrEqual(150);
  });

  it('rebuilds the screen when the canvas aspect changes', () => {
    const mirror = createMirror();
    const texture = new THREE.Texture();
    const before = mirror.group.children.length;

    mirror.feedback?.(texture, 4 / 3);
    expect(mirror.group.children.length).toBe(before);

    let found = false;
    mirror.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.material instanceof THREE.ShaderMaterial) {
        found = mesh.material.uniforms.map.value === texture;
      }
    });
    expect(found).toBe(true);
    mirror.dispose?.();
  });
});
