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
import { storageKey } from '@/persistence/Storage';

const phone: Viewport = { width: 844, height: 390, safe: { top: 0, right: 44, bottom: 20, left: 44 } };

describe('touch profiles', () => {
  beforeEach(() => localStorage.clear());

  it('presets are already inside the safe area and free of overlaps on their target viewports', () => {
    const tablet: Viewport = { width: 1180, height: 820, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
    const cases = [
      ['twoThumb', phone],
      ['leftFire', phone],
      ['compactPhone', phone],
      ['tablet', tablet],
    ] as const;
    for (const [preset, viewport] of cases) {
      const profile = presetProfile(preset);
      expect(clampProfile(profile, viewport)).toEqual({ ...profile, version: TOUCH_PROFILE_VERSION });
      expect(findOverlaps(profile, viewport)).toEqual([]);
    }
  });

  it('clamps controls back inside the screen and keeps essentials visible', () => {
    const profile = presetProfile('twoThumb');
    profile.controls.fire = { x: 1.4, y: -0.3, size: 0.9, opacity: 3, visible: false };
    const clamped = clampProfile(profile, phone);
    const rect = controlRect(clamped.controls.fire, phone);
    expect(rect.cx + rect.d / 2).toBeLessThanOrEqual(phone.width - phone.safe.right + 0.01);
    expect(rect.cy - rect.d / 2).toBeGreaterThanOrEqual(phone.safe.top - 0.01);
    expect(clamped.controls.fire.opacity).toBe(1);
    expect(clamped.controls.fire.visible).toBe(true);
    expect(clamped.controls.fire.size).toBeLessThanOrEqual(0.34);
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
    localStorage.setItem(storageKey('touch.profiles'), JSON.stringify({ v: 1, savedAt: 'x', data: { phone: { preset: 'zzz', controls: { fire: { x: 'a' } } }, tablet: 5 } }));
    const repaired = loadProfiles();
    expect(repaired.phone.preset).toBe('custom');
    expect(repaired.phone.controls.fire).toEqual(defaultProfiles().phone.controls.fire);
    expect(repaired.tablet).toEqual(defaultProfiles().tablet);
  });

  it('resets unversioned payloads and rejects newer versions', () => {
    localStorage.setItem(storageKey('touch.profiles'), JSON.stringify({ v: 0, savedAt: 'x', data: { phone: {} } }));
    expect(loadProfiles()).toEqual(defaultProfiles());
    localStorage.setItem(storageKey('touch.profiles'), JSON.stringify({ v: 9, savedAt: 'x', data: { phone: {} } }));
    expect(loadProfiles()).toEqual(defaultProfiles());
  });
});
