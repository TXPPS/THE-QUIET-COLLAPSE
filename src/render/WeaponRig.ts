import * as THREE from 'three';
import type { EquippedItem } from '@/game/sim/types';

/*
 * Held items (PLACEHOLDER_ART, see docs/audit/ASSET_LEDGER.md). Built in a natural frame: barrel
 * along +Z, top along +Y, origin at the hand. Low-poly boxes with one light-catching strip so the
 * silhouette reads at phone resolution and in unlit rooms.
 */

const GUNMETAL = { color: 0x363a3f, metalness: 0.7, roughness: 0.45, emissive: 0x111316 };
const EDGE = { color: 0xb4bac0, metalness: 0.8, roughness: 0.3, emissive: 0x2c3034 };
const GRIP = { color: 0x1e1a17, metalness: 0.1, roughness: 0.9, emissive: 0x050404 };
const MEDKIT = { color: 0x7a3a30, metalness: 0.05, roughness: 0.8, emissive: 0x1a0806 };
const MEDKIT_CROSS = { color: 0xd8d2c4, metalness: 0, roughness: 0.9, emissive: 0x2a2820 };
const TORCH = { color: 0x4a4e52, metalness: 0.6, roughness: 0.4, emissive: 0x0a0b0c };

type Spec = { color: number; metalness: number; roughness: number; emissive: number };

class MeshFactory {
  readonly geometries: THREE.BufferGeometry[] = [];
  readonly materials: THREE.Material[] = [];
  private readonly cache = new Map<Spec, THREE.MeshStandardMaterial>();

  box(w: number, h: number, d: number, spec: Spec, x = 0, y = 0, z = 0): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(w, h, d);
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, this.material(spec));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    return mesh;
  }

  cylinder(r: number, length: number, spec: Spec, y = 0, z = 0): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(r, r, length, 8);
    geometry.rotateX(Math.PI / 2);
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, this.material(spec));
    mesh.position.set(0, y, z);
    return mesh;
  }

  private material(spec: Spec): THREE.MeshStandardMaterial {
    let material = this.cache.get(spec);
    if (!material) {
      material = new THREE.MeshStandardMaterial(spec);
      this.materials.push(material);
      this.cache.set(spec, material);
    }
    return material;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}

/** Handgun or medkit in the right hand; the muzzle socket feeds the fire effects. */
export class WeaponRig {
  readonly group = new THREE.Group();
  readonly muzzle = new THREE.Object3D();
  private readonly pistol = new THREE.Group();
  private readonly medkit = new THREE.Group();
  private readonly factory = new MeshFactory();

  constructor() {
    const f = this.factory;
    // Slide over the frame, grip raked back, a small trigger guard, one bright edge on top.
    this.pistol.add(
      f.box(0.036, 0.04, 0.2, GUNMETAL, 0, 0.03, 0.06),
      f.box(0.034, 0.03, 0.13, GUNMETAL, 0, 0.0, 0.04),
      f.box(0.038, 0.006, 0.17, EDGE, 0, 0.053, 0.065),
      f.box(0.038, 0.006, 0.16, EDGE, 0, 0.007, 0.06),
      f.box(0.006, 0.004, 0.02, EDGE, 0, 0.056, 0.15),
      f.box(0.006, 0.006, 0.03, GUNMETAL, 0, -0.032, 0.03),
      f.box(0.006, 0.02, 0.005, GUNMETAL, 0, -0.024, 0.045),
    );
    const grip = f.box(0.028, 0.085, 0.036, GRIP, 0, -0.05, -0.02);
    grip.rotation.x = 0.25;
    this.pistol.add(grip);
    this.muzzle.position.set(0, 0.03, 0.156);
    this.pistol.add(this.muzzle);
    this.medkit.add(f.box(0.16, 0.09, 0.06, MEDKIT, 0, -0.02, 0.02), f.box(0.02, 0.06, 0.062, MEDKIT_CROSS, 0, -0.02, 0.02), f.box(0.06, 0.02, 0.062, MEDKIT_CROSS, 0, -0.02, 0.02));
    this.medkit.visible = false;
    this.group.add(this.pistol, this.medkit);
  }

  setEquipped(item: EquippedItem): void {
    this.pistol.visible = item === 'pistol';
    this.medkit.visible = item === 'medkit';
  }

  dispose(): void {
    this.factory.dispose();
    this.group.removeFromParent();
  }
}

/** Hand torch in the left hand with a lit lens while the flashlight is on. */
export class FlashlightRig {
  readonly group = new THREE.Group();
  private readonly lens: THREE.MeshStandardMaterial;
  private readonly factory = new MeshFactory();

  constructor() {
    const f = this.factory;
    const body = f.cylinder(0.018, 0.14, TORCH, 0, 0.03);
    const head = f.cylinder(0.024, 0.03, TORCH, 0, 0.11);
    this.lens = new THREE.MeshStandardMaterial({ color: 0xf2e6c8, emissive: 0xf2e6c8, emissiveIntensity: 1.2, roughness: 0.3 });
    const lensGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.006, 8);
    lensGeometry.rotateX(Math.PI / 2);
    const lens = new THREE.Mesh(lensGeometry, this.lens);
    lens.position.set(0, 0, 0.127);
    this.factory.geometries.push(lensGeometry);
    this.group.add(body, head, lens);
  }

  setLit(on: boolean): void {
    this.lens.emissiveIntensity = on ? 1.2 : 0.05;
  }

  dispose(): void {
    this.factory.dispose();
    this.lens.dispose();
    this.group.removeFromParent();
  }
}
