import { describe, expect, it } from 'vitest';
import { AutoQuality } from '@/render/AutoQuality';

const stats = (medianMs: number) => ({ medianMs, worstMs: medianMs * 2, fps: 1000 / medianMs, samples: 120 });

describe('AutoQuality', () => {
  it('steps the render scale down under sustained slow frames and never below the floor', () => {
    const q = new AutoQuality();
    let changes = 0;
    for (let i = 0; i < 40; i += 1) if (q.update(1, stats(40))) changes += 1;
    expect(q.scale).toBe(0.6);
    expect(changes).toBe(4);
  });

  it('steps back up only after several calm samples', () => {
    const q = new AutoQuality();
    q.scale = 0.8;
    let changed = false;
    for (let i = 0; i < 3; i += 1) changed = q.update(3, stats(8)) || changed;
    expect(changed).toBe(false);
    expect(q.scale).toBe(0.8);
    for (let i = 0; i < 2; i += 1) q.update(3, stats(8));
    expect(q.scale).toBeCloseTo(0.9, 5);
  });

  it('ignores windows with too few samples', () => {
    const q = new AutoQuality();
    expect(q.update(10, { medianMs: 50, worstMs: 90, fps: 20, samples: 10 })).toBe(false);
    expect(q.scale).toBe(1);
  });
});
