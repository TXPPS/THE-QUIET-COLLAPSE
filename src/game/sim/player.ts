import { DIFFICULTY, PISTOL, PLAYER } from '@/config/gameplay';
import { consumeItem, countItem, itemDef, type ItemId } from '@/game/items/registry';
import { clamp, dampAngle, length2 } from '@/core/math';
import type { ActionSnapshot } from '@/input/InputFrame';
import { fireHitscan } from './combat';
import type { PlayerRuntime } from './entities';
import type { Vec2 } from './types';
import type { World } from './World';

export interface PlayerInput extends ActionSnapshot {
  isEngaged(action: 'Aim' | 'Sprint'): boolean;
  clearToggle(action: 'Aim' | 'Sprint'): void;
}

const FOOTSTEP_INTERVAL_WALK = 0.52;
const FOOTSTEP_INTERVAL_SPRINT = 0.32;
const scratch: Vec2 = { x: 0, z: 0 };

/** Advances the player one fixed step. Movement is relative to the camera yaw. */
export function updatePlayer(world: World, input: PlayerInput, dt: number): void {
  const p = world.player;
  p.prevX = p.x;
  p.prevZ = p.z;
  tickTimers(p, dt);
  if (p.dead) {
    p.deathTimer += dt;
    p.velX = 0;
    p.velZ = 0;
    return;
  }
  handleEquipment(world, input);
  handleCombat(world, input, dt);
  handleMovement(world, input, dt);
  applyMovement(world, dt);
  handleFacing(world, dt);
  handleFootsteps(world, dt);
}

function tickTimers(p: PlayerRuntime, dt: number): void {
  p.invulnTimer = Math.max(0, p.invulnTimer - dt);
  p.hurtTimer = Math.max(0, p.hurtTimer - dt);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.recoil = Math.max(0, p.recoil - dt * 4);
  p.staminaRegenDelay = Math.max(0, p.staminaRegenDelay - dt);
}

function handleEquipment(world: World, input: PlayerInput): void {
  const p = world.player;
  if (input.justPressed('SwapItem') && !p.isBusy) {
    p.equipped = p.equipped === 'pistol' ? 'medkit' : 'pistol';
    world.events.emit('equip', { item: p.equipped });
  }
  if (input.justPressed('Flashlight') && p.hasFlashlight) {
    p.flashlightOn = !p.flashlightOn;
    world.events.emit('flashlight', { on: p.flashlightOn });
  }
}

function handleCombat(world: World, input: PlayerInput, dt: number): void {
  const p = world.player;
  const wantsAim = input.isEngaged('Aim') && !p.dead && p.dodgeTimer <= 0 && p.medkitTimer <= 0;
  p.aiming = wantsAim;
  p.weaponRaise = clamp(p.weaponRaise + (wantsAim ? dt / PISTOL.raiseTime : -dt / PISTOL.raiseTime), 0, 1);
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) finishReload(world);
    return;
  }
  if (p.medkitTimer > 0) {
    p.medkitTimer -= dt;
    if (p.medkitTimer <= 0) finishMedkit(world);
    return;
  }
  if (input.justPressed('Reload')) tryReload(world);
  if (!wantsAim || p.weaponRaise < 1) return;
  if (input.justPressed('Fire')) {
    if (p.equipped === 'medkit') tryMedkit(world);
    else tryFire(world);
  }
}

function tryFire(world: World): void {
  const p = world.player;
  if (p.fireCooldown > 0) return;
  if (p.ammoLoaded <= 0) {
    p.fireCooldown = PISTOL.fireInterval;
    world.events.emit('dryFire', undefined);
    if (p.ammoReserve > 0) tryReload(world);
    return;
  }
  p.ammoLoaded -= 1;
  p.fireCooldown = PISTOL.fireInterval;
  p.recoil = 1;
  const result = fireHitscan(world);
  world.events.emit('shot', { x: p.x, z: p.z, hit: result.hit });
  world.events.emit('noise', { x: p.x, z: p.z, radius: PISTOL.noiseRadius, kind: 'gunshot' });
  if (!result.hit) world.events.emit('impact', result.impact);
}

