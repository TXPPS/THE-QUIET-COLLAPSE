import type { KbmBinding } from './bindings';

const KEY_LABELS: Record<string, string> = {
  Space: 'Space',
  Escape: 'Esc',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Backspace: 'Backspace',
  Tab: 'Tab',
  ShiftLeft: 'Shift',
  ShiftRight: 'R Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'R Ctrl',
  AltLeft: 'Alt',
  AltRight: 'R Alt',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  CapsLock: 'Caps',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Backquote: '`',
};

const KEY_ARIA: Record<string, string> = {
  ArrowUp: 'Up arrow',
  ArrowDown: 'Down arrow',
  ArrowLeft: 'Left arrow',
  ArrowRight: 'Right arrow',
  Escape: 'Escape',
};

const MOUSE_LABELS: Record<number, [string, string]> = {
  0: ['LMB', 'Left mouse button'],
  1: ['MMB', 'Middle mouse button'],
  2: ['RMB', 'Right mouse button'],
  3: ['M4', 'Mouse button 4'],
  4: ['M5', 'Mouse button 5'],
};

export function keyCodeLabel(code: string): string {
  const known = KEY_LABELS[code];
  if (known) return known;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  if (/^F\d{1,2}$/.test(code)) return code;
  return code;
}

export function kbmBindingLabel(binding: KbmBinding): { text: string; aria: string } {
  if (binding.type === 'key') {
    const text = keyCodeLabel(binding.code);
    return { text, aria: KEY_ARIA[binding.code] ?? `${text} key` };
  }
  if (binding.type === 'mouse') {
    const entry = MOUSE_LABELS[binding.button] ?? [`M${binding.button + 1}`, `Mouse button ${binding.button + 1}`];
    return { text: entry[0], aria: entry[1] };
  }
  return binding.dir === 'up' ? { text: 'Wheel ↑', aria: 'Mouse wheel up' } : { text: 'Wheel ↓', aria: 'Mouse wheel down' };
}
