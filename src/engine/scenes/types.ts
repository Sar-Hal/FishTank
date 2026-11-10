import type * as THREE from 'three';

export interface FeedbackView {
  /** Canvas width / height. */
  aspect: number;
  /** Physical height of the real screen in centimetres. */
  heightCm: number;
}

export interface Environment {
  group: THREE.Group;
  background: THREE.Color;
  fog: THREE.Fog | null;
  update: (dt: number, elapsed: number) => void;
  dispose?: () => void;
  /**
   * Optional. When present, the engine copies every finished frame into
   * `texture` and calls this whenever the texture, canvas aspect or physical
   * screen height changes. Used by the Infinity scene to show the screen
   * inside itself.
   */
  feedback?: (texture: THREE.Texture, view: FeedbackView) => void;
}

export type SceneFactory = () => Environment;
