import * as THREE from 'three';
import type { AssetLibrary } from '@/assets/AssetLibrary';
import { LIGHTING } from '@/config/lighting';
import type { MaterialKey, SurfaceKind } from '@/game/level/types';

/**
 * Level materials. Concrete, brick, plaster and asphalt receive the ambientCG PBR sets once the
 * asset library has them; everything else stays a flat placeholder (PLACEHOLDER_ART, see the
 * asset ledger). Geometry carries world-space UVs so one material tiles at a fixed metric scale.
 */
const MATERIAL_SPECS: Record<MaterialKey, { color: number; roughness: number; metalness: number; emissive?: number }> = {
  concrete: { color: 0x8a8b86, roughness: 0.95, metalness: 0 },
  brick: { color: 0x8a7468, roughness: 0.9, metalness: 0 },
  plaster: { color: 0x9a968a, roughness: 0.85, metalness: 0 },
  metal: { color: 0x4d5257, roughness: 0.55, metalness: 0.6 },
  rust: { color: 0x5d3f2c, roughness: 0.8, metalness: 0.35 },
  glass: { color: 0x2b3a3f, roughness: 0.2, metalness: 0.1 },
  asphalt: { color: 0x3a3b3d, roughness: 1, metalness: 0 },
  tile: { color: 0x585a52, roughness: 0.5, metalness: 0 },
  wood: { color: 0x54402c, roughness: 0.85, metalness: 0 },
  barrier: { color: 0x9a7a2c, roughness: 0.8, metalness: 0.05 },
  bus: { color: 0x3c4a55, roughness: 0.6, metalness: 0.3 },
  car: { color: 0x33373a, roughness: 0.5, metalness: 0.45 },
  tarp: { color: 0x3f4a3a, roughness: 0.95, metalness: 0 },
  fence: { color: 0x3b3f42, roughness: 0.6, metalness: 0.5 },
  paper: { color: 0x9a948a, roughness: 1, metalness: 0 },
};

const SURFACE_SPECS: Record<SurfaceKind, { color: number; roughness: number; metalness: number }> = {
  asphalt: { color: 0x4a4b4d, roughness: 1, metalness: 0 },
  concrete: { color: 0x6c6d6a, roughness: 0.95, metalness: 0 },
  tile: { color: 0x74766e, roughness: 0.45, metalness: 0 },
  gravel: { color: 0x4f4d49, roughness: 1, metalness: 0 },
  metal: { color: 0x33373a, roughness: 0.5, metalness: 0.5 },
  water: { color: 0x0a0f14, roughness: 0.15, metalness: 0.1 },
};

/** Which ambientCG set dresses each key, and its tiling in metres. */
const TEXTURED: Partial<Record<string, { set: string; tile: number; tint?: number }>> = {
  'block:concrete': { set: 'concrete034', tile: LIGHTING.tiles.concrete },
  'block:brick': { set: 'bricks104', tile: LIGHTING.tiles.brick },
  'block:plaster': { set: 'paintedplaster017', tile: LIGHTING.tiles.plaster },
  'block:asphalt': { set: 'asphalt033', tile: LIGHTING.tiles.asphalt },
  'surface:asphalt': { set: 'asphalt033', tile: LIGHTING.tiles.asphalt },
  'surface:concrete': { set: 'concrete034', tile: LIGHTING.tiles.concrete },
  'surface:gravel': { set: 'concrete034', tile: LIGHTING.tiles.concrete * 0.6, tint: 0x8c8880 },
  'surface:tile': { set: 'paintedplaster017', tile: 1.5, tint: 0xb8b6ae },
};

/** Metres per texture repeat for a material id (1 when untextured). */
export function tileSize(id: string): number {
  return TEXTURED[id]?.tile ?? 1;
}

export class MaterialLibrary {
  private readonly cache = new Map<string, THREE.MeshStandardMaterial>();

  block(key: MaterialKey): THREE.MeshStandardMaterial {
    return this.get(`block:${key}`, MATERIAL_SPECS[key]);
  }

  surface(kind: SurfaceKind): THREE.MeshStandardMaterial {
    return this.get(`surface:${kind}`, SURFACE_SPECS[kind]);
  }

  private get(id: string, spec: { color: number; roughness: number; metalness: number; emissive?: number }): THREE.MeshStandardMaterial {
    let material = this.cache.get(id);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: spec.color,
        roughness: spec.roughness,
        metalness: spec.metalness,
        emissive: spec.emissive ?? 0x000000,
      });
      material.name = id;
      this.cache.set(id, material);
    }
    return material;
  }

  /** Attaches the PBR maps to every textured material that has been created; safe to call late. */
  async applyTextures(assets: AssetLibrary): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (const [id, material] of this.cache) {
      const entry = TEXTURED[id];
      if (!entry || material.map) continue;
      jobs.push(this.texture(assets, material, entry));
    }
    await Promise.all(jobs);
  }

  private async texture(assets: AssetLibrary, material: THREE.MeshStandardMaterial, entry: { set: string; tint?: number }): Promise<void> {
    try {
      const [map, normal, orm] = await Promise.all([
        assets.texture(`texture.${entry.set}.color`, { srgb: true }),
        assets.texture(`texture.${entry.set}.normal`, { srgb: false }),
        assets.texture(`texture.${entry.set}.orm`, { srgb: false }),
      ]);
      material.map = map;
      material.normalMap = normal;
      material.roughnessMap = orm;
      material.aoMap = orm;
      material.color.set(entry.tint ?? 0xffffff);
      material.roughness = 1;
      material.needsUpdate = true;
    } catch {
      // Missing texture set: the flat placeholder colour stays.
    }
  }

  dispose(): void {
    for (const material of this.cache.values()) material.dispose();
    this.cache.clear();
  }
}
