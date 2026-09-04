import * as THREE from 'three';
import type { MaterialKey, SurfaceKind } from '@/game/level/types';

/**
 * Procedural placeholder materials (PLACEHOLDER_ART, see docs/audit/ASSET_LEDGER.md).
 * Restrained palette derived from the night district: charcoal, concrete, smoke, sodium amber.
 */
const MATERIAL_SPECS: Record<MaterialKey, { color: number; roughness: number; metalness: number; emissive?: number }> = {
  concrete: { color: 0x5a5b58, roughness: 0.95, metalness: 0 },
  brick: { color: 0x5c463c, roughness: 0.9, metalness: 0 },
  plaster: { color: 0x6b675c, roughness: 0.85, metalness: 0 },
  metal: { color: 0x4d5257, roughness: 0.55, metalness: 0.6 },
  rust: { color: 0x5d3f2c, roughness: 0.8, metalness: 0.35 },
  glass: { color: 0x2b3a3f, roughness: 0.2, metalness: 0.1 },
  asphalt: { color: 0x232426, roughness: 1, metalness: 0 },
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
  asphalt: { color: 0x1e1f21, roughness: 1, metalness: 0 },
  concrete: { color: 0x3a3b39, roughness: 0.95, metalness: 0 },
  tile: { color: 0x44463f, roughness: 0.45, metalness: 0 },
  gravel: { color: 0x2f2d2a, roughness: 1, metalness: 0 },
  metal: { color: 0x33373a, roughness: 0.5, metalness: 0.5 },
  water: { color: 0x0a0f14, roughness: 0.15, metalness: 0.1 },
};

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
      this.cache.set(id, material);
    }
    return material;
  }

  dispose(): void {
    for (const material of this.cache.values()) material.dispose();
    this.cache.clear();
  }
}
