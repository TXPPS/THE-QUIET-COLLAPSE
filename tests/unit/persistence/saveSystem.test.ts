// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DISTRICT_LEVEL } from '@/game/level/districtLevel';
import { createNewRun, validateRunState } from '@/game/sim/runState';
import type { RunState } from '@/game/sim/types';
import { SaveSystem, SAVE_VERSION } from '@/persistence/SaveSystem';
import { storageKey } from '@/persistence/Storage';

const header = { playtimeSec: 12, objectiveLabel: 'Leave', locationLabel: 'Stairwell', difficulty: 'standard' as const, checkpointId: 'start' };

describe('SaveSystem', () => {
  beforeEach(() => localStorage.clear());

  it('lists empty slots, saves, loads and picks the most recent slot', () => {
    const saves = new SaveSystem<RunState>(validateRunState);
    expect(saves.listSlots().map((s) => s.status)).toEqual(['empty', 'empty', 'empty']);
    const run = createNewRun(DISTRICT_LEVEL, 'standard', 7);
    expect(saves.save(2, header, run)).toBe(true);
    const info = saves.inspect(2);
    expect(info.status).toBe('ok');
    expect(info.header?.slot).toBe(2);
    expect(saves.load(2)?.run).toEqual(run);
    expect(saves.mostRecentSlot()?.slot).toBe(2);
    expect(saves.firstEmptySlot()).toBe(1);
  });

  it('reports corrupt and unsupported slots without throwing and lets them be deleted', () => {
    const saves = new SaveSystem<RunState>(validateRunState);
    localStorage.setItem(storageKey('save.slot1'), 'garbage');
    localStorage.setItem(storageKey('save.slot2'), JSON.stringify({ v: SAVE_VERSION + 5, savedAt: 'x', data: {} }));
    localStorage.setItem(storageKey('save.slot3'), JSON.stringify({ v: SAVE_VERSION, savedAt: 'x', data: { header: {}, run: { version: 1 } } }));
    expect(saves.listSlots().map((s) => s.status)).toEqual(['corrupt', 'unsupported', 'corrupt']);
    expect(saves.load(1)).toBeNull();
    expect(saves.mostRecentSlot()).toBeNull();
    saves.delete(1);
    expect(saves.inspect(1).status).toBe('empty');
  });

  it('rejects run payloads with the wrong shape', () => {
    const run = createNewRun(DISTRICT_LEVEL, 'standard', 7);
    expect(validateRunState(run)).toBe(true);
    expect(validateRunState({ ...run, player: { ...run.player, health: 'full' } })).toBe(false);
    expect(validateRunState({ ...run, threats: { a: { x: 1 } } })).toBe(false);
    expect(validateRunState({ ...run, version: 99 })).toBe(false);
    expect(validateRunState(null)).toBe(false);
  });
});
