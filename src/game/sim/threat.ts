import { PLAYER, THREAT } from '@/config/gameplay';
import { dampAngle, length2, wrapAngle } from '@/core/math';
import type { NavProvider } from '@/game/nav/NavProvider';
import type { ThreatRuntime } from './entities';
import { damagePlayer } from './player';
import { perceive } from './threatSenses';
import { enterState } from './threatState';
import { LOCOMOTION_STATES, type Vec2 } from './types';
import type { World } from './World';

export { onNoise } from './threatSenses';

const scratch: Vec2 = { x: 0, z: 0 };
const WAYPOINT_REACH = 0.45;
const VOCAL_INTERVAL_MIN = 4;
const VOCAL_INTERVAL_MAX = 11;
const DEATH_SETTLE = 1.4;
/** Seconds of recovery after the attack lands before the enemy moves again. */
const ATTACK_RECOVER = 0.6;
/** Metres the crowd agent may drift from the resolved simulation position before it is re-synced. */
const CROWD_RESYNC_DISTANCE = 0.06;
const STAGGER_PUSH = 2.4;

export function updateThreats(world: World, dt: number): void {
  world.navigation?.update(dt);
  for (const threat of world.threats) {
    threat.prevX = threat.x;
    threat.prevZ = threat.z;
    if (!threat.alive) {
      // Dead: the corpse settles and nothing else runs (the agent was removed when the hit landed).
      threat.deathTimer = Math.min(DEATH_SETTLE, threat.deathTimer + dt);
      threat.moving = false;
      continue;
    }
    threat.attackCooldown = Math.max(0, threat.attackCooldown - dt);
    perceive(world, threat, dt);
    switch (threat.state) {
      case 'idle':
        updateIdle(world, threat, dt);
        break;
      case 'wander':
        updateWander(world, threat, dt);
        break;
      case 'investigate':
        updateInvestigate(world, threat, dt);
        break;
      case 'chase':
        updateChase(world, threat, dt);
        break;
      case 'attack':
        updateAttack(world, threat, dt);
        break;
      case 'hitReact':
      case 'stagger':
      case 'knockdown':
        updateReaction(world, threat, dt);
        break;
      default:
        break;
    }
    syncAgent(world, threat);
    integrate(world, threat, dt);
    vocalise(world, threat, dt);
  }
}

function updateIdle(world: World, threat: ThreatRuntime, dt: number): void {
  threat.velX = 0;
  threat.velZ = 0;
  threat.moving = false;
  threat.wanderTimer -= dt;
  if (threat.wanders && threat.wanderTimer <= 0) {
    const angle = world.rng() * Math.PI * 2;
    const radius = THREAT.wanderRadius * (0.4 + world.rng() * 0.6);
    threat.target.x = threat.home.x + Math.sin(angle) * radius;
    threat.target.z = threat.home.z + Math.cos(angle) * radius;
    enterState(world, threat, 'wander');
  }
}

function updateWander(world: World, threat: ThreatRuntime, dt: number): void {
  if (moveAlongPath(world, threat, threat.target, Math.min(THREAT.wanderSpeed, threat.walkSpeed), dt)) {
    threat.wanderTimer = THREAT.wanderPause * (0.6 + world.rng());
    enterState(world, threat, 'idle');
  }
  threat.stateTimer += dt;
  if (threat.stateTimer > 12) enterState(world, threat, 'idle');
}

function updateInvestigate(world: World, threat: ThreatRuntime, dt: number): void {
  threat.stateTimer += dt;
  const arrived = moveAlongPath(world, threat, threat.target, Math.min(THREAT.investigateSpeed, threat.runSpeed), dt);
  if (arrived || threat.stateTimer > THREAT.investigateTimeout) {
    threat.wanderTimer = THREAT.wanderPause;
    threat.awareness = Math.min(threat.awareness, 0.3);
    enterState(world, threat, 'idle');
  }
}

function updateChase(world: World, threat: ThreatRuntime, dt: number): void {
  const p = world.player;
  const target = threat.timeSinceSeen < THREAT.memoryOfPlayer ? { x: p.x, z: p.z } : threat.lastSeenPlayer;
  if (!target || threat.timeSinceSeen > THREAT.loseTargetAfter || p.dead) {
    threat.awareness = 0.3;
    if (threat.lastSeenPlayer) {
      threat.target.x = threat.lastSeenPlayer.x;
      threat.target.z = threat.lastSeenPlayer.z;
    }
    enterState(world, threat, 'investigate');
    return;
  }
  const distance = length2(p.x - threat.x, p.z - threat.z);
  if (distance <= THREAT.attackReach && threat.timeSinceSeen < 0.5) {
    if (threat.attackCooldown <= 0) enterState(world, threat, 'attack');
    else {
      // Waiting out the cooldown at arm's length: face the player, do not shove into them.
      threat.velX = 0;
      threat.velZ = 0;
      threat.moving = false;
      threat.yaw = dampAngle(threat.yaw, Math.atan2(p.x - threat.x, p.z - threat.z), 10, dt);
      world.navigation?.clearTarget(threat.id);
      threat.navGoal = null;
    }
    return;
  }
  moveAlongPath(world, threat, target, threat.runSpeed, dt);
}

