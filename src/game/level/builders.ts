import type { BlockDef, DoorDef, LightDef, MaterialKey, SurfaceDef, SurfaceKind, ZoneDef } from './types';

let autoId = 0;

function nextId(prefix: string): string {
  autoId += 1;
  return `${prefix}_${autoId}`;
}

/** Block from min/max corners (readable for buildings and walls). */
export function box(id: string, x0: number, z0: number, x1: number, z1: number, h: number, material: MaterialKey, extra: Partial<BlockDef> = {}): BlockDef {
  return { id, x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0), d: Math.abs(z1 - z0), h, material, ...extra };
}

/** Block from centre, size and rotation (props). */
export function prop(prefix: string, x: number, z: number, w: number, d: number, h: number, material: MaterialKey, rot = 0, extra: Partial<BlockDef> = {}): BlockDef {
  return { id: nextId(prefix), x, z, w, d, h, rot, material, prop: true, ...extra };
}

export function surface(x0: number, z0: number, x1: number, z1: number, kind: SurfaceKind, y = 0): SurfaceDef {
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0), d: Math.abs(z1 - z0), kind, y };
}

export function light(id: string, x: number, y: number, z: number, color: number, intensity: number, range: number, extra: Partial<LightDef> = {}): LightDef {
  return { id, x, y, z, color, intensity, range, ...extra };
}

export function door(id: string, x: number, z: number, w: number, t: number, h: number, label: string, rot = 0, material: MaterialKey = 'metal'): DoorDef {
  return { id, x, z, w, t, h, label, rot, material };
}

export function zone(id: string, x0: number, z0: number, x1: number, z1: number, kind: ZoneDef['kind'], extra: Partial<ZoneDef> = {}): ZoneDef {
  return { id, x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0), d: Math.abs(z1 - z0), kind, ...extra };
}

export function car(x: number, z: number, rot: number, material: MaterialKey = 'car'): BlockDef {
  return prop('car', x, z, 1.9, 4.4, 1.45, material, rot);
}

export function pillar(x: number, z: number, h: number): BlockDef {
  return prop('pillar', x, z, 0.7, 0.7, h, 'concrete');
}
