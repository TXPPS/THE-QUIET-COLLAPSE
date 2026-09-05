// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { BindingStore, BINDINGS_VERSION } from '@/input/BindingStore';
import { PAD } from '@/input/bindings';
import { PAD_PROFILES, PAD_PROFILE_FAMILIES, profileFamilyFor } from '@/input/padProfiles';
import { InputFrame } from '@/input/InputFrame';
import { GamepadSource, type PadTuning } from '@/input/GamepadSource';
import { storageKey } from '@/persistence/Storage';

const TUNING: PadTuning = { deadZoneRadial: 0.1, deadZoneAxial: 0.05, stickSensitivity: 1, aimSensitivity: 1, invertY: false, invertX: false, glyphFamilyOverride: 'auto', nintendoConfirm: 'east', vibration: false };

function padWith(pressed: number[]): Gamepad {
  return {
    index: 0,
    id: 'x',
    mapping: 'standard',
    connected: true,
    timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ value: pressed.includes(i) ? 1 : 0, pressed: pressed.includes(i), touched: pressed.includes(i) })),
  } as unknown as Gamepad;
}

describe('controller binding profiles', () => {
  beforeEach(() => localStorage.clear());

  it('ships the documented layout for every family', () => {
    for (const family of PAD_PROFILE_FAMILIES) {
      const p = PAD_PROFILES[family];
      expect(p.Aim).toEqual([{ type: 'button', index: PAD.l2 }]);
      expect(p.Fire).toEqual([{ type: 'button', index: PAD.r2 }]);
      expect(p.Jump).toEqual([{ type: 'button', index: PAD.south }]);
      expect(p.Interact).toEqual([{ type: 'button', index: PAD.south }]);
      expect(p.Dodge).toEqual([{ type: 'button', index: PAD.east }]);
      expect(p.Reload).toEqual([{ type: 'button', index: PAD.west }]);
      expect(p.SwapItem).toEqual([{ type: 'button', index: PAD.north }]);
      expect(p.QuickItem).toEqual([{ type: 'button', index: PAD.l1 }]);
      expect(p.Melee).toEqual([{ type: 'button', index: PAD.r1 }]);
      expect(p.Sprint).toEqual([{ type: 'button', index: PAD.l3 }]);
      expect(p.Flashlight).toEqual([{ type: 'button', index: PAD.r3 }]);
      expect(p.QuickItemPrev).toEqual([{ type: 'button', index: PAD.dpadUp }]);
      expect(p.QuickItemNext).toEqual([{ type: 'button', index: PAD.dpadDown }]);
      expect(p.WeaponPrev).toEqual([{ type: 'button', index: PAD.dpadLeft }]);
      expect(p.WeaponNext).toEqual([{ type: 'button', index: PAD.dpadRight }]);
      expect(p.Pause).toEqual([{ type: 'button', index: PAD.start }]);
      expect(p.Inventory).toEqual([{ type: 'button', index: PAD.select }]);
      expect(p.Confirm).toEqual([{ type: 'button', index: PAD.south }]);
      expect(p.Cancel).toEqual([{ type: 'button', index: PAD.east }]);
      expect(p.TabPrev).toEqual([{ type: 'button', index: PAD.l1 }]);
      expect(p.TabNext).toEqual([{ type: 'button', index: PAD.r1 }]);
    }
    expect(profileFamilyFor('xbox')).toBe('xbox');
    expect(profileFamilyFor('playstation')).toBe('playstation');
    expect(profileFamilyFor('nintendo')).toBe('nintendo');
    expect(profileFamilyFor('generic')).toBe('generic');
    expect(profileFamilyFor('keyboard')).toBe('generic');
  });

  it('remaps one family without touching the others and persists per family', () => {
    const store = new BindingStore();
    store.rebindPad('Reload', { type: 'button', index: PAD.north }, ['Reload', 'SwapItem'], 'playstation');
    expect(store.padFor('Reload', 'playstation')).toEqual([{ type: 'button', index: PAD.north }]);
    expect(store.padFor('SwapItem', 'playstation')).toEqual([]);
    expect(store.padFor('Reload', 'xbox')).toEqual([{ type: 'button', index: PAD.west }]);
    expect(store.padFor('SwapItem', 'xbox')).toEqual([{ type: 'button', index: PAD.north }]);
    const reloaded = new BindingStore();
    expect(reloaded.padFor('Reload', 'playstation')).toEqual([{ type: 'button', index: PAD.north }]);
    expect(reloaded.padFor('Reload', 'nintendo')).toEqual([{ type: 'button', index: PAD.west }]);
  });

  it('keeps Jump and Interact on the same face button when one of them is rebound', () => {
    const store = new BindingStore();
    store.rebindPad('Jump', { type: 'button', index: PAD.south }, ['Jump', 'Interact', 'Confirm'], 'xbox');
    expect(store.padFor('Interact', 'xbox')).toEqual([{ type: 'button', index: PAD.south }]);
  });

  it('migrates a v1 single controller map into every family profile', () => {
    localStorage.setItem(
      storageKey('bindings'),
      JSON.stringify({ v: 1, savedAt: 'x', data: { kbm: {}, pad: { Fire: [{ type: 'button', index: PAD.r1 }] } } }),
    );
    const store = new BindingStore();
    for (const family of PAD_PROFILE_FAMILIES) expect(store.padFor('Fire', family)).toEqual([{ type: 'button', index: PAD.r1 }]);
    const raw = JSON.parse(localStorage.getItem(storageKey('bindings')) ?? '{}') as { v: number };
    expect(raw.v).toBe(1); // nothing is rewritten until the player changes something
    store.rebindPad('Fire', { type: 'button', index: PAD.r2 }, ['Fire'], 'xbox');
    expect((JSON.parse(localStorage.getItem(storageKey('bindings')) ?? '{}') as { v: number }).v).toBe(BINDINGS_VERSION);
  });

  it('a pad reads the profile of its detected family, honouring the glyph override', () => {
    const store = new BindingStore();
    store.rebindPad('Reload', { type: 'button', index: PAD.north }, ['Reload', 'SwapItem'], 'playstation');
    const ps = new GamepadSource(0, 'DualSense Wireless Controller (Vendor: 054c)', 'standard', store, TUNING);
    expect(ps.profileFamily).toBe('playstation');
    ps.readPad(padWith([PAD.north]));
    let frame = new InputFrame();
    ps.poll(frame, 'game', 1 / 60);
    expect(frame.down.has('Reload')).toBe(true);
    expect(frame.down.has('SwapItem')).toBe(false);
    ps.setTuning({ ...TUNING, glyphFamilyOverride: 'xbox' });
    expect(ps.profileFamily).toBe('xbox');
    ps.readPad(padWith([PAD.north]));
    frame = new InputFrame();
    ps.poll(frame, 'game', 1 / 60);
    expect(frame.down.has('SwapItem')).toBe(true);
    expect(frame.down.has('Reload')).toBe(false);
  });

  it('one south press reports both Jump and Interact so the simulation can give the prompt priority', () => {
    const source = new GamepadSource(0, 'Xbox Wireless Controller (Vendor: 045e)', 'standard', new BindingStore(), TUNING);
    source.readPad(padWith([PAD.south]));
    const frame = new InputFrame();
    source.poll(frame, 'game', 1 / 60);
    expect(frame.pressedNow.has('Jump')).toBe(true);
    expect(frame.pressedNow.has('Interact')).toBe(true);
    const ui = new InputFrame();
    source.readPad(padWith([PAD.south, PAD.l1]));
    source.poll(ui, 'ui', 1 / 60);
    expect(ui.down.has('Confirm')).toBe(true);
    expect(ui.down.has('TabPrev')).toBe(true);
    expect(ui.down.has('Jump')).toBe(false);
  });
});
