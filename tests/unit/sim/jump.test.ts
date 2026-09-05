import { describe, expect, it } from 'vitest';
import { PLAYER } from '@/config/gameplay';
import { DISTRICT_LEVEL } from '@/game/level/districtLevel';
import type { LevelData } from '@/game/level/types';
import { createNewRun } from '@/game/sim/runState';
import { Simulation } from '@/game/sim/Simulation';
import { World } from '@/game/sim/World';
import { ScriptedInput } from '../../helpers/scriptedInput';

const STEP = 1 / 60;

/** A flat test yard: a waist-high vaultable barrier ahead (+Z) and a tall wall behind (-Z). */
const YARD: LevelData = {
  ...DISTRICT_LEVEL,
  id: 'yard',
  name: 'Yard',
  bounds: { minX: -12, minZ: -12, maxX: 12, maxZ: 12 },
  playerStart: { x: 0, z: 0, yaw: 0 },
  lookStart: { yaw: 0, pitch: 0 },
  blocks: [
    { id: 'barrier', x: 0, z: 3, w: 3, d: 0.5, h: 0.9, material: 'barrier', lowObstacle: true, vaultable: true },
    { id: 'wall', x: 0, z: -3, w: 4, d: 0.6, h: 2.5, material: 'concrete' },
    { id: 'deep', x: 6, z: 3, w: 3, d: 3, h: 0.9, material: 'concrete', lowObstacle: true, vaultable: true },
  ],
  surfaces: [],
  lights: [],
  doors: [],
  pickups: [],
  documents: [],
  interactables: [],
  zones: [],
  threats: [],
  decals: [],
  models: [],
  mapLabels: [],
  spawnRays: [],
};

function yard() {
  const world = new World(YARD, createNewRun(YARD, 'standard', 3));
  const sim = new Simulation(world);
  const input = new ScriptedInput();
  const events: string[] = [];
  for (const name of ['jump', 'land', 'vault'] as const) world.events.on(name, () => events.push(name));
  const step = () => {
    input.beginStep();
    sim.step(input, STEP);
  };
  const run = (seconds: number) => {
    for (let i = 0; i < Math.ceil(seconds / STEP); i += 1) step();
  };
  return { world, sim, input, events, step, run };
}

describe('jump', () => {
  it('a grounded press hops and lands within the expected air time, emitting jump and land', () => {
    const y = yard();
    const p = y.world.player;
    y.input.press('Jump');
    y.step();
    expect(p.jumpState).toBe('air');
    expect(p.velY).toBeCloseTo(PLAYER.jumpSpeed - PLAYER.gravity * STEP, 6);
    let peak = 0;
    let airTime = 0;
    while (p.jumpState === 'air' && airTime < 3) {
      y.step();
      airTime += STEP;
      peak = Math.max(peak, p.y);
    }
    const expectedAir = (2 * PLAYER.jumpSpeed) / PLAYER.gravity;
    expect(airTime).toBeGreaterThan(expectedAir * 0.8);
    expect(airTime).toBeLessThan(expectedAir * 1.3);
    expect(peak).toBeGreaterThan(0.3);
    expect(p.y).toBe(0);
    expect(p.jumpState).toBe('grounded');
    expect(y.events).toEqual(['jump', 'land']);
  });

  it('refuses to jump while aiming or reloading, and a mid-air press does nothing', () => {
    const y = yard();
    const p = y.world.player;
    y.input.hold('Aim', true);
    y.run(0.3);
    y.input.press('Jump');
    y.step();
    expect(p.jumpState).toBe('grounded');
    y.input.hold('Aim', false);
    y.run(0.3);
    p.ammoLoaded = 2;
    p.ammoReserve = 6;
    y.input.press('Reload');
    y.step();
    expect(p.reloadTimer).toBeGreaterThan(0);
    y.input.press('Jump');
    y.step();
    expect(p.jumpState).toBe('grounded');
    y.run(2);
    y.input.press('Jump');
    y.step();
    expect(p.jumpState).toBe('air');
    const velY = p.velY;
    y.input.press('Jump');
    y.step();
    expect(p.velY).toBeLessThan(velY); // gravity only, no second impulse
    expect(y.events.filter((e) => e === 'jump')).toHaveLength(1);
  });

  it('gives interact priority over jump when a prompt shows and both arrive on one press', () => {
    const y = yard();
    // A prompt from the previous step (the simulation derives the flag from it).
    const doc = DISTRICT_LEVEL.documents[0];
    if (!doc) throw new Error('level has no documents');
    y.sim.prompt = { target: { kind: 'document', def: doc, verb: 'Read' }, label: doc.title };
    y.input.press('Jump');
    y.input.press('Interact');
    y.input.beginStep();
    y.sim.step(y.input, STEP);
    expect(y.world.player.jumpState).toBe('grounded');
    y.step(); // release both
    y.input.press('Jump');
    y.input.press('Interact');
    y.input.beginStep();
    y.sim.step(y.input, STEP);
    // Without a prompt the simulation resets the flag itself, so the same double press jumps.
    expect(y.world.player.jumpState).toBe('air');
  });

  it('save state is unaffected by being mid-air', () => {
    const y = yard();
    y.input.press('Jump');
    y.run(0.15);
    expect(y.world.player.y).toBeGreaterThan(0);
    const saved = y.world.toRunState();
    expect('y' in saved.player).toBe(false);
    const reloaded = new World(YARD, saved);
    expect(reloaded.player.y).toBe(0);
    expect(reloaded.player.jumpState).toBe('grounded');
  });
});

describe('vault', () => {
  it('a press while walking into a waist-high vaultable barrier climbs over it and lands past it', () => {
    const y = yard();
    const p = y.world.player;
    y.input.move = { x: 0, y: 1 }; // toward +Z at yaw 0
    y.run(0.8);
    expect(p.z).toBeGreaterThan(1.5);
    const before = p.z;
    y.input.press('Jump');
    y.step();
    expect(p.jumpState).toBe('vault');
    expect(y.events).toContain('vault');
    let peak = 0;
    let time = 0;
    while (p.jumpState === 'vault' && time < 3) {
      y.step();
      time += STEP;
      peak = Math.max(peak, p.y);
    }
    expect(time).toBeLessThan(PLAYER.vaultDuration + 0.1);
    expect(peak).toBeGreaterThan(0.9); // clears the barrier top
    expect(p.z).toBeGreaterThan(3.25 + p.radius); // past the barrier's far face
    expect(p.z).toBeGreaterThan(before);
    expect(p.y).toBe(0);
    expect(y.events.at(-1)).toBe('land');
  });

  it('will not vault a tall wall or a collider deeper than the vault reach', () => {
    const y = yard();
    const p = y.world.player;
    y.world.look.yaw = Math.PI; // face -Z toward the tall wall
    y.input.move = { x: 0, y: 1 };
    y.run(0.8);
    y.input.press('Jump');
    y.step();
    expect(p.jumpState).toBe('air'); // plain jump, never a vault
    const deep = yard();
    deep.world.player.x = 6;
    deep.world.player.prevX = 6;
    deep.input.move = { x: 0, y: 1 };
    deep.run(0.5);
    deep.input.press('Jump');
    deep.step();
    expect(deep.world.player.jumpState).toBe('air');
    expect(deep.events).not.toContain('vault');
  });
});
