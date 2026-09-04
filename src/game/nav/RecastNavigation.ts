import { Crowd, importTileCache, init, type CrowdAgent, type NavMesh, type Obstacle, type TileCache } from 'recast-navigation';
import { createDefaultTileCacheMeshProcess } from '@recast-navigation/generators';
import { THREAT } from '@/config/gameplay';
import type { DoorDef, LevelData } from '@/game/level/types';
import type { Vec2 } from '@/game/sim/types';
import type { NavProvider } from './NavProvider';
import { levelSignature } from './signature';

const MAX_AGENTS = 32;
const AGENT_ACCELERATION = 9;
const AGENT_SEPARATION = 1.6;
/** Tile rebuild passes allowed per step after an obstacle change. */
const MAX_TILE_UPDATES_PER_STEP = 4;
const ZERO: Vec2 = { x: 0, z: 0 };

let initialised: Promise<void> | null = null;

/**
 * Recast/Detour crowd over the baked district tile cache. Every threat is a crowd agent that is
 * steered along the navmesh with local avoidance; closed doors are box obstacles carved out of
 * the tiles at runtime.
 */
export class RecastNavigation implements NavProvider {
  private readonly agents = new Map<string, CrowdAgent>();
  private readonly obstacles = new Map<string, Obstacle>();
  private readonly velocity: Vec2 = { x: 0, z: 0 };
  private dirty = false;

  private constructor(
    readonly navMesh: NavMesh,
    private readonly tileCache: TileCache,
    private readonly crowd: Crowd,
  ) {}

  /** Loads the wasm module once; safe to call repeatedly. */
  static ensureInit(): Promise<void> {
    if (!initialised) initialised = init();
    return initialised;
  }

  /** Builds the runtime from the baked bytes; null when the level changed since the bake. */
  static fromBytes(bytes: ArrayBuffer, level: LevelData, bakedSignature: string): RecastNavigation | null {
    if (levelSignature(level) !== bakedSignature) return null;
    const { navMesh, tileCache } = importTileCache(new Uint8Array(bytes), createDefaultTileCacheMeshProcess());
    const crowd = new Crowd(navMesh, { maxAgents: MAX_AGENTS, maxAgentRadius: THREAT.radius + 0.1 });
    return new RecastNavigation(navMesh, tileCache, crowd);
  }

  get agentCount(): number {
    return this.agents.size;
  }

  addAgent(id: string, x: number, z: number, radius: number): void {
    if (this.agents.has(id)) return;
    const agent = this.crowd.addAgent(
      { x, y: 0, z },
      { radius, height: THREAT.height, maxAcceleration: AGENT_ACCELERATION, maxSpeed: THREAT.chaseSpeed, separationWeight: AGENT_SEPARATION, collisionQueryRange: radius * 6, pathOptimizationRange: radius * 20 },
    );
    this.agents.set(id, agent);
  }

  removeAgent(id: string): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    this.crowd.removeAgent(agent);
    this.agents.delete(id);
  }

  setTarget(id: string, goal: Vec2, speed: number): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    agent.maxSpeed = speed;
    agent.requestMoveTarget({ x: goal.x, y: 0, z: goal.z });
  }

  clearTarget(id: string): void {
    this.agents.get(id)?.resetMoveTarget();
  }

  agentPosition(id: string): Vec2 | null {
    const agent = this.agents.get(id);
    if (!agent) return null;
    const position = agent.position();
    return { x: position.x, z: position.z };
  }

  agentVelocity(id: string): Vec2 {
    const agent = this.agents.get(id);
    if (!agent) return ZERO;
    const velocity = agent.velocity();
    this.velocity.x = velocity.x;
    this.velocity.z = velocity.z;
    return this.velocity;
  }

  teleport(id: string, x: number, z: number): void {
    this.agents.get(id)?.teleport({ x, y: 0, z });
  }

  setDoorBlocked(door: DoorDef, blocked: boolean): void {
    const existing = this.obstacles.get(door.id);
    if (blocked && !existing) {
      const result = this.tileCache.addBoxObstacle({ x: door.x, y: door.h / 2, z: door.z }, { x: door.w / 2, y: door.h / 2, z: door.t / 2 }, door.rot ?? 0);
      if (result.success && result.obstacle) this.obstacles.set(door.id, result.obstacle);
      this.dirty = true;
    } else if (!blocked && existing) {
      this.tileCache.removeObstacle(existing);
      this.obstacles.delete(door.id);
      this.dirty = true;
    }
  }

  update(dt: number): void {
    if (this.dirty) {
      for (let i = 0; i < MAX_TILE_UPDATES_PER_STEP; i += 1) {
        const result = this.tileCache.update(this.navMesh);
        if (result.upToDate) {
          this.dirty = false;
          break;
        }
      }
    }
    this.crowd.update(dt);
  }

  dispose(): void {
    this.crowd.destroy();
    this.tileCache.destroy();
    this.navMesh.destroy();
    this.agents.clear();
    this.obstacles.clear();
  }
}
