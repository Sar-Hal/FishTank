import { describe, expect, it } from 'vitest';
import { windowScale } from '../PortalEngine';
import { angleDelta } from './aquarium';

describe('windowScale', () => {
  it('scales the scene slice to fill the real screen height', () => {
    expect(windowScale({ bottom: -100, top: 100 }, 20)).toBeCloseTo(0.1, 6);
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
