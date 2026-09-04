import type { DifficultyId } from '@/config/gameplay';

export interface Vec2 {
  x: number;
  z: number;
}

/** Axis-aligned or rotated box on the XZ plane with a visual height. */
export interface Collider {
  id: string;
  cx: number;
  cz: number;
  hw: number;
  hd: number;
  rot: number;
  height: number;
  /** Colliders that block movement but not bullets/vision (e.g. low fences) set this. */
  lowObstacle?: boolean;
  /** Doors can be opened and stop blocking. */
  doorId?: string;
}

export type ThreatAiState = 'idle' | 'wander' | 'investigate' | 'chase' | 'attack' | 'stagger' | 'dead';

export interface ThreatSaveState {
  x: number;
  z: number;
  yaw: number;
  health: number;
  alive: boolean;
}

export type EquippedItem = 'pistol' | 'medkit';
export type DoorState = 'closed' | 'open';

export interface PlayerSaveState {
  x: number;
  z: number;
  yaw: number;
  health: number;
  stamina: number;
  ammoLoaded: number;
  ammoReserve: number;
  medkits: number;
  hasFlashlight: boolean;
  flashlightOn: boolean;
  equipped: EquippedItem;
}

export interface LookSaveState {
  yaw: number;
  pitch: number;
}

/** Everything needed to restore a run. Transient AI timers and animation state are excluded. */
export interface RunState {
  version: number;
  seed: number;
  difficulty: DifficultyId;
  playtimeSec: number;
  checkpointId: string;
  objectiveIndex: number;
  player: PlayerSaveState;
  look: LookSaveState;
  threats: Record<string, ThreatSaveState>;
  pickupsTaken: Record<string, boolean>;
  doors: Record<string, DoorState>;
  flags: Record<string, boolean>;
  documentsRead: string[];
  completed: boolean;
}

export const RUN_STATE_VERSION = 1;

export type NoiseKind = 'footstep' | 'sprint' | 'gunshot' | 'door' | 'impact';

export interface NoiseEvent {
  x: number;
  z: number;
  radius: number;
  kind: NoiseKind;
}
