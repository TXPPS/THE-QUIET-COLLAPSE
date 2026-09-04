import type { KbmBinding, PadBinding } from './bindings';
import { PAD } from './bindings';
import type { GlyphFamily } from './InputSource';

/*
 * Maps bindings to Kenney Input Prompts symbol ids (the sprite sheet built by the asset pipeline,
 * manifest key `ui.prompts`). Text chips remain the fallback for anything without a symbol.
 */

const KEY_ICONS: Record<string, string> = {
  Space: 'keyboard_space',
  Escape: 'keyboard_escape',
  Enter: 'keyboard_enter',
  NumpadEnter: 'keyboard_numpad_enter',
  Backspace: 'keyboard_backspace',
  Tab: 'keyboard_tab',
  ShiftLeft: 'keyboard_shift',
  ShiftRight: 'keyboard_shift',
  ControlLeft: 'keyboard_ctrl',
  ControlRight: 'keyboard_ctrl',
  AltLeft: 'keyboard_alt',
  AltRight: 'keyboard_alt',
  ArrowUp: 'keyboard_arrow_up',
  ArrowDown: 'keyboard_arrow_down',
  ArrowLeft: 'keyboard_arrow_left',
  ArrowRight: 'keyboard_arrow_right',
  PageUp: 'keyboard_page_up',
  PageDown: 'keyboard_page_down',
  CapsLock: 'keyboard_capslock',
  Home: 'keyboard_home',
  End: 'keyboard_end',
  Delete: 'keyboard_delete',
  Insert: 'keyboard_insert',
  Minus: 'keyboard_minus',
  Equal: 'keyboard_equals',
  BracketLeft: 'keyboard_bracket_open',
  BracketRight: 'keyboard_bracket_close',
  Semicolon: 'keyboard_semicolon',
  Quote: 'keyboard_apostrophe',
  Comma: 'keyboard_comma',
  Period: 'keyboard_period',
  Slash: 'keyboard_slash_forward',
  Backslash: 'keyboard_slash_back',
  Backquote: 'keyboard_tilde',
};

const MOUSE_ICONS: Record<number, string> = { 0: 'mouse_left', 1: 'mouse_scroll', 2: 'mouse_right', 3: 'mouse_side_back', 4: 'mouse_side_forward' };

export const MOUSE_LOOK_ICON = 'mouse_move';
export const ARROWS_ICON = 'keyboard_arrows_all';

export function kbmIcon(binding: KbmBinding): string | null {
  if (binding.type === 'mouse') return MOUSE_ICONS[binding.button] ?? null;
  if (binding.type === 'wheel') return binding.dir === 'up' ? 'mouse_scroll_up' : 'mouse_scroll_down';
  const { code } = binding;
  const known = KEY_ICONS[code];
  if (known) return known;
  if (/^Key[A-Z]$/.test(code)) return `keyboard_${code.slice(3).toLowerCase()}`;
  if (/^Digit\d$/.test(code)) return `keyboard_${code.slice(5)}`;
  if (/^F([1-9]|1[0-2])$/.test(code)) return `keyboard_${code.toLowerCase()}`;
  return null;
}

type PadIconTable = Partial<Record<number, string>>;

const XBOX_ICONS: PadIconTable = {
  [PAD.south]: 'xbox_button_a',
  [PAD.east]: 'xbox_button_b',
  [PAD.west]: 'xbox_button_x',
  [PAD.north]: 'xbox_button_y',
  [PAD.l1]: 'xbox_lb',
  [PAD.r1]: 'xbox_rb',
  [PAD.l2]: 'xbox_lt',
  [PAD.r2]: 'xbox_rt',
  [PAD.select]: 'xbox_button_view',
  [PAD.start]: 'xbox_button_menu',
  [PAD.l3]: 'xbox_stick_l_press',
  [PAD.r3]: 'xbox_stick_r_press',
  [PAD.dpadUp]: 'xbox_dpad_up',
  [PAD.dpadDown]: 'xbox_dpad_down',
  [PAD.dpadLeft]: 'xbox_dpad_left',
  [PAD.dpadRight]: 'xbox_dpad_right',
  [PAD.home]: 'xbox_guide',
};

const PLAYSTATION_ICONS: PadIconTable = {
  [PAD.south]: 'playstation_button_cross',
  [PAD.east]: 'playstation_button_circle',
  [PAD.west]: 'playstation_button_square',
  [PAD.north]: 'playstation_button_triangle',
  [PAD.l1]: 'playstation_trigger_l1',
  [PAD.r1]: 'playstation_trigger_r1',
  [PAD.l2]: 'playstation_trigger_l2',
  [PAD.r2]: 'playstation_trigger_r2',
  [PAD.select]: 'playstation4_button_share',
  [PAD.start]: 'playstation4_button_options',
  [PAD.l3]: 'playstation_stick_l_press',
  [PAD.r3]: 'playstation_stick_r_press',
  [PAD.dpadUp]: 'playstation_dpad_up',
  [PAD.dpadDown]: 'playstation_dpad_down',
  [PAD.dpadLeft]: 'playstation_dpad_left',
  [PAD.dpadRight]: 'playstation_dpad_right',
};

const NINTENDO_ICONS: PadIconTable = {
  [PAD.south]: 'switch_button_b',
  [PAD.east]: 'switch_button_a',
  [PAD.west]: 'switch_button_y',
  [PAD.north]: 'switch_button_x',
  [PAD.l1]: 'switch_button_l',
  [PAD.r1]: 'switch_button_r',
  [PAD.l2]: 'switch_button_zl',
  [PAD.r2]: 'switch_button_zr',
  [PAD.select]: 'switch_button_minus',
  [PAD.start]: 'switch_button_plus',
  [PAD.l3]: 'switch_stick_l_press',
  [PAD.r3]: 'switch_stick_r_press',
  [PAD.dpadUp]: 'switch_dpad_up',
  [PAD.dpadDown]: 'switch_dpad_down',
  [PAD.dpadLeft]: 'switch_dpad_left',
  [PAD.dpadRight]: 'switch_dpad_right',
  [PAD.home]: 'switch_button_home',
};

const PAD_ICONS: Partial<Record<GlyphFamily, PadIconTable>> = { xbox: XBOX_ICONS, playstation: PLAYSTATION_ICONS, nintendo: NINTENDO_ICONS };

const STICK_ICONS: Partial<Record<GlyphFamily, [string, string]>> = {
  xbox: ['xbox_stick_l', 'xbox_stick_r'],
  playstation: ['playstation_stick_l', 'playstation_stick_r'],
  nintendo: ['switch_stick_l', 'switch_stick_r'],
  generic: ['generic_stick', 'generic_stick'],
};

export function padIcon(binding: PadBinding, family: GlyphFamily): string | null {
  if (binding.type === 'stick') return stickIcon(family, binding.x !== 0);
  if (binding.type !== 'button') return null;
  return PAD_ICONS[family]?.[binding.index] ?? null;
}

export function stickIcon(family: GlyphFamily, right: boolean): string | null {
  const pair = STICK_ICONS[family];
  return pair ? pair[right ? 1 : 0] : null;
}
