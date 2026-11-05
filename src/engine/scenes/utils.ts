import * as THREE from 'three';

/**
 * Dispose every geometry, material and texture reachable from a scene graph.
 * Shared resources are collected first so nothing is disposed twice.
 */
export function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (mesh.geometry) geometries.add(mesh.geometry);

    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;

    for (const entry of Array.isArray(material) ? material : [material]) {
      materials.add(entry);
    }
  });

  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) textures.add(value);
    }
    material.dispose();
  }

  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
}
