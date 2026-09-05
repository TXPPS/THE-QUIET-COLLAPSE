import { PISTOL, PLAYER } from '@/config/gameplay';
import { consumeItem, countItem, itemDef, type ItemId } from '@/game/items/registry';
import { clamp, dampAngle, length2 } from '@/core/math';
import type { ActionSnapshot } from '@/input/InputFrame';
import { fireHitscan } from './combat';
import type { PlayerRuntime } from './entities';
import { cycleEquipped, cycleQuickItem, ensureQuickItem, tryMelee } from './playerActions';
import { moveDirection, updateJump, type MoveDirection } from './playerJump';
import type { Vec2 } from './types';
import type { World } from './World';

export interface PlayerInput extends ActionSnapshot {
  isEngaged(action: 'Aim' | 'Sprint'): boolean;
  clearToggle(action: 'Aim' | 'Sprint'): void;
}

const FOOTSTEP_INTERVAL_WALK = 0.52;
const FOOTSTEP_INTERVAL_SPRINT = 0.32;
const scratch: Vec2 = { x: 0, z: 0 };
const direction: MoveDirection = { x: 0, z: 0, magnitude: 0 };

/** Advances the player one fixed step. Movement is relative to the camera yaw. */
export function updatePlayer(world: World, input: PlayerInput, dt: number): void {
  const p = world.player;
  p.prevX = p.x;
  p.prevZ = p.z;
  p.prevY = p.y;
  p.prevWeaponRaise = p.weaponRaise;
  tickTimers(p, dt);
  if (p.dead) {
    p.deathTimer += dt;
    p.velX = 0;
    p.velZ = 0;
    return;
  }
  moveDirection(world, input, direction);
  handleEquipment(world, input);
  handleCombat(world, input, dt);
  handleMovement(world, input, dt);
  updateJump(world, input, direction, dt);
  applyMovement(world, dt);
  handleFacing(world, dt);
  handleFootsteps(world, dt);
}

function tickTimers(p: PlayerRuntime, dt: number): void {
  p.invulnTimer = Math.max(0, p.invulnTimer - dt);
  p.hurtTimer = Math.max(0, p.hurtTimer - dt);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.meleeCooldown = Math.max(0, p.meleeCooldown - dt);
  p.recoil = Math.max(0, p.recoil - dt * 4);
  p.staminaRegenDelay = Math.max(0, p.staminaRegenDelay - dt);
}

function handleEquipment(world: World, input: PlayerInput): void {
  const p = world.player;
  ensureQuickItem(p);
  if (input.justPressed('SwapItem') || input.justPressed('WeaponNext')) cycleEquipped(world, 1);
  else if (input.justPressed('WeaponPrev')) cycleEquipped(world, -1);
  if (input.justPressed('QuickItemNext')) cycleQuickItem(world, 1);
  else if (input.justPressed('QuickItemPrev')) cycleQuickItem(world, -1);
  if (input.justPressed('Flashlight') && p.hasFlashlight) {
    p.flashlightOn = !p.flashlightOn;
    world.events.emit('flashlight', { on: p.flashlightOn });
  }
}

/**
 * Aim is one value with one owner: `weaponRaise` ramps 0→1 in 120 ms and back in 180 ms, and the
 * camera, crosshair and arm layer all read it. Firing waits for the ramp to finish.
 */
function handleCombat(world: World, input: PlayerInput, dt: number): void {
  const p = world.player;
  const wantsAim = input.isEngaged('Aim') && !p.dead && p.dodgeTimer <= 0 && p.medkitTimer <= 0 && p.jumpState !== 'vault';
  p.aiming = wantsAim;
  p.weaponRaise = clamp(p.weaponRaise + (wantsAim ? dt / PISTOL.aimInTime : -dt / PISTOL.aimOutTime), 0, 1);
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
  if (input.justPressed('QuickItem')) tryMedkit(world, p.quickItem);
  if (input.justPressed('Melee')) tryMelee(world);
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
  if (p.equipped !== 'pistol' || p.ammoLoaded >= PISTOL.magazine || p.ammoReserve <= 0 || p.reloadTimer > 0 || p.airborne) return;
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
  if (countItem(p, item) <= 0 || p.health >= PLAYER.maxHealth || p.medkitTimer > 0 || p.airborne) return;
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
  if (p.jumpState === 'vault') return; // the vault owns position until it lands
  const magnitude = direction.magnitude;
  const dirX = direction.x;
  const dirZ = direction.z;
  if (p.dodgeTimer > 0) {
    p.dodgeTimer -= dt;
    const speed = PLAYER.dodgeDistance / PLAYER.dodgeDuration;
    p.velX = p.dodgeDirX * speed;
    p.velZ = p.dodgeDirZ * speed;
    return;
  }
  const canDodge = p.stamina >= PLAYER.dodgeCost && !p.isBusy && p.medkitTimer <= 0 && !p.airborne;
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
  // In the air the direction still steers, but slower: no sudden reversals mid-jump.
  const rate = (magnitude > 0.05 ? PLAYER.acceleration : PLAYER.deceleration) * (p.airborne ? 0.35 : 1);
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
  if (p.jumpState === 'vault') {
    // The vault set the position; only keep it out of everything except the collider being crossed.
    scratch.x = p.x;
    scratch.z = p.z;
    world.resolveCircle(scratch, p.radius, p.vaultColliderId);
  } else {
    scratch.x = p.x + p.velX * dt;
    scratch.z = p.z + p.velZ * dt;
    world.resolveCircle(scratch, p.radius);
  }
  p.x = clamp(scratch.x, world.level.bounds.minX + 1, world.level.bounds.maxX - 1);
  p.z = clamp(scratch.z, world.level.bounds.minZ + 1, world.level.bounds.maxZ - 1);
}

function handleFacing(world: World, dt: number): void {
  const p = world.player;
  if (p.jumpState === 'vault') return;
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
  if (speed < 0.4 || p.airborne) {
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

/** Applies damage from a threat; honours dodge/hit invulnerability. Damage already carries the difficulty preset. */
export function damagePlayer(world: World, amount: number, fromX: number, fromZ: number): boolean {
  const p = world.player;
  if (p.dead || p.invulnTimer > 0) return false;
  p.health = Math.max(0, p.health - amount);
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
  world.events.emit('playerHurt', { amount, health: p.health });
  if (p.health <= 0) {
    p.dead = true;
    p.deathTimer = 0;
    p.aiming = false;
    world.events.emit('playerDied', undefined);
  }
  return true;
}
