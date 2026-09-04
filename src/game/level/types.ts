import type { NavBounds } from '@/game/sim/navgrid';

export type MaterialKey =
  | 'concrete'
  | 'brick'
  | 'plaster'
  | 'metal'
  | 'rust'
  | 'glass'
  | 'asphalt'
  | 'tile'
  | 'wood'
  | 'barrier'
  | 'bus'
  | 'car'
  | 'tarp'
  | 'fence'
  | 'paper';

export type SurfaceKind = 'asphalt' | 'concrete' | 'tile' | 'gravel' | 'metal' | 'water';

/** Kenney kit ids as emitted by the asset pipeline (`kit.<id>` manifest keys). */
export type KitId = 'city-kit-roads' | 'city-kit-suburban' | 'city-kit-commercial' | 'city-kit-industrial' | 'modular-buildings';

/** A kit model that stands in for a block's box visual; the block stays the collider. */
export interface BlockModel {
  kit: KitId;
  name: string;
  /** Extra yaw applied on top of the block rotation (radians). */
  yaw?: number;
}

/** A visual-only kit model placement (roads, lights, facades, skyline). */
export interface ModelDef {
  id: string;
  kit: KitId;
  name: string;
  x: number;
  z: number;
  /** Authored height; with `ground` it is the probe start and the model drops onto the surface below. */
  y?: number;
  yaw?: number;
  ground?: boolean;
  /** Uniform scale multiplier on top of the kit scale. */
  scale?: number;
}

export interface BlockDef {
  id: string;
  /** Centre X/Z, full width/depth, height and Y rotation (radians). */
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  rot?: number;
  y?: number;
  material: MaterialKey;
  /** Blocks movement but not sight/bullets (rubble, low barriers). */
  lowObstacle?: boolean;
  /** Visual only. */
  noCollide?: boolean;
  /** Skip the visual (invisible blocker). */
  invisible?: boolean;
  /** Set by the prop builders: grounded onto the surface below at level build time. */
  prop?: boolean;
  /** A prop that deliberately hangs above the ground on something else (a barrier arm on its post). */
  elevated?: boolean;
  /** Drawn as this kit model instead of a box (collider unchanged). */
  model?: BlockModel;
  /** Collider only: the visual is provided by dressing models (tiled fences, facades). */
  modelled?: boolean;
}

/** One grounding probe recorded at level build time (drawn by the QA overlay). */
export interface SpawnRay {
  id: string;
  kind: 'prop' | 'pickup' | 'document' | 'interactable' | 'model';
  x: number;
  z: number;
  fromY: number;
  hitY: number | null;
  placed: boolean;
}

export interface SurfaceDef {
  x: number;
  z: number;
  w: number;
  d: number;
  kind: SurfaceKind;
  y?: number;
}

export interface LightDef {
  id: string;
  x: number;
  y: number;
  z: number;
  color: number;
  intensity: number;
  range: number;
  /** 0 = steady; larger = more erratic flicker. */
  flicker?: number;
  /** Rotating beacon (emergency light). */
  rotating?: boolean;
  /** Only rendered on balanced/high quality. */
  optional?: boolean;
}

export interface DoorDef {
  id: string;
  x: number;
  z: number;
  /** Door width along its local X and wall thickness along local Z. */
  w: number;
  t: number;
  rot?: number;
  h: number;
  label: string;
  material: MaterialKey;
  initiallyOpen?: boolean;
}

export type PickupKind = 'ammo' | 'medkit' | 'flashlight';

export interface PickupDef {
  id: string;
  x: number;
  z: number;
  y?: number;
  kind: PickupKind;
  amount: number;
  label: string;
}

export type DocumentStyle = 'official' | 'handwritten' | 'print';

export interface DocumentDef {
  id: string;
  x: number;
  z: number;
  y?: number;
  title: string;
  body: string;
  style: DocumentStyle;
  /** Wall-mounted documents face this yaw. */
  yaw?: number;
}

export type InteractableKind = 'radio' | 'blocked' | 'gate';

export interface InteractableDef {
  id: string;
  x: number;
  z: number;
  y?: number;
  kind: InteractableKind;
  label: string;
  message?: string;
}

export type ZoneKind = 'objective' | 'checkpoint' | 'message' | 'ending' | 'interior';

export interface ZoneDef {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  kind: ZoneKind;
  objectiveId?: string;
  checkpointId?: string;
  message?: string;
  /** Interior zones clamp the camera below this ceiling height. */
  ceiling?: number;
  flag?: string;
}

export interface ThreatDef {
  id: string;
  x: number;
  z: number;
  yaw: number;
  wander: boolean;
}

export interface ObjectiveDef {
  id: string;
  label: string;
  detail: string;
  /** Map marker for the objective. */
  marker?: { x: number; z: number };
}

export interface DecalDef {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  w: number;
  h: number;
  style: 'poster' | 'notice' | 'graffiti' | 'sign';
  text?: string;
}

export interface LevelData {
  id: string;
  name: string;
  bounds: NavBounds;
  playerStart: { x: number; z: number; yaw: number };
  lookStart: { yaw: number; pitch: number };
  blocks: BlockDef[];
  surfaces: SurfaceDef[];
  lights: LightDef[];
  doors: DoorDef[];
  pickups: PickupDef[];
  documents: DocumentDef[];
  interactables: InteractableDef[];
  zones: ZoneDef[];
  threats: ThreatDef[];
  objectives: ObjectiveDef[];
  decals: DecalDef[];
  /** Kit model placements that dress the level (visual only). */
  models: ModelDef[];
  /** Map annotations for the district map screen. */
  mapLabels: Array<{ x: number; z: number; text: string }>;
  /** Grounding probes recorded when the level was built (QA overlay). */
  spawnRays?: SpawnRay[];
}
