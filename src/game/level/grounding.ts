import { SPAWN } from '@/config/gameplay';
import type { BlockDef, LevelData, SpawnRay } from './types';

export interface GroundingReport {
  rays: SpawnRay[];
  /** Ids removed because no surface lay within `SPAWN.maxDrop` below the spawn point. */
  skipped: string[];
}

function insideBlock(block: BlockDef, x: number, z: number): boolean {
  const dx = x - block.x;
  const dz = z - block.z;
  const rot = block.rot ?? 0;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) <= block.w / 2 && Math.abs(lz) <= block.d / 2;
}

/**
 * Casts straight down from (x, fromY, z) and returns the highest surface or block top at or below
 * that height, or null when nothing lies underneath. Invisible blockers never count as ground.
 */
export function surfaceBelow(level: Pick<LevelData, 'surfaces'>, blocks: readonly BlockDef[], x: number, z: number, fromY: number, excludeId?: string): number | null {
  let best: number | null = null;
  for (const patch of level.surfaces) {
    const y = patch.y ?? 0;
    if (y > fromY || Math.abs(x - patch.x) > patch.w / 2 || Math.abs(z - patch.z) > patch.d / 2) continue;
    if (best === null || y > best) best = y;
  }
  for (const block of blocks) {
    if (block.invisible || block.id === excludeId) continue;
    const top = (block.y ?? 0) + block.h;
    if (top > fromY || !insideBlock(block, x, z)) continue;
    if (best === null || top > best) best = top;
  }
  return best;
}

interface Placement {
  y: number | null;
  ray: SpawnRay;
}

function probe(level: LevelData, blocks: readonly BlockDef[], id: string, kind: SpawnRay['kind'], x: number, z: number, authoredY: number, lift: number, excludeId?: string): Placement {
  const fromY = authoredY + SPAWN.probeLift;
  const hitY = surfaceBelow(level, blocks, x, z, fromY, excludeId);
  const placed = hitY !== null && fromY - hitY <= SPAWN.maxDrop;
  return { y: placed ? (hitY as number) + lift : null, ray: { id, kind, x, z, fromY, hitY, placed } };
}

/**
 * Grounds everything that spawns in the world: props (blocks authored with `prop`), pickups,
 * loose documents and the radio drop straight down onto the nearest surface below their spawn
 * point; anything with no surface within `SPAWN.maxDrop` metres is left out of the level and
 * reported. Elevated blocks (`elevated: true`, e.g. a barrier arm on its post) keep their height.
 * Dressing models flagged `ground` drop the same way; wall-mounted ones keep their authored height.
 */
export function groundLevel(level: LevelData): { level: LevelData; report: GroundingReport } {
  const rays: SpawnRay[] = [];
  const skipped: string[] = [];
  const blocks: BlockDef[] = level.blocks.map((block) => ({ ...block }));
  const kept: BlockDef[] = [];
  for (const block of blocks) {
    if (!block.prop || block.elevated) {
      kept.push(block);
      continue;
    }
    const placement = probe(level, blocks, block.id, 'prop', block.x, block.z, block.y ?? 0, 0, block.id);
    rays.push(placement.ray);
    if (placement.y === null) {
      skipped.push(block.id);
      block.invisible = true; // removed from the working set so nothing lands on it
      continue;
    }
    block.y = placement.y;
    kept.push(block);
  }
  const pickups = level.pickups.flatMap((pickup) => {
    const placement = probe(level, kept, pickup.id, 'pickup', pickup.x, pickup.z, pickup.y ?? SPAWN.defaultProbeHeight, SPAWN.pickupLift);
    rays.push(placement.ray);
    if (placement.y === null) {
      skipped.push(pickup.id);
      return [];
    }
    return [{ ...pickup, y: placement.y }];
  });
  const documents = level.documents.flatMap((doc) => {
    if (doc.yaw !== undefined) return [doc];
    const placement = probe(level, kept, doc.id, 'document', doc.x, doc.z, doc.y ?? SPAWN.defaultProbeHeight, SPAWN.documentLift);
    rays.push(placement.ray);
    if (placement.y === null) {
      skipped.push(doc.id);
      return [];
    }
    return [{ ...doc, y: placement.y }];
  });
  const interactables = level.interactables.flatMap((item) => {
    if (item.kind !== 'radio') return [item];
    const placement = probe(level, kept, item.id, 'interactable', item.x, item.z, item.y ?? SPAWN.defaultProbeHeight, SPAWN.radioLift);
    rays.push(placement.ray);
    if (placement.y === null) {
      skipped.push(item.id);
      return [];
    }
    return [{ ...item, y: placement.y }];
  });
  const models = level.models.flatMap((item) => {
    if (!item.ground) return [item];
    const placement = probe(level, kept, item.id, 'model', item.x, item.z, item.y ?? SPAWN.defaultProbeHeight, 0);
    rays.push(placement.ray);
    if (placement.y === null) {
      skipped.push(item.id);
      return [];
    }
    return [{ ...item, y: placement.y }];
  });
  return { level: { ...level, blocks: kept, pickups, documents, interactables, models, spawnRays: rays }, report: { rays, skipped } };
}