function updateAttack(world: World, threat: ThreatRuntime, dt: number): void {
  const p = world.player;
  const stats = threat.stats;
  threat.velX = 0;
  threat.velZ = 0;
  threat.moving = false;
  threat.stateTimer += dt;
  threat.yaw = dampAngle(threat.yaw, Math.atan2(p.x - threat.x, p.z - threat.z), 10, dt);
  if (!threat.attackLanded && threat.stateTimer >= stats.attackWindup) {
    threat.attackLanded = true;
    const distance = length2(p.x - threat.x, p.z - threat.z);
    if (distance <= THREAT.attackReach * 1.15) damagePlayer(world, stats.damage, threat.x, threat.z);
  }
  if (threat.stateTimer >= stats.attackWindup + ATTACK_RECOVER) {
    threat.awareness = 1;
    enterState(world, threat, 'chase');
  }
}

/**
 * Hit-react holds still, stagger drifts back along the hit and knockdown lies down, signals the
 * rise and gets up slower. All three keep the crowd agent paused; chase resumes from the body.
 */
function updateReaction(world: World, threat: ThreatRuntime, dt: number): void {
  const stats = threat.stats;
  threat.reactionTimer -= dt;
  threat.moving = false;
  if (threat.state === 'stagger') {
    const push = Math.max(0, threat.reactionTimer / stats.staggerDuration) * STAGGER_PUSH;
    threat.velX = threat.staggerDirX * push;
    threat.velZ = threat.staggerDirZ * push;
  } else {
    threat.velX = 0;
    threat.velZ = 0;
  }
  if (threat.state === 'knockdown' && !threat.riseSignalled && threat.reactionTimer <= stats.knockdownRise) {
    threat.riseSignalled = true;
    world.events.emit('threatRise', { id: threat.id });
  }
  if (threat.reactionTimer > 0) return;
  if (threat.state === 'knockdown') threat.risen = true;
  threat.awareness = 1;
  enterState(world, threat, 'chase');
}

/** Follows a path towards `goal`; returns true when arrived. Uses the crowd when attached, the grid A* otherwise. */
function moveAlongPath(world: World, threat: ThreatRuntime, goal: Vec2, speed: number, dt: number): boolean {
  const distanceToGoal = length2(goal.x - threat.x, goal.z - threat.z);
  if (distanceToGoal < WAYPOINT_REACH) {
    threat.velX = 0;
    threat.velZ = 0;
    threat.moving = false;
    world.navigation?.clearTarget(threat.id);
    threat.navGoal = null;
    return true;
  }
  if (world.navigation) return moveWithCrowd(world, threat, goal, speed, dt);
  threat.repathTimer -= dt;
  if (!threat.path || threat.repathTimer <= 0) {
    threat.repathTimer = THREAT.repathInterval;
    const direct = world.nav.lineFree({ x: threat.x, z: threat.z }, goal);
    const raw = direct ? [goal] : world.nav.findPath({ x: threat.x, z: threat.z }, goal);
    threat.path = raw ? world.nav.smooth(raw, { x: threat.x, z: threat.z }) : null;
    threat.pathIndex = 0;
  }
  let next = threat.path ? threat.path[threat.pathIndex] : null;
  if (!next) {
    threat.velX = 0;
    threat.velZ = 0;
    threat.moving = false;
    return distanceToGoal < WAYPOINT_REACH * 2;
  }
  while (next && length2(next.x - threat.x, next.z - threat.z) < WAYPOINT_REACH && threat.path) {
    threat.pathIndex += 1;
    next = threat.path[threat.pathIndex] ?? null;
  }
  if (!next) return true;
  const dx = next.x - threat.x;
  const dz = next.z - threat.z;
  const len = length2(dx, dz) || 1;
  threat.velX = (dx / len) * speed;
  threat.velZ = (dz / len) * speed;
  threat.moving = true;
  threat.yaw = dampAngle(threat.yaw, Math.atan2(dx, dz), 8, dt);
  return false;
}

