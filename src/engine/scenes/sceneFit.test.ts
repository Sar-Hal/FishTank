import { describe, expect, it } from 'vitest';
import { windowScale } from '../PortalEngine';
import { angleDelta } from './aquarium';

describe('windowScale', () => {
  it('scales the scene slice to fill the real screen height', () => {
    expect(windowScale({ bottom: -100, top: 100 }, 20)).toBeCloseTo(0.1, 6);
  });

  it('fills more of a tall portrait screen without changing landscape', () => {
    // Landscape 30 × 17 cm: height limits, exactly as before.
    expect(windowScale({ bottom: 0, top: 100 }, 17, 30)).toBeCloseTo(0.17, 6);
    // Portrait 7 × 15 cm: width limits, allowing a 1.4× overfill.
    expect(windowScale({ bottom: 0, top: 100 }, 15, 7)).toBeCloseTo(0.098, 6);
  });

  it('leaves the scene alone for an invalid slice or screen', () => {
    expect(windowScale({ bottom: 10, top: 10 }, 20)).toBe(1);
    expect(windowScale({ bottom: 0, top: 100 }, 0)).toBe(1);
  });
});

describe('angleDelta', () => {
  it('turns the short way across ±π', () => {
    expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2, 6);
    expect(angleDelta(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(-0.2, 6);
  });

  it('matches plain subtraction for small turns', () => {
    expect(angleDelta(0.2, 0.5)).toBeCloseTo(0.3, 6);
  });
});
