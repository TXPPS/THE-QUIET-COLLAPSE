import { describe, expect, it } from 'vitest';
import { DISTRICT_LEVEL } from '@/game/level/districtLevel';
import { createNewRun } from '@/game/sim/runState';
import { World } from '@/game/sim/World';
import { createHeadless, stepFor, walkAndInteract } from '../../helpers/headless';

describe('save/load integrity', () => {
  it('rebuilding a world from a snapshot never duplicates entities or re-spawns taken pickups', () => {
    const h = createHeadless(undefined, { killThreats: true });
    const flashlight = DISTRICT_LEVEL.pickups.find((p) => p.id === 'pk_flashlight')!;
    expect(walkAndInteract(h, flashlight)).toBe(true);
    const snapshot = h.world.toRunState();
    for (let round = 0; round < 5; round += 1) {
      const world = new World(DISTRICT_LEVEL, snapshot);
      expect(world.threats.length).toBe(DISTRICT_LEVEL.threats.length);
      expect(new Set(world.threats.map((t) => t.id)).size).toBe(DISTRICT_LEVEL.threats.length);
      expect(world.pickupsTaken['pk_flashlight']).toBe(true);
      expect(world.player.hasFlashlight).toBe(true);
      expect(world.toRunState()).toEqual(snapshot);
    }
  });

  it('a fresh run after a death is fully reset (no carried-over state)', () => {
    const dead = createHeadless();
    dead.world.player.health = 5;
    dead.world.player.x = 58;
    dead.world.player.z = 22;
    const threat = dead.world.threats.find((t) => t.id === 'th_street')!;
    threat.state = 'chase';
    threat.awareness = 1;
    threat.lastSeenPlayer = { x: 58, z: 22 };
    threat.timeSinceSeen = 0;
    stepFor(dead, 15);
    expect(dead.world.player.dead).toBe(true);
    const fresh = new World(DISTRICT_LEVEL, createNewRun(DISTRICT_LEVEL, 'normal', 99));
    expect(fresh.player.dead).toBe(false);
    expect(fresh.player.health).toBe(100);
    expect(fresh.threats.every((t) => t.alive && t.state === 'idle')).toBe(true);
    expect(Object.keys(fresh.pickupsTaken)).toEqual([]);
    expect(fresh.objectiveIndex).toBe(0);
  });

  it('snapshots are deep copies: mutating the world after saving does not alter the save', () => {
    const h = createHeadless();
    const snapshot = h.world.toRunState();
    h.world.player.health = 1;
    h.world.flags['x'] = true;
    h.world.threats[0]!.alive = false;
    expect(snapshot.player.health).toBe(100);
    expect(snapshot.flags['x']).toBeUndefined();
    expect(Object.values(snapshot.threats).every((t) => t.alive)).toBe(true);
  });
});
