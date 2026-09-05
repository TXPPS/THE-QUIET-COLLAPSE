import type { DoorDef } from '@/game/level/types';
import type { Vec2 } from '@/game/sim/types';

/**
 * Steering/pathing service the simulation can delegate to (Recast crowd at runtime). The grid A*
 * stays as the headless fallback so unit tests and asset failures never lose enemy movement.
 */
export interface NavProvider {
  addAgent(id: string, x: number, z: number, radius: number): void;
  removeAgent(id: string): void;
  /** Requests a path to `goal` and caps the agent at `speed` m/s. */
  setTarget(id: string, goal: Vec2, speed: number): void;
  clearTarget(id: string): void;
  /**
   * A paused agent stops steering (no target, zero speed) while the body is in a non-locomotion
   * state; the simulation keeps teleporting it onto the body so nothing snaps when it resumes.
   */
  setAgentPaused(id: string, paused: boolean): void;
  /** Where the crowd moved the agent this step (null when the agent is unknown). */
  agentPosition(id: string): Vec2 | null;
  agentVelocity(id: string): Vec2;
  /** Re-syncs the agent after the simulation corrected its position. */
  teleport(id: string, x: number, z: number): void;
  /** Closed doors are temporary obstacles; opening one removes it. */
  setDoorBlocked(door: DoorDef, blocked: boolean): void;
  update(dt: number): void;
  /** Debug drawing hook: the underlying navmesh object when available. */
  readonly navMesh: unknown;
  readonly agentCount: number;
  dispose(): void;
}
