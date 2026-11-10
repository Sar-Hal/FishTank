import type * as THREE from 'three';

export interface Environment {
  group: THREE.Group;
  background: THREE.Color;
  fog: THREE.Fog | null;
  update: (dt: number, elapsed: number) => void;
  dispose?: () => void;
  /**
   * Optional. When present, the engine copies every finished frame into
   * `texture` and calls this whenever the texture or canvas aspect changes.
   * Used by the Infinity scene to show the screen inside itself.
   */
  feedback?: (texture: THREE.Texture, aspect: number) => void;
}

export type SceneFactory = () => Environment;
