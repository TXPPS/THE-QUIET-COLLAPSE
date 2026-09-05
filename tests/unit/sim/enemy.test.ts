import { describe, expect, it } from 'vitest';
import { ENEMY_STATS, resolveEnemyStats } from '@/config/enemies';
import { PISTOL, THREAT } from '@/config/gameplay';
import type { NavProvider } from '@/game/nav/NavProvider';
import type { DoorDef } from '@/game/level/types';
import { fireHitscan } from '@/game/sim/combat';
import type { ThreatRuntime } from '@/game/sim/entities';
import { tryMelee } from '@/game/sim/playerActions';
import { damageThreat } from '@/game/sim/threatState';
import type { Vec2 } from '@/game/sim/types';
import { createHeadless, STEP, stepFor, stepOnce, type Headless } from '../../helpers/headless';

/** Records every crowd call so tests can assert agent lifecycle and pausing without recast. */
class FakeNav implements NavProvider {
  readonly agents = new Map<string, { x: number; z: number; paused: boolean; target: Vec2 | null; speed: number }>();
  readonly log: string[] = [];
  readonly navMesh = null;
  get agentCount(): number {
    return this.agents.size;
  }
  addAgent(id: string, x: number, z: number): void {
    this.agents.set(id, { x, z, paused: false, target: null, speed: 0 });
    this.log.push(`add:${id}`);
  }
  removeAgent(id: string): void {
    this.agents.delete(id);
    this.log.push(`remove:${id}`);
  }
  setTarget(id: string, goal: Vec2, speed: number): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.target = { ...goal };
      agent.speed = speed;
    }
  }
  clearTarget(id: string): void {
    const agent = this.agents.get(id);
    if (agent) agent.target = null;
  }
  setAgentPaused(id: string, paused: boolean): void {
    const agent = this.agents.get(id);
    if (agent) agent.paused = paused;
    this.log.push(`${paused ? 'pause' : 'resume'}:${id}`);
  }
  agentPosition(id: string): Vec2 | null {
    const agent = this.agents.get(id);
    return agent ? { x: agent.x, z: agent.z } : null;
  }
  agentVelocity(id: string): Vec2 {
    const agent = this.agents.get(id);
    if (!agent || agent.paused || !agent.target) return { x: 0, z: 0 };
    const dx = agent.target.x - agent.x;
    const dz = agent.target.z - agent.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: (dx / len) * agent.speed, z: (dz / len) * agent.speed };
  }
  teleport(id: string, x: number, z: number): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.x = x;
      agent.z = z;
    }
  }
  setDoorBlocked(_door: DoorDef, _blocked: boolean): void {}
  update(dt: number): void {
    // Agents that are steering drift toward their target; paused ones never move on their own.
    for (const agent of this.agents.values()) {
      if (agent.paused || !agent.target) continue;
      const dx = agent.target.x - agent.x;
      const dz = agent.target.z - agent.z;
      const len = Math.hypot(dx, dz) || 1;
      const step = Math.min(len, agent.speed * dt);
      agent.x += (dx / len) * step;
      agent.z += (dz / len) * step;
    }
  }
  dispose(): void {}
}

function street(h: Headless): ThreatRuntime {
  const threat = h.world.threats.find((t) => t.id === 'th_street');
  if (!threat) throw new Error('missing th_street');
  return threat;
}

/** Puts the player in the open street facing the street resident a few metres away, with the aim ray on it. */
function faceOff(h: Headless, distance = 4): ThreatRuntime {
  const { world } = h;
  const threat = street(h);
  for (const other of world.threats) if (other !== threat) other.alive = false;
  world.player.x = 20;
  world.player.z = 21;
  world.player.prevX = 20;
  world.player.prevZ = 21;
  threat.x = 20;
  threat.z = 21 + distance;
  threat.prevX = threat.x;
  threat.prevZ = threat.z;
  threat.state = 'chase';
  threat.awareness = 1;
  threat.lastSeenPlayer = { x: 20, z: 21 };
  threat.timeSinceSeen = 0;
  world.look.yaw = 0;
  world.look.pitch = 0;
  return threat;
}

/** Aims the camera ray from the player at a height on the threat's body. */
function aimAt(h: Headless, threat: ThreatRuntime, height: number): void {
  const ray = h.world.aimRay;
  const p = h.world.player;
  ray.ox = p.x;
  ray.oy = height;
  ray.oz = p.z - 0.5;
  const dx = threat.x - ray.ox;
  const dz = threat.z - ray.oz;
  const len = Math.hypot(dx, dz);
  ray.dx = dx / len;
  ray.dy = 0;
  ray.dz = dz / len;
}

