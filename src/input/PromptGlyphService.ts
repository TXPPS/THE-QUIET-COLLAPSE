import { EventBus } from '@/core/EventBus';
import { ACTION_META, type Action, type AxisAction, type BindingSlot, isAxisAction } from './actions';
import type { BindingStore } from './BindingStore';
import { PAD, type PadBinding } from './bindings';
import type { GlyphFamily } from './InputSource';
import type { InputSourceRegistry } from './InputSourceRegistry';
import { kbmBindingLabel } from './keyLabels';

export type GlyphShape = 'key' | 'mouse' | 'wheel' | 'face' | 'shoulder' | 'trigger' | 'stick' | 'dpad' | 'system' | 'touch' | 'axis';

export interface Glyph {
  /** Short text rendered inside the chip. */
  text: string;
  /** Accessible name for screen readers. */
  aria: string;
  shape: GlyphShape;
  family: GlyphFamily;
}

export interface GlyphEvents extends Record<string, unknown> {
  change: { family: GlyphFamily };
}

type PadLabelTable = Record<number, [string, string, GlyphShape]>;

const XBOX: PadLabelTable = {
  [PAD.south]: ['A', 'A button', 'face'],
  [PAD.east]: ['B', 'B button', 'face'],
  [PAD.west]: ['X', 'X button', 'face'],
  [PAD.north]: ['Y', 'Y button', 'face'],
  [PAD.l1]: ['LB', 'Left bumper', 'shoulder'],
  [PAD.r1]: ['RB', 'Right bumper', 'shoulder'],
  [PAD.l2]: ['LT', 'Left trigger', 'trigger'],
  [PAD.r2]: ['RT', 'Right trigger', 'trigger'],
  [PAD.select]: ['View', 'View button', 'system'],
  [PAD.start]: ['Menu', 'Menu button', 'system'],
  [PAD.l3]: ['LS', 'Left stick press', 'stick'],
  [PAD.r3]: ['RS', 'Right stick press', 'stick'],
  [PAD.dpadUp]: ['D↑', 'D-pad up', 'dpad'],
  [PAD.dpadDown]: ['D↓', 'D-pad down', 'dpad'],
  [PAD.dpadLeft]: ['D←', 'D-pad left', 'dpad'],
  [PAD.dpadRight]: ['D→', 'D-pad right', 'dpad'],
};

const PLAYSTATION: PadLabelTable = {
  ...XBOX,
  [PAD.south]: ['✕', 'Cross button', 'face'],
  [PAD.east]: ['○', 'Circle button', 'face'],
  [PAD.west]: ['□', 'Square button', 'face'],
  [PAD.north]: ['△', 'Triangle button', 'face'],
  [PAD.l1]: ['L1', 'L1 button', 'shoulder'],
  [PAD.r1]: ['R1', 'R1 button', 'shoulder'],
  [PAD.l2]: ['L2', 'L2 trigger', 'trigger'],
  [PAD.r2]: ['R2', 'R2 trigger', 'trigger'],
  [PAD.select]: ['Share', 'Share button', 'system'],
  [PAD.start]: ['Options', 'Options button', 'system'],
  [PAD.l3]: ['L3', 'L3 stick press', 'stick'],
  [PAD.r3]: ['R3', 'R3 stick press', 'stick'],
};

const NINTENDO: PadLabelTable = {
  ...XBOX,
  [PAD.south]: ['B', 'B button', 'face'],
  [PAD.east]: ['A', 'A button', 'face'],
  [PAD.west]: ['Y', 'Y button', 'face'],
  [PAD.north]: ['X', 'X button', 'face'],
  [PAD.l1]: ['L', 'L button', 'shoulder'],
  [PAD.r1]: ['R', 'R button', 'shoulder'],
  [PAD.l2]: ['ZL', 'ZL trigger', 'trigger'],
  [PAD.r2]: ['ZR', 'ZR trigger', 'trigger'],
  [PAD.select]: ['−', 'Minus button', 'system'],
  [PAD.start]: ['+', 'Plus button', 'system'],
};

const STICK_LABELS: Record<GlyphFamily, [string, string]> = {
  keyboard: ['Mouse', 'Mouse'],
  touch: ['Drag', 'Drag on the right side'],
  xbox: ['LS', 'Left stick'],
  playstation: ['L', 'Left stick'],
  nintendo: ['L', 'Left stick'],
  generic: ['Stick 1', 'Left stick'],
};

const TOUCH_LABELS: Partial<Record<Action, [string, string]>> = {
  Move: ['Joystick', 'Left joystick'],
  Look: ['Drag', 'Drag on the right side'],
  Aim: ['Aim', 'Aim button'],
  Fire: ['Fire', 'Fire button'],
  Reload: ['Reload', 'Reload button'],
  Interact: ['Use', 'Use button'],
  Sprint: ['Run', 'Run button'],
  Dodge: ['Step', 'Step button'],
  SwapItem: ['Swap', 'Swap item button'],
  Flashlight: ['Light', 'Flashlight button'],
  Inventory: ['Items', 'Items button'],
  Map: ['Map', 'Map button'],
  Pause: ['Pause', 'Pause button'],
  Navigate: ['Tap', 'Tap an option'],
  Confirm: ['Tap', 'Tap to confirm'],
  Cancel: ['Back', 'Back button'],
  TabPrev: ['◀', 'Previous tab'],
  TabNext: ['▶', 'Next tab'],
};