export function tryReload(world: World): void {
  const p = world.player;
  if (p.equipped !== 'pistol' || p.ammoLoaded >= PISTOL.magazine || p.ammoReserve <= 0 || p.reloadTimer > 0) return;
  p.reloadTimer = PISTOL.reloadTime;
  world.events.emit('reloadStart', undefined);
}

function finishReload(world: World): void {
  const p = world.player;
  const needed = PISTOL.magazine - p.ammoLoaded;
  const moved = Math.min(needed, p.ammoReserve);
  p.ammoLoaded += moved;
  p.ammoReserve -= moved;
  p.reloadTimer = 0;
  world.events.emit('reloadDone', undefined);
}

/** Starts applying a medical item (kit by default); the effect lands when its timer runs out. */
export function tryMedkit(world: World, item: ItemId = 'medkit'): void {
  const p = world.player;
  const use = itemDef(item).use;
  if (!use || use.kind !== 'heal') return;
  if (countItem(p, item) <= 0 || p.health >= PLAYER.maxHealth || p.medkitTimer > 0) return;
  p.healingItem = item;
  p.medkitTimer = use.seconds;
}

function finishMedkit(world: World): void {
  const p = world.player;
  const item = p.healingItem as ItemId;
  const use = itemDef(item).use;
  p.medkitTimer = 0;
  if (!use || use.kind !== 'heal' || !consumeItem(p, item)) return;
  p.health = Math.min(PLAYER.maxHealth, p.health + use.amount);
  world.events.emit('medkitUsed', undefined);
  world.events.emit('playerHealed', { health: p.health });
}

function handleMovement(world: World, input: PlayerInput, dt: number): void {
  const p = world.player;
  const move = input.axis('Move');
  const camYaw = world.look.yaw;
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  // Screen-right for a camera facing (fx, fz) is forward x up = (-fz, fx): +X is on the LEFT at yaw 0.
  const rx = -Math.cos(camYaw);
  const rz = Math.sin(camYaw);
  let dirX = rx * move.x + fx * move.y;
  let dirZ = rz * move.x + fz * move.y;
  const magnitude = length2(dirX, dirZ);
  if (magnitude > 1) {
    dirX /= magnitude;
    dirZ /= magnitude;
  }
  if (p.dodgeTimer > 0) {
    p.dodgeTimer -= dt;
    const speed = PLAYER.dodgeDistance / PLAYER.dodgeDuration;
    p.velX = p.dodgeDirX * speed;
    p.velZ = p.dodgeDirZ * speed;
    return;
  }
  const canDodge = p.stamina >= PLAYER.dodgeCost && !p.isBusy && p.medkitTimer <= 0;
  if (input.justPressed('Dodge') && canDodge) {
    startDodge(world, magnitude > 0.1 ? dirX : -Math.sin(p.yaw), magnitude > 0.1 ? dirZ : -Math.cos(p.yaw));
    return;
  }
  const wantsSprint = input.isEngaged('Sprint') && magnitude > 0.1 && !p.aiming && p.medkitTimer <= 0;
  if (wantsSprint && p.stamina > (p.sprinting ? 0 : PLAYER.staminaMinToSprint)) {
    p.sprinting = true;
    p.stamina = Math.max(0, p.stamina - PLAYER.staminaDrainPerSec * dt);
    p.staminaRegenDelay = PLAYER.staminaRegenDelay;
    if (p.stamina <= 0) {
      p.sprinting = false;
      input.clearToggle('Sprint');
    }
  } else {
    p.sprinting = false;
    if (p.staminaRegenDelay <= 0) p.stamina = Math.min(PLAYER.maxStamina, p.stamina + PLAYER.staminaRegenPerSec * dt);
  }
  // Speed scales linearly with deflection: normalise the direction so it is not applied twice.
  const speed = targetSpeed(p) * magnitude;
  const nx = magnitude > 1e-6 ? dirX / magnitude : 0;
  const nz = magnitude > 1e-6 ? dirZ / magnitude : 0;
  const targetX = nx * speed;
  const targetZ = nz * speed;
  const rate = magnitude > 0.05 ? PLAYER.acceleration : PLAYER.deceleration;
  const blend = 1 - Math.exp(-rate * dt);
  p.velX += (targetX - p.velX) * blend;
  p.velZ += (targetZ - p.velZ) * blend;
  p.moving = magnitude > 0.05;
}

