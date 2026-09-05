import { PISTOL, THREAT } from '@/config/gameplay';
import { rayCircleT, segmentBoxT } from './collision';
import { damageThreat } from './threatState';
import type { World } from './World';

export interface ShotResult {
  hit: boolean;
  threatId: string | null;
  killed: boolean;
  headshot: boolean;
  impact: { x: number; y: number; z: number };
}

/**
 * Hitscan from the render camera's aim ray. Threat capsules are tested as vertical cylinders and
 * walls occlude by height so shots over low barriers still land. Hits above the head line take
 * the enemy's headshot multiplier.
 */
export function fireHitscan(world: World): ShotResult {
  const ray = world.aimRay;
  const spread = PISTOL.spreadAim;
  const dx = ray.dx + (world.rng() - 0.5) * spread;
  const dz = ray.dz + (world.rng() - 0.5) * spread;
  const dy = ray.dy + (world.rng() - 0.5) * spread;
  let bestT: number = PISTOL.range;
  let bestThreat: string | null = null;
  for (const threat of world.threats) {
    if (!threat.alive) continue;
    const t = rayCircleT(ray.ox, ray.oz, dx, dz, threat.x, threat.z, THREAT.radius);
    if (t < 0 || t > bestT) continue;
    const y = ray.oy + dy * t;
    if (y < 0 || y > THREAT.height) continue;
    bestT = t;
    bestThreat = threat.id;
  }
  // Wall occlusion: the nearest collider crossing the ray below its height wins over the threat.
  const endX = ray.ox + dx * bestT;
  const endZ = ray.oz + dz * bestT;
  let wallT = Infinity;
  for (const collider of world.activeColliders) {
    if (collider.lowObstacle && ray.oy + dy * bestT > collider.height) continue;
    const t = segmentBoxT(ray.ox, ray.oz, endX, endZ, collider);
    if (t < 0) continue;
    const y = ray.oy + dy * (t * bestT);
    if (y > collider.height || y < -0.2) continue;
    if (t * bestT < wallT) wallT = t * bestT;
  }
  if (wallT < bestT) {
    return { hit: false, threatId: null, killed: false, headshot: false, impact: { x: ray.ox + dx * wallT, y: ray.oy + dy * wallT, z: ray.oz + dz * wallT } };
  }
  if (bestThreat !== null) {
    const threat = world.threats.find((t) => t.id === bestThreat);
    if (threat) {
      const hitY = ray.oy + dy * bestT;
      const headshot = hitY >= THREAT.height * THREAT.headFraction;
      const damage = PISTOL.damage * (headshot ? threat.stats.headshotMultiplier : 1);
      const result = damageThreat(world, threat, damage, { headshot, dirX: dx, dirZ: dz });
      return { hit: true, threatId: threat.id, killed: result.killed, headshot, impact: { x: threat.x, y: hitY, z: threat.z } };
    }
  }
  return { hit: false, threatId: null, killed: false, headshot: false, impact: { x: endX, y: ray.oy + dy * bestT, z: endZ } };
}
