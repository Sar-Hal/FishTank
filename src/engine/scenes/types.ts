import type * as THREE from 'three';

export interface Environment {
  group: THREE.Group;
  background: THREE.Color;
  fog: THREE.Fog | null;
  update: (dt: number, elapsed: number) => void;
}

export type SceneFactory = () => Environment;