function maxStepDelta(h: Headless, threat: ThreatRuntime, seconds: number): number {
  let worst = 0;
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const x = threat.x;
    const z = threat.z;
    stepOnce(h);
    worst = Math.max(worst, Math.hypot(threat.x - x, threat.z - z));
  }
  return worst;
}

describe('enemy stats and difficulty presets', () => {
  it('resolves speed, cooldown and damage per preset from the data tables', () => {
    const accessible = resolveEnemyStats('affected', 'accessible');
    const standard = resolveEnemyStats('affected', 'standard');
    const hard = resolveEnemyStats('affected', 'hard');
    expect(accessible.runSpeed).toBeCloseTo(3.4 * 0.8, 6);
    expect(standard.runSpeed).toBeCloseTo(3.4 * 0.9, 6);
    expect(hard.runSpeed).toBeCloseTo(3.4, 6);
    expect([accessible.attackCooldown, standard.attackCooldown, hard.attackCooldown]).toEqual([1.8, 1.4, 1.0]);
    expect([accessible.damage, standard.damage, hard.damage]).toEqual([20, 30, 40]);
    expect(standard.hp).toBe(ENEMY_STATS.affected.hp);
  });

  it('gives every threat the run difficulty stats and reads legacy "normal" saves as standard', () => {
    const h = createHeadless();
    const run = h.world.toRunState();
    (run as { difficulty: string }).difficulty = 'normal';
    const legacy = createHeadless(run);
    expect(legacy.world.difficulty).toBe('standard');
    expect(street(legacy).stats.damage).toBe(30);
    const hardRun = { ...h.world.toRunState(), difficulty: 'hard' as const };
    expect(street(createHeadless(hardRun)).stats.runSpeed).toBeCloseTo(3.4, 6);
  });
});

describe('enemy death', () => {
  it('lethal damage kills within the same step: dead state, agent removed, no position change afterwards', () => {
    const h = createHeadless();
    const threat = faceOff(h);
    const nav = new FakeNav();
    h.world.setNavigation(nav); // only the living street resident gets an agent
    stepFor(h, 0.5); // chasing: the agent is active
    expect(nav.agentCount).toBe(1);
    expect(threat.agentActive).toBe(true);
    threat.health = 10;
    aimAt(h, threat, 1.2);
    const before = nav.agentCount;
    const result = fireHitscan(h.world);
    expect(result.killed).toBe(true);
    expect(threat.alive).toBe(false);
    expect(threat.state).toBe('dead');
    expect(nav.agentCount).toBe(before - 1);
    expect(nav.log.filter((entry) => entry === 'remove:th_street')).toHaveLength(1);
    const x = threat.x;
    const z = threat.z;
    stepFor(h, 3);
    expect(threat.x).toBe(x);
    expect(threat.z).toBe(z);
    expect(threat.alive).toBe(false);
    expect(threat.state).toBe('dead');
    // A second lethal hit changes nothing.
    expect(damageThreat(h.world, threat, 500).reaction).toBe('dead');
    expect(nav.log.filter((entry) => entry === 'remove:th_street')).toHaveLength(1);
  });

  it('never re-rises after a save and load', () => {
    const h = createHeadless();
    const threat = faceOff(h);
    damageThreat(h.world, threat, 1000);
    const reloaded = createHeadless(h.world.toRunState());
    expect(street(reloaded).alive).toBe(false);
    expect(street(reloaded).state).toBe('dead');
    stepFor(reloaded, 2);
    expect(street(reloaded).state).toBe('dead');
  });
});

