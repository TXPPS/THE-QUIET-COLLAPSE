// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { BindingStore } from '@/input/BindingStore';
import type { GamepadSource, PadTuning } from '@/input/GamepadSource';
import { InputFrame } from '@/input/InputFrame';
import { InputSourceRegistry } from '@/input/InputSourceRegistry';
import { KeyboardMouseSource } from '@/input/KeyboardMouseSource';
import { gamepadSourceId } from '@/input/InputSource';

const tuning: PadTuning = { deadZoneRadial: 0.18, deadZoneAxial: 0.1, stickSensitivity: 1, aimSensitivity: 1, invertY: false, invertX: false, glyphFamilyOverride: 'auto', nintendoConfirm: 'east', vibration: true };

function padEvent(type: 'gamepadconnected' | 'gamepaddisconnected', gamepad: Gamepad): Event {
  return Object.assign(new Event(type), { gamepad });
}

function fakePad(index: number, id: string, buttons: number[] = [], axes: number[] = []): Gamepad {
  return {
    index,
    id,
    mapping: 'standard',
    connected: true,
    timestamp: 0,
    axes,
    buttons: buttons.map((value) => ({ value, pressed: value > 0.5, touched: value > 0 })),
    hapticActuators: [],
    vibrationActuator: null,
  } as unknown as Gamepad;
}

describe('InputSourceRegistry policies', () => {
  let now = 1000;
  beforeEach(() => {
    localStorage.clear();
    now = 1000;
    performance.now = () => now;
  });

  function setup() {
    const bindings = new BindingStore();
    const registry = new InputSourceRegistry(bindings, tuning);
    const kbm = new KeyboardMouseSource(bindings);
    registry.register(kbm);
    return { bindings, registry, kbm };
  }

  it('auto policy follows the most recently active source with debounce', () => {
    const { registry, kbm } = setup();
    const families: string[] = [];
    registry.events.on('activeChanged', ({ family }) => families.push(family));
    window.dispatchEvent(padEvent('gamepadconnected', fakePad(0, 'Xbox Wireless Controller (Vendor: 045e)')));
    const pad = registry.get(gamepadSourceId(0)) as GamepadSource;
    expect(pad).toBeTruthy();
    kbm.lastActivity = now;
    registry.update(now);
    expect(registry.activeSource).toBe(kbm);
    now += 500;
    pad.lastActivity = now;
    registry.update(now);
    expect(registry.activeSource).toBe(pad);
    expect(registry.activeFamily).toBe('xbox');
    // Small jitter older than the debounce window must not flip prompts back.
    kbm.lastActivity = now + 100;
    registry.update(now + 100);
    expect(registry.activeSource).toBe(pad);
    expect(families).toEqual(['keyboard', 'xbox']);
    registry.dispose();
  });

  it('locked policy lets only the primary source contribute and reports its loss', () => {
    const { registry, kbm } = setup();
    window.dispatchEvent(padEvent('gamepadconnected', fakePad(1, 'DualSense Wireless Controller')));
    const pad = registry.get(gamepadSourceId(1)) as GamepadSource;
    registry.setPolicy('locked', pad.id);
    expect(registry.contributing()).toEqual([pad]);
    expect(registry.activeFamily).toBe('playstation');
    kbm.lastActivity = now + 5000;
    registry.update(now + 5000);
    expect(registry.activeSource).toBe(pad);
    let lost: string | null = null;
    registry.events.on('primaryLost', ({ source }) => (lost = source.id));
    window.dispatchEvent(padEvent('gamepaddisconnected', fakePad(1, 'DualSense Wireless Controller')));
    expect(lost).toBe(pad.id);
    expect(registry.activeSource).toBe(kbm);
    expect(registry.contributing()).toEqual([]);
    registry.dispose();
  });

  it('applies dead zones and nintendo confirm swapping when polling a pad', () => {
    const { registry } = setup();
    window.dispatchEvent(padEvent('gamepadconnected', fakePad(0, 'Pro Controller (Vendor: 057e)')));
    const pad = registry.get(gamepadSourceId(0)) as GamepadSource;
    pad.readPad(fakePad(0, 'Pro Controller', [0, 1], [0.05, 0.02, 0, 0]));
    const ui = new InputFrame();
    pad.poll(ui, 'ui', 1 / 60);
    // East (index 1) is Confirm under the nintendo "east confirms" policy.
    expect(ui.down.has('Confirm')).toBe(true);
    expect(ui.down.has('Cancel')).toBe(false);
    const game = new InputFrame();
    pad.readPad(fakePad(0, 'Pro Controller', [], [0.05, 0.02, 0, 0]));
    pad.poll(game, 'game', 1 / 60);
    expect(game.axes.Move).toEqual({ x: 0, y: 0 });
    registry.dispose();
  });
});
