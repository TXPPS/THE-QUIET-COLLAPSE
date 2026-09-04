import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DecalDef, LevelData, LightDef } from '@/game/level/types';
import { MaterialLibrary } from './materials';

interface FlickerLight {
  light: THREE.PointLight;
  base: number;
  flicker: number;
  rotating: boolean;
  phase: number;
}

/** Level light intensities are authored on a 0–10 scale; three.js point lights expect candela. */
const POINT_LIGHT_SCALE = 34;

const DECAL_COLORS: Record<DecalDef['style'], number> = {
  poster: 0x8f8776,
  notice: 0xb9b19a,
  graffiti: 0xc99a3a,
  sign: 0x6e8a7a,
};

/** The slice of world state the renderer needs to sync doors and pickups. */
export interface WorldView {
  isDoorOpen(id: string): boolean;
  pickupsTaken: Record<string, boolean>;
}

/**
 * Builds the static level: merged geometry per material (few draw calls), doors as individual
 * meshes, lights with flicker, pickups/documents as small readable markers.
 */
export class WorldRenderer {
  readonly group = new THREE.Group();
  readonly materials = new MaterialLibrary();
  private readonly doors = new Map<string, THREE.Mesh>();
  private readonly pickups = new Map<string, THREE.Object3D>();
  private readonly lights: FlickerLight[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private time = 0;

  constructor(private readonly level: LevelData, quality: { optionalLights: boolean; shadows: boolean }) {
    this.buildSurfaces();
    this.buildBlocks(quality.shadows);
    this.buildDoors();
    this.buildMarkers();
    this.buildDecals();
    this.buildLights(quality.optionalLights);
  }

  private buildSurfaces(): void {
    for (const patch of this.level.surfaces) {
      const geometry = new THREE.PlaneGeometry(patch.w, patch.d);
      geometry.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geometry, this.materials.surface(patch.kind));
      mesh.position.set(patch.x, patch.y ?? 0, patch.z);
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.geometries.push(geometry);
    }
  }

