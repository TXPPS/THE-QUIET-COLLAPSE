import type { ResolvedEnemyStats } from '@/config/enemies';
import { PLAYER, THREAT } from '@/config/gameplay';
import type { ThreatDef } from '@/game/level/types';
import type { ItemId } from '@/game/items/registry';
import type { EquippedItem, PlayerSaveState, ThreatAiState, ThreatSaveState, Vec2 } from './types';

export type JumpState = 'grounded' | 'air' | 'vault';

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
  /** Carried registry items by id. */
  readonly items: Record<string, number>;
  /** Which medical item the current application will consume. */
  healingItem: string = 'medkit';
  /** Medical item applied by the Quick item action (cycled with the d-pad). */
  quickItem: ItemId = 'medkit';
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
  meleeCooldown = 0;
  staminaRegenDelay = 0;
  footstepTimer = 0;
  dead = false;
  deathTimer = 0;
  /**
   * The one aim value: 0 lowered, 1 aimed (120 ms in, 180 ms out). Camera distance, shoulder, field
   * of view, crosshair and the arm layer all read this and nothing else.
   */
  weaponRaise = 0;
  prevWeaponRaise = 0;
  recoil = 0;
  lastHitDirX = 0;
  lastHitDirZ = 0;
  /* jump / vault */
  y = 0;
  prevY = 0;
  velY = 0;
  jumpState: JumpState = 'grounded';
  coyoteTimer = 0;
  vaultTimer = 0;
  vaultFrom: Vec2 = { x: 0, z: 0 };
  vaultTo: Vec2 = { x: 0, z: 0 };
  vaultHeight = 0;
  vaultColliderId: string | null = null;

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
    this.items = { ...(saved.items ?? {}) };
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
    return this.reloadTimer > 0 || this.medkitTimer > 0 || this.dodgeTimer > 0 || this.dead || this.jumpState === 'vault';
  }

  get airborne(): boolean {
    return this.jumpState !== 'grounded';
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
      items: { ...this.items },
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
  /** Combat statistics resolved for this enemy's kind and the run's difficulty preset. */
  readonly stats: ResolvedEnemyStats;
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
  /** Seconds until the next attack may start. */
  attackCooldown = 0;
  vocalTimer = 0;
  deathTimer = 0;
  staggerDirX = 0;
  staggerDirZ = 0;
  /** Seconds left in the current hit-react / stagger / knockdown. */
  reactionTimer = 0;
  /** Set once the enemy has been knocked down; it never goes down a second time and rises slower. */
  knockedDown = false;
  risen = false;
  riseSignalled = false;
  moving = false;
  /** Last goal handed to the crowd agent (null when idle). */
  navGoal: Vec2 | null = null;
  /** Whether the crowd agent currently steers this body (locomotion states only). */
  agentActive = false;

  constructor(def: ThreatDef, saved: ThreatSaveState | undefined, stats: ResolvedEnemyStats) {
    this.id = def.id;
    this.stats = stats;
    this.x = saved?.x ?? def.x;
    this.z = saved?.z ?? def.z;
    this.prevX = this.x;
    this.prevZ = this.z;
    this.yaw = saved?.yaw ?? def.yaw;
    this.health = saved?.health ?? stats.hp;
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

  /** Run speed after difficulty scaling and the slow-down that follows a knockdown. */
  get runSpeed(): number {
    return this.stats.runSpeed * (this.risen ? this.stats.risenSpeedFactor : 1);
  }

  get walkSpeed(): number {
    return this.stats.walkSpeed * (this.risen ? this.stats.risenSpeedFactor : 1);
  }

  toSave(): ThreatSaveState {
    return { x: this.x, z: this.z, yaw: this.yaw, health: this.health, alive: this.alive };
  }
}
