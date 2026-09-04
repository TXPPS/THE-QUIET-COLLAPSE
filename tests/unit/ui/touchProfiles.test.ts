// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clampProfile,
  controlRect,
  defaultProfiles,
  findOverlaps,
  loadProfiles,
  presetProfile,
  saveProfiles,
  TOUCH_PROFILE_VERSION,
  type Viewport,
} from '@/ui/touch/touchProfiles';
import { VERIFICATION_VIEWPORTS } from '@/ui/touch/touchLayout';
import { storageKey } from '@/persistence/Storage';

const phone: Viewport = VERIFICATION_VIEWPORTS['19.5:9']!;

describe('touch profiles', () => {
  beforeEach(() => localStorage.clear());

  it('presets are already in range and free of overlaps on their target viewports', () => {
    const tablet: Viewport = { width: 1180, height: 820, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
    const cases = [
      ['twoThumb', phone],
      ['leftFire', phone],
      ['compactPhone', phone],
      ['tablet', tablet],
    ] as const;
    for (const [preset, viewport] of cases) {
      const profile = presetProfile(preset);
      expect(clampProfile(profile)).toEqual({ ...profile, version: TOUCH_PROFILE_VERSION });
      expect(findOverlaps(profile, viewport)).toEqual([]);
    }
  });

  it('clamps controls back inside the safe area and keeps essentials visible', () => {
    const profile = presetProfile('twoThumb');
    profile.controls.fire = { x: 1.4, y: -0.3, size: 0.9, opacity: 3, visible: false };
    const clamped = clampProfile(profile);
    const rect = controlRect('fire', clamped.controls.fire, phone);
    expect(rect.cx + rect.r).toBeLessThanOrEqual(phone.width - phone.safe.right - 8 + 0.01);
    expect(rect.cy - rect.r).toBeGreaterThanOrEqual(phone.safe.top + 8 - 0.01);
    expect(clamped.controls.fire.opacity).toBe(1);
    expect(clamped.controls.fire.visible).toBe(true);
    expect(clamped.controls.fire.size).toBeLessThanOrEqual(0.36);
  });

  it('reports overlaps between visible controls', () => {
    const profile = presetProfile('twoThumb');
    profile.controls.reload = { ...profile.controls.fire };
    expect(findOverlaps(profile, phone)).toContainEqual(['fire', 'reload']);
  });

  it('round-trips through storage and sanitises damaged entries', () => {
    const profiles = defaultProfiles();
    profiles.phone.controls.aim.x = 0.6;
    profiles.phone.preset = 'custom';
    expect(saveProfiles(profiles)).toBe(true);
    const loaded = loadProfiles();
    expect(loaded.phone.controls.aim.x).toBe(0.6);
    expect(loaded.phone.preset).toBe('custom');
    localStorage.setItem(storageKey('touch.profiles'), JSON.stringify({ v: TOUCH_PROFILE_VERSION, savedAt: 'x', data: { phone: { preset: 'zzz', controls: { fire: { x: 'a' } } }, tablet: 5 } }));
    const repaired = loadProfiles();
    expect(repaired.phone.preset).toBe('custom');
    expect(repaired.phone.controls.fire).toEqual(defaultProfiles().phone.controls.fire);
    expect(repaired.tablet).toEqual(defaultProfiles().tablet);
  });

  it('resets v1 layouts (different coordinate system) and rejects newer versions', () => {
    localStorage.setItem(storageKey('touch.profiles'), JSON.stringify({ v: 1, savedAt: 'x', data: { phone: { preset: 'custom', controls: {} } } }));
    expect(loadProfiles()).toEqual(defaultProfiles());
    localStorage.setItem(storageKey('touch.profiles'), JSON.stringify({ v: 9, savedAt: 'x', data: { phone: {} } }));
    expect(loadProfiles()).toEqual(defaultProfiles());
  });
});