  private buildBlocks(shadows: boolean): void {
    const byMaterial = new Map<string, THREE.BufferGeometry[]>();
    for (const block of this.level.blocks) {
      if (block.invisible) continue;
      const geometry = new THREE.BoxGeometry(block.w, block.h, block.d);
      geometry.rotateY(block.rot ?? 0);
      geometry.translate(block.x, (block.y ?? 0) + block.h / 2, block.z);
      const list = byMaterial.get(block.material) ?? [];
      list.push(geometry);
      byMaterial.set(block.material, list);
    }
    for (const [key, list] of byMaterial) {
      const merged = mergeGeometries(list, false);
      for (const geometry of list) geometry.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, this.materials.block(key as never));
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      this.group.add(mesh);
      this.geometries.push(merged);
    }
  }

  private buildDoors(): void {
    for (const door of this.level.doors) {
      const geometry = new THREE.BoxGeometry(door.w, door.h, door.t * 0.6);
      const mesh = new THREE.Mesh(geometry, this.materials.block(door.material));
      mesh.position.set(door.x, door.h / 2, door.z);
      mesh.rotation.y = door.rot ?? 0;
      this.group.add(mesh);
      this.doors.set(door.id, mesh);
      this.geometries.push(geometry);
    }
  }

  private buildMarkers(): void {
    const pickupGeometry = new THREE.BoxGeometry(0.28, 0.18, 0.2);
    const docGeometry = new THREE.PlaneGeometry(0.28, 0.36);
    this.geometries.push(pickupGeometry, docGeometry);
    const pickupMaterials = {
      ammo: new THREE.MeshStandardMaterial({ color: 0x6b6f63, roughness: 0.6, metalness: 0.4, emissive: 0x2a2a1a }),
      medkit: new THREE.MeshStandardMaterial({ color: 0x8a5a4a, roughness: 0.7, emissive: 0x2a0f0a }),
      flashlight: new THREE.MeshStandardMaterial({ color: 0x4a4e52, roughness: 0.4, metalness: 0.6, emissive: 0x2a2a1a }),
    };
    for (const pickup of this.level.pickups) {
      const mesh = new THREE.Mesh(pickupGeometry, pickupMaterials[pickup.kind]);
      mesh.position.set(pickup.x, pickup.y ?? 0.4, pickup.z);
      this.group.add(mesh);
      this.pickups.set(pickup.id, mesh);
    }
    const docMaterial = new THREE.MeshStandardMaterial({ color: 0xb8b09a, roughness: 1, side: THREE.DoubleSide, emissive: 0x2a2820 });
    for (const doc of this.level.documents) {
      const mesh = new THREE.Mesh(docGeometry, docMaterial);
      mesh.position.set(doc.x, doc.y ?? 1, doc.z);
      if (doc.yaw !== undefined) mesh.rotation.y = doc.yaw;
      else mesh.rotation.x = -Math.PI / 2;
      this.group.add(mesh);
    }
  }

  private buildDecals(): void {
    for (const decal of this.level.decals) {
      const geometry = new THREE.PlaneGeometry(decal.w, decal.h);
      const material = new THREE.MeshStandardMaterial({ color: DECAL_COLORS[decal.style], roughness: 1, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(decal.x, decal.y, decal.z);
      mesh.rotation.y = decal.yaw;
      this.group.add(mesh);
      this.geometries.push(geometry);
    }
  }

  private buildLights(optionalLights: boolean): void {
    for (const def of this.level.lights) {
      if (def.optional && !optionalLights) continue;
      const light = new THREE.PointLight(def.color, def.intensity * POINT_LIGHT_SCALE, def.range, 1.6);
      light.position.set(def.x, def.y, def.z);
      light.castShadow = false; // point-light shadows are too costly for WebGL on phones
      this.group.add(light);
      this.lights.push({ light, base: def.intensity * POINT_LIGHT_SCALE, flicker: def.flicker ?? 0, rotating: def.rotating ?? false, phase: Math.random() * 10 });
      this.addFixture(def);
    }
  }

  private addFixture(def: LightDef): void {
    const geometry = new THREE.SphereGeometry(0.12, 8, 6);
    const material = new THREE.MeshBasicMaterial({ color: def.color });
    const bulb = new THREE.Mesh(geometry, material);
    bulb.position.set(def.x, def.y, def.z);
    this.group.add(bulb);
    this.geometries.push(geometry);
  }

  /** Syncs door and pickup visibility with the world; advances flicker. */
  update(world: WorldView, dt: number): void {
    this.time += dt;
    for (const [id, mesh] of this.doors) {
      const open = world.isDoorOpen(id);
      const door = this.level.doors.find((d) => d.id === id);
      if (!door) continue;
      const target = open ? (door.rot ?? 0) + Math.PI / 2 * 0.92 : (door.rot ?? 0);
      mesh.rotation.y += (target - mesh.rotation.y) * Math.min(1, dt * 8);
      const hinge = door.w / 2;
      const rot = (door.rot ?? 0);
      const swing = mesh.rotation.y - rot;
      mesh.position.x = door.x - Math.cos(rot) * hinge + Math.cos(rot + swing) * hinge;
      mesh.position.z = door.z + Math.sin(rot) * hinge - Math.sin(rot + swing) * hinge;
    }
    for (const [id, object] of this.pickups) object.visible = !world.pickupsTaken[id];
    for (const entry of this.lights) {
      if (entry.rotating) {
        entry.light.intensity = entry.base * (0.35 + 0.65 * Math.abs(Math.sin(this.time * 2.6 + entry.phase)));
      } else if (entry.flicker > 0) {
        const n = Math.sin(this.time * 17 + entry.phase) * Math.sin(this.time * 5.3 + entry.phase * 2);
        const drop = n > 0.75 - entry.flicker * 0.5 ? 0.25 : 1;
        entry.light.intensity = entry.base * (drop - entry.flicker * 0.08 * Math.abs(n));
      }
    }
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    this.materials.dispose();
    this.group.removeFromParent();
  }
}
