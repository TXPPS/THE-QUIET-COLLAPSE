import type * as THREE from 'three';
import type { EquippedItem, ThreatAiState } from '@/game/sim/types';

export type RigKind = 'player' | 'threat';

/** Continuous state a rig needs every frame; one-shots (shots, hits, dodges) arrive through `trigger`. */
export interface RigPose {
  x: number;
  /** Height above the ground (jump / vault); 0 when grounded. */
  y: number;
  z: number;
  yaw: number;
  /** Direction of travel (radians, world), meaningful when `moving`. */
  moveYaw: number;
  moving: boolean;
  speed: number;
  aiming: boolean;
  airborne: boolean;
  dead: boolean;
  deathTimer: number;
  hurt: boolean;
  /** 0..1 attack windup for threats. */
  attack: number;
  stagger: boolean;
  threatState: ThreatAiState | null;
  /** Player only: 0..1 aim blend (the one ADS value), look pitch (radians) and reload progress (0 when idle). */
  weaponRaise: number;
  lookPitch: number;
  reloadProgress: number;
  equipped: EquippedItem;
  flashlightOn: boolean;
  usingMedkit: boolean;
}

export type RigTrigger = 'shoot' | 'reload' | 'hit' | 'dodge' | 'interact' | 'jump' | 'land' | 'vault' | 'melee' | 'attack' | 'stagger' | 'knockdown' | 'rise';

/** Where a held item sits on its joint: metres and radians in joint space. */
export interface ItemSocket {
  joint: string;
  positionOffset: readonly [number, number, number];
  rotationOffset: readonly [number, number, number];
}

export interface Rig {
  readonly group: THREE.Group;
  readonly kind: RigKind;
  /** Fires when a foot lands (animated rigs only). */
  onFootstep: ((foot: 'left' | 'right') => void) | null;
  update(pose: RigPose, dt: number): void;
  trigger(event: RigTrigger): void;
  muzzleWorldPosition(out: THREE.Vector3): THREE.Vector3;
  /** QA socket tuner: re-seats a held item live (no persistence; values are committed by hand). */
  setSocket(item: 'pistol' | 'medkit' | 'flashlight', socket: ItemSocket): void;
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
