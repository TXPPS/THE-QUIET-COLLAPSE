// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BindingStore } from '@/input/BindingStore';
import { GamepadSource, type PadTuning } from '@/input/GamepadSource';
import { InputFrame } from '@/input/InputFrame';
import { PAD } from '@/input/bindings';
import { TRIGGER_PRESS, TRIGGER_RELEASE, TriggerReader } from '@/input/triggers';

const TUNING: PadTuning = { deadZoneRadial: 0.1, deadZoneAxial: 0.05, stickSensitivity: 1, aimSensitivity: 1, invertY: false, invertX: false, glyphFamilyOverride: 'auto', nintendoConfirm: 'east', vibration: false };

function buttons(values: Partial<Record<number, number>>, count = 17): GamepadButton[] {
  return Array.from({ length: count }, (_, i) => {
    const value = values[i] ?? 0;
    return { value, pressed: value > 0.5, touched: value > 0 };
  });
}

/** Synthetic Gamepad snapshot; `mapping` decides whether triggers may fall back to axes. */
function pad(mapping: string, values: Partial<Record<number, number>>, axes: number[] = [0, 0, 0, 0]): Gamepad {
  return { index: 0, id: 'Xbox Wireless Controller (Vendor: 045e)', mapping, connected: true, timestamp: 0, axes, buttons: buttons(values) } as unknown as Gamepad;
}

describe('TriggerReader', () => {
  it('reads standard-mapping triggers from the analog button value with hysteresis', () => {
    const reader = new TriggerReader('standard');
    const axes = [0, 0, 0, 0];
    expect(reader.read(buttons({ [PAD.r2]: 0.2 }), axes, PAD.r2)).toEqual({ value: 0.2, pressed: false });
    expect(reader.read(buttons({ [PAD.r2]: TRIGGER_PRESS }), axes, PAD.r2).pressed).toBe(true);
    // Between the release and press points the previous state holds.
    expect(reader.read(buttons({ [PAD.r2]: (TRIGGER_PRESS + TRIGGER_RELEASE) / 2 }), axes, PAD.r2).pressed).toBe(true);
    expect(reader.read(buttons({ [PAD.r2]: TRIGGER_RELEASE }), axes, PAD.r2).pressed).toBe(false);
    expect(reader.read(buttons({ [PAD.r2]: (TRIGGER_PRESS + TRIGGER_RELEASE) / 2 }), axes, PAD.r2).pressed).toBe(false);
  });

  it('treats a digital-only trigger (pressed without a value) as fully pulled', () => {
    const reader = new TriggerReader('standard');
    const digital = buttons({});
    digital[PAD.l2] = { value: 0, pressed: true, touched: true };
    expect(reader.read(digital, [0, 0, 0, 0], PAD.l2)).toEqual({ value: 1, pressed: true });
  });

  it('never uses the axis fallback on a standard mapping', () => {
    const reader = new TriggerReader('standard');
    expect(reader.read(buttons({}), [0, 0, 0, 0, 1, 1], PAD.r2).value).toBe(0);
  });

  it('falls back to a -1..1 trigger axis that rests at -1 on non-standard mappings', () => {
    const reader = new TriggerReader('');
    const none = buttons({});
    // First observation establishes the rest value.
    expect(reader.read(none, [0, 0, 0, 0, -1, -1], PAD.r2)).toEqual({ value: 0, pressed: false });
    expect(reader.read(none, [0, 0, 0, 0, -1, 0], PAD.r2)).toEqual({ value: 0.5, pressed: true });
    expect(reader.read(none, [0, 0, 0, 0, -1, 1], PAD.r2)).toEqual({ value: 1, pressed: true });
    expect(reader.read(none, [0, 0, 0, 0, -1, -0.6], PAD.r2)).toEqual({ value: 0.2, pressed: false });
    // Left trigger lives on axis 4.
    expect(reader.read(none, [0, 0, 0, 0, 0.5, -1], PAD.l2).value).toBeCloseTo(0.75, 6);
  });

  it('falls back to a 0..1 trigger axis that rests at 0 on non-standard mappings', () => {
    const reader = new TriggerReader('');
    const none = buttons({});
    expect(reader.read(none, [0, 0, 0, 0, 0, 0], PAD.l2).value).toBe(0);
    expect(reader.read(none, [0, 0, 0, 0, 0.7, 0], PAD.l2)).toEqual({ value: 0.7, pressed: true });
    expect(reader.read(none, [0, 0, 0, 0, -0.3, 0], PAD.l2).value).toBe(0);
  });

  it('prefers the button value when a non-standard pad reports one', () => {
    const reader = new TriggerReader('');
    expect(reader.read(buttons({ [PAD.r2]: 0.9 }), [0, 0, 0, 0, -1, -1], PAD.r2).value).toBe(0.9);
  });
});

