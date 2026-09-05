import { PLAYER } from '@/config/gameplay';
import { countItem, ITEM_ORDER, ITEMS, type ItemId } from '@/game/items/registry';
import { length2 } from '@/core/math';
import type { PlayerRuntime } from './entities';
import { damageThreat } from './threatState';
import { EQUIPPABLE, type EquippedItem } from './types';
import type { World } from './World';

/** Medical items that can sit in the quick slot, in registry order. */
export const QUICK_ITEMS: readonly ItemId[] = ITEM_ORDER.filter((id) => ITEMS[id].category === 'medical' && ITEMS[id].use?.kind === 'heal');

/** Swaps the held weapon/item forward or backward through the equippable list. */
export function cycleEquipped(world: World, direction: 1 | -1): void {
  const p = world.player;
  if (p.isBusy) return;
  const index = EQUIPPABLE.indexOf(p.equipped);
  const next = EQUIPPABLE[(index + direction + EQUIPPABLE.length) % EQUIPPABLE.length] as EquippedItem;
  if (next === p.equipped) return;
  p.equipped = next;
  world.events.emit('equip', { item: p.equipped });
}

/** Keeps the quick slot on something the player actually carries (first carried medical item otherwise). */
export function ensureQuickItem(p: PlayerRuntime): void {
  if (countItem(p, p.quickItem) > 0) return;
  const carried = QUICK_ITEMS.find((id) => countItem(p, id) > 0);
  if (carried) p.quickItem = carried;
}

/** D-pad up/down: moves the quick slot to the next carried medical item. */
export function cycleQuickItem(world: World, direction: 1 | -1): void {
  const p = world.player;
  const carried = QUICK_ITEMS.filter((id) => countItem(p, id) > 0);
  if (carried.length === 0) return;
  const index = carried.indexOf(p.quickItem);
  const next = carried[((index < 0 ? 0 : index) + direction + carried.length) % carried.length] as ItemId;
  if (next === p.quickItem && carried.length === 1) {
    world.events.emit('quickItemChanged', { item: p.quickItem });
    return;
  }
  p.quickItem = next;
  world.events.emit('quickItemChanged', { item: p.quickItem });
}

/**
 * Melee shove: a short, telegraphed push at the nearest affected in front of the camera. Costs
 * stamina, always staggers (so it buys distance), never kills outright at full health.
 */
export function tryMelee(world: World): boolean {
  const p = world.player;
  if (p.meleeCooldown > 0 || p.isBusy || p.airborne || p.stamina < PLAYER.meleeCost) return false;
  p.meleeCooldown = PLAYER.meleeCooldown;
  p.stamina -= PLAYER.meleeCost;
  p.staminaRegenDelay = PLAYER.staminaRegenDelay;
  const fx = Math.sin(world.look.yaw);
  const fz = Math.cos(world.look.yaw);
  let hit = false;
  let bestDistance = PLAYER.meleeReach + p.radius;
  let target = null as (typeof world.threats)[number] | null;
  for (const threat of world.threats) {
    if (!threat.alive) continue;
    const dx = threat.x - p.x;
    const dz = threat.z - p.z;
    const distance = length2(dx, dz);
    if (distance > bestDistance) continue;
    if ((dx * fx + dz * fz) / (distance || 1) < PLAYER.meleeCos && distance > p.radius + threat.radius + 0.05) continue;
    bestDistance = distance;
    target = threat;
  }
  if (target) {
    hit = true;
    damageThreat(world, target, PLAYER.meleeDamage, { melee: true, dirX: target.x - p.x, dirZ: target.z - p.z });
    // The push itself: the body shifts back along the shove.
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const len = length2(dx, dz) || 1;
    target.x += (dx / len) * PLAYER.meleePush * 0.25;
    target.z += (dz / len) * PLAYER.meleePush * 0.25;
  }
  p.yaw = world.look.yaw;
  world.events.emit('melee', { hit, x: p.x, z: p.z });
  world.events.emit('noise', { x: p.x, z: p.z, radius: PLAYER.walkNoiseRadius, kind: 'impact' });
  return hit;
}