const PAD_TABLES: Partial<Record<GlyphFamily, PadLabelTable>> = { xbox: XBOX, playstation: PLAYSTATION, nintendo: NINTENDO };

function genericPadGlyph(binding: PadBinding): Glyph {
  if (binding.type === 'button') return { text: `B${binding.index + 1}`, aria: `Button ${binding.index + 1}`, shape: 'face', family: 'generic' };
  if (binding.type === 'axis') return { text: `Ax${binding.index}${binding.sign > 0 ? '+' : '-'}`, aria: `Axis ${binding.index}`, shape: 'axis', family: 'generic' };
  return { text: binding.x === 0 ? 'Stick 1' : 'Stick 2', aria: binding.x === 0 ? 'Left stick' : 'Right stick', shape: 'stick', family: 'generic' };
}

/**
 * Resolves an action to the glyph of its current binding for the active input family.
 * Emits `change` whenever the family or bindings change so every prompt refreshes at once.
 */
export class PromptGlyphService {
  readonly events = new EventBus<GlyphEvents>();
  private readonly offs: Array<() => void> = [];

  constructor(
    private readonly bindings: BindingStore,
    private readonly registry: InputSourceRegistry,
  ) {
    this.offs.push(registry.events.on('activeChanged', ({ family }) => this.events.emit('change', { family })));
    this.offs.push(bindings.events.on('change', () => this.events.emit('change', { family: registry.activeFamily })));
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.events.clear();
  }

  get family(): GlyphFamily {
    return this.registry.activeFamily;
  }

  /** Primary glyph for an action under the active family. */
  glyph(action: Action, family: GlyphFamily = this.family): Glyph {
    if (family === 'touch') {
      const label = TOUCH_LABELS[action] ?? [ACTION_META[action].label, ACTION_META[action].label];
      return { text: label[0], aria: label[1], shape: 'touch', family };
    }
    if (family === 'keyboard') return this.keyboardGlyph(action);
    return this.padGlyph(action, family);
  }

  /** All glyphs bound to an action (used by the remapping screen). */
  glyphsFor(action: Action, family: GlyphFamily = this.family): Glyph[] {
    if (family === 'keyboard') {
      if (isAxisAction(action)) return [this.keyboardGlyph(action)];
      return this.bindings.kbmFor(action).map((binding) => ({ ...kbmBindingLabel(binding), shape: shapeOfKbm(binding.type), family }));
    }
    if (family === 'touch') return [this.glyph(action, family)];
    if (isAxisAction(action)) return [this.padGlyph(action, family)];
    return this.bindings.padFor(action).map((binding) => this.padBindingGlyph(binding, family));
  }

  private keyboardGlyph(action: Action): Glyph {
    if (action === 'Look') return { text: 'Mouse', aria: 'Move the mouse', shape: 'mouse', family: 'keyboard' };
    if (isAxisAction(action)) return this.keyboardAxisGlyph(action);
    const binding = this.bindings.kbmFor(action)[0];
    if (!binding) return { text: '—', aria: 'Unbound', shape: 'key', family: 'keyboard' };
    return { ...kbmBindingLabel(binding), shape: shapeOfKbm(binding.type), family: 'keyboard' };
  }

  private keyboardAxisGlyph(action: AxisAction): Glyph {
    const parts = (['up', 'left', 'down', 'right'] as const).map((dir) => {
      const binding = this.bindings.kbmFor(`${action}.${dir}` as BindingSlot)[0];
      return binding ? kbmBindingLabel(binding).text : '·';
    });
    return { text: parts.join(''), aria: `${parts.join(', ')} keys`, shape: 'key', family: 'keyboard' };
  }

  private padGlyph(action: Action, family: GlyphFamily): Glyph {
    if (isAxisAction(action)) {
      const binding = this.bindings.padFor(action)[0];
      if (binding?.type === 'stick' && binding.x !== 0) {
        const label = family === 'xbox' ? 'RS' : family === 'generic' ? 'Stick 2' : 'R';
        return { text: label, aria: 'Right stick', shape: 'stick', family };
      }
      const [text, aria] = STICK_LABELS[family];
      return { text, aria, shape: 'stick', family };
    }
    const binding = this.bindings.padFor(action)[0];
    if (!binding) return { text: '—', aria: 'Unbound', shape: 'face', family };
    return this.padBindingGlyph(binding, family);
  }

  /** Glyph for one concrete gamepad binding under a family (remap screen). */
  padBindingGlyph(binding: PadBinding, family: GlyphFamily): Glyph {
    const table = PAD_TABLES[family];
    if (!table || binding.type !== 'button') return { ...genericPadGlyph(binding), family };
    const entry = table[binding.index];
    if (!entry) return { ...genericPadGlyph(binding), family };
    return { text: entry[0], aria: entry[1], shape: entry[2], family };
  }
}

function shapeOfKbm(type: 'key' | 'mouse' | 'wheel'): GlyphShape {
  return type === 'key' ? 'key' : type === 'mouse' ? 'mouse' : 'wheel';
}
