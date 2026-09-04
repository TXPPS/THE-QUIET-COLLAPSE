// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsStore } from '@/persistence/SettingsStore';
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from '@/persistence/settingsSchema';
import { storageKey } from '@/persistence/Storage';

describe('SettingsStore', () => {
  beforeEach(() => localStorage.clear());

  it('loads defaults when nothing is stored and persists updates with a version', () => {
    const store = new SettingsStore();
    expect(store.loadStatus).toBe('defaults');
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    store.update({ video: { fov: 70 }, controls: { policy: 'locked', primarySource: 'gamepad:0' } });
    const raw = JSON.parse(localStorage.getItem(storageKey('settings')) ?? '{}') as { v: number; data: { video: { fov: number } } };
    expect(raw.v).toBe(SETTINGS_VERSION);
    expect(raw.data.video.fov).toBe(70);
    const reloaded = new SettingsStore();
    expect(reloaded.get().controls.primarySource).toBe('gamepad:0');
  });

  it('clamps out-of-range numbers, rejects bad enums and drops unknown keys', () => {
    localStorage.setItem(
      storageKey('settings'),
      JSON.stringify({ v: 1, savedAt: 'x', data: { video: { fov: 500, quality: 'ultra', bogus: 1 }, audio: { master: -2 }, controls: { deadZoneRadial: 'nope' } } }),
    );
    const store = new SettingsStore();
    expect(store.loadStatus).toBe('ok');
    expect(store.get().video.fov).toBe(80);
    expect(store.get().video.quality).toBe('auto');
    expect(store.get().audio.master).toBe(0);
    expect(store.get().controls.deadZoneRadial).toBe(DEFAULT_SETTINGS.controls.deadZoneRadial);
    expect('bogus' in store.get().video).toBe(false);
  });

  it('recovers from corrupted JSON by rewriting defaults', () => {
    localStorage.setItem(storageKey('settings'), '{not json');
    const store = new SettingsStore();
    expect(store.loadStatus).toBe('recovered');
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    expect(new SettingsStore().loadStatus).toBe('ok');
  });

  it('emits change events with previous values and resets sections', () => {
    const store = new SettingsStore();
    const seen: number[] = [];
    store.events.on('change', ({ previous }) => seen.push(previous.video.fov));
    store.update({ video: { fov: 60 } });
    store.reset('video');
    expect(seen).toEqual([58, 60]);
    expect(store.get().video.fov).toBe(58);
  });
});
