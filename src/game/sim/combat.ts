import { PISTOL, THREAT } from '@/config/gameplay';
import { rayCircleT, segmentBoxT } from './collision';
import type { World } from './World';

export interface ShotResult {
  hit: boolean;
  threatId: string | null;
  killed: boolean;
  impact: { x: number; y: number; z: number };
}

/**
 * Hitscan from the render camera's aim ray. Threat capsules are tested as vertical cylinders and
 * walls occlude by height so shots over low barriers still land.
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
    return { hit: false, threatId: null, killed: false, impact: { x: ray.ox + dx * wallT, y: ray.oy + dy * wallT, z: ray.oz + dz * wallT } };
  }
  if (bestThreat !== null) {
    const threat = world.threats.find((t) => t.id === bestThreat);
    if (threat) {
      threat.health -= PISTOL.damage;
      const killed = threat.health <= 0;
      if (killed) {
        threat.alive = false;
        threat.state = 'dead';
        threat.deathTimer = 0;
      } else {
        threat.state = 'stagger';
        threat.stateTimer = THREAT.staggerDuration;
        threat.staggerDirX = dx;
        threat.staggerDirZ = dz;
        threat.awareness = 1;
        threat.lastSeenPlayer = { x: world.player.x, z: world.player.z };
        threat.timeSinceSeen = 0;
      }
      world.events.emit('threatHit', { id: threat.id, x: threat.x, z: threat.z, killed });
      world.events.emit('threatVocal', { id: threat.id, x: threat.x, z: threat.z, kind: killed ? 'death' : 'hurt' });
      return { hit: true, threatId: threat.id, killed, impact: { x: threat.x, y: ray.oy + dy * bestT, z: threat.z } };
    }
  }
  return { hit: false, threatId: null, killed: false, impact: { x: endX, y: ray.oy + dy * bestT, z: endZ } };
}