describe('GamepadSource triggers', () => {
  it('aims and fires from analog triggers on a standard pad and reports the analog value', () => {
    const source = new GamepadSource(0, 'Xbox Wireless Controller (Vendor: 045e)', 'standard', new BindingStore(), TUNING);
    source.readPad(pad('standard', { [PAD.l2]: 0.3, [PAD.r2]: 0.1 }));
    let frame = new InputFrame();
    source.poll(frame, 'game', 1 / 60);
    expect(frame.down.has('Aim')).toBe(false);
    source.readPad(pad('standard', { [PAD.l2]: 0.6, [PAD.r2]: 0.4 }));
    frame = new InputFrame();
    source.poll(frame, 'game', 1 / 60);
    expect(frame.pressedNow.has('Aim')).toBe(true);
    expect(frame.pressedNow.has('Fire')).toBe(true);
    expect(source.triggerValue(PAD.l2)).toBeCloseTo(0.6, 6);
    // Easing off to the dead band between the two thresholds keeps the hold.
    source.readPad(pad('standard', { [PAD.l2]: 0.3, [PAD.r2]: 0.3 }));
    frame = new InputFrame();
    source.poll(frame, 'game', 1 / 60);
    expect(frame.down.has('Aim')).toBe(true);
    expect(frame.pressedNow.has('Aim')).toBe(false);
    source.readPad(pad('standard', { [PAD.l2]: 0.1, [PAD.r2]: 0 }));
    frame = new InputFrame();
    source.poll(frame, 'game', 1 / 60);
    expect(frame.down.has('Aim')).toBe(false);
    expect(frame.down.has('Fire')).toBe(false);
  });

  it('reads triggers from the axes when a non-standard pad reports no trigger buttons', () => {
    const source = new GamepadSource(0, 'Generic USB Gamepad', '', new BindingStore(), TUNING);
    // Rest snapshot: axes 4/5 sit at -1 (Android Chrome style).
    source.readPad(pad('', {}, [0, 0, 0, 0, -1, -1]));
    let frame = new InputFrame();
    source.poll(frame, 'game', 1 / 60);
    expect(frame.down.has('Fire')).toBe(false);
    source.readPad(pad('', {}, [0, 0, 0, 0, -1, 0.2]));
    frame = new InputFrame();
    source.poll(frame, 'game', 1 / 60);
    expect(frame.pressedNow.has('Fire')).toBe(true);
    expect(source.triggerValue(PAD.r2)).toBeCloseTo(0.6, 6);
    expect(source.lastActivity).toBeGreaterThan(0);
  });

  it('scales stick look by the aim multiplier and the field-of-view ratio only while aiming', () => {
    const modifier = { fovRatio: 1, aiming: false };
    const source = new GamepadSource(0, 'Xbox Wireless Controller (Vendor: 045e)', 'standard', new BindingStore(), { ...TUNING, aimSensitivity: 0.5 }, modifier);
    source.readPad(pad('standard', {}, [0, 0, 1, 0]));
    let frame = new InputFrame();
    source.poll(frame, 'game', 1);
    const plain = frame.lookDeltaX;
    modifier.aiming = true;
    modifier.fovRatio = 44 / 58;
    frame = new InputFrame();
    source.poll(frame, 'game', 1);
    expect(frame.lookDeltaX / plain).toBeCloseTo(0.5 * (44 / 58), 6);
  });
});
