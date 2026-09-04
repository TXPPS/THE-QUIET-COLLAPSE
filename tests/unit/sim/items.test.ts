import { describe, expect, it } from 'vitest';
import { DISTRICT_LEVEL } from '@/game/level/districtLevel';
import { canCombine, carriedItems, combineItem, countItem, grantItem, ITEMS } from '@/game/items/registry';
import { createNewRun, validateRunState } from '@/game/sim/runState';
import { tryMedkit } from '@/game/sim/player';
import { World } from '@/game/sim/World';
import { createHeadless, stepFor, walkAndInteract } from '../../helpers/headless';

describe('item registry', () => {
  it('grants, counts, combines and persists registry items', () => {
    const world = new World(DISTRICT_LEVEL, createNewRun(DISTRICT_LEVEL, 'normal', 7));
    expect(grantItem(world, 'dressing', 1)).toBe(1);
    expect(grantItem(world, 'antiseptic', 1)).toBe(1);
    expect(countItem(world.player, 'dressing')).toBe(1);
    expect(canCombine(world.player, 'dressing')).toBe(true);
    const before = world.player.medkits;
    expect(combineItem(world, 'dressing')).toBe('medkit');
    expect(world.player.medkits).toBe(before + 1);
    expect(countItem(world.player, 'dressing')).toBe(0);
    expect(countItem(world.player, 'antiseptic')).toBe(0);
    grantItem(world, 'radio_key', 1);
    const saved = world.toRunState();
    expect(saved.player.items).toEqual({ dressing: 0, antiseptic: 0, radio_key: 1 });
    expect(validateRunState(saved)).toBe(true);
    const restored = new World(DISTRICT_LEVEL, saved);
    expect(countItem(restored.player, 'radio_key')).toBe(1);
    expect(carriedItems(restored.player).map((entry) => entry.def.id)).toEqual(['pistol', 'medkit', 'radio_key']);
  });

  it('respects stack limits and accepts v1 saves without an items map', () => {
    const run = createNewRun(DISTRICT_LEVEL, 'normal', 8);
    delete run.player.items;
    expect(validateRunState(run)).toBe(true);
    const world = new World(DISTRICT_LEVEL, run);
    expect(grantItem(world, 'dressing', 99)).toBe(ITEMS.dressing.stack);
    expect(grantItem(world, 'flashlight', 1)).toBe(1);
    expect(grantItem(world, 'flashlight', 1)).toBe(0);
  });

  it('applies a field dressing for its own heal amount over its own time', () => {
    const h = createHeadless(undefined, { killThreats: true });
    const p = h.world.player;
    p.health = 40;
    grantItem(h.world, 'dressing', 1);
    tryMedkit(h.world, 'dressing');
    expect(p.medkitTimer).toBeGreaterThan(0);
    stepFor(h, 2);
    expect(p.health).toBe(40 + (ITEMS.dressing.use?.kind === 'heal' ? ITEMS.dressing.use.amount : 0));
    expect(countItem(p, 'dressing')).toBe(0);
  });

  it('world pickups go through the registry', () => {
    const h = createHeadless(undefined, { killThreats: true });
    h.world.setDoor('door_stairwell', true);
    h.world.setDoor('door_pharmacy', true);
    const antiseptic = DISTRICT_LEVEL.pickups.find((p) => p.id === 'pk_antiseptic_shelf')!;
    expect(walkAndInteract(h, antiseptic, 120)).toBe(true);
    expect(countItem(h.world.player, 'antiseptic')).toBe(1);
    expect(h.events).toContain('pickup:pk_antiseptic_shelf');
  });
});
