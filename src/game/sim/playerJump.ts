import { PLAYER } from '@/config/gameplay';
import { length2 } from '@/core/math';
import type { ActionSnapshot } from '@/input/InputFrame';
import { pointInside, segmentBoxT } from './collision';
import type { PlayerRuntime } from './entities';
import type { Collider, Vec2 } from './types';
import type { World } from './World';

/** Step used when walking the vault ray through a collider to find its far side. */
const VAULT_PROBE_STEP = 0.05;
/** A landing spot that collision pushes further than this is blocked. */
const LANDING_TOLERANCE = 0.02;
/** Falls faster than this land "hard" (louder, heavier animation). */
const HARD_LANDING_SPEED = 5;
const scratch: Vec2 = { x: 0, z: 0 };

export interface MoveDirection {
  x: number;
  z: number;
  magnitude: number;
}

/** Camera-relative movement direction from the Move axis (not normalised; magnitude ≤ 1). */
export function moveDirection(world: World, input: ActionSnapshot, out: MoveDirection): MoveDirection {
  const move = input.axis('Move');
  const camYaw = world.look.yaw;
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  // Screen-right for a camera facing (fx, fz) is forward x up = (-fz, fx): +X is on the LEFT at yaw 0.
  const rx = -Math.cos(camYaw);
  const rz = Math.sin(camYaw);
  out.x = rx * move.x + fx * move.y;
  out.z = rz * move.x + fz * move.y;
  out.magnitude = length2(out.x, out.z);
  if (out.magnitude > 1) {
    out.x /= out.magnitude;
    out.z /= out.magnitude;
    out.magnitude = 1;
  }
  return out;
}

/**
 * Jump and vault. Jump is a short grounded hop with coyote time; when a waist-high collider tagged
 * `vaultable` sits within reach in the travel direction the same press climbs over it instead. Aiming,
 * reloading, healing and dodging all refuse the press; a shared Jump/Interact button interacts
 * when a prompt is showing.
 */
export function updateJump(world: World, input: ActionSnapshot, direction: MoveDirection, dt: number): void {
  const p = world.player;
  if (p.jumpState === 'vault') {
    advanceVault(world, p, dt);
    return;
  }
  if (p.jumpState === 'grounded') p.coyoteTimer = PLAYER.coyoteTime;
  else p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
  const pressed = input.justPressed('Jump') && !(world.interactAvailable && input.justPressed('Interact'));
  if (pressed && canJump(p)) {
    if (!tryVault(world, direction)) startJump(world);
  }
  if (p.jumpState === 'air') integrateAir(world, p, dt);
}

function canJump(p: PlayerRuntime): boolean {
  return p.coyoteTimer > 0 && !p.aiming && p.reloadTimer <= 0 && p.medkitTimer <= 0 && p.dodgeTimer <= 0 && !p.dead;
}

function startJump(world: World): void {
  const p = world.player;
  p.velY = PLAYER.jumpSpeed;
  p.jumpState = 'air';
  p.coyoteTimer = 0;
  world.events.emit('jump', undefined);
}

function integrateAir(world: World, p: PlayerRuntime, dt: number): void {
  p.y += p.velY * dt;
  p.velY -= PLAYER.gravity * dt;
  if (p.y <= 0 && p.velY < 0) {
    const hard = -p.velY >= HARD_LANDING_SPEED;
    p.y = 0;
    p.velY = 0;
    p.jumpState = 'grounded';
    p.coyoteTimer = PLAYER.coyoteTime;
    world.events.emit('land', { hard });
    world.events.emit('noise', { x: p.x, z: p.z, radius: hard ? PLAYER.sprintNoiseRadius : PLAYER.walkNoiseRadius, kind: 'land' });
  }
}

/** Looks for a vaultable collider ahead; on success starts the vault and returns true. */
export function tryVault(world: World, direction: MoveDirection): boolean {
  const p = world.player;
  let dirX: number;
  let dirZ: number;
  if (direction.magnitude > 0.1) {
    dirX = direction.x / direction.magnitude;
    dirZ = direction.z / direction.magnitude;
  } else {
    dirX = Math.sin(p.yaw);
    dirZ = Math.cos(p.yaw);
  }
  const reach = PLAYER.vaultReach + p.radius;
  const endX = p.x + dirX * reach;
  const endZ = p.z + dirZ * reach;
  let best: Collider | null = null;
  let bestT = Infinity;
  for (const collider of world.activeColliders) {
    if (!collider.vaultable || collider.height > PLAYER.vaultMaxHeight) continue;
    const t = segmentBoxT(p.x, p.z, endX, endZ, collider, p.radius * 0.5);
    if (t < 0 || t >= bestT) continue;
    bestT = t;
    best = collider;
  }
  if (!best) return false;
  // Walk the ray through the collider to its far side; too deep and it cannot be crossed.
  let x = p.x + dirX * reach * bestT;
  let z = p.z + dirZ * reach * bestT;
  let travelled = 0;
  while (pointInside(best, x, z, p.radius * 0.5) && travelled <= PLAYER.vaultMaxDepth) {
    x += dirX * VAULT_PROBE_STEP;
    z += dirZ * VAULT_PROBE_STEP;
    travelled += VAULT_PROBE_STEP;
  }
  if (travelled > PLAYER.vaultMaxDepth) return false;
  const landX = x + dirX * (p.radius + 0.2);
  const landZ = z + dirZ * (p.radius + 0.2);
  scratch.x = landX;
  scratch.z = landZ;
  world.resolveCircle(scratch, p.radius, best.id);
  if (length2(scratch.x - landX, scratch.z - landZ) > LANDING_TOLERANCE) return false;
  const bounds = world.level.bounds;
  if (landX < bounds.minX + 1 || landX > bounds.maxX - 1 || landZ < bounds.minZ + 1 || landZ > bounds.maxZ - 1) return false;
  p.jumpState = 'vault';
  p.vaultTimer = 0;
  p.vaultFrom.x = p.x;
  p.vaultFrom.z = p.z;
  p.vaultTo.x = landX;
  p.vaultTo.z = landZ;
  p.vaultHeight = best.height + PLAYER.vaultClearance;
  p.vaultColliderId = best.id;
  p.coyoteTimer = 0;
  p.sprinting = false;
  p.yaw = Math.atan2(dirX, dirZ);
  p.velX = (landX - p.x) / PLAYER.vaultDuration;
  p.velZ = (landZ - p.z) / PLAYER.vaultDuration;
  p.moving = true;
  world.events.emit('vault', { height: best.height });
  return true;
}

function advanceVault(world: World, p: PlayerRuntime, dt: number): void {
  p.vaultTimer += dt;
  const t = Math.min(1, p.vaultTimer / PLAYER.vaultDuration);
  const ease = t * t * (3 - 2 * t);
  p.x = p.vaultFrom.x + (p.vaultTo.x - p.vaultFrom.x) * ease;
  p.z = p.vaultFrom.z + (p.vaultTo.z - p.vaultFrom.z) * ease;
  p.y = Math.sin(Math.PI * t) * p.vaultHeight;
  p.moving = true;
  if (t < 1) return;
  p.y = 0;
  p.velY = 0;
  p.jumpState = 'grounded';
  p.vaultColliderId = null;
  p.coyoteTimer = PLAYER.coyoteTime;
  p.velX = 0;
  p.velZ = 0;
  world.events.emit('land', { hard: false });
}
