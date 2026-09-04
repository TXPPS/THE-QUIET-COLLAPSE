import type { BlockDef, KitId, MaterialKey } from './types';

/** Kenney kits are authored at 1 unit = 10 m (city kits) or 4 m (modular buildings). */
export const KIT_SCALE: Record<KitId, number> = {
  'city-kit-roads': 10,
  'city-kit-suburban': 10,
  'city-kit-commercial': 10,
  'city-kit-industrial': 10,
  'modular-buildings': 4,
};

/** Measured footprints (metres, kit scale applied) for the models that double as colliders. */
export const MODEL_FOOTPRINT: Record<string, { w: number; d: number; h: number }> = {
  'city-kit-roads/dumpster': { w: 2.8, d: 3.7, h: 2.1 },
  'city-kit-roads/construction-barrier': { w: 1.4, d: 2.2, h: 1.3 },
  'city-kit-roads/construction-fence': { w: 0.8, d: 3.8, h: 1.8 },
  'city-kit-roads/construction-light': { w: 0.8, d: 0.8, h: 2.3 },
  'city-kit-roads/traffic-light': { w: 1.2, d: 0.9, h: 5.1 },
  'city-kit-roads/electricity-pole': { w: 0.6, d: 0.6, h: 5.2 },
  'city-kit-roads/light-curved': { w: 0.5, d: 0.5, h: 6.7 },
  'city-kit-industrial/shipping-container-a': { w: 3.7, d: 8.2, h: 3.5 },
  'city-kit-industrial/shipping-container-b': { w: 3.7, d: 8.2, h: 3.5 },
  'city-kit-industrial/shipping-container-c': { w: 3.7, d: 8.2, h: 3.5 },
  'city-kit-industrial/detail-tank': { w: 8.5, d: 5.2, h: 4.2 },
  'city-kit-suburban/planter': { w: 4.0, d: 3.0, h: 1.8 },
  'city-kit-suburban/tree-small': { w: 0.8, d: 0.8, h: 5.7 },
  'city-kit-suburban/tree-large': { w: 0.9, d: 0.9, h: 7.7 },
};

let autoId = 0;

/**
 * A collidable prop drawn as a kit model. The collider takes the model's measured footprint so
 * what the player bumps into is what they see; grounding treats it like any other prop.
 */
export function modelProp(kit: KitId, name: string, x: number, z: number, rot = 0, material: MaterialKey = 'metal', extra: Partial<BlockDef> = {}): BlockDef {
  const footprint = MODEL_FOOTPRINT[`${kit}/${name}`];
  if (!footprint) throw new Error(`no footprint for ${kit}/${name}`);
  autoId += 1;
  return { id: `${name}_${autoId}`, x, z, w: footprint.w, d: footprint.d, h: footprint.h, rot, material, prop: true, model: { kit, name }, ...extra };
}
