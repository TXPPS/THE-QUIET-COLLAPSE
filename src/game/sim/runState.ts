import { ENEMY_STATS, normaliseDifficulty } from '@/config/enemies';
import { MEDKIT, PISTOL, PLAYER, type DifficultyId } from '@/config/gameplay';
import { isFiniteNumber, isRecord } from '@/persistence/Storage';
import type { LevelData } from '@/game/level/types';
import { RUN_STATE_VERSION, type PlayerSaveState, type RunState, type ThreatSaveState } from './types';

export function createNewRun(level: LevelData, difficulty: DifficultyId, seed = Date.now() >>> 0): RunState {
  const threats: Record<string, ThreatSaveState> = {};
  for (const def of level.threats) {
    threats[def.id] = { x: def.x, z: def.z, yaw: def.yaw, health: ENEMY_STATS[def.kind ?? 'affected'].hp, alive: true };
  }
  return {
    version: RUN_STATE_VERSION,
    seed,
    difficulty,
    playtimeSec: 0,
    checkpointId: 'start',
    objectiveIndex: 0,
    player: {
      x: level.playerStart.x,
      z: level.playerStart.z,
      yaw: level.playerStart.yaw,
      health: PLAYER.maxHealth,
      stamina: PLAYER.maxStamina,
      ammoLoaded: PISTOL.startLoaded,
      ammoReserve: PISTOL.startReserve,
      medkits: MEDKIT.startCount,
      hasFlashlight: false,
      flashlightOn: false,
      equipped: 'pistol',
      items: {},
    },
    look: { yaw: level.lookStart.yaw, pitch: level.lookStart.pitch },
    threats,
    pickupsTaken: {},
    doors: {},
    flags: {},
    documentsRead: [],
    completed: false,
  };
}

function isPlayerState(value: unknown): value is PlayerSaveState {
  if (!isRecord(value)) return false;
  const numeric = ['x', 'z', 'yaw', 'health', 'stamina', 'ammoLoaded', 'ammoReserve', 'medkits'];
  if (!numeric.every((key) => isFiniteNumber(value[key]))) return false;
  if (typeof value['hasFlashlight'] !== 'boolean' || typeof value['flashlightOn'] !== 'boolean') return false;
  const items = value['items'];
  if (items !== undefined && !(isRecord(items) && Object.values(items).every((n) => isFiniteNumber(n) && n >= 0))) return false;
  return value['equipped'] === 'pistol' || value['equipped'] === 'medkit';
}

function isThreatState(value: unknown): value is ThreatSaveState {
  if (!isRecord(value)) return false;
  return ['x', 'z', 'yaw', 'health'].every((key) => isFiniteNumber(value[key])) && typeof value['alive'] === 'boolean';
}

function isStringBoolRecord(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every((v) => typeof v === 'boolean');
}

/** Structural validation of a persisted run; rejects anything that could crash the simulation. */
export function validateRunState(value: unknown): value is RunState {
  if (!isRecord(value)) return false;
  if (value['version'] !== RUN_STATE_VERSION) return false;
  if (!isFiniteNumber(value['seed']) || !isFiniteNumber(value['playtimeSec']) || !isFiniteNumber(value['objectiveIndex'])) return false;
  // v1 saves stored "normal"; it is rewritten to the standard preset in place.
  if (value['difficulty'] === 'normal') value['difficulty'] = 'standard';
  if (value['difficulty'] !== normaliseDifficulty(value['difficulty'])) return false;
  if (typeof value['checkpointId'] !== 'string' || typeof value['completed'] !== 'boolean') return false;
  if (!isPlayerState(value['player'])) return false;
  const look = value['look'];
  if (!isRecord(look) || !isFiniteNumber(look['yaw']) || !isFiniteNumber(look['pitch'])) return false;
  const threats = value['threats'];
  if (!isRecord(threats) || !Object.values(threats).every(isThreatState)) return false;
  if (!isStringBoolRecord(value['pickupsTaken']) || !isStringBoolRecord(value['flags'])) return false;
  const doors = value['doors'];
  if (!isRecord(doors) || !Object.values(doors).every((v) => v === 'open' || v === 'closed')) return false;
  const docs = value['documentsRead'];
  return Array.isArray(docs) && docs.every((d) => typeof d === 'string');
}

/** Deep copy used when snapshotting for a checkpoint so later mutation cannot leak into the save. */
export function cloneRunState(state: RunState): RunState {
  return structuredClone(state);
}