function startDodge(world: World, dirX: number, dirZ: number): void {
  const p = world.player;
  const len = length2(dirX, dirZ) || 1;
  p.dodgeDirX = dirX / len;
  p.dodgeDirZ = dirZ / len;
  p.dodgeTimer = PLAYER.dodgeDuration;
  p.invulnTimer = Math.max(p.invulnTimer, PLAYER.dodgeInvulnerable);
  p.stamina -= PLAYER.dodgeCost;
  p.staminaRegenDelay = PLAYER.staminaRegenDelay;
  p.sprinting = false;
  world.events.emit('dodge', undefined);
}

function targetSpeed(p: PlayerRuntime): number {
  let speed: number = p.sprinting ? PLAYER.sprintSpeed : p.aiming ? PLAYER.aimWalkSpeed : PLAYER.walkSpeed;
  if (p.medkitTimer > 0 || p.reloadTimer > 0) speed = Math.min(speed, PLAYER.aimWalkSpeed);
  const condition = p.condition;
  if (condition === 'hurt') speed *= PLAYER.hurtSpeedFactor;
  else if (condition === 'critical') speed *= PLAYER.criticalSpeedFactor;
  return speed;
}

function applyMovement(world: World, dt: number): void {
  const p = world.player;
  scratch.x = p.x + p.velX * dt;
  scratch.z = p.z + p.velZ * dt;
  world.resolveCircle(scratch, p.radius);
  p.x = clamp(scratch.x, world.level.bounds.minX + 1, world.level.bounds.maxX - 1);
  p.z = clamp(scratch.z, world.level.bounds.minZ + 1, world.level.bounds.maxZ - 1);
}

function handleFacing(world: World, dt: number): void {
  const p = world.player;
  if (p.aiming || p.reloadTimer > 0) {
    p.yaw = dampAngle(p.yaw, world.look.yaw, PLAYER.turnRate * 1.5, dt);
    return;
  }
  const speed = length2(p.velX, p.velZ);
  if (speed > 0.2) p.yaw = dampAngle(p.yaw, Math.atan2(p.velX, p.velZ), PLAYER.turnRate, dt);
}

function handleFootsteps(world: World, dt: number): void {
  const p = world.player;
  const speed = length2(p.velX, p.velZ);
  if (speed < 0.4) {
    p.footstepTimer = 0.1;
    return;
  }
  p.footstepTimer -= dt;
  if (p.footstepTimer > 0) return;
  p.footstepTimer = p.sprinting ? FOOTSTEP_INTERVAL_SPRINT : FOOTSTEP_INTERVAL_WALK;
  if (!world.animatedFootsteps) world.events.emit('footstep', { x: p.x, z: p.z, surface: world.surfaceAt(p.x, p.z), sprint: p.sprinting });
  world.events.emit('noise', {
    x: p.x,
    z: p.z,
    radius: p.sprinting ? PLAYER.sprintNoiseRadius : PLAYER.walkNoiseRadius,
    kind: p.sprinting ? 'sprint' : 'footstep',
  });
}

/** Applies damage from a threat; honours dodge/hit invulnerability and difficulty. */
export function damagePlayer(world: World, amount: number, fromX: number, fromZ: number): boolean {
  const p = world.player;
  if (p.dead || p.invulnTimer > 0) return false;
  const scaled = amount * DIFFICULTY[world.difficulty].damageTaken;
  p.health = Math.max(0, p.health - scaled);
  p.invulnTimer = PLAYER.hurtInvulnerable;
  p.hurtTimer = 0.6;
  const dx = p.x - fromX;
  const dz = p.z - fromZ;
  const len = length2(dx, dz) || 1;
  p.lastHitDirX = dx / len;
  p.lastHitDirZ = dz / len;
  p.velX += (dx / len) * 3;
  p.velZ += (dz / len) * 3;
  p.medkitTimer = 0;
  world.events.emit('playerHurt', { amount: scaled, health: p.health });
  if (p.health <= 0) {
    p.dead = true;
    p.deathTimer = 0;
    p.aiming = false;
    world.events.emit('playerDied', undefined);
  }
  return true;
}
