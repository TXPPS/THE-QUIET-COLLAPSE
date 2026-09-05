import { describe, expect, it } from 'vitest';
import { shouldShowTouchHud, type TouchVisibilityInput } from '@/app/TouchShell';

const BASE: TouchVisibilityInput = {
  inGame: true,
  needsRotate: false,
  policy: 'auto',
  primarySourceId: null,
  touchSourceId: 'touch',
  activeKind: 'touch',
  touchViable: true,
  presentation: 'phone',
};

describe('touch HUD visibility policy', () => {
  it('shows while touch is the active source and hides the moment a pad or keyboard takes over', () => {
    expect(shouldShowTouchHud(BASE)).toBe(true);
    expect(shouldShowTouchHud({ ...BASE, activeKind: 'gamepad' })).toBe(false);
    expect(shouldShowTouchHud({ ...BASE, activeKind: 'keyboardMouse' })).toBe(false);
    // The first meaningful touch brings it back.
    expect(shouldShowTouchHud({ ...BASE, activeKind: 'touch' })).toBe(true);
  });

  it('locked-to-touch keeps it visible regardless of the last active source; locked to anything else hides it', () => {
    expect(shouldShowTouchHud({ ...BASE, policy: 'locked', primarySourceId: 'touch', activeKind: 'gamepad' })).toBe(true);
    expect(shouldShowTouchHud({ ...BASE, policy: 'locked', primarySourceId: 'gamepad:0', activeKind: 'touch' })).toBe(false);
  });

  it('before any input it shows on handhelds only, and never outside gameplay, in portrait or without touch', () => {
    expect(shouldShowTouchHud({ ...BASE, activeKind: null })).toBe(true);
    expect(shouldShowTouchHud({ ...BASE, activeKind: null, presentation: 'desktop' })).toBe(false);
    expect(shouldShowTouchHud({ ...BASE, inGame: false })).toBe(false);
    expect(shouldShowTouchHud({ ...BASE, needsRotate: true })).toBe(false);
    expect(shouldShowTouchHud({ ...BASE, touchViable: false })).toBe(false);
  });
});
