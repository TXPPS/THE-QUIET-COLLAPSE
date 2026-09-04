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
  /** Map annotations for the district map screen. */
  mapLabels: Array<{ x: number; z: number; text: string }>;
}
