import type { DifficultyPreset } from '@/persistence/settingsSchema';
import { PLAYER } from './gameplay';

export type EnemyKind = 'affected';

/** Per-kind combat statistics. Speeds are metres per second; times are seconds; damage is health points. */
export interface EnemyStats {
  hp: number;
  walkSpeed: number;
  /** Base run speed; the difficulty preset scales it against the player's jog pace. */
  runSpeed: number;
  attackWindup: number;
  attackCooldown: number;
  damage: number;
  /** A single hit at or above this much damage staggers instead of a hit-react. */
  staggerThreshold: number;
  /** A single hit at or above this much damage knocks the enemy down (only once per life). */
  knockdownThreshold: number;
  headshotMultiplier: number;
  /** Seconds spent in each non-locomotion reaction. */
  hitReactDuration: number;
  staggerDuration: number;
  knockdownFall: number;
  knockdownDown: number;
  knockdownRise: number;
  /** Speed factor after the enemy has got up once. */
  risenSpeedFactor: number;
}

export const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  affected: {
    hp: 100,
    walkSpeed: 1.3,
    runSpeed: PLAYER.jogSpeed,
    attackWindup: 0.55,
    attackCooldown: 1.4,
    damage: 30,
    staggerThreshold: 40,
    knockdownThreshold: 75,
    headshotMultiplier: 2,
    hitReactDuration: 0.25,
    staggerDuration: 0.45,
    knockdownFall: 1.1,
    knockdownDown: 0.7,
    knockdownRise: 1.4,
    risenSpeedFactor: 0.78,
  },
};

/** Difficulty presets: enemy speed relative to the player's jog, attack cooldown and damage. */
export interface DifficultyDef {
  label: string;
  hint: string;
  /** Enemy run speed as a fraction of the player's jog pace. */
  enemySpeed: number;
  attackCooldown: number;
  damage: number;
  /** Rounds found are scaled by this. */
  ammoFound: number;
}

export const DIFFICULTY_PRESETS: Record<DifficultyPreset, DifficultyDef> = {
  accessible: { label: 'Accessible', hint: 'Slower affected, longer pauses between attacks, lighter hits.', enemySpeed: 0.8, attackCooldown: 1.8, damage: 20, ammoFound: 1.3 },
  standard: { label: 'Standard', hint: 'The intended pace.', enemySpeed: 0.9, attackCooldown: 1.4, damage: 30, ammoFound: 1 },
  hard: { label: 'Hard', hint: 'Affected keep up with a jog, attack often and hit hard; fewer rounds found.', enemySpeed: 1.0, attackCooldown: 1.0, damage: 40, ammoFound: 0.66 },
};

export const DIFFICULTY_ORDER: readonly DifficultyPreset[] = ['accessible', 'standard', 'hard'];

/** Resolved numbers for one enemy kind under one preset (what the QA overlay shows). */
export interface ResolvedEnemyStats extends EnemyStats {
  preset: DifficultyPreset;
}

export function resolveEnemyStats(kind: EnemyKind, preset: DifficultyPreset): ResolvedEnemyStats {
  const base = ENEMY_STATS[kind];
  const def = DIFFICULTY_PRESETS[preset];
  return { ...base, preset, runSpeed: PLAYER.jogSpeed * def.enemySpeed, attackCooldown: def.attackCooldown, damage: def.damage };
}

/** Older saves and settings called the middle preset "normal". */
export function normaliseDifficulty(value: unknown): DifficultyPreset {
  if (value === 'accessible' || value === 'hard' || value === 'standard') return value;
  return 'standard';
}
