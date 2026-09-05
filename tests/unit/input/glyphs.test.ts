// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { BindingStore } from '@/input/BindingStore';
import { InputSourceRegistry } from '@/input/InputSourceRegistry';
import { PromptGlyphService } from '@/input/PromptGlyphService';
import { KeyboardMouseSource } from '@/input/KeyboardMouseSource';
import type { PadTuning } from '@/input/GamepadSource';

const tuning: PadTuning = { deadZoneRadial: 0.18, deadZoneAxial: 0.1, stickSensitivity: 1, aimSensitivity: 1, invertY: false, invertX: false, glyphFamilyOverride: 'auto', nintendoConfirm: 'east', vibration: true };

describe('PromptGlyphService', () => {
  beforeEach(() => localStorage.clear());

  it('renders keyboard glyphs from the current binding and updates after a remap', () => {
    const bindings = new BindingStore();
    const registry = new InputSourceRegistry(bindings, tuning);
    registry.register(new KeyboardMouseSource(bindings));
    const glyphs = new PromptGlyphService(bindings, registry);
    expect(glyphs.glyph('Interact')).toMatchObject({ text: 'E', icon: 'keyboard_e' });
    expect(glyphs.glyph('Fire')).toMatchObject({ text: 'LMB', shape: 'mouse', icon: 'mouse_left' });
    expect(glyphs.glyph('Look').icon).toBe('mouse_move');
    expect(glyphs.glyph('Sprint').icon).toBe('keyboard_shift');
    let changes = 0;
    glyphs.events.on('change', () => (changes += 1));
    bindings.rebindKbm('Interact', { type: 'key', code: 'KeyG' }, ['Interact']);
    expect(glyphs.glyph('Interact')).toMatchObject({ text: 'G', icon: 'keyboard_g' });
    expect(changes).toBe(1);
    registry.dispose();
  });

  it('renders each controller family with its own labels and generic fallback', () => {
    const bindings = new BindingStore();
    const registry = new InputSourceRegistry(bindings, tuning);
    const glyphs = new PromptGlyphService(bindings, registry);
    expect(glyphs.glyph('Interact', 'xbox')).toMatchObject({ text: 'A', icon: 'xbox_button_a' });
    expect(glyphs.glyph('Interact', 'playstation')).toMatchObject({ aria: 'Cross button', icon: 'playstation_button_cross' });
    expect(glyphs.glyph('Interact', 'nintendo')).toMatchObject({ text: 'B', icon: 'switch_button_b' });
    expect(glyphs.glyph('Interact', 'generic').text).toBe('B1');
    expect(glyphs.glyph('Interact', 'generic').icon).toBeUndefined();
    expect(glyphs.glyph('Aim', 'xbox')).toMatchObject({ text: 'LT', icon: 'xbox_lt' });
    expect(glyphs.glyph('Aim', 'playstation')).toMatchObject({ text: 'L2', icon: 'playstation_trigger_l2' });
    expect(glyphs.glyph('Move', 'xbox')).toMatchObject({ shape: 'stick', icon: 'xbox_stick_l' });
    expect(glyphs.glyph('Look', 'playstation').icon).toBe('playstation_stick_r');
    expect(glyphs.glyph('Look', 'keyboard').text).toBe('Mouse');
    expect(glyphs.glyph('Interact', 'touch').shape).toBe('touch');
    registry.dispose();
  });
});
