import type { InputFrame } from './InputFrame';

export type SourceKind = 'keyboardMouse' | 'touch' | 'gamepad';
export type GlyphFamily = 'keyboard' | 'touch' | 'xbox' | 'playstation' | 'nintendo' | 'generic';
export type SourceContext = 'game' | 'ui';

export interface InputSource {
  readonly id: string;
  readonly kind: SourceKind;
  /** Friendly name shown in the chooser and options. */
  label: string;
  /** Glyph family this source renders its prompts with. */
  glyphFamily: GlyphFamily;
  /** 0..1 confidence in the family classification (1 for keyboard/touch). */
  confidence: number;
  available: boolean;
  /** performance.now() of the last activity above the noise thresholds. */
  lastActivity: number;
  start(): void;
  stop(): void;
  /** Writes this source's contribution for the frame. `context` decides which bindings apply. */
  poll(frame: InputFrame, context: SourceContext, dt: number): void;
}

export const KEYBOARD_MOUSE_SOURCE_ID = 'keyboardMouse';
export const TOUCH_SOURCE_ID = 'touch';

export function gamepadSourceId(index: number): string {
  return `gamepad:${index}`;
}
