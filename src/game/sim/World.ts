import { EventBus } from '@/core/EventBus';
import { THREAT } from '@/config/gameplay';
import { createRng } from '@/core/math';
import type { BlockDef, DoorDef, LevelData, SurfaceKind, ZoneDef } from '@/game/level/types';
import { resolveCircleBox, segmentBlocked } from './collision';
import { PlayerRuntime, ThreatRuntime } from './entities';
import type { SimEvents } from './events';
import { NavGrid } from './navgrid';
import { cloneRunState } from './runState';
import type { Collider, DoorState, LookSaveState, RunState, Vec2 } from './types';

export interface AimRay {
  ox: number;
  oy: number;
  oz: number;
  dx: number;
  dy: number;
  dz: number;
}

const NAV_CELL = 0.5;
const NAV_PADDING = THREAT.radius + 0.1;

function blockToCollider(block: BlockDef): Collider {
  return {
    id: block.id,
    cx: block.x,
    cz: block.z,
    hw: block.w / 2,
    hd: block.d / 2,
    rot: block.rot ?? 0,
    height: (block.y ?? 0) + block.h,
    lowObstacle: block.lowObstacle ?? false,
  };
}

function doorToCollider(door: DoorDef): Collider {
  return { id: `door:${door.id}`, cx: door.x, cz: door.z, hw: door.w / 2, hd: door.t / 2, rot: door.rot ?? 0, height: door.h, doorId: door.id };
}

/**
 * The simulation world: level geometry, colliders, navigation, entities and the run state that
 * persists. Constructed fresh for every new game or load so no transient state survives.
 */
export class World {
  readonly events = new EventBus<SimEvents>();
  readonly player: PlayerRuntime;
  readonly threats: ThreatRuntime[] = [];
  readonly look: LookSaveState;
  readonly nav: NavGrid;
  readonly rng: () => number;
  readonly aimRay: AimRay = { ox: 0, oy: 1.5, oz: 0, dx: 0, dy: 0, dz: 1 };
  playtimeSec: number;
  checkpointId: string;
  objectiveIndex: number;
  completed: boolean;
  readonly difficulty: RunState['difficulty'];
  readonly seed: number;
  readonly pickupsTaken: Record<string, boolean>;
  readonly doors: Record<string, DoorState>;
  readonly flags: Record<string, boolean>;
  readonly documentsRead: Set<string>;
  private readonly staticColliders: Collider[];
  private readonly doorColliders = new Map<string, Collider>();
  private colliders: Collider[] = [];
  /** Set when the player crosses the ending trigger. */
  endingReached = false;

  constructor(
    readonly level: LevelData,
    state: RunState,
  ) {
    this.seed = state.seed;
    this.rng = createRng(state.seed);
    this.difficulty = state.difficulty;
    this.playtimeSec = state.playtimeSec;
    this.checkpointId = state.checkpointId;
    this.objectiveIndex = state.objectiveIndex;
    this.completed = state.completed;
    this.pickupsTaken = { ...state.pickupsTaken };
    this.doors = { ...state.doors };
    this.flags = { ...state.flags };
    this.documentsRead = new Set(state.documentsRead);
    this.look = { yaw: state.look.yaw, pitch: state.look.pitch };
    this.player = new PlayerRuntime(state.player);
    for (const def of level.threats) this.threats.push(new ThreatRuntime(def, state.threats[def.id]));
    this.staticColliders = level.blocks.filter((block) => !block.noCollide).map(blockToCollider);
    for (const door of level.doors) this.doorColliders.set(door.id, doorToCollider(door));
    this.rebuildColliders();
    this.nav = new NavGrid(level.bounds, NAV_CELL, this.colliders, NAV_PADDING);
  }

  /** All colliders currently blocking movement (closed doors included). */
  get activeColliders(): readonly Collider[] {
    return this.colliders;
  }

  isDoorOpen(id: string): boolean {
    return this.doors[id] === 'open';
  }

  setDoor(id: string, open: boolean): void {
    this.doors[id] = open ? 'open' : 'closed';
    this.rebuildColliders();
    this.nav.rebuild(this.colliders);
  }

  private rebuildColliders(): void {
    this.colliders = this.staticColliders.slice();
    for (const [id, collider] of this.doorColliders) {
      if (!this.isDoorOpen(id)) this.colliders.push(collider);
    }
  }

  /** Pushes a circle out of every collider it overlaps (two passes settle corner cases). */
  resolveCircle(pos: Vec2, radius: number): boolean {
    let corrected = false;
    for (let pass = 0; pass < 2; pass += 1) {
      for (const collider of this.colliders) {
        if (Math.abs(collider.cx - pos.x) > collider.hw + collider.hd + radius + 1) continue;
        if (Math.abs(collider.cz - pos.z) > collider.hw + collider.hd + radius + 1) continue;
        if (resolveCircleBox(pos, radius, collider)) corrected = true;
      }
    }
    return corrected;
  }

  hasLineOfSight(ax: number, az: number, bx: number, bz: number, yA = 1.5, yB = 1.5): boolean {
    return !segmentBlocked(ax, az, bx, bz, this.colliders, yA, yB, true);
  }

  surfaceAt(x: number, z: number): SurfaceKind {
    let result: SurfaceKind = 'concrete';
    for (const patch of this.level.surfaces) {
      if (Math.abs(x - patch.x) <= patch.w / 2 && Math.abs(z - patch.z) <= patch.d / 2) result = patch.kind;
    }
    return result;
  }

  zonesAt(x: number, z: number, kind?: ZoneDef['kind']): ZoneDef[] {
    const result: ZoneDef[] = [];
    for (const zone of this.level.zones) {
      if (kind && zone.kind !== kind) continue;
      if (Math.abs(x - zone.x) <= zone.w / 2 && Math.abs(z - zone.z) <= zone.d / 2) result.push(zone);
    }
    return result;
  }

  ceilingAt(x: number, z: number): number | null {
    let ceiling: number | null = null;
    for (const zone of this.zonesAt(x, z, 'interior')) {
      if (zone.ceiling !== undefined && (ceiling === null || zone.ceiling < ceiling)) ceiling = zone.ceiling;
    }
    return ceiling;
  }

  currentObjective() {
    return this.level.objectives[this.objectiveIndex] ?? null;
  }

  /** Serialises the persistent part of the world. */
  toRunState(): RunState {
    const threats: RunState['threats'] = {};
    for (const threat of this.threats) threats[threat.id] = threat.toSave();
    return cloneRunState({
      version: 1,
      seed: this.seed,
      difficulty: this.difficulty,
      playtimeSec: this.playtimeSec,
      checkpointId: this.checkpointId,
      objectiveIndex: this.objectiveIndex,
      player: this.player.toSave(),
      look: { yaw: this.look.yaw, pitch: this.look.pitch },
      threats,
      pickupsTaken: { ...this.pickupsTaken },
      doors: { ...this.doors },
      flags: { ...this.flags },
      documentsRead: Array.from(this.documentsRead),
      completed: this.completed,
    });
  }

  dispose(): void {
    this.events.clear();
  }
}
