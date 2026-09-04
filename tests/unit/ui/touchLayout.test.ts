import { describe, expect, it } from 'vitest';
import {
  checkLayout,
  controlRect,
  findLookZoneIntrusions,
  findOverlaps,
  findSafeAreaViolations,
  layoutFromCentre,
  lookZoneRect,
  MIN_GAP_PX,
  MIN_PRIMARY_PX,
  MIN_TARGET_PX,
  PRIMARY_CONTROLS,
  SAFE_EDGE_MARGIN_PX,
  TOUCH_CONTROL_IDS,
  VERIFICATION_VIEWPORTS,
} from '@/ui/touch/touchLayout';
import { PRESET_IDS, presetProfile, verifyPresets } from '@/ui/touch/touchPresets';

describe('touch layout presets', () => {
  it('every preset passes the overlap, safe-area and look-zone checks at 19.5:9, 20:9, 4:3 and 16:10 in both look modes', () => {
    const failures = verifyPresets();
    expect(failures.map((f) => f.message)).toEqual([]);
  });

  it('keeps every visible control at least 56 px, primaries at least 72 px, with 12 px gaps and 8 px safe margins', () => {
    for (const preset of PRESET_IDS) {
      const profile = presetProfile(preset);
      profile.controls.lookStick.visible = true;
      for (const viewport of Object.values(VERIFICATION_VIEWPORTS)) {
        for (const id of TOUCH_CONTROL_IDS) {
          const rect = controlRect(id, profile.controls[id], viewport);
          expect(rect.d, `${preset} ${id}`).toBeGreaterThanOrEqual(PRIMARY_CONTROLS.has(id) ? MIN_PRIMARY_PX : MIN_TARGET_PX);
        }
        expect(findOverlaps(profile, viewport, MIN_GAP_PX)).toEqual([]);
        expect(findSafeAreaViolations(profile, viewport, SAFE_EDGE_MARGIN_PX)).toEqual([]);
      }
    }
  });

  it('phone and tablet presets differ: tablet keeps larger margins and smaller relative controls', () => {
    const phone = presetProfile('twoThumb').controls;
    const tablet = presetProfile('tablet').controls;
    expect(tablet.fire.size).toBeLessThan(phone.fire.size);
    expect(tablet.joystick.size).toBeLessThan(phone.joystick.size);
    expect(tablet.fire.x).toBeLessThan(phone.fire.x);
    expect(tablet.pause.y).toBeGreaterThan(phone.pause.y);
  });

  it('keeps the top-centre band free of controls', () => {
    for (const preset of PRESET_IDS) {
      const profile = presetProfile(preset);
      for (const viewport of Object.values(VERIFICATION_VIEWPORTS)) {
        for (const id of TOUCH_CONTROL_IDS) {
          if (!profile.controls[id].visible) continue;
          const rect = controlRect(id, profile.controls[id], viewport);
          const inTopBand = rect.cy - rect.r < viewport.safe.top + 64;
          const inCentre = Math.abs(rect.cx - viewport.width / 2) < viewport.width * 0.2;
          expect(inTopBand && inCentre, `${preset} ${id} sits in the top-centre band`).toBe(false);
        }
      }
    }
  });

  it('places x = 1 / y = 1 exactly on the 8 px safe margin at any aspect', () => {
    for (const viewport of Object.values(VERIFICATION_VIEWPORTS)) {
      const rect = controlRect('fire', { x: 1, y: 1, size: 0.21, opacity: 1, visible: true }, viewport);
      expect(rect.cx + rect.r).toBeCloseTo(viewport.width - viewport.safe.right - SAFE_EDGE_MARGIN_PX, 5);
      expect(rect.cy + rect.r).toBeCloseTo(viewport.height - viewport.safe.bottom - SAFE_EDGE_MARGIN_PX, 5);
      const back = layoutFromCentre('fire', { x: 1, y: 1, size: 0.21, opacity: 1, visible: true }, viewport, rect.cx, rect.cy);
      expect(back.x).toBeCloseTo(1, 5);
      expect(back.y).toBeCloseTo(1, 5);
    }
  });

  it('reports overlaps, edge violations and look-zone intrusions', () => {
    const viewport = VERIFICATION_VIEWPORTS['19.5:9']!;
    const profile = presetProfile('twoThumb');
    profile.controls.reload = { ...profile.controls.fire };
    expect(findOverlaps(profile, viewport)).toContainEqual(['fire', 'reload']);
    profile.controls.joystick.x = 0.6;
    expect(findLookZoneIntrusions(profile, viewport)).toContain('joystick');
    const zone = lookZoneRect(viewport);
    expect(zone.x0).toBe(viewport.width / 2);
    expect(zone.x1).toBe(viewport.width - viewport.safe.right);
    expect(checkLayout(profile, viewport).ok).toBe(false);
  });
});