/**
 * Crowd steering: the agent owns the path and local avoidance; the simulation reads its velocity
 * and position back each step and re-syncs the agent whenever collision resolution moved it.
 */
function moveWithCrowd(world: World, threat: ThreatRuntime, goal: Vec2, speed: number, dt: number): boolean {
  const nav = world.navigation as NavProvider;
  threat.repathTimer -= dt;
  const goalMoved = !threat.navGoal || length2(threat.navGoal.x - goal.x, threat.navGoal.z - goal.z) > WAYPOINT_REACH;
  if (threat.repathTimer <= 0 || goalMoved) {
    threat.repathTimer = THREAT.repathInterval;
    threat.navGoal = { x: goal.x, z: goal.z };
    nav.setTarget(threat.id, goal, speed);
  }
  const velocity = nav.agentVelocity(threat.id);
  threat.velX = velocity.x;
  threat.velZ = velocity.z;
  const moving = length2(velocity.x, velocity.z) > 0.05;
  threat.moving = moving;
  if (moving) threat.yaw = dampAngle(threat.yaw, Math.atan2(velocity.x, velocity.z), 8, dt);
  return false;
}

/**
 * The crowd agent steers only in locomotion states. Everywhere else it is paused and glued to the
 * body every step, so when locomotion resumes the agent is already where the mesh is: no snap.
 */
function syncAgent(world: World, threat: ThreatRuntime): void {
  const nav = world.navigation;
  if (!nav) return;
  const wantsAgent = LOCOMOTION_STATES.has(threat.state);
  if (wantsAgent && !threat.agentActive) {
    nav.teleport(threat.id, threat.x, threat.z);
    nav.setAgentPaused(threat.id, false);
    threat.agentActive = true;
    threat.repathTimer = 0;
    threat.navGoal = null;
  } else if (!wantsAgent && threat.agentActive) {
    nav.setAgentPaused(threat.id, true);
    threat.agentActive = false;
    threat.navGoal = null;
  }
}

function integrate(world: World, threat: ThreatRuntime, dt: number): void {
  const nav = world.navigation;
  const crowdPosition = nav && threat.agentActive ? nav.agentPosition(threat.id) : null;
  if (crowdPosition) {
    scratch.x = crowdPosition.x;
    scratch.z = crowdPosition.z;
  } else {
    scratch.x = threat.x + threat.velX * dt;
    scratch.z = threat.z + threat.velZ * dt;
  }
  // Keep threats apart and out of the player's capsule.
  for (const other of world.threats) {
    if (other === threat || !other.alive) continue;
    separate(scratch, other.x, other.z, THREAT.separation);
  }
  const p = world.player;
  if (!p.dead) separate(scratch, p.x, p.z, THREAT.radius + PLAYER.radius);
  world.resolveCircle(scratch, threat.radius);
  threat.x = scratch.x;
  threat.z = scratch.z;
  if (!nav) return;
  if (!threat.agentActive) {
    // Paused: the agent follows the body so other agents avoid the real position.
    nav.teleport(threat.id, threat.x, threat.z);
    return;
  }
  const agent = nav.agentPosition(threat.id);
  if (agent && length2(agent.x - threat.x, agent.z - threat.z) > CROWD_RESYNC_DISTANCE) {
    nav.teleport(threat.id, threat.x, threat.z);
    if (threat.navGoal) nav.setTarget(threat.id, threat.navGoal, length2(threat.velX, threat.velZ) || threat.runSpeed);
  }
}

function separate(pos: Vec2, ox: number, oz: number, minDistance: number): void {
  const dx = pos.x - ox;
  const dz = pos.z - oz;
  const distance = length2(dx, dz);
  if (distance >= minDistance || distance < 1e-5) return;
  const push = (minDistance - distance) / distance;
  pos.x += dx * push;
  pos.z += dz * push;
}

function vocalise(world: World, threat: ThreatRuntime, dt: number): void {
  threat.vocalTimer -= dt;
  if (threat.vocalTimer > 0) return;
  threat.vocalTimer = VOCAL_INTERVAL_MIN + world.rng() * (VOCAL_INTERVAL_MAX - VOCAL_INTERVAL_MIN);
  if (threat.state === 'attack' || threat.state === 'knockdown') return;
  world.events.emit('threatVocal', { id: threat.id, x: threat.x, z: threat.z, kind: 'idle' });
}

/** Facing angle helper for the renderer. */
export function threatFacing(threat: ThreatRuntime): number {
  return wrapAngle(threat.yaw);
}
