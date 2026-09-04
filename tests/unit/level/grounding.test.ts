import { describe, expect, it } from 'vitest';
import { SPAWN } from '@/config/gameplay';
import { box, prop, surface } from '@/game/level/builders';
import { DISTRICT_GROUNDING, DISTRICT_LEVEL } from '@/game/level/districtLevel';
import { groundLevel, surfaceBelow } from '@/game/level/grounding';
import type { LevelData } from '@/game/level/types';

function level(partial: Partial<LevelData>): LevelData {
  return {
    id: 'test',
    name: 'test',
    bounds: { minX: -10, minZ: -10, maxX: 10, maxZ: 10 },
    models: [],
    playerStart: { x: 0, z: 0, yaw: 0 },
    lookStart: { yaw: 0, pitch: 0 },
    blocks: [],
    surfaces: [surface(-10, -10, 10, 10, 'concrete', -0.02)],
    lights: [],
    doors: [],
    pickups: [],
    documents: [],
    interactables: [],
    zones: [],
    threats: [],
    objectives: [],
    decals: [],
    mapLabels: [],
    ...partial,
  };
}

describe('spawn grounding', () => {
  it('finds the highest surface or block top under a point, honouring rotation and probe height', () => {
    const car = prop('car', 0, 0, 2, 4, 1.4, 'car', Math.PI / 2);
    const data = level({ blocks: [car] });
    expect(surfaceBelow(data, data.blocks, 0, 0, 3)).toBeCloseTo(1.4, 6);
    expect(surfaceBelow(data, data.blocks, 1.5, 0, 3)).toBeCloseTo(1.4, 6); // rotated: long side along X
    expect(surfaceBelow(data, data.blocks, 0, 1.5, 3)).toBeCloseTo(-0.02, 6);
    expect(surfaceBelow(data, data.blocks, 0, 0, 1)).toBeCloseTo(-0.02, 6); // probe below the roof ignores it
    expect(surfaceBelow(data, data.blocks, 50, 50, 3)).toBeNull();
  });

  it('drops props and pickups onto the surface below and stacks on already-grounded props', () => {
    const crate = prop('crate', 2, 2, 1, 1, 0.8, 'wood', 0, { y: 0 });
    const data = level({
      blocks: [crate],
      pickups: [
        { id: 'on_crate', x: 2, z: 2, y: 1.5, kind: 'ammo', amount: 1, label: 'a' },
        { id: 'on_floor', x: -2, z: -2, y: 1.0, kind: 'medkit', amount: 1, label: 'b' },
      ],
    });
    const { level: grounded, report } = groundLevel(data);
    expect(grounded.blocks[0]?.y).toBeCloseTo(-0.02, 6);
    expect(grounded.pickups.find((p) => p.id === 'on_crate')?.y).toBeCloseTo(-0.02 + 0.8 + SPAWN.pickupLift, 6);
    expect(grounded.pickups.find((p) => p.id === 'on_floor')?.y).toBeCloseTo(-0.02 + SPAWN.pickupLift, 6);
    expect(report.skipped).toEqual([]);
    expect(report.rays.every((r) => r.placed)).toBe(true);
    expect(grounded.spawnRays).toHaveLength(3);
  });

  it('skips a spawn with no surface within the maximum drop and keeps elevated props', () => {
    const arm = prop('arm', 0, 0, 2, 0.2, 0.1, 'barrier', 0, { y: 0.9, elevated: true });
    const floating = prop('debris', 0, 0, 1, 1, 0.5, 'concrete', 0, { y: SPAWN.maxDrop + 2 });
    const data = level({
      blocks: [arm, floating],
      surfaces: [surface(-1, -1, 1, 1, 'concrete', 0)],
      pickups: [{ id: 'off_world', x: 5, z: 5, y: 1, kind: 'ammo', amount: 1, label: 'c' }],
    });
    const { level: grounded, report } = groundLevel(data);
    expect(grounded.blocks.map((b) => b.id)).toEqual([arm.id]);
    expect(grounded.blocks[0]?.y).toBe(0.9);
    expect(grounded.pickups).toEqual([]);
    expect(report.skipped).toEqual([floating.id, 'off_world']);
    expect(report.rays.filter((r) => !r.placed)).toHaveLength(2);
  });

  it('does not treat invisible blockers or buildings above the probe as ground', () => {
    const blocker = box('blocker', -1, -1, 1, 1, 3, 'concrete', { invisible: true });
    const data = level({ blocks: [blocker], pickups: [{ id: 'p', x: 0, z: 0, y: 1, kind: 'ammo', amount: 1, label: 'd' }] });
    expect(groundLevel(data).level.pickups[0]?.y).toBeCloseTo(-0.02 + SPAWN.pickupLift, 6);
  });

  it('grounds the whole district: nothing skipped, every pickup and loose document rests on a surface', () => {
    expect(DISTRICT_GROUNDING.skipped).toEqual([]);
    for (const ray of DISTRICT_GROUNDING.rays) expect(ray.placed, ray.id).toBe(true);
    const byId = (id: string) => DISTRICT_LEVEL.pickups.find((p) => p.id === id)!;
    const topOf = (prefix: string, x: number, z: number) => {
      const block = DISTRICT_LEVEL.blocks.find((b) => b.id.startsWith(prefix) && Math.abs(b.x - x) < 0.01 && Math.abs(b.z - z) < 0.01)!;
      return (block.y ?? 0) + block.h;
    };
    expect(byId('pk_flashlight').y).toBeCloseTo(topOf('bag', 9.4, 12.8) + SPAWN.pickupLift, 6); // on the bag, not floating at 0.9
    expect(byId('pk_medkit_pharmacy').y).toBeCloseTo(topOf('shelf', 35, 35.2) + SPAWN.pickupLift, 6); // shelf top
    expect(byId('pk_ammo_pharmacy').y).toBeCloseTo(topOf('counter', 41.5, 40.4) + SPAWN.pickupLift, 6); // counter top
    expect(DISTRICT_LEVEL.interactables.find((i) => i.id === 'it_radio')?.y).toBeCloseTo(topOf('desk', 47.8, 42.2) + SPAWN.radioLift, 6); // desk
    expect(DISTRICT_LEVEL.documents.find((d) => d.id === 'doc_transcript')?.y).toBeCloseTo(topOf('ledge', 70.6, 34.15) + SPAWN.documentLift, 6); // booth ledge
    expect(DISTRICT_LEVEL.blocks.some((b) => b.id.startsWith('papers'))).toBe(false);
    expect(DISTRICT_LEVEL.blocks.find((b) => b.id.startsWith('barrier_arm'))?.y).toBe(0.9);
    expect(DISTRICT_LEVEL.blocks.some((b) => b.id.startsWith('post'))).toBe(true);
  });
});
