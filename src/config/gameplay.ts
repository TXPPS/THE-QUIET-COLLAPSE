/** Gameplay tuning. All gameplay numbers live here; systems import tokens, never literals. */
export const PLAYER = {
  radius: 0.38,
  height: 1.75,
  eyeHeight: 1.55,
  walkSpeed: 2.6,
  sprintSpeed: 5.0,
  aimWalkSpeed: 1.6,
  hurtSpeedFactor: 0.85,
  criticalSpeedFactor: 0.7,
  acceleration: 14,
  deceleration: 18,
  turnRate: 12,
  maxHealth: 100,
  hurtThreshold: 60,
  criticalThreshold: 30,
  maxStamina: 100,
  staminaDrainPerSec: 22,
  staminaRegenPerSec: 16,
  staminaRegenDelay: 0.9,
  staminaMinToSprint: 12,
  dodgeCost: 28,
  dodgeDuration: 0.36,
  dodgeDistance: 2.6,
  dodgeInvulnerable: 0.28,
  sprintNoiseRadius: 9,
  walkNoiseRadius: 3.5,
  hurtInvulnerable: 0.5,
} as const;

export const PISTOL = {
  magazine: 6,
  startLoaded: 6,
  startReserve: 0,
  damage: 40,
  range: 40,
  fireInterval: 0.42,
  reloadTime: 1.6,
  noiseRadius: 42,
  recoilPitch: 0.035,
  recoilYaw: 0.012,
  spreadAim: 0.006,
  raiseTime: 0.22,
} as const;

export const MEDKIT = {
  heal: 60,
  useTime: 1.4,
  startCount: 1,
} as const;

export const THREAT = {
  radius: 0.42,
  height: 1.8,
  maxHealth: 100,
  wanderSpeed: 0.7,
  investigateSpeed: 1.6,
  chaseSpeed: 3.1,
  sightRangeLit: 15,
  sightRangeDark: 7.5,
  sightRangeFlashlightBonus: 5,
  sightConeCos: 0.42,
  hearingSensitivity: 1,
  attackReach: 1.35,
  attackWindup: 0.55,
  attackRecover: 1.15,
  attackDamage: 26,
  attackKnockback: 1.4,
  staggerDuration: 0.45,
  loseTargetAfter: 5.5,
  repathInterval: 0.45,
  investigateTimeout: 8,
  wanderRadius: 4,
  wanderPause: 2.2,
  memoryOfPlayer: 3,
  separation: 0.9,
} as const;

export const CAMERA = {
  distance: 3.1,
  aimDistance: 1.55,
  height: 1.55,
  shoulderOffset: 0.48,
  aimShoulderOffset: 0.62,
  fov: 58,
  aimFov: 44,
  minPitch: -0.55,
  maxPitch: 0.75,
  collisionRadius: 0.28,
  followRate: 14,
  aimBlendRate: 12,
  fovBlendRate: 10,
  lookSensitivityBase: 0.0022,
  stickLookRateBase: 2.4,
  shakeDecay: 9,
} as const;

export const INTERACTION = {
  reach: 1.9,
  facingCos: 0.35,
  documentReadTime: 0,
} as const;

export const DIFFICULTY = {
  normal: { damageTaken: 1, ammoFound: 1 },
  hard: { damageTaken: 1.35, ammoFound: 0.66 },
} as const;
export type DifficultyId = keyof typeof DIFFICULTY;

export const FLASHLIGHT = {
  range: 18,
  angle: 0.42,
  penumbra: 0.6,
  intensity: 170,
} as const;

/** Spawn grounding: everything placed in the world drops onto the nearest surface below it. */
export const SPAWN = {
  /** Probe starts this far above the authored height so an item authored exactly on a surface still hits it. */
  probeLift: 0.5,
  /** Spawns with no surface within this distance below the probe are skipped. */
  maxDrop: 4,
  /** Authored height assumed when an entity has none. */
  defaultProbeHeight: 1.5,
  /** Half heights of the markers so their bottoms sit on the surface. */
  pickupLift: 0.09,
  documentLift: 0.01,
  radioLift: 0.1,
} as const;

export const RUN = {
  deathToGameOverDelay: 1.6,
  endingFadeDelay: 1.2,
  objectiveToastSeconds: 4.5,
  autosaveToastSeconds: 2.5,
} as const;
