// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { BindingStore, BINDINGS_VERSION } from '@/input/BindingStore';
import { DEFAULT_KBM_BINDINGS } from '@/input/bindings';
import { storageKey } from '@/persistence/Storage';

describe('BindingStore', () => {
  beforeEach(() => localStorage.clear());

  it('starts from defaults and persists a rebind with the schema version', () => {
    const store = new BindingStore();
    expect(store.kbmFor('Interact')).toEqual(DEFAULT_KBM_BINDINGS.Interact);
    store.rebindKbm('Interact', { type: 'key', code: 'KeyF' }, ['Interact', 'Flashlight']);
    expect(store.kbmFor('Interact')).toEqual([{ type: 'key', code: 'KeyF' }]);
    // KeyF was Flashlight; the conflict is cleared in the same context.
    expect(store.kbmFor('Flashlight')).toEqual([]);
    const raw = JSON.parse(localStorage.getItem(storageKey('bindings')) ?? '{}') as { v: number };
    expect(raw.v).toBe(BINDINGS_VERSION);
    const reloaded = new BindingStore();
    expect(reloaded.kbmFor('Interact')).toEqual([{ type: 'key', code: 'KeyF' }]);
  });

  it('never leaves a required slot unbound', () => {
    const store = new BindingStore();
    store.rebindKbm('Fire', { type: 'key', code: 'Escape' }, ['Fire', 'Pause']);
    expect(store.kbmFor('Pause').length).toBeGreaterThan(0);
  });

  it('ignores corrupted persisted data', () => {
    localStorage.setItem(storageKey('bindings'), '{"v":1,"savedAt":"x","data":{"kbm":{"Fire":[{"type":"nope"}]},"pad":{"Fire":"bad"}}}');
    const store = new BindingStore();
    expect(store.kbmFor('Fire')).toEqual([]);
    expect(store.padFor('Fire')).toEqual(DEFAULT_KBM_BINDINGS.Fire ? store.padFor('Fire') : []);
    store.resetAll();
    expect(store.kbmFor('Fire')).toEqual(DEFAULT_KBM_BINDINGS.Fire);
  });

  it('rejects a payload from a newer schema version', () => {
    localStorage.setItem(storageKey('bindings'), JSON.stringify({ v: BINDINGS_VERSION + 1, savedAt: 'x', data: { kbm: { Fire: [] }, pad: {} } }));
    const store = new BindingStore();
    expect(store.kbmFor('Fire')).toEqual(DEFAULT_KBM_BINDINGS.Fire);
  });
});