describe('enemy reactions', () => {
  it('a light hit only flinches: no position change, then pursuit resumes', () => {
    const h = createHeadless();
    const threat = faceOff(h, 6);
    stepFor(h, 0.3);
    const x = threat.x;
    const z = threat.z;
    const result = damageThreat(h.world, threat, ENEMY_STATS.affected.staggerThreshold - 1);
    expect(result.reaction).toBe('hitReact');
    expect(threat.state).toBe('hitReact');
    stepFor(h, ENEMY_STATS.affected.hitReactDuration - STEP);
    expect(threat.x).toBeCloseTo(x, 6);
    expect(threat.z).toBeCloseTo(z, 6);
    stepFor(h, 0.2);
    expect(threat.state).toBe('chase');
  });

  it('a pistol round at the chest staggers and returns to pursuit without teleporting (crowd attached)', () => {
    const h = createHeadless();
    const threat = faceOff(h, 9);
    const nav = new FakeNav();
    h.world.setNavigation(nav);
    stepFor(h, 0.5);
    expect(threat.state).toBe('chase');
    expect(threat.agentActive).toBe(true);
    aimAt(h, threat, 1.2);
    const result = fireHitscan(h.world);
    expect(result.killed).toBe(false);
    expect(result.headshot).toBe(false);
    expect(threat.state).toBe('stagger');
    stepOnce(h);
    expect(threat.agentActive).toBe(false);
    expect(nav.agents.get('th_street')?.paused).toBe(true);
    // Through the stagger and back into the chase, no step may move the body further than a fast stride.
    const worst = maxStepDelta(h, threat, ENEMY_STATS.affected.staggerDuration + 0.6);
    expect(worst).toBeLessThan(threat.runSpeed * STEP * 1.5);
    expect(threat.state).toBe('chase');
    expect(threat.agentActive).toBe(true);
    const agent = nav.agentPosition('th_street');
    expect(agent).not.toBeNull();
    expect(Math.hypot((agent?.x ?? 0) - threat.x, (agent?.z ?? 0) - threat.z)).toBeLessThan(0.1);
  });

  it('the crowd agent is paused during an attack and re-synced to the body when the chase resumes', () => {
    const h = createHeadless();
    const threat = faceOff(h, 1);
    const nav = new FakeNav();
    h.world.setNavigation(nav);
    stepFor(h, 0.2);
    expect(threat.state).toBe('attack');
    expect(nav.agents.get('th_street')?.paused).toBe(true);
    // Drag the ghost agent away as a real crowd could; the body must not follow it.
    nav.teleport('th_street', threat.x + 3, threat.z);
    const x = threat.x;
    stepOnce(h);
    expect(threat.x).toBeCloseTo(x, 3);
    // Once the attack ends and the chase resumes the agent sits on the body again.
    h.world.player.x = 20;
    h.world.player.z = 30;
    h.world.player.health = 100;
    const worst = maxStepDelta(h, threat, 1.5);
    expect(worst).toBeLessThan(threat.runSpeed * STEP * 1.5);
    expect(threat.state).toBe('chase');
    const agent = nav.agentPosition('th_street');
    expect(Math.hypot((agent?.x ?? 0) - threat.x, (agent?.z ?? 0) - threat.z)).toBeLessThan(0.1);
  });

  it('a headshot doubles damage and knocks the enemy down once; it gets up slower and never goes down again', () => {
    const h = createHeadless();
    const threat = faceOff(h, 5);
    const rises: string[] = [];
    h.world.events.on('threatRise', ({ id }) => rises.push(id));
    stepFor(h, 0.3);
    aimAt(h, threat, THREAT.height * 0.95);
    const result = fireHitscan(h.world);
    expect(result.headshot).toBe(true);
    expect(threat.health).toBe(ENEMY_STATS.affected.hp - PISTOL.damage * ENEMY_STATS.affected.headshotMultiplier);
    expect(threat.state).toBe('knockdown');
    const x = threat.x;
    const z = threat.z;
    const stats = threat.stats;
    stepFor(h, stats.knockdownFall + stats.knockdownDown + 0.1);
    expect(rises).toEqual(['th_street']);
    expect(threat.x).toBeCloseTo(x, 6);
    expect(threat.z).toBeCloseTo(z, 6);
    stepFor(h, stats.knockdownRise);
    expect(threat.state).toBe('chase');
    expect(threat.risen).toBe(true);
    expect(threat.runSpeed).toBeCloseTo(stats.runSpeed * stats.risenSpeedFactor, 6);
    // Heavy damage again: a stagger this time, never a second knockdown.
    threat.health = ENEMY_STATS.affected.hp;
    expect(damageThreat(h.world, threat, ENEMY_STATS.affected.knockdownThreshold).reaction).toBe('stagger');
  });

  it('the melee shove staggers the affected in front, costs stamina and respects its cooldown', () => {
    const h = createHeadless();
    const threat = faceOff(h, 1.2);
    stepOnce(h);
    const stamina = h.world.player.stamina;
    expect(tryMelee(h.world)).toBe(true);
    expect(threat.state).toBe('stagger');
    expect(h.world.player.stamina).toBeLessThan(stamina);
    expect(tryMelee(h.world)).toBe(false); // cooldown
    expect(h.events.some((entry) => entry.startsWith('threatHit:th_street'))).toBe(true);
  });
});
