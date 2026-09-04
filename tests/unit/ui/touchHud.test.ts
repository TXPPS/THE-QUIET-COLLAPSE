// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InputFrame } from '@/input/InputFrame';
import { TouchSource } from '@/input/TouchSource';
import { TouchHud, readViewport, type TouchHudState } from '@/ui/touch/TouchHud';
import { controlRect, presetProfile } from '@/ui/touch/touchProfiles';

class FakePointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
    super(type, { bubbles: true, cancelable: true, ...init });
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'touch';
  }
}

function fire(target: Element, type: string, pointerId: number, x = 0, y = 0): void {
  target.dispatchEvent(new FakePointerEvent(type, { pointerId, clientX: x, clientY: y }));
}

const IDLE: TouchHudState = { fireVisible: true, canReload: false, hasFlashlight: false, promptVisible: false };

/** Polls the source into a fresh frame the way InputManager does once per render frame. */
function poll(source: TouchSource, dt = 1 / 60): InputFrame {
  const frame = new InputFrame();
  source.poll(frame, 'game', dt);
  return frame;
}

describe('TouchHud pointer ownership', () => {
  beforeAll(() => {
    (globalThis as { PointerEvent?: unknown }).PointerEvent = FakePointerEvent;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.hasPointerCapture = () => false;
  });

  let layer: HTMLElement;
  let source: TouchSource;
  let hud: TouchHud;
  let moveZone: HTMLElement;
  let lookZone: HTMLElement;
  let fireButton: HTMLElement;
  /** A point inside the look zone that hits no button (jsdom viewport 1024×768, no insets). */
  let freeLook: { x: number; y: number };

  beforeEach(() => {
    document.body.innerHTML = '';
    layer = document.createElement('div');
    document.body.append(layer);
    source = new TouchSource();
    hud = new TouchHud(layer, source, presetProfile('twoThumb'));
    hud.setVisible(true);
    hud.update(IDLE, 1 / 60);
    (globalThis as { performance: Performance }).performance.now = () => 1000;
    moveZone = layer.querySelector('.tqc-touch__zone--move') as HTMLElement;
    lookZone = layer.querySelector('.tqc-touch__zone--look') as HTMLElement;
    fireButton = layer.querySelector('[data-touch-control="fire"]') as HTMLElement;
    freeLook = { x: 620, y: 200 };
  });

  it('runs the move stick and the look zone at the same time on independent pointers, every frame', () => {
    fire(moveZone, 'pointerdown', 1, 120, 600);
    fire(lookZone, 'pointerdown', 2, freeLook.x, freeLook.y);
    expect(hud.ownedPointers.get(1)).toBe('joystick');
    expect(hud.ownedPointers.get(2)).toBe('look');
    for (let frame = 1; frame <= 5; frame += 1) {
      fire(moveZone, 'pointermove', 1, 120, 600 - frame * 20);
      fire(lookZone, 'pointermove', 2, freeLook.x + frame * 10, freeLook.y + frame * 4);
      const polled = poll(source);
      expect(polled.axes.Move.y, `frame ${frame} move`).toBeGreaterThan(0);
      expect(polled.lookDeltaX, `frame ${frame} look x`).toBeGreaterThan(0);
      expect(polled.lookDeltaY, `frame ${frame} look y`).toBeGreaterThan(0);
    }
    // Cancel the look finger: look stops, the stick keeps driving movement.
    fire(lookZone, 'pointercancel', 2, freeLook.x, freeLook.y);
    expect(hud.ownedPointers.has(2)).toBe(false);
    fire(lookZone, 'pointermove', 2, freeLook.x + 200, freeLook.y + 200);
    fire(moveZone, 'pointermove', 1, 120, 450);
    const after = poll(source);
    expect(after.lookDeltaX).toBe(0);
    expect(after.lookDeltaY).toBe(0);
    expect(after.axes.Move.y).toBeGreaterThan(0.5);
    fire(moveZone, 'pointerup', 1, 120, 450);
    expect(source.moveY).toBe(0);
    expect(hud.ownedPointers.size).toBe(0);
  });

  it('never lets a finger that started on a button drive the look zone, or the reverse', () => {
    fire(fireButton, 'pointerdown', 3, 900, 700);
    expect(source.isHeld('Fire')).toBe(true);
    fire(lookZone, 'pointerdown', 3, freeLook.x, freeLook.y);
    fire(lookZone, 'pointermove', 3, freeLook.x + 50, freeLook.y + 50);
    expect(source.lookDx).toBe(0);
    expect(source.lookDy).toBe(0);
    fire(fireButton, 'pointerup', 3, 900, 700);
    expect(source.isHeld('Fire')).toBe(false);

    fire(lookZone, 'pointerdown', 4, freeLook.x, freeLook.y);
    fire(fireButton, 'pointerdown', 4, 900, 700);
    expect(source.isHeld('Fire')).toBe(false);
    fire(lookZone, 'pointermove', 4, freeLook.x + 30, freeLook.y);
    expect(source.lookDx).toBe(30);
    fire(lookZone, 'pointerup', 4, freeLook.x + 30, freeLook.y);
  });

  it('refuses a look drag whose first touch lands on a visible button hit area', () => {
    const viewport = readViewport(hud.root);
    const rect = controlRect('fire', presetProfile('twoThumb').controls.fire, viewport);
    fire(lookZone, 'pointerdown', 5, rect.cx, rect.cy);
    expect(hud.ownedPointers.has(5)).toBe(false);
    fire(lookZone, 'pointermove', 5, rect.cx + 40, rect.cy);
    expect(source.lookDx).toBe(0);
  });

  it('reports drag-down as look-down through the Look action and honours the touch invert option', () => {
    fire(lookZone, 'pointerdown', 6, freeLook.x, freeLook.y);
    fire(lookZone, 'pointermove', 6, freeLook.x, freeLook.y + 25);
    expect(source.lookDy).toBe(25);
    expect(poll(source).lookDeltaY).toBeGreaterThan(0);
    source.setTuning({ stickSensitivity: 1, invertY: true });
    fire(lookZone, 'pointermove', 6, freeLook.x, freeLook.y + 50);
    expect(poll(source).lookDeltaY).toBeLessThan(0);
    fire(lookZone, 'pointerup', 6, freeLook.x, freeLook.y + 50);
  });

  it('holds and releases a button per pointer id and ignores a second finger on the same button', () => {
    fire(fireButton, 'pointerdown', 5);
    expect(source.isHeld('Fire')).toBe(true);
    fire(fireButton, 'pointerdown', 6);
    fire(fireButton, 'pointerup', 6);
    expect(source.isHeld('Fire')).toBe(true);
    fire(fireButton, 'pointerup', 5);
    expect(source.isHeld('Fire')).toBe(false);
  });

  it('drives the joystick from a floating origin and clears on pointercancel', () => {
    fire(moveZone, 'pointerdown', 2, 100, 300);
    fire(moveZone, 'pointermove', 2, 100, 190);
    expect(source.moveY).toBeGreaterThan(0.8);
    expect(source.moveX).toBeCloseTo(0, 5);
    fire(moveZone, 'pointermove', 9, 500, 300); // another pointer must not steal the stick
    expect(source.moveY).toBeGreaterThan(0.8);
    fire(moveZone, 'pointercancel', 2, 100, 250);
    expect(source.moveX).toBe(0);
    expect(source.moveY).toBe(0);
  });

  it('latches aim on tap and toggles it off on the next tap', () => {
    const aim = layer.querySelector('[data-touch-control="aim"]') as HTMLElement;
    fire(aim, 'pointerdown', 3);
    fire(aim, 'pointerup', 3);
    expect(source.isHeld('Aim')).toBe(true);
    fire(aim, 'pointerdown', 4);
    fire(aim, 'pointerup', 4);
    expect(source.isHeld('Aim')).toBe(false);
  });

  it('releases everything on visibility loss and when hidden, including the look pointer', () => {
    fire(fireButton, 'pointerdown', 5);
    fire(moveZone, 'pointerdown', 2, 100, 300);
    fire(moveZone, 'pointermove', 2, 140, 300);
    fire(lookZone, 'pointerdown', 7, freeLook.x, freeLook.y);
    expect(source.isHeld('Fire')).toBe(true);
    expect(hud.ownedPointers.size).toBe(3);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(source.isHeld('Fire')).toBe(false);
    expect(source.moveX).toBe(0);
    expect(hud.ownedPointers.size).toBe(0);
    fire(lookZone, 'pointermove', 7, freeLook.x + 40, freeLook.y);
    expect(source.lookDx).toBe(0);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    fire(fireButton, 'pointerdown', 8);
    hud.setVisible(false);
    expect(source.isHeld('Fire')).toBe(false);
  });

  it('applies the configurable joystick dead zone and sprint threshold', () => {
    hud.tuning = { deadZone: 0.3, sprintThreshold: 0.8, sprintLock: true };
    fire(moveZone, 'pointerdown', 2, 100, 300);
    fire(moveZone, 'pointermove', 2, 100, 290); // 10px on a ~78px radius: inside the dead zone
    expect(source.moveY).toBe(0);
    fire(moveZone, 'pointermove', 2, 100, 150); // far past the edge: full deflection
    expect(source.moveY).toBeCloseTo(1, 5);
    for (let i = 0; i < 30; i += 1) hud.update(IDLE, 1 / 60);
    expect(source.isHeld('Sprint')).toBe(true);
    fire(moveZone, 'pointermove', 2, 100, 280); // relax below the release point
    hud.update(IDLE, 1 / 60);
    expect(source.isHeld('Sprint')).toBe(false);
    fire(moveZone, 'pointerup', 2, 100, 280);
  });

  it('shows contextual buttons only when their action is valid', () => {
    const interact = layer.querySelector('[data-touch-control="interact"]') as HTMLElement;
    const reload = layer.querySelector('[data-touch-control="reload"]') as HTMLElement;
    expect(interact.hidden).toBe(true);
    expect(reload.hidden).toBe(true);
    hud.update({ ...IDLE, promptVisible: true, canReload: true }, 1 / 60);
    expect(interact.hidden).toBe(false);
    expect(reload.hidden).toBe(false);
    fire(reload, 'pointerdown', 9);
    expect(source.isHeld('Reload')).toBe(true);
    hud.update({ ...IDLE, canReload: false }, 1 / 60);
    expect(reload.hidden).toBe(true);
    expect(source.isHeld('Reload')).toBe(false);
  });

  it('shows the first-use look hint until the player drags, then reports it', () => {
    let used = 0;
    hud.onLookUsed = () => (used += 1);
    hud.setLookHint(true);
    const hint = layer.querySelector('.tqc-touch__look-hint') as HTMLElement;
    expect(hint.classList.contains('is-visible')).toBe(true);
    fire(lookZone, 'pointerdown', 10, freeLook.x, freeLook.y);
    fire(lookZone, 'pointermove', 10, freeLook.x + 3, freeLook.y);
    expect(hint.classList.contains('is-visible')).toBe(true);
    fire(lookZone, 'pointermove', 10, freeLook.x + 20, freeLook.y);
    expect(hint.classList.contains('is-visible')).toBe(false);
    expect(used).toBe(1);
    fire(lookZone, 'pointerup', 10, freeLook.x + 20, freeLook.y);
  });

  it('offers a right look stick with a radial dead zone and exponential response instead of the drag zone', () => {
    const profile = presetProfile('twoThumb');
    profile.controls.lookStick.visible = true;
    hud.setProfile(profile);
    hud.setLookControl('stick');
    const stick = layer.querySelector('[data-touch-control="lookStick"]') as HTMLElement;
    expect(stick.hidden).toBe(false);
    const rect = controlRect('lookStick', profile.controls.lookStick, readViewport(hud.root));
    fire(lookZone, 'pointerdown', 11, freeLook.x, freeLook.y);
    fire(lookZone, 'pointermove', 11, freeLook.x + 40, freeLook.y);
    expect(source.lookDx).toBe(0); // drag zone is off in stick mode
    fire(stick, 'pointerdown', 12, rect.cx, rect.cy);
    fire(stick, 'pointermove', 12, rect.cx, rect.cy + rect.r * 0.05); // inside the dead zone
    expect(source.lookStickY).toBe(0);
    fire(stick, 'pointermove', 12, rect.cx, rect.cy + rect.r * 0.5);
    const half = source.lookStickY;
    expect(half).toBeGreaterThan(0);
    const halfLook = poll(source, 1).lookDeltaY;
    fire(stick, 'pointermove', 12, rect.cx, rect.cy + rect.r * 2);
    expect(source.lookStickY).toBeCloseTo(1, 5);
    const fullLook = poll(source, 1).lookDeltaY;
    expect(fullLook / halfLook).toBeGreaterThan(2.5); // squared curve, not linear
    fire(stick, 'pointerup', 12, rect.cx, rect.cy);
    expect(source.lookStickY).toBe(0);
    hud.setLookControl('drag');
    expect(stick.hidden).toBe(true);
  });
});
