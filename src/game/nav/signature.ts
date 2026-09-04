import type { LevelData } from '@/game/level/types';

/**
 * Stable fingerprint of everything the navmesh depends on (static colliders, ground patches,
 * bounds). Baked into the navmesh asset at build time and compared at runtime so a stale mesh is
 * never used against edited level data.
 */
export function levelSignature(level: Pick<LevelData, 'blocks' | 'surfaces' | 'bounds'>): string {
  const parts: string[] = [`${level.bounds.minX},${level.bounds.minZ},${level.bounds.maxX},${level.bounds.maxZ}`];
  for (const block of level.blocks) {
    if (block.noCollide) continue;
    parts.push([block.id, block.x, block.z, block.w, block.d, block.h, block.rot ?? 0, block.y ?? 0, block.lowObstacle ? 1 : 0].join(':'));
  }
  for (const patch of level.surfaces) parts.push(['s', patch.x, patch.z, patch.w, patch.d, patch.y ?? 0].join(':'));
  return fnv1a(parts.join('|'));
}

/** FNV-1a 32-bit as 8 hex characters; deterministic in Node and browsers alike. */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
