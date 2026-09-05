import type { Action, BindingSlot } from './actions';

/* ---------- keyboard & mouse ---------- */

export type KbmBinding =
  | { type: 'key'; code: string }
  | { type: 'mouse'; button: number }
  | { type: 'wheel'; dir: 'up' | 'down' };

export type KbmBindingMap = Partial<Record<BindingSlot, KbmBinding[]>>;

export const DEFAULT_KBM_BINDINGS: KbmBindingMap = {
  'Move.up': [{ type: 'key', code: 'KeyW' }, { type: 'key', code: 'ArrowUp' }],
  'Move.down': [{ type: 'key', code: 'KeyS' }, { type: 'key', code: 'ArrowDown' }],
  'Move.left': [{ type: 'key', code: 'KeyA' }, { type: 'key', code: 'ArrowLeft' }],
  'Move.right': [{ type: 'key', code: 'KeyD' }, { type: 'key', code: 'ArrowRight' }],
  Aim: [{ type: 'mouse', button: 2 }],
  Fire: [{ type: 'mouse', button: 0 }],
  Reload: [{ type: 'key', code: 'KeyR' }],
  Interact: [{ type: 'key', code: 'KeyE' }],
  Jump: [{ type: 'key', code: 'Space' }],
  Sprint: [{ type: 'key', code: 'ShiftLeft' }, { type: 'key', code: 'ShiftRight' }],
  Dodge: [{ type: 'key', code: 'KeyC' }, { type: 'key', code: 'ControlLeft' }],
  Melee: [{ type: 'key', code: 'KeyV' }, { type: 'mouse', button: 1 }],
  QuickItem: [{ type: 'key', code: 'KeyH' }],
  QuickItemPrev: [{ type: 'key', code: 'BracketLeft' }],
  QuickItemNext: [{ type: 'key', code: 'BracketRight' }],
  WeaponPrev: [{ type: 'key', code: 'Digit1' }, { type: 'wheel', dir: 'up' }],
  WeaponNext: [{ type: 'key', code: 'Digit2' }, { type: 'wheel', dir: 'down' }],
  SwapItem: [{ type: 'key', code: 'KeyQ' }],
  Flashlight: [{ type: 'key', code: 'KeyF' }],
  Inventory: [{ type: 'key', code: 'Tab' }, { type: 'key', code: 'KeyI' }],
  Map: [{ type: 'key', code: 'KeyM' }],
  Pause: [{ type: 'key', code: 'Escape' }, { type: 'key', code: 'KeyP' }],
  'Navigate.up': [{ type: 'key', code: 'ArrowUp' }, { type: 'key', code: 'KeyW' }],
  'Navigate.down': [{ type: 'key', code: 'ArrowDown' }, { type: 'key', code: 'KeyS' }],
  'Navigate.left': [{ type: 'key', code: 'ArrowLeft' }, { type: 'key', code: 'KeyA' }],
  'Navigate.right': [{ type: 'key', code: 'ArrowRight' }, { type: 'key', code: 'KeyD' }],
  Confirm: [{ type: 'key', code: 'Enter' }, { type: 'key', code: 'Space' }, { type: 'key', code: 'NumpadEnter' }],
  Cancel: [{ type: 'key', code: 'Escape' }, { type: 'key', code: 'Backspace' }],
  TabPrev: [{ type: 'key', code: 'KeyQ' }, { type: 'key', code: 'PageUp' }],
  TabNext: [{ type: 'key', code: 'KeyE' }, { type: 'key', code: 'PageDown' }],
};

/* ---------- gamepad (W3C standard mapping indices) ---------- */

export const PAD = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  l1: 4,
  r1: 5,
  l2: 6,
  r2: 7,
  select: 8,
  start: 9,
  l3: 10,
  r3: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
  home: 16,
} as const;

export const PAD_AXIS = { leftX: 0, leftY: 1, rightX: 2, rightY: 3 } as const;

export type PadBinding =
  | { type: 'button'; index: number }
  | { type: 'axis'; index: number; sign: 1 | -1 }
  | { type: 'stick'; x: number; y: number };

export type PadSlot = BindingSlot | 'Move' | 'Look' | 'Navigate';
export type PadBindingMap = Partial<Record<PadSlot, PadBinding[]>>;

/** Slots that must keep at least one binding so the player can never lock themselves out. */
export const REQUIRED_SLOTS: readonly BindingSlot[] = ['Pause', 'Confirm', 'Cancel', 'Interact'];

export function bindingsEqual(a: KbmBinding, b: KbmBinding): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'key' && b.type === 'key') return a.code === b.code;
  if (a.type === 'mouse' && b.type === 'mouse') return a.button === b.button;
  if (a.type === 'wheel' && b.type === 'wheel') return a.dir === b.dir;
  return false;
}

export function padBindingsEqual(a: PadBinding, b: PadBinding): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'button' && b.type === 'button') return a.index === b.index;
  if (a.type === 'axis' && b.type === 'axis') return a.index === b.index && a.sign === b.sign;
  if (a.type === 'stick' && b.type === 'stick') return a.x === b.x && a.y === b.y;
  return false;
}

export function slotsOf(action: Action): BindingSlot[] {
  if (action === 'Move' || action === 'Look' || action === 'Navigate') {
    return [`${action}.up`, `${action}.down`, `${action}.left`, `${action}.right`];
  }
  return [action];
}
