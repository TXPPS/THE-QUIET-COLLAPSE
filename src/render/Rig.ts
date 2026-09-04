import type * as THREE from 'three';
import type { EquippedItem, ThreatAiState } from '@/game/sim/types';

export type RigKind = 'player' | 'threat';

/** Continuous state a rig needs every frame; one-shots (shots, hits, dodges) arrive through `trigger`. */
export interface RigPose {
  x: number;
  z: number;
  yaw: number;
  /** Direction of travel (radians, world), meaningful when `moving`. */
  moveYaw: number;
  moving: boolean;
  speed: number;
  aiming: boolean;
  dead: boolean;
  deathTimer: number;
  hurt: boolean;
  /** 0..1 attack windup for threats. */
  attack: number;
  stagger: boolean;
  threatState: ThreatAiState | null;
  /** Player only: 0..1 weapon raise blend, look pitch (radians) and reload progress (0 when idle). */
  weaponRaise: number;
  lookPitch: number;
  reloadProgress: number;
  equipped: EquippedItem;
  flashlightOn: boolean;
  usingMedkit: boolean;
}

export type RigTrigger = 'shoot' | 'reload' | 'hit' | 'dodge' | 'interact' | 'attack' | 'stagger';

export interface Rig {
  readonly group: THREE.Group;
  readonly kind: RigKind;
  /** Fires when a foot lands (animated rigs only). */
  onFootstep: ((foot: 'left' | 'right') => void) | null;
  update(pose: RigPose, dt: number): void;
  trigger(event: RigTrigger): void;
  muzzleWorldPosition(out: THREE.Vector3): THREE.Vector3;
  dispose(): void;
}

export const IDLE_HANDS: Pick<RigPose, 'weaponRaise' | 'lookPitch' | 'reloadProgress' | 'equipped' | 'flashlightOn' | 'usingMedkit'> = {
  weaponRaise: 0,
  lookPitch: 0,
  reloadProgress: 0,
  equipped: 'pistol',
  flashlightOn: false,
  usingMedkit: false,
};
