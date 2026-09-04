import { pointInside } from './collision';
import type { Collider, Vec2 } from './types';

export interface NavBounds {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

const DIRS: ReadonlyArray<[number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Coarse walkability grid with A* and line-of-sight smoothing. Built once per level; doors are
 * re-rasterised through `setBlocked` when they open or close.
 */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;
  private readonly gScore: Float32Array;
  private readonly cameFrom: Int32Array;
  private readonly closed: Uint8Array;

  constructor(
    readonly bounds: NavBounds,
    readonly cell: number,
    colliders: readonly Collider[],
    readonly padding: number,
  ) {
    this.cols = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    const size = this.cols * this.rows;
    this.blocked = new Uint8Array(size);
    this.gScore = new Float32Array(size);
    this.cameFrom = new Int32Array(size);
    this.closed = new Uint8Array(size);
    for (const collider of colliders) this.rasterise(collider, true);
  }

  index(col: number, row: number): number {
    return row * this.cols + col;
  }

  toCell(x: number, z: number): [number, number] {
    const col = Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.bounds.minX) / this.cell)));
    const row = Math.max(0, Math.min(this.rows - 1, Math.floor((z - this.bounds.minZ) / this.cell)));
    return [col, row];
  }

  toWorld(col: number, row: number): Vec2 {
    return { x: this.bounds.minX + (col + 0.5) * this.cell, z: this.bounds.minZ + (row + 0.5) * this.cell };
  }

  isBlockedAt(x: number, z: number): boolean {
    const [col, row] = this.toCell(x, z);
    return this.blocked[this.index(col, row)] === 1;
  }

  /** Marks every cell overlapping the collider (inflated by padding) as blocked or free. */
  rasterise(collider: Collider, blocked: boolean): void {
    const reach = Math.hypot(collider.hw, collider.hd) + this.padding;
    const [c0, r0] = this.toCell(collider.cx - reach, collider.cz - reach);
    const [c1, r1] = this.toCell(collider.cx + reach, collider.cz + reach);
    for (let row = r0; row <= r1; row += 1) {
      for (let col = c0; col <= c1; col += 1) {
        const p = this.toWorld(col, row);
        if (pointInside(collider, p.x, p.z, this.padding)) this.blocked[this.index(col, row)] = blocked ? 1 : 0;
      }
    }
  }

  /** Re-blocks cells covered by other colliders after a door opened (doors may overlap walls). */
  rebuild(colliders: readonly Collider[]): void {
    this.blocked.fill(0);
    for (const collider of colliders) this.rasterise(collider, true);
  }

  /** Nearest free cell centre to a world point (spiral search), or null. */
  nearestFree(x: number, z: number, maxRadiusCells = 6): Vec2 | null {
    const [c, r] = this.toCell(x, z);
    for (let radius = 0; radius <= maxRadiusCells; radius += 1) {
      for (let dr = -radius; dr <= radius; dr += 1) {
        for (let dc = -radius; dc <= radius; dc += 1) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          const col = c + dc;
          const row = r + dr;
          if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) continue;
          if (this.blocked[this.index(col, row)] === 0) return this.toWorld(col, row);
        }
      }
    }
    return null;
  }

  /** A* path (list of world waypoints, excluding the start). Returns null when unreachable. */
  findPath(from: Vec2, to: Vec2, maxExpansions = 6000): Vec2[] | null {
    const start = this.freeCellNear(from);
    const goal = this.freeCellNear(to);
    if (!start || !goal) return null;
    const startIndex = this.index(start[0], start[1]);
    const goalIndex = this.index(goal[0], goal[1]);
    if (startIndex === goalIndex) return [to];
    this.gScore.fill(Infinity);
    this.closed.fill(0);
    this.cameFrom.fill(-1);
    const open = new BinaryHeap();
    this.gScore[startIndex] = 0;
    open.push(startIndex, this.heuristic(start[0], start[1], goal[0], goal[1]));
    let expansions = 0;
    while (open.size > 0 && expansions < maxExpansions) {
      const current = open.pop();
      if (current === goalIndex) return this.reconstruct(goalIndex, to);
      if (this.closed[current]) continue;
      this.closed[current] = 1;
      expansions += 1;
      const col = current % this.cols;
      const row = (current - col) / this.cols;
      for (const [dc, dr, cost] of DIRS) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
        const ni = this.index(nc, nr);
        if (this.blocked[ni] || this.closed[ni]) continue;
        // No corner cutting through blocked orthogonal neighbours.
        if (dc !== 0 && dr !== 0 && (this.blocked[this.index(col + dc, row)] || this.blocked[this.index(col, row + dr)])) continue;
        const tentative = (this.gScore[current] ?? Infinity) + cost;
        if (tentative < (this.gScore[ni] ?? Infinity)) {
          this.gScore[ni] = tentative;
          this.cameFrom[ni] = current;
          open.push(ni, tentative + this.heuristic(nc, nr, goal[0], goal[1]));
        }
      }
    }
    return null;
  }

  /** Removes waypoints that can be skipped with a straight, unblocked line. */
  smooth(path: Vec2[], from: Vec2): Vec2[] {
    if (path.length <= 2) return path;
    const result: Vec2[] = [];
    let anchor = from;
    let i = 0;
    while (i < path.length) {
      let j = path.length - 1;
      while (j > i && !this.lineFree(anchor, path[j] as Vec2)) j -= 1;
      const next = path[j] as Vec2;
      result.push(next);
      anchor = next;
      i = j + 1;
    }
    return result;
  }

  lineFree(a: Vec2, b: Vec2): boolean {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (this.cell * 0.5)));
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      if (this.isBlockedAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  private freeCellNear(p: Vec2): [number, number] | null {
    const [col, row] = this.toCell(p.x, p.z);
    if (!this.blocked[this.index(col, row)]) return [col, row];
    const near = this.nearestFree(p.x, p.z);
    return near ? this.toCell(near.x, near.z) : null;
  }

  private heuristic(c0: number, r0: number, c1: number, r1: number): number {
    const dx = Math.abs(c1 - c0);
    const dz = Math.abs(r1 - r0);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  }

  private reconstruct(goalIndex: number, to: Vec2): Vec2[] {
    const cells: number[] = [];
    let current = goalIndex;
    while (current >= 0) {
      cells.push(current);
      current = this.cameFrom[current] ?? -1;
    }
    cells.reverse();
    const path: Vec2[] = [];
    for (let i = 1; i < cells.length; i += 1) {
      const index = cells[i] as number;
      const col = index % this.cols;
      path.push(this.toWorld(col, (index - col) / this.cols));
    }
    path.push(to);
    return path;
  }
}

/** Minimal binary min-heap keyed by f-score. */
class BinaryHeap {
  private readonly items: number[] = [];
  private readonly scores: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, score: number): void {
    this.items.push(item);
    this.scores.push(score);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((this.scores[parent] as number) <= (this.scores[i] as number)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0] as number;
    const lastItem = this.items.pop() as number;
    const lastScore = this.scores.pop() as number;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.scores[0] = lastScore;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && (this.scores[left] as number) < (this.scores[smallest] as number)) smallest = left;
        if (right < this.items.length && (this.scores[right] as number) < (this.scores[smallest] as number)) smallest = right;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const item = this.items[a] as number;
    this.items[a] = this.items[b] as number;
    this.items[b] = item;
    const score = this.scores[a] as number;
    this.scores[a] = this.scores[b] as number;
    this.scores[b] = score;
  }
}
