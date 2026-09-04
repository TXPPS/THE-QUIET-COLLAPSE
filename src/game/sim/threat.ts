import { PLAYER, THREAT } from '@/config/gameplay';
import { dampAngle, length2, wrapAngle } from '@/core/math';
import type { ThreatRuntime } from './entities';
import { damagePlayer } from './player';
import type { NoiseEvent, Vec2 } from './types';
import type { World } from './World';

const scratch: Vec2 = { x: 0, z: 0 };
const WAYPOINT_REACH = 0.45;
const VOCAL_INTERVAL_MIN = 4;
const VOCAL_INTERVAL_MAX = 11;
const DEATH_SETTLE = 1.4;

/** Threats react to noise: closer, louder noises pull them out of idle into investigation. */
export function onNoise(world: World, noise: NoiseEvent): void {
  for (const threat of world.threats) {
    if (!threat.alive || threat.state === 'chase' || threat.state === 'attack') continue;
    const distance = length2(noise.x - threat.x, noise.z - threat.z);
    if (distance > noise.radius * THREAT.hearingSensitivity) continue;
    const strength = 1 - distance / (noise.radius + 0.001);
    if (noise.kind === 'gunshot' || strength > 0.35 || threat.state === 'investigate') {
      threat.target.x = noise.x;
      threat.target.z = noise.z;
      threat.awareness = Math.max(threat.awareness, noise.kind === 'gunshot' ? 0.9 : 0.5);
      if (threat.state !== 'stagger') enterState(world, threat, 'investigate');
    }
  }
}

export function updateThreats(world: World, dt: number): void {
  for (const threat of world.threats) {
    threat.prevX = threat.x;
    threat.prevZ = threat.z;
    if (!threat.alive) {
      threat.deathTimer = Math.min(DEATH_SETTLE, threat.deathTimer + dt);
      threat.moving = false;
      continue;
    }
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
      case 'stagger':
        updateStagger(world, threat, dt);
        break;
      default:
        break;
    }
    integrate(world, threat, dt);
    vocalise(world, threat, dt);
  }
}

function enterState(world: World, threat: ThreatRuntime, state: ThreatRuntime['state']): void {
  if (threat.state === state) return;
  const previous = threat.state;
  threat.state = state;
  threat.stateTimer = 0;
  threat.path = null;
  threat.repathTimer = 0;
  if (state === 'chase' && previous !== 'attack') {
    world.events.emit('threatAlert', { id: threat.id });
    world.events.emit('threatVocal', { id: threat.id, x: threat.x, z: threat.z, kind: 'alert' });
  }
  if (state === 'attack') {
    threat.attackLanded = false;
    world.events.emit('threatAttack', { id: threat.id });
    world.events.emit('threatVocal', { id: threat.id, x: threat.x, z: threat.z, kind: 'attack' });
  }
}

function sightRange(world: World, threat: ThreatRuntime): number {
  const p = world.player;
  const surface = world.surfaceAt(threat.x, threat.z);
  const dark = surface !== 'asphalt';
  let range = dark ? THREAT.sightRangeDark : THREAT.sightRangeLit;
  if (p.flashlightOn) range += THREAT.sightRangeFlashlightBonus;
  if (p.sprinting) range *= 1.2;
  return range;
}

