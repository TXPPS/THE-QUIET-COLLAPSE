// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { BindingStore } from '@/input/BindingStore';
import { InputSourceRegistry } from '@/input/InputSourceRegistry';
import { PromptGlyphService } from '@/input/PromptGlyphService';
import { KeyboardMouseSource } from '@/input/KeyboardMouseSource';
import type { PadTuning } from '@/input/GamepadSource';

const tuning: PadTuning = { deadZoneRadial: 0.18, deadZoneAxial: 0.1, stickSensitivity: 1, invertY: false, invertX: false, glyphFamilyOverride: 'auto', nintendoConfirm: 'east', vibration: true };

describe('PromptGlyphService', () => {
  beforeEach(() => localStorage.clear());

  it('renders keyboard glyphs from the current binding and updates after a remap', () => {
    const bindings = new BindingStore();
    const registry = new InputSourceRegistry(bindings, tuning);
    registry.register(new KeyboardMouseSource(bindings));
    const glyphs = new PromptGlyphService(bindings, registry);
    expect(glyphs.glyph('Interact').text).toBe('E');
    expect(glyphs.glyph('Fire')).toMatchObject({ text: 'LMB', shape: 'mouse' });
    let changes = 0;
    glyphs.events.on('change', () => (changes += 1));
    bindings.rebindKbm('Interact', { type: 'key', code: 'KeyG' }, ['Interact']);
    expect(glyphs.glyph('Interact').text).toBe('G');
    expect(changes).toBe(1);
    registry.dispose();
  });

  it('renders each controller family with its own labels and generic fallback', () => {
    const bindings = new BindingStore();
    const registry = new InputSourceRegistry(bindings, tuning);
    const glyphs = new PromptGlyphService(bindings, registry);
    expect(glyphs.glyph('Interact', 'xbox').text).toBe('A');
    expect(glyphs.glyph('Interact', 'playstation').aria).toBe('Cross button');
    expect(glyphs.glyph('Interact', 'nintendo').text).toBe('B');
    expect(glyphs.glyph('Interact', 'generic').text).toBe('B1');
    expect(glyphs.glyph('Aim', 'xbox').text).toBe('LT');
    expect(glyphs.glyph('Aim', 'playstation').text).toBe('L2');
    expect(glyphs.glyph('Move', 'xbox').shape).toBe('stick');
    expect(glyphs.glyph('Look', 'keyboard').text).toBe('Mouse');
    expect(glyphs.glyph('Interact', 'touch').shape).toBe('touch');
    registry.dispose();
  });
});
