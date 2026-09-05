import { THREAT } from '@/config/gameplay';
import { length2 } from '@/core/math';
import type { ThreatRuntime } from './entities';
import { enterState, isReaction } from './threatState';
import type { NoiseEvent } from './types';
import type { World } from './World';

/** Threats react to noise: closer, louder noises pull them out of idle into investigation. */
export function onNoise(world: World, noise: NoiseEvent): void {
  for (const threat of world.threats) {
    if (!threat.alive || threat.state === 'chase' || threat.state === 'attack' || isReaction(threat.state)) continue;
    const distance = length2(noise.x - threat.x, noise.z - threat.z);
    if (distance > noise.radius * THREAT.hearingSensitivity) continue;
    const strength = 1 - distance / (noise.radius + 0.001);
    if (noise.kind === 'gunshot' || strength > 0.35 || threat.state === 'investigate') {
      threat.target.x = noise.x;
      threat.target.z = noise.z;
      threat.awareness = Math.max(threat.awareness, noise.kind === 'gunshot' ? 0.9 : 0.5);
      enterState(world, threat, 'investigate');
    }
  }
}

export function sightRange(world: World, threat: ThreatRuntime): number {
  const p = world.player;
  const surface = world.surfaceAt(threat.x, threat.z);
  const dark = surface !== 'asphalt';
  let range = dark ? THREAT.sightRangeDark : THREAT.sightRangeLit;
  if (p.flashlightOn) range += THREAT.sightRangeFlashlightBonus;
  if (p.sprinting) range *= 1.2;
  return range;
}

/** Vision: awareness builds while the player is in the cone and unobstructed, decays otherwise. */
export function perceive(world: World, threat: ThreatRuntime, dt: number): void {
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
    if (threat.state === 'attack' || isReaction(threat.state)) return;
    if (threat.awareness >= 1) enterState(world, threat, 'chase');
    else if (threat.awareness > 0.35 && (threat.state === 'idle' || threat.state === 'wander')) {
      threat.target.x = p.x;
      threat.target.z = p.z;
      enterState(world, threat, 'investigate');
    }
  } else if (threat.state !== 'chase' && threat.state !== 'attack' && !isReaction(threat.state)) {
    threat.awareness = Math.max(0, threat.awareness - dt * 0.25);
  }
}
