import { DISTRICT_LEVEL } from '@/game/level/districtLevel';
import { createNewRun } from '@/game/sim/runState';
import { Simulation } from '@/game/sim/Simulation';
import type { RunState, Vec2 } from '@/game/sim/types';
import { World } from '@/game/sim/World';
import { ScriptedInput } from './scriptedInput';

export const STEP = 1 / 60;

export interface Headless {
  world: World;
  sim: Simulation;
  input: ScriptedInput;
  events: string[];
}

export function createHeadless(state?: RunState, options: { killThreats?: boolean } = {}): Headless {
  const run = state ?? createNewRun(DISTRICT_LEVEL, 'standard', 1234);
  if (options.killThreats) for (const threat of Object.values(run.threats)) threat.alive = false;
  const world = new World(DISTRICT_LEVEL, run);
  const sim = new Simulation(world);
  const input = new ScriptedInput();
  const events: string[] = [];
  const record = (name: string) => world.events.on(name as never, (payload: unknown) => events.push(`${name}:${summarise(payload)}`));
  for (const name of ['objective', 'checkpoint', 'pickup', 'door', 'document', 'message', 'saveRequest', 'ending', 'playerDied', 'playerHurt', 'threatHit'])
    record(name);
  return { world, sim, input, events };
}

function summarise(payload: unknown): string {
  if (payload === undefined || payload === null) return '';
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    return String(record['id'] ?? record['label'] ?? record['text'] ?? '');
  }
  return String(payload);
}

export function stepOnce(h: Headless): void {
  h.input.beginStep();
  h.sim.step(h.input, STEP);
}

export function stepFor(h: Headless, seconds: number): void {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepOnce(h);
}

/** Faces the camera towards a point (the interaction check uses the look yaw). */
export function faceTowards(h: Headless, target: Vec2): void {
  const p = h.world.player;
  h.world.look.yaw = Math.atan2(target.x - p.x, target.z - p.z);
}

/** Walks the player to a target using the nav grid; returns true when within `tolerance`. */
export function walkTo(h: Headless, target: Vec2, maxSeconds = 60, tolerance = 0.6): boolean {
  const { world, input } = h;
  let path: Vec2[] | null = null;
  let repath = 0;
  let index = 0;
  const steps = Math.ceil(maxSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const p = world.player;
    const distance = Math.hypot(target.x - p.x, target.z - p.z);
    if (distance <= tolerance) {
      input.move = { x: 0, y: 0 };
      stepOnce(h);
      return true;
    }
    repath -= STEP;
    if (!path || repath <= 0) {
      repath = 0.5;
      const from = { x: p.x, z: p.z };
      const raw = world.nav.lineFree(from, target) ? [target] : world.nav.findPath(from, target);
      path = raw ? world.nav.smooth(raw, from) : null;
      index = 0;
      if (!path) return false;
    }
    let next = path[index];
    while (next && Math.hypot(next.x - p.x, next.z - p.z) < 0.4 && index < path.length - 1) {
      index += 1;
      next = path[index];
    }
    if (!next) return false;
    const dx = next.x - p.x;
    const dz = next.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    // Camera at yaw 0 faces +Z, so screen-right is -X: Move.x must be negated to travel +X.
    world.look.yaw = 0;
    input.move = { x: -dx / len, y: dz / len };
    stepOnce(h);
  }
  input.move = { x: 0, y: 0 };
  return false;
}

/** Walks to a point, faces it and presses Interact. */
export function walkAndInteract(h: Headless, target: Vec2, maxSeconds = 60): boolean {
  if (!walkTo(h, target, maxSeconds, 0.7)) {
    const p = h.world.player;
    throw new Error(`walkTo failed: player at (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) target (${target.x}, ${target.z})`);
  }
  faceTowards(h, target);
  stepOnce(h);
  if (!h.sim.prompt) {
    const p = h.world.player;
    throw new Error(`no interaction prompt at (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) for target (${target.x}, ${target.z})`);
  }
  h.input.press('Interact');
  stepOnce(h);
  stepOnce(h);
  return true;
}
