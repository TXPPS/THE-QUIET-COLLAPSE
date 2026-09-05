import { PAD } from './bindings';

/** Digital press point for an analog trigger and the lower point at which it releases again. */
export const TRIGGER_PRESS = 0.35;
export const TRIGGER_RELEASE = 0.25;

/**
 * Where non-standard mappings tend to put the triggers when they arrive as axes (Android Chrome
 * with Xbox and many generic pads): left trigger on axis 4, right trigger on axis 5; some pads use
 * axis 2 for the left trigger when only five axes exist.
 */
const TRIGGER_AXES: Record<number, readonly number[]> = {
  [PAD.l2]: [4, 2],
  [PAD.r2]: [5],
};
/** An axis whose first observed value sits at or below this is a -1..1 trigger resting at -1. */
const RESTS_AT_MINUS_ONE = -0.9;
const EPSILON = 1e-3;

export interface TriggerSample {
  /** 0..1 analog value after normalisation. */
  value: number;
  /** Digital state after hysteresis. */
  pressed: boolean;
}

/**
 * Reads the two triggers as analog values with hysteresis. Standard mappings use the button value;
 * other mappings fall back to the trigger axes when the button reports nothing, normalising a
 * -1..1 axis (rest at -1) or a 0..1 axis from the value seen at rest.
 */
export class TriggerReader {
  private readonly state = new Map<number, boolean>();
  private readonly axisRest = new Map<number, number>();

  constructor(private readonly mapping: string) {}

  /** Analog value of a trigger button index from a gamepad snapshot. */
  value(buttons: ArrayLike<GamepadButton | undefined>, axes: ArrayLike<number>, index: number): number {
    this.observeRest(axes);
    const button = buttons[index];
    let value = button ? button.value : 0;
    if (!value && button?.pressed) value = 1;
    if (this.mapping !== 'standard' && value <= EPSILON) value = this.axisValue(axes, index);
    return clamp01(value);
  }

  /** Applies press/release hysteresis to a trigger value; returns the digital state. */
  digital(index: number, value: number): boolean {
    const was = this.state.get(index) ?? false;
    const now = was ? value > TRIGGER_RELEASE : value >= TRIGGER_PRESS;
    this.state.set(index, now);
    return now;
  }

  /** Convenience: analog + digital in one call. */
  read(buttons: ArrayLike<GamepadButton | undefined>, axes: ArrayLike<number>, index: number): TriggerSample {
    const value = this.value(buttons, axes, index);
    return { value, pressed: this.digital(index, value) };
  }

  isPressed(index: number): boolean {
    return this.state.get(index) ?? false;
  }

  reset(): void {
    this.state.clear();
  }

  /** The first snapshot fixes each trigger axis’ rest value (nobody pulls a trigger while plugging in). */
  private observeRest(axes: ArrayLike<number>): void {
    if (this.mapping === 'standard') return;
    for (const list of Object.values(TRIGGER_AXES)) {
      for (const axis of list) if (axis < axes.length && !this.axisRest.has(axis)) this.axisRest.set(axis, axes[axis] ?? 0);
    }
  }

  private axisValue(axes: ArrayLike<number>, index: number): number {
    for (const axis of TRIGGER_AXES[index] ?? []) {
      if (axis >= axes.length) continue;
      const raw = axes[axis] ?? 0;
      const rest = this.axisRest.get(axis) ?? 0;
      // A -1..1 trigger rests at -1; a 0..1 trigger rests at 0.
      return rest <= RESTS_AT_MINUS_ONE ? (raw + 1) / 2 : Math.max(0, raw);
    }
    return 0;
  }
}

export function isTriggerIndex(index: number): boolean {
  return index === PAD.l2 || index === PAD.r2;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