function perceive(world: World, threat: ThreatRuntime, dt: number): void {
  const p = world.player;
  threat.timeSinceSeen += dt;
  if (p.dead) {
    threat.awareness = Math.max(0, threat.awareness - dt * 0.5);
    return;
  }
  const dx = p.x - threat.x;
  const dz = p.z - threat.z;
  const distance = length2(dx, dz);
  const range = sightRange(world, threat);
  let sees = false;
  if (distance < range) {
    const facingX = Math.sin(threat.yaw);
    const facingZ = Math.cos(threat.yaw);
    const dot = (dx * facingX + dz * facingZ) / (distance || 1);
    const inCone = dot > THREAT.sightConeCos || distance < 2.2;
    if (inCone && world.hasLineOfSight(threat.x, threat.z, p.x, p.z, 1.6, 1.2)) sees = true;
  }
  if (sees) {
    const gain = distance < range * 0.5 ? 2.2 : 1.1;
    threat.awareness = Math.min(1, threat.awareness + gain * dt);
    threat.lastSeenPlayer = { x: p.x, z: p.z };
    threat.timeSinceSeen = 0;
    if (threat.awareness >= 1 && threat.state !== 'attack' && threat.state !== 'stagger') enterState(world, threat, 'chase');
    else if (threat.awareness > 0.35 && (threat.state === 'idle' || threat.state === 'wander')) {
      threat.target.x = p.x;
      threat.target.z = p.z;
      enterState(world, threat, 'investigate');
    }
  } else if (threat.state !== 'chase' && threat.state !== 'attack') {
    threat.awareness = Math.max(0, threat.awareness - dt * 0.25);
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
  if (moveAlongPath(world, threat, threat.target, THREAT.wanderSpeed, dt)) {
    threat.wanderTimer = THREAT.wanderPause * (0.6 + world.rng());
    enterState(world, threat, 'idle');
  }
  threat.stateTimer += dt;
  if (threat.stateTimer > 12) enterState(world, threat, 'idle');
}

function updateInvestigate(world: World, threat: ThreatRuntime, dt: number): void {
  threat.stateTimer += dt;
  const arrived = moveAlongPath(world, threat, threat.target, THREAT.investigateSpeed, dt);
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
    enterState(world, threat, 'attack');
    return;
  }
  moveAlongPath(world, threat, target, THREAT.chaseSpeed, dt);
}

function updateAttack(world: World, threat: ThreatRuntime, dt: number): void {
  const p = world.player;
  threat.velX = 0;
  threat.velZ = 0;
  threat.moving = false;
  threat.stateTimer += dt;
  threat.yaw = dampAngle(threat.yaw, Math.atan2(p.x - threat.x, p.z - threat.z), 10, dt);
  if (!threat.attackLanded && threat.stateTimer >= THREAT.attackWindup) {
    threat.attackLanded = true;
    const distance = length2(p.x - threat.x, p.z - threat.z);
    if (distance <= THREAT.attackReach * 1.15) damagePlayer(world, THREAT.attackDamage, threat.x, threat.z);
  }
  if (threat.stateTimer >= THREAT.attackWindup + THREAT.attackRecover) {
    threat.awareness = 1;
    enterState(world, threat, 'chase');
  }
}

function updateStagger(world: World, threat: ThreatRuntime, dt: number): void {
  threat.stateTimer += dt;
  const push = Math.max(0, 1 - threat.stateTimer / THREAT.staggerDuration) * 2.4;
  threat.velX = threat.staggerDirX * push;
  threat.velZ = threat.staggerDirZ * push;
  threat.moving = false;
  if (threat.stateTimer >= THREAT.staggerDuration) enterState(world, threat, 'chase');
}

/** Follows an A* path towards `goal`; returns true when arrived. Repaths on a timer. */
function moveAlongPath(world: World, threat: ThreatRuntime, goal: Vec2, speed: number, dt: number): boolean {
  const distanceToGoal = length2(goal.x - threat.x, goal.z - threat.z);
  if (distanceToGoal < WAYPOINT_REACH) {
    threat.velX = 0;
    threat.velZ = 0;
    threat.moving = false;
    return true;
  }
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

function integrate(world: World, threat: ThreatRuntime, dt: number): void {
  scratch.x = threat.x + threat.velX * dt;
  scratch.z = threat.z + threat.velZ * dt;
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
  if (threat.state === 'attack') return;
  world.events.emit('threatVocal', { id: threat.id, x: threat.x, z: threat.z, kind: 'idle' });
}

/** Facing angle helper for the renderer. */
export function threatFacing(threat: ThreatRuntime): number {
  return wrapAngle(threat.yaw);
}
