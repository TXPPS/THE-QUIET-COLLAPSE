import type { Collider, Vec2 } from './types';

const scratchLocal: Vec2 = { x: 0, z: 0 };

/** Transforms a world point into the collider's local (unrotated) space. Result is reused. */
export function toLocal(collider: Collider, x: number, z: number, out: Vec2 = scratchLocal): Vec2 {
  const dx = x - collider.cx;
  const dz = z - collider.cz;
  if (collider.rot === 0) {
    out.x = dx;
    out.z = dz;
    return out;
  }
  const cos = Math.cos(-collider.rot);
  const sin = Math.sin(-collider.rot);
  out.x = dx * cos - dz * sin;
  out.z = dx * sin + dz * cos;
  return out;
}

export function pointInside(collider: Collider, x: number, z: number, margin = 0): boolean {
  const local = toLocal(collider, x, z);
  return Math.abs(local.x) <= collider.hw + margin && Math.abs(local.z) <= collider.hd + margin;
}

/**
 * Pushes a circle out of a rotated box. Mutates `pos` and returns true when a correction happened.
 */
export function resolveCircleBox(pos: Vec2, radius: number, collider: Collider): boolean {
  const local = toLocal(collider, pos.x, pos.z);
  const clampedX = Math.max(-collider.hw, Math.min(collider.hw, local.x));
  const clampedZ = Math.max(-collider.hd, Math.min(collider.hd, local.z));
  let dx = local.x - clampedX;
  let dz = local.z - clampedZ;
  let dist = Math.sqrt(dx * dx + dz * dz);
  if (dist >= radius) return false;
  if (dist < 1e-6) {
    // Centre is inside the box: push out through the nearest face.
    const px = collider.hw - Math.abs(local.x);
    const pz = collider.hd - Math.abs(local.z);
    if (px < pz) {
      dx = local.x >= 0 ? 1 : -1;
      dz = 0;
      dist = -px;
    } else {
      dx = 0;
      dz = local.z >= 0 ? 1 : -1;
      dist = -pz;
    }
  } else {
    dx /= dist;
    dz /= dist;
  }
  const push = radius - dist;
  const cos = Math.cos(collider.rot);
  const sin = Math.sin(collider.rot);
  pos.x += (dx * cos - dz * sin) * push;
  pos.z += (dx * sin + dz * cos) * push;
  return true;
}

/**
 * Parametric intersection of a segment with a rotated box (slab test). Returns t in [0,1] of the
 * first hit or -1. `heightAt` lets callers reject boxes below a 3D ray's height at the hit.
 */
export function segmentBoxT(ax: number, az: number, bx: number, bz: number, collider: Collider, inflate = 0): number {
  const a = toLocal(collider, ax, az, { x: 0, z: 0 });
  const b = toLocal(collider, bx, bz, { x: 0, z: 0 });
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const hw = collider.hw + inflate;
  const hd = collider.hd + inflate;
  let tMin = 0;
  let tMax = 1;
  for (let axis = 0; axis < 2; axis += 1) {
    const origin = axis === 0 ? a.x : a.z;
    const delta = axis === 0 ? dx : dz;
    const half = axis === 0 ? hw : hd;
    if (Math.abs(delta) < 1e-9) {
      if (Math.abs(origin) > half) return -1;
      continue;
    }
    let t1 = (-half - origin) / delta;
    let t2 = (half - origin) / delta;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return -1;
  }
  return tMin;
}

/** True when the 2D segment is blocked by any collider tall enough at the crossing point. */
export function segmentBlocked(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  colliders: readonly Collider[],
  yAtStart = 1.5,
  yAtEnd = 1.5,
  ignoreLow = true,
): boolean {
  for (const collider of colliders) {
    if (ignoreLow && collider.lowObstacle) continue;
    const t = segmentBoxT(ax, az, bx, bz, collider);
    if (t < 0) continue;
    const y = yAtStart + (yAtEnd - yAtStart) * t;
    if (y <= collider.height) return true;
  }
  return false;
}

/** Circle vs circle overlap test. */
export function circlesOverlap(ax: number, az: number, ar: number, bx: number, bz: number, br: number): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const r = ar + br;
  return dx * dx + dz * dz < r * r;
}

/** Parametric hit of a 2D ray with a circle; returns nearest t ≥ 0 or -1. */
export function rayCircleT(ox: number, oz: number, dx: number, dz: number, cx: number, cz: number, r: number): number {
  const fx = ox - cx;
  const fz = oz - cz;
  const a = dx * dx + dz * dz;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0 || a === 0) return -1;
  const sqrt = Math.sqrt(disc);
  const t1 = (-b - sqrt) / (2 * a);
  if (t1 >= 0) return t1;
  const t2 = (-b + sqrt) / (2 * a);
  return t2 >= 0 ? t2 : -1;
}
