import { describe, expect, it } from 'vitest';
import { classifyGamepad, friendlyGamepadName, glyphFamilyFor } from '@/input/gamepadFamilies';

describe('gamepad family classification', () => {
  it.each([
    ['Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)', 'standard', 'xbox', 'xbox'],
    ['Xbox Wireless Controller Extended Gamepad', 'standard', 'xbox', 'xbox'],
    ['DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', 'standard', 'playstation', 'playstation'],
    ['Sony Interactive Entertainment Wireless Controller', 'standard', 'playstation', 'playstation'],
    ['Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)', 'standard', 'nintendo', 'nintendo'],
    ['Nintendo Switch Joy-Con (L/R)', 'standard', 'nintendo', 'nintendo'],
    ['Wireless Controller (STANDARD GAMEPAD)', 'standard', 'playstation', 'generic'],
    ['USB Gamepad (Vendor: 0079 Product: 0011)', '', 'generic', 'generic'],
    ['Totally Unknown Device 1234', '', 'unknown', 'generic'],
  ])('%s → family %s, glyphs %s', (id, mapping, family, glyphs) => {
    const result = classifyGamepad(id, mapping);
    expect(result.family).toBe(family);
    expect(glyphFamilyFor(result)).toBe(glyphs);
  });

  it('never returns a confidence above 1 or below 0', () => {
    for (const id of ['xbox', 'DualShock 4', 'zzz', '']) {
      const { confidence } = classifyGamepad(id, 'standard');
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    }
  });

  it('trims verbose ids into friendly names and falls back to the family label', () => {
    const cls = classifyGamepad('Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)', 'standard');
    expect(friendlyGamepadName('Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)', cls)).toBe('Xbox 360 Controller');
    expect(friendlyGamepadName('()', cls)).toBe('Xbox controller');
  });
});
