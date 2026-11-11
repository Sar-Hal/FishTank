import type * as THREE from 'three';

export interface FeedbackView {
  /** Canvas width / height. */
  aspect: number;
  /** Physical height of the real screen in centimetres. */
  heightCm: number;
}

/**
 * The vertical slice of a scene (in the scene's own units) that should line up
 * with the real screen's bottom and top edges at the glass (z = 0). The engine
 * scales the scene so this slice exactly fills the physical screen height, so
 * the scene sits behind the screen like a real tank instead of a huge room
 * seen from far away.
 */
export interface SceneWindow {
  bottom: number;
  top: number;
}

export interface Environment {
  group: THREE.Group;
  background: THREE.Color;
  fog: THREE.Fog | null;
  /** Optional: fit this slice of the scene to the screen. Omit for real-cm scenes. */
  window?: SceneWindow;
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
