import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import type { AssetLibrary } from '@/assets/AssetLibrary';
import { BONE, CHARACTER, CLIP, LOWER_BONES } from '@/config/character';

export type CharacterVariant = 'resident' | 'affected';

export interface FootPlants {
  /** Normalised clip phases (0..1) at which each foot touches down. */
  left: number[];
  right: number[];
}

export interface ClipSet {
  /** Full clips by name. */
  full: Map<string, THREE.AnimationClip>;
  /** Lower-body and upper-body masked variants by name. */
  lower: Map<string, THREE.AnimationClip>;
  upper: Map<string, THREE.AnimationClip>;
  plants: Map<string, FootPlants>;
}

const LOWER = new Set<string>(LOWER_BONES);
const LOCOMOTION_CLIPS = [CLIP.walk, CLIP.jog, CLIP.sprint, CLIP.threatWalk];

/** The base body ships as a sculpted suit; a weaker normal map keeps it reading as plain clothing. */
function softenSuit(material: THREE.MeshStandardMaterial): void {
  if (!material.name.startsWith('MI_Superhero')) return;
  material.normalScale.set(CHARACTER.suitNormalScale, CHARACTER.suitNormalScale);
  material.roughness = 1;
  material.needsUpdate = true;
}

function trackBone(track: THREE.KeyframeTrack): string {
  return track.name.split('.')[0] ?? '';
}

function masked(clip: THREE.AnimationClip, keep: (bone: string) => boolean, suffix: string): THREE.AnimationClip {
  return new THREE.AnimationClip(`${clip.name}#${suffix}`, clip.duration, clip.tracks.filter((track) => keep(trackBone(track))));
}

/**
 * Scans a locomotion clip on a scratch skeleton and records the phases where each foot reaches a
 * local height minimum: those are the plants that drive footstep audio.
 */
function scanFootPlants(template: THREE.Object3D, clip: THREE.AnimationClip): FootPlants {
  const scratch = cloneSkeleton(template);
  const mixer = new THREE.AnimationMixer(scratch);
  const action = mixer.clipAction(clip);
  action.play();
  const left = scratch.getObjectByName(BONE.footLeft);
  const right = scratch.getObjectByName(BONE.footRight);
  const samples = CHARACTER.footstepSamples;
  const heights = { left: new Float32Array(samples), right: new Float32Array(samples) };
  const position = new THREE.Vector3();
  for (let i = 0; i < samples; i += 1) {
    mixer.setTime((i / samples) * clip.duration);
    scratch.updateMatrixWorld(true);
    heights.left[i] = left ? left.getWorldPosition(position).y : 0;
    heights.right[i] = right ? right.getWorldPosition(position).y : 0;
  }
  const minima = (values: Float32Array): number[] => {
    const result: number[] = [];
    const range = Math.max(1e-4, Math.max(...values) - Math.min(...values));
    for (let i = 0; i < samples; i += 1) {
      const prev = values[(i - 1 + samples) % samples] as number;
      const next = values[(i + 1) % samples] as number;
      const value = values[i] as number;
      // A plant is a clear minimum in the lower third of the foot's travel.
      if (value <= prev && value < next && (value - Math.min(...values)) / range < 0.34) result.push(i / samples);
    }
    // Merge minima closer than a tenth of the cycle (flat contact plateaus).
    return result.filter((phase, index) => index === 0 || phase - (result[index - 1] as number) > 0.1);
  };
  mixer.stopAllAction();
  return { left: minima(heights.left), right: minima(heights.right) };
}

/**
 * Loads the two character models and the shared clip library once, prepares masked clip
 * variants and foot-plant tables, and hands out fresh skeleton clones per rig instance.
 */
export class CharacterAssets {
  private templates: Record<CharacterVariant, THREE.Object3D> | null = null;
  private clips: ClipSet | null = null;
  private loading: Promise<void> | null = null;
  private failureText: string | null = null;

  constructor(private readonly library: AssetLibrary) {}

  get ready(): boolean {
    return this.templates !== null && this.clips !== null;
  }

  get failure(): string | null {
    return this.failureText;
  }

  load(): Promise<void> {
    if (!this.loading) this.loading = this.loadAll().catch((error: unknown) => void (this.failureText = error instanceof Error ? error.message : String(error)));
    return this.loading;
  }

  private async loadAll(): Promise<void> {
    const [resident, affected, animations] = await Promise.all([this.library.gltf('character.resident'), this.library.gltf('character.affected'), this.library.gltf('character.animations')]);
    for (const gltf of [resident, affected]) {
      gltf.scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = false;
          mesh.frustumCulled = false; // skinned bounds lag the pose; never let a limb pop out
          softenSuit(mesh.material as THREE.MeshStandardMaterial);
        }
      });
    }
    const full = new Map<string, THREE.AnimationClip>();
    const lower = new Map<string, THREE.AnimationClip>();
    const upper = new Map<string, THREE.AnimationClip>();
    const plants = new Map<string, FootPlants>();
    for (const clip of animations.animations) {
      full.set(clip.name, clip);
      lower.set(clip.name, masked(clip, (bone) => LOWER.has(bone), 'lower'));
      upper.set(clip.name, masked(clip, (bone) => !LOWER.has(bone), 'upper'));
      if ((LOCOMOTION_CLIPS as readonly string[]).includes(clip.name)) plants.set(clip.name, scanFootPlants(resident.scene, clip));
    }
    this.templates = { resident: resident.scene, affected: affected.scene };
    this.clips = { full, lower, upper, plants };
  }

  /** A deep skeleton clone of the variant; materials are shared, geometry is shared. */
  instantiate(variant: CharacterVariant): { root: THREE.Object3D; clips: ClipSet } {
    if (!this.templates || !this.clips) throw new Error('CharacterAssets not loaded');
    return { root: cloneSkeleton(this.templates[variant]), clips: this.clips };
  }
}
