import type { GlyphFamily } from './InputSource';
import { PAD, PAD_AXIS, type PadBindingMap } from './bindings';

/** Controller families that carry their own default binding profile. */
export type PadProfileFamily = 'xbox' | 'playstation' | 'nintendo' | 'generic';
export const PAD_PROFILE_FAMILIES: readonly PadProfileFamily[] = ['xbox', 'playstation', 'nintendo', 'generic'];

export const PAD_PROFILE_LABELS: Record<PadProfileFamily, string> = {
  xbox: 'Xbox',
  playstation: 'PlayStation',
  nintendo: 'Nintendo',
  generic: 'Generic',
};

/**
 * The shipped layout, expressed in W3C standard-mapping positions. Every family shares the same
 * positions (A / Cross / B-on-Nintendo are all "south"); the glyph tables name them per family and
 * the Nintendo confirm policy can swap confirm/cancel at poll time.
 *
 *   LS move · LS click sprint · RS look · RS click flashlight
 *   LT aim · RT fire
 *   A jump/vault (interact wins when a prompt shows) · B dodge/cancel · X reload · Y swap weapon/item
 *   LB quick item · RB melee/push
 *   D-pad up/down quick-item cycle · left/right weapon cycle
 *   Menu pause · View inventory (the map is the inventory's other tab)
 *   Menus: A confirm · B cancel · LB/RB tabs
 */
function standardLayout(): PadBindingMap {
  return {
    Move: [{ type: 'stick', x: PAD_AXIS.leftX, y: PAD_AXIS.leftY }],
    Look: [{ type: 'stick', x: PAD_AXIS.rightX, y: PAD_AXIS.rightY }],
    Navigate: [{ type: 'stick', x: PAD_AXIS.leftX, y: PAD_AXIS.leftY }],
    'Navigate.up': [{ type: 'button', index: PAD.dpadUp }],
    'Navigate.down': [{ type: 'button', index: PAD.dpadDown }],
    'Navigate.left': [{ type: 'button', index: PAD.dpadLeft }],
    'Navigate.right': [{ type: 'button', index: PAD.dpadRight }],
    Sprint: [{ type: 'button', index: PAD.l3 }],
    Flashlight: [{ type: 'button', index: PAD.r3 }],
    Aim: [{ type: 'button', index: PAD.l2 }],
    Fire: [{ type: 'button', index: PAD.r2 }],
    Jump: [{ type: 'button', index: PAD.south }],
    Interact: [{ type: 'button', index: PAD.south }],
    Dodge: [{ type: 'button', index: PAD.east }],
    Reload: [{ type: 'button', index: PAD.west }],
    SwapItem: [{ type: 'button', index: PAD.north }],
    QuickItem: [{ type: 'button', index: PAD.l1 }],
    Melee: [{ type: 'button', index: PAD.r1 }],
    QuickItemPrev: [{ type: 'button', index: PAD.dpadUp }],
    QuickItemNext: [{ type: 'button', index: PAD.dpadDown }],
    WeaponPrev: [{ type: 'button', index: PAD.dpadLeft }],
    WeaponNext: [{ type: 'button', index: PAD.dpadRight }],
    Pause: [{ type: 'button', index: PAD.start }],
    Inventory: [{ type: 'button', index: PAD.select }],
    Map: [],
    Confirm: [{ type: 'button', index: PAD.south }],
    Cancel: [{ type: 'button', index: PAD.east }],
    TabPrev: [{ type: 'button', index: PAD.l1 }],
    TabNext: [{ type: 'button', index: PAD.r1 }],
  };
}

/** Default binding profile per family, stored as plain data so it can be rendered, diffed and remapped. */
export const PAD_PROFILES: Record<PadProfileFamily, PadBindingMap> = {
  xbox: standardLayout(),
  playstation: standardLayout(),
  nintendo: standardLayout(),
  generic: standardLayout(),
};

/** The Xbox profile doubles as the reference layout (documentation, tests, legacy callers). */
export const DEFAULT_PAD_BINDINGS: PadBindingMap = PAD_PROFILES.xbox;

/** Which stored profile a source's glyph family uses; keyboard/touch never reach here. */
export function profileFamilyFor(family: GlyphFamily): PadProfileFamily {
  return family === 'xbox' || family === 'playstation' || family === 'nintendo' ? family : 'generic';
}

export function defaultProfile(family: PadProfileFamily): PadBindingMap {
  return structuredClone(PAD_PROFILES[family]);
}
