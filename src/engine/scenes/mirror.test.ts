import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createMirror, screenSize } from './mirror';

describe('Infinity scene', () => {
  it('asks the engine for the previous frame instead of a screen share', () => {
    const mirror = createMirror();
    expect(typeof mirror.feedback).toBe('function');
    mirror.dispose?.();
  });

  it('sizes the virtual screen from the real screen, not the viewing distance', () => {
    const wide = screenSize({ aspect: 16 / 9, heightCm: 20 });
    expect(wide.width / wide.height).toBeCloseTo(16 / 9, 5);
    expect(wide.height).toBeCloseTo(17, 5);

    const tall = screenSize({ aspect: 9 / 16, heightCm: 30 });
    expect(tall.width / tall.height).toBeCloseTo(9 / 16, 5);
    expect(tall.height).toBeLessThan(30);
  });

  it('rebuilds the screen when the canvas aspect changes', () => {
    const mirror = createMirror();
    const texture = new THREE.Texture();
    const before = mirror.group.children.length;

    mirror.feedback?.(texture, { aspect: 4 / 3, heightCm: 25 });
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
