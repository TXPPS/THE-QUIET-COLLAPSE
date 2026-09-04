import { DIFFICULTY, MEDKIT, PISTOL } from '@/config/gameplay';
import type { PlayerRuntime } from '@/game/sim/entities';
import type { World } from '@/game/sim/World';

export type ItemCategory = 'medical' | 'ammo' | 'light' | 'key' | 'document';
export type ItemId = 'pistol' | 'rounds' | 'medkit' | 'dressing' | 'antiseptic' | 'flashlight' | 'radio_key';

export type UseEffect = { kind: 'heal'; amount: number; seconds: number } | { kind: 'reload' } | { kind: 'toggleLight' };

export interface ItemDef {
  id: ItemId;
  name: string;
  category: ItemCategory;
  /** Maximum carried; 1 for unique items. */
  stack: number;
  /** World marker mesh: a small box in this tint until a modelled pickup replaces it (PLACEHOLDER_ART). */
  mesh: { tint: number };
  examine: string;
  use?: UseEffect;
  /** Combining with `with` consumes one of each and yields `result`. */
  combine?: { with: ItemId; result: ItemId };
  /** Never shown as a countable entry (equipment and keys read as present/absent). */
  unique?: boolean;
}

const HEAL_DRESSING = 22;
const DRESSING_SECONDS = 1.1;

/**
 * Data-driven item table. Systems consume this through the helpers below; the pistol's
 * magazine, the medkit count and the flashlight stay dedicated player fields for save
 * compatibility, everything else lives in `player.items`.
 */
export const ITEMS: Record<ItemId, ItemDef> = {
  pistol: { id: 'pistol', name: 'Pistol', category: 'ammo', stack: 1, mesh: { tint: 0x4a4e52 }, unique: true, examine: `Compact service pistol. ${PISTOL.magazine}-round magazine. Rounds are scarce; every shot is a decision.`, use: { kind: 'reload' } },
  rounds: { id: 'rounds', name: 'Rounds', category: 'ammo', stack: 60, mesh: { tint: 0x6b6f63 }, examine: 'Loose pistol rounds. They go into the magazine on a reload.' },
  medkit: { id: 'medkit', name: 'First-aid kit', category: 'medical', stack: 5, mesh: { tint: 0x8a5a4a }, examine: `Dressings and antiseptic, packed. Restores ${MEDKIT.heal} health. Takes a moment to apply; do it somewhere quiet.`, use: { kind: 'heal', amount: MEDKIT.heal, seconds: MEDKIT.useTime } },
  dressing: { id: 'dressing', name: 'Field dressing', category: 'medical', stack: 5, mesh: { tint: 0xb8b09a }, examine: `A sealed sterile dressing. On its own it closes a wound for ${HEAL_DRESSING} health. With antiseptic it makes a full first-aid kit.`, use: { kind: 'heal', amount: HEAL_DRESSING, seconds: DRESSING_SECONDS }, combine: { with: 'antiseptic', result: 'medkit' } },
  antiseptic: { id: 'antiseptic', name: 'Antiseptic', category: 'medical', stack: 5, mesh: { tint: 0x6e8a7a }, examine: 'A small bottle from the pharmacy shelf. Useless alone; combined with a dressing it makes a first-aid kit.', combine: { with: 'dressing', result: 'medkit' } },
  flashlight: { id: 'flashlight', name: 'Flashlight', category: 'light', stack: 1, mesh: { tint: 0x4a4e52 }, unique: true, examine: 'Reliable, bright, and visible from a long way off.', use: { kind: 'toggleLight' } },
  radio_key: { id: 'radio_key', name: 'Back-room key', category: 'key', stack: 1, mesh: { tint: 0xc99a3a }, unique: true, examine: 'A brass key on a pharmacy lanyard. Someone kept the back room locked.' },
};

export const ITEM_ORDER: readonly ItemId[] = ['pistol', 'rounds', 'medkit', 'dressing', 'antiseptic', 'flashlight', 'radio_key'];

export function itemDef(id: ItemId): ItemDef {
  return ITEMS[id];
}

/** How many of an item the player carries (dedicated fields for the legacy items). */
export function countItem(p: PlayerRuntime, id: ItemId): number {
  if (id === 'pistol') return 1;
  if (id === 'rounds') return p.ammoReserve;
  if (id === 'medkit') return p.medkits;
  if (id === 'flashlight') return p.hasFlashlight ? 1 : 0;
  return p.items[id] ?? 0;
}

/** Adds `amount` (difficulty-scaled for rounds); returns the amount actually added. */
export function grantItem(world: World, id: ItemId, amount: number): number {
  const p = world.player;
  const def = ITEMS[id];
  if (id === 'rounds') {
    const scaled = Math.max(1, Math.round(amount * DIFFICULTY[world.difficulty].ammoFound));
    p.ammoReserve += scaled;
    return scaled;
  }
  if (id === 'medkit') {
    const added = Math.min(amount, def.stack - p.medkits);
    p.medkits += added;
    return added;
  }
  if (id === 'flashlight') {
    if (p.hasFlashlight) return 0;
    p.hasFlashlight = true;
    p.flashlightOn = true;
    world.events.emit('flashlight', { on: true });
    return 1;
  }
  if (id === 'pistol') return 0;
  const current = p.items[id] ?? 0;
  const added = Math.min(amount, def.stack - current);
  p.items[id] = current + added;
  return added;
}

export function consumeItem(p: PlayerRuntime, id: ItemId, amount = 1): boolean {
  if (countItem(p, id) < amount) return false;
  if (id === 'rounds') p.ammoReserve -= amount;
  else if (id === 'medkit') p.medkits -= amount;
  else if (id === 'flashlight') p.hasFlashlight = false;
  else if (id !== 'pistol') p.items[id] = (p.items[id] ?? 0) - amount;
  return true;
}

export function canCombine(p: PlayerRuntime, id: ItemId): boolean {
  const def = ITEMS[id];
  return Boolean(def.combine) && countItem(p, id) > 0 && countItem(p, def.combine!.with) > 0;
}

/** Consumes both parts and grants the result. Returns the result id or null. */
export function combineItem(world: World, id: ItemId): ItemId | null {
  const p = world.player;
  const def = ITEMS[id];
  if (!def.combine || !canCombine(p, id)) return null;
  consumeItem(p, id);
  consumeItem(p, def.combine.with);
  grantItem(world, def.combine.result, 1);
  world.events.emit('itemCombined', { result: def.combine.result });
  return def.combine.result;
}

/** Every carried item with its count, in registry order. */
export function carriedItems(p: PlayerRuntime): Array<{ def: ItemDef; count: number }> {
  return ITEM_ORDER.map((id) => ({ def: ITEMS[id], count: countItem(p, id) })).filter((entry) => entry.count > 0);
}
