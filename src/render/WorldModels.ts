import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { AssetLibrary } from '@/assets/AssetLibrary';
import { KIT_SCALE } from '@/game/level/kitModels';
import type { BlockDef, KitId, ModelDef } from '@/game/level/types';

interface Placement {
  kit: KitId;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
}

const KIT_IDS: KitId[] = ['city-kit-roads', 'city-kit-suburban', 'city-kit-commercial', 'city-kit-industrial', 'modular-buildings'];
const KIT_ROUGHNESS = 0.92;
/** Kenney palettes are bright and saturated; pulled down so kit props sit in the same night as the PBR surfaces. */
const KIT_ALBEDO = 0.72;
const toned = new WeakSet<THREE.Material>();
function tone(material: THREE.MeshStandardMaterial): void {
  if (toned.has(material)) return;
  toned.add(material);
  material.roughness = KIT_ROUGHNESS;
  material.color.multiplyScalar(KIT_ALBEDO);
}

/**
 * Kenney kit instances for the level: every distinct model becomes one InstancedMesh, so a
 * street of thirty road tiles is a single draw call. Colliders are untouched; a block with a
 * `model` reference is drawn here instead of as a box.
 */
export class WorldModels {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly local = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly scaleVector = new THREE.Vector3();

  constructor(
    private readonly kits: Map<KitId, GLTF>,
    private readonly shadows: boolean,
  ) {}

  /** Loads every kit the library has; kits that failed to load are skipped (their models are simply absent). */
  static async load(assets: AssetLibrary): Promise<Map<KitId, GLTF>> {
    const kits = new Map<KitId, GLTF>();
    await Promise.all(
      KIT_IDS.map(async (kit) => {
        try {
          const gltf = await assets.gltf(`kit.${kit}`);
          gltf.scene.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (mesh.isMesh && mesh.material instanceof THREE.MeshStandardMaterial) tone(mesh.material);
          });
          kits.set(kit, gltf);
        } catch {
          // Missing kit: placements stay empty; the box placeholders remain for collidable props.
        }
      }),
    );
    return kits;
  }

  /** True when the kit for a block model is available (the caller draws a box otherwise). */
  has(kit: KitId, name: string): boolean {
    return Boolean(this.kits.get(kit)?.scene.getObjectByName(name));
  }

  build(models: readonly ModelDef[], blocks: readonly BlockDef[]): void {
    const placements: Placement[] = [];
    for (const item of models) placements.push({ kit: item.kit, name: item.name, x: item.x, y: item.y ?? 0, z: item.z, yaw: item.yaw ?? 0, scale: item.scale ?? 1 });
    for (const block of blocks) {
      if (!block.model || block.invisible) continue;
      placements.push({ kit: block.model.kit, name: block.model.name, x: block.x, y: block.y ?? 0, z: block.z, yaw: (block.rot ?? 0) + (block.model.yaw ?? 0), scale: 1 });
    }
    const groups = new Map<string, Placement[]>();
    for (const placement of placements) {
      const key = `${placement.kit}/${placement.name}`;
      const list = groups.get(key) ?? [];
      list.push(placement);
      groups.set(key, list);
    }
    for (const list of groups.values()) this.instantiate(list);
  }

  private instantiate(list: Placement[]): void {
    const first = list[0];
    if (!first) return;
    const source = this.kits.get(first.kit)?.scene.getObjectByName(first.name) as THREE.Mesh | undefined;
    if (!source || !source.isMesh) return;
    const mesh = new THREE.InstancedMesh(source.geometry, source.material, list.length);
    mesh.castShadow = this.shadows;
    mesh.receiveShadow = this.shadows;
    mesh.name = `${first.kit}/${first.name}`;
    const kitScale = KIT_SCALE[first.kit];
    source.updateMatrix();
    for (let i = 0; i < list.length; i += 1) {
      const p = list[i] as Placement;
      this.position.set(p.x, p.y, p.z);
      this.quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.yaw);
      this.scaleVector.setScalar(kitScale * p.scale);
      this.matrix.compose(this.position, this.quaternion, this.scaleVector);
      // The node's own transform (Kenney nodes carry a scale) sits inside the kit-scaled frame.
      this.local.copy(source.matrix);
      this.matrix.multiply(this.local);
      mesh.setMatrixAt(i, this.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
    this.meshes.push(mesh);
  }

  get instanceCount(): number {
    return this.meshes.reduce((sum, mesh) => sum + mesh.count, 0);
  }

  dispose(): void {
    for (const mesh of this.meshes) mesh.dispose();
    this.meshes.length = 0;
    this.group.removeFromParent();
  }
}
