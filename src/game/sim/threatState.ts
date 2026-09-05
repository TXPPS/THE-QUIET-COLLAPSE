import type { ThreatRuntime } from './entities';
import type { HitReaction, ThreatAiState } from './types';
import type { World } from './World';

export interface DamageOptions {
  headshot?: boolean;
  /** A shove: always at least a stagger, pushes along the given direction. */
  melee?: boolean;
  dirX?: number;
  dirZ?: number;
}

export interface DamageResult {
  killed: boolean;
  reaction: HitReaction;
}

/** Every state transition goes through here so timers, paths and events stay consistent. */
export function enterState(world: World, threat: ThreatRuntime, state: ThreatAiState): void {
  if (threat.state === state) return;
  const previous = threat.state;
  threat.state = state;
  threat.stateTimer = 0;
  threat.path = null;
  threat.repathTimer = 0;
  if (state === 'chase' && previous !== 'attack' && !isReaction(previous)) {
    world.events.emit('threatAlert', { id: threat.id });
    world.events.emit('threatVocal', { id: threat.id, x: threat.x, z: threat.z, kind: 'alert' });
  }
  if (state === 'attack') {
    threat.attackLanded = false;
    threat.attackCooldown = threat.stats.attackCooldown;
    world.events.emit('threatAttack', { id: threat.id });
    world.events.emit('threatVocal', { id: threat.id, x: threat.x, z: threat.z, kind: 'attack' });
  }
}

export function isReaction(state: ThreatAiState): boolean {
  return state === 'hitReact' || state === 'stagger' || state === 'knockdown';
}

/**
 * Applies damage and picks the reaction: a light hit only flinches the upper body (no position
 * change), a hit at or above the stagger threshold staggers (brief, interruptible), heavy damage
 * knocks the enemy down once per life, and a lethal hit kills on the spot: the crowd agent is
 * removed in the same call, so nothing steers the corpse afterwards.
 */
export function damageThreat(world: World, threat: ThreatRuntime, amount: number, options: DamageOptions = {}): DamageResult {
  if (!threat.alive) return { killed: false, reaction: 'dead' };
  threat.health -= amount;
  threat.awareness = 1;
  threat.lastSeenPlayer = { x: world.player.x, z: world.player.z };
  threat.timeSinceSeen = 0;
  let reaction: HitReaction;
  if (threat.health <= 0) {
    killThreat(world, threat);
    reaction = 'dead';
  } else {
    reaction = pickReaction(threat, amount, options);
    if (reaction === 'knockdown' || reaction === 'stagger' || reaction === 'hitReact') startReaction(world, threat, reaction, options);
  }
  world.events.emit('threatHit', { id: threat.id, x: threat.x, z: threat.z, killed: reaction === 'dead', reaction, headshot: options.headshot ?? false });
  world.events.emit('threatVocal', { id: threat.id, x: threat.x, z: threat.z, kind: reaction === 'dead' ? 'death' : 'hurt' });
  return { killed: reaction === 'dead', reaction };
}

function pickReaction(threat: ThreatRuntime, amount: number, options: DamageOptions): HitReaction {
  const stats = threat.stats;
  if (threat.state === 'knockdown') return 'knockdown';
  if (!threat.knockedDown && amount >= stats.knockdownThreshold) return 'knockdown';
  if (options.melee || amount >= stats.staggerThreshold) return 'stagger';
  return threat.state === 'stagger' ? 'stagger' : 'hitReact';
}

function startReaction(world: World, threat: ThreatRuntime, reaction: 'hitReact' | 'stagger' | 'knockdown', options: DamageOptions): void {
  const stats = threat.stats;
  if (reaction === 'knockdown' && threat.state === 'knockdown') return; // already down: stays down
  threat.velX = 0;
  threat.velZ = 0;
  threat.moving = false;
  threat.navGoal = null;
  if (reaction === 'hitReact') {
    threat.reactionTimer = stats.hitReactDuration;
  } else if (reaction === 'stagger') {
    const len = Math.hypot(options.dirX ?? 0, options.dirZ ?? 0);
    threat.staggerDirX = len > 1e-6 ? (options.dirX ?? 0) / len : 0;
    threat.staggerDirZ = len > 1e-6 ? (options.dirZ ?? 0) / len : 0;
    threat.reactionTimer = stats.staggerDuration;
  } else {
    threat.knockedDown = true;
    threat.riseSignalled = false;
    threat.reactionTimer = stats.knockdownFall + stats.knockdownDown + stats.knockdownRise;
  }
  enterState(world, threat, reaction);
  threat.stateTimer = 0;
}

/** Dead this frame: no re-rise, no steering, the corpse mesh stays where the body was. */
export function killThreat(world: World, threat: ThreatRuntime): void {
  threat.alive = false;
  threat.health = Math.min(threat.health, 0);
  threat.state = 'dead';
  threat.deathTimer = 0;
  threat.velX = 0;
  threat.velZ = 0;
  threat.moving = false;
  threat.navGoal = null;
  threat.path = null;
  if (threat.agentActive || world.navigation) world.navigation?.removeAgent(threat.id);
  threat.agentActive = false;
}
