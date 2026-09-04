import { PLAYER, THREAT } from '@/config/gameplay';
import type { ThreatDef } from '@/game/level/types';
import type { EquippedItem, PlayerSaveState, ThreatAiState, ThreatSaveState, Vec2 } from './types';

/** Player simulation state: persisted fields plus transient timers that never reach a save. */
export class PlayerRuntime {
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
  yaw: number;
  velX = 0;
  velZ = 0;
  health: number;
  stamina: number;
  ammoLoaded: number;
  ammoReserve: number;
  medkits: number;
  hasFlashlight: boolean;
  flashlightOn: boolean;
  equipped: EquippedItem;
  // transient
  sprinting = false;
  aiming = false;
  moving = false;
  dodgeTimer = 0;
  dodgeDirX = 0;
  dodgeDirZ = 0;
  invulnTimer = 0;
  hurtTimer = 0;
  reloadTimer = 0;
  fireCooldown = 0;
  medkitTimer = 0;
  staminaRegenDelay = 0;
  footstepTimer = 0;
  dead = false;
  deathTimer = 0;
  weaponRaise = 0;
  recoil = 0;
  lastHitDirX = 0;
  lastHitDirZ = 0;

  constructor(saved: PlayerSaveState) {
    this.x = saved.x;
    this.z = saved.z;
    this.prevX = saved.x;
    this.prevZ = saved.z;
    this.yaw = saved.yaw;
    this.health = saved.health;
    this.stamina = saved.stamina;
    this.ammoLoaded = saved.ammoLoaded;
    this.ammoReserve = saved.ammoReserve;
    this.medkits = saved.medkits;
    this.hasFlashlight = saved.hasFlashlight;
    this.flashlightOn = saved.flashlightOn;
    this.equipped = saved.equipped;
  }

  get radius(): number {
    return PLAYER.radius;
  }

  get condition(): 'fine' | 'hurt' | 'critical' {
    if (this.health <= PLAYER.criticalThreshold) return 'critical';
    if (this.health <= PLAYER.hurtThreshold) return 'hurt';
    return 'fine';
  }

  get isBusy(): boolean {
    return this.reloadTimer > 0 || this.medkitTimer > 0 || this.dodgeTimer > 0 || this.dead;
  }

  toSave(): PlayerSaveState {
    return {
      x: this.x,
      z: this.z,
      yaw: this.yaw,
      health: this.health,
      stamina: this.stamina,
      ammoLoaded: this.ammoLoaded,
      ammoReserve: this.ammoReserve,
      medkits: this.medkits,
      hasFlashlight: this.hasFlashlight,
      flashlightOn: this.flashlightOn,
      equipped: this.equipped,
    };
  }
}

export class ThreatRuntime {
  readonly id: string;
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
  yaw: number;
  health: number;
  alive: boolean;
  state: ThreatAiState;
  readonly wanders: boolean;
  readonly home: Vec2;
  velX = 0;
  velZ = 0;
  path: Vec2[] | null = null;
  pathIndex = 0;
  repathTimer = 0;
  target: Vec2 = { x: 0, z: 0 };
  lastSeenPlayer: Vec2 | null = null;
  timeSinceSeen = Infinity;
  awareness = 0;
  stateTimer = 0;
  wanderTimer = 0;
  attackLanded = false;
  vocalTimer = 0;
  deathTimer = 0;
  staggerDirX = 0;
  staggerDirZ = 0;
  moving = false;

  constructor(def: ThreatDef, saved: ThreatSaveState | undefined) {
    this.id = def.id;
    this.x = saved?.x ?? def.x;
    this.z = saved?.z ?? def.z;
    this.prevX = this.x;
    this.prevZ = this.z;
    this.yaw = saved?.yaw ?? def.yaw;
    this.health = saved?.health ?? THREAT.maxHealth;
    this.alive = saved?.alive ?? true;
    this.state = this.alive ? 'idle' : 'dead';
    this.wanders = def.wander;
    this.home = { x: def.x, z: def.z };
    this.target.x = this.x;
    this.target.z = this.z;
  }

  get radius(): number {
    return THREAT.radius;
  }

  toSave(): ThreatSaveState {
    return { x: this.x, z: this.z, yaw: this.yaw, health: this.health, alive: this.alive };
  }
}
