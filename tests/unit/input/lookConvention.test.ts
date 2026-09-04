// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { CAMERA } from '@/config/gameplay';
import { BindingStore } from '@/input/BindingStore';
import { GamepadSource, type PadTuning } from '@/input/GamepadSource';
import { InputFrame } from '@/input/InputFrame';
import { InputManager } from '@/input/InputManager';
import { KeyboardMouseSource } from '@/input/KeyboardMouseSource';
import { TouchSource } from '@/input/TouchSource';
import { SettingsStore } from '@/persistence/SettingsStore';
import { createHeadless } from '../../helpers/headless';

const PAD_TUNING: PadTuning = {
  deadZoneRadial: 0.1,
  deadZoneAxial: 0.05,
  stickSensitivity: 1,
  invertY: false,
  invertX: false,
  glyphFamilyOverride: 'auto',
  nintendoConfirm: 'east',
  vibration: false,
};

function fakePad(axes: number[]): Gamepad {
  return { index: 0, id: 'Xbox Controller (STANDARD GAMEPAD)', mapping: 'standard', axes, buttons: [], connected: true, timestamp: 0 } as unknown as Gamepad;
}

class FakePointerEvent extends MouseEvent {
  pointerId = 1;
  pointerType = 'mouse';
}

/**
 * One Look convention for every source: +x turns right, +y looks DOWN (screen Y grows downward).
 * Each source applies its own invert flag; the simulation subtracts y from pitch.
 */
describe('Look sign convention', () => {
  beforeEach(() => {
    localStorage.clear();
    (globalThis as { PointerEvent?: unknown }).PointerEvent = FakePointerEvent;
  });

  it('mouse moved down (positive movementY) looks down; the mouse invert flips it', () => {
    const source = new KeyboardMouseSource(new BindingStore());
    const canvas = document.createElement('canvas');
    source.lockTarget = canvas;
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => canvas });
    source.start();
    document.dispatchEvent(new Event('pointerlockchange'));
    const move = (dx: number, dy: number) => {
      const event = new FakePointerEvent('pointermove');
      Object.defineProperty(event, 'movementX', { value: dx });
      Object.defineProperty(event, 'movementY', { value: dy });
      window.dispatchEvent(event);
    };
    move(0, 0); // the first move after a lock change is dropped by design
    move(0, 30);
    let frame = new InputFrame();
    source.poll(frame, 'game', 1 / 60);
    expect(frame.lookDeltaY).toBeGreaterThan(0);
    source.tuning = { mouseSensitivity: 1, invertY: true, invertX: false };
    move(0, 30);
    frame = new InputFrame();
    source.poll(frame, 'game', 1 / 60);
    expect(frame.lookDeltaY).toBeLessThan(0);
    source.stop();
  });

  it('right stick pushed down looks down with a squared response; the controller invert flips it', () => {
    const pad = new GamepadSource(0, 'Xbox Controller (STANDARD GAMEPAD)', 'standard', new BindingStore(), PAD_TUNING);
    pad.readPad(fakePad([0, 0, 0, 0.5]));
    let frame = new InputFrame();
    pad.poll(frame, 'game', 1);
    const half = frame.lookDeltaY;
    expect(half).toBeGreaterThan(0);
    pad.readPad(fakePad([0, 0, 0, 1]));
    frame = new InputFrame();
    pad.poll(frame, 'game', 1);
    expect(frame.lookDeltaY / half).toBeGreaterThan(2.5);
    pad.setTuning({ ...PAD_TUNING, invertY: true });
    frame = new InputFrame();
    pad.poll(frame, 'game', 1);
    expect(frame.lookDeltaY).toBeLessThan(0);
  });

  it('touch drag down looks down; the touch invert flips it; the right stick integrates per frame', () => {
    const touch = new TouchSource();
    touch.addLook(0, 20);
    let frame = new InputFrame();
    touch.poll(frame, 'game', 1 / 60);
    expect(frame.lookDeltaY).toBeCloseTo(20 * CAMERA.lookSensitivityBase * 1.6, 6);
    touch.setTuning({ stickSensitivity: 1, invertY: true });
    touch.addLook(0, 20);
    frame = new InputFrame();
    touch.poll(frame, 'game', 1 / 60);
    expect(frame.lookDeltaY).toBeLessThan(0);
    touch.setTuning({ stickSensitivity: 1, invertY: false });
    touch.setLookStick(0, 1);
    frame = new InputFrame();
    touch.poll(frame, 'game', 0.5);
    expect(frame.lookDeltaY).toBeCloseTo(CAMERA.stickLookRateBase * 0.5, 6);
  });

  it('per-source invert settings reach the right source and nothing else', () => {
    const settings = new SettingsStore();
    const input = new InputManager(settings);
    settings.update({ controls: { invertYTouch: true } });
    input.enableTouch(true);
    input.setContext('game');
    input.touch.addLook(0, 10);
    input.update(1 / 60);
    expect(input.lookDelta().y).toBeLessThan(0);
    expect(input.keyboardMouse.tuning.invertY).toBe(false);
    settings.update({ controls: { invertYMouse: true, invertYTouch: false } });
    expect(input.keyboardMouse.tuning.invertY).toBe(true);
    input.touch.addLook(0, 10);
    input.update(1 / 60);
    expect(input.lookDelta().y).toBeGreaterThan(0);
    input.dispose();
  });

  it('the simulation lowers pitch for a positive (look-down) delta and turns right for positive x', () => {
    const h = createHeadless(undefined, { killThreats: true });
    const before = h.world.look.pitch;
    h.sim.applyLook(0, 0.1);
    expect(h.world.look.pitch).toBeCloseTo(before - 0.1, 6);
    const yaw = h.world.look.yaw;
    h.sim.applyLook(0.2, 0);
    expect(h.world.look.yaw).toBeCloseTo(yaw - 0.2, 6);
    expect(h.world.look.pitch).toBeLessThanOrEqual(CAMERA.maxPitch);
  });

  it('Move.x > 0 strafes toward screen-right for the current camera yaw', () => {
    const h = createHeadless(undefined, { killThreats: true });
    const p = h.world.player;
    p.x = 14;
    p.z = 21;
    h.world.look.yaw = Math.PI / 2; // facing +X: screen-right is +Z
    h.input.move = { x: 1, y: 0 };
    for (let i = 0; i < 30; i += 1) {
      h.input.beginStep();
      h.sim.step(h.input, 1 / 60);
    }
    expect(p.z).toBeGreaterThan(21.2);
    expect(Math.abs(p.x - 14)).toBeLessThan(0.05);
    h.world.look.yaw = 0; // facing +Z: screen-right is -X
    const x0 = p.x;
    for (let i = 0; i < 30; i += 1) {
      h.input.beginStep();
      h.sim.step(h.input, 1 / 60);
    }
    expect(p.x).toBeLessThan(x0 - 0.2);
  });

  it('migrates the old single invertY flag onto every source', () => {
    localStorage.setItem('the-quiet-collapse.settings', JSON.stringify({ v: 1, savedAt: 'x', data: { controls: { invertY: true } } }));
    const store = new SettingsStore();
    const c = store.get().controls;
    expect([c.invertYMouse, c.invertYGamepad, c.invertYTouch]).toEqual([true, true, true]);
    expect('invertY' in c).toBe(false);
  });
});
