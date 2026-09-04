import type { LevelData } from '@/game/level/types';

/** Recast build parameters for the district. Cell size sets path accuracy; radius/height match the affected. */
export const NAV_BUILD = {
  cs: 0.2,
  ch: 0.2,
  walkableSlopeAngle: 45,
  /** In cells: threat radius 0.42 m, standing height 1.8 m, step 0.25 m. */
  walkableRadius: 3,
  walkableHeight: 9,
  walkableClimb: 1,
  tileSize: 48,
  expectedLayersPerTile: 4,
  maxObstacles: 64,
  /** Vertical extent of the static geometry fed to the builder. */
  groundY: 0,
  wallMargin: 1.5,
} as const;

export interface NavGeometry {
  positions: Float32Array;
  indices: Uint32Array;
}

function pushBox(positions: number[], indices: number[], cx: number, cz: number, hw: number, hd: number, y0: number, y1: number, rot: number): void {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const base = positions.length / 3;
  const corners: Array<[number, number]> = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  for (const y of [y0, y1]) {
    for (const [lx, lz] of corners) positions.push(cx + lx * cos - lz * sin, y, cz + lx * sin + lz * cos);
  }
  const quad = (a: number, b: number, c: number, d: number) => indices.push(base + a, base + b, base + c, base + a, base + c, base + d);
  quad(0, 1, 2, 3); // bottom
  quad(4, 7, 6, 5); // top
  quad(0, 4, 5, 1);
  quad(1, 5, 6, 2);
  quad(2, 6, 7, 3);
  quad(3, 7, 4, 0);
}

/**
 * Static walkable geometry for the navmesh: one ground slab over the level bounds plus every
 * collider block as a closed box. Doors are omitted (they become temporary obstacles at runtime).
 */
export function buildNavGeometry(level: Pick<LevelData, 'blocks' | 'bounds'>): NavGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const { bounds } = level;
  const margin = NAV_BUILD.wallMargin;
  const base = positions.length / 3;
  positions.push(bounds.minX - margin, NAV_BUILD.groundY, bounds.minZ - margin);
  positions.push(bounds.maxX + margin, NAV_BUILD.groundY, bounds.minZ - margin);
  positions.push(bounds.maxX + margin, NAV_BUILD.groundY, bounds.maxZ + margin);
  positions.push(bounds.minX - margin, NAV_BUILD.groundY, bounds.maxZ + margin);
  indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  for (const block of level.blocks) {
    if (block.noCollide) continue;
    const y0 = block.y ?? 0;
    pushBox(positions, indices, block.x, block.z, block.w / 2, block.d / 2, y0, y0 + block.h, block.rot ?? 0);
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
