import { describe, expect, it } from 'vitest';
import { applyDeadZones } from '@/input/GamepadSource';

describe('applyDeadZones', () => {
  it('returns zero inside the radial dead zone', () => {
    expect(applyDeadZones(0.1, 0.1, 0.2, 0.05)).toEqual({ x: 0, y: 0 });
  });

  it('rescales so the edge of the dead zone maps to zero and full deflection stays full', () => {
    const edge = applyDeadZones(0.2001, 0, 0.2, 0);
    expect(edge.x).toBeCloseTo(0, 2);
    const full = applyDeadZones(1, 0, 0.2, 0);
    expect(full.x).toBeCloseTo(1, 5);
    const diagonal = applyDeadZones(Math.SQRT1_2, Math.SQRT1_2, 0.2, 0);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 5);
  });

  it('applies the axial dead zone per component after the radial one', () => {
    const result = applyDeadZones(0.9, 0.05, 0.1, 0.1);
    expect(result.x).toBeGreaterThan(0.8);
    expect(result.y).toBe(0);
  });

  it('never produces a magnitude above 1', () => {
    const samples: Array<[number, number]> = [[1, 1], [-1, 1], [0.8, -0.9]];
    for (const [x, y] of samples) {
      const r = applyDeadZones(x, y, 0.15, 0.05);
      expect(Math.hypot(r.x, r.y)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
