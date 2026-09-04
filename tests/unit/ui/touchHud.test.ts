// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TouchSource } from '@/input/TouchSource';
import { TouchHud } from '@/ui/touch/TouchHud';
import { presetProfile } from '@/ui/touch/touchProfiles';

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

describe('TouchHud pointer lifecycle', () => {
  beforeAll(() => {
    (globalThis as { PointerEvent?: unknown }).PointerEvent = FakePointerEvent;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.hasPointerCapture = () => false;
  });

  let layer: HTMLElement;
  let source: TouchSource;
  let hud: TouchHud;

  beforeEach(() => {
    document.body.innerHTML = '';
    layer = document.createElement('div');
    document.body.append(layer);
    source = new TouchSource();
    hud = new TouchHud(layer, source, presetProfile('twoThumb'));
    hud.setVisible(true);
    (globalThis as { performance: Performance }).performance.now = () => 1000;
  });

  it('holds and releases a button per pointer id and ignores a second finger on the same button', () => {
    const fireButton = layer.querySelector('[data-touch-control="fire"]') as HTMLElement;
    fire(fireButton, 'pointerdown', 5);
    expect(source.isHeld('Fire')).toBe(true);
    fire(fireButton, 'pointerdown', 6);
    fire(fireButton, 'pointerup', 6);
    expect(source.isHeld('Fire')).toBe(true);
    fire(fireButton, 'pointerup', 5);
    expect(source.isHeld('Fire')).toBe(false);
  });

  it('drives the joystick from a floating origin and clears on pointercancel', () => {
    const zone = layer.querySelector('.tqc-touch__zone--move') as HTMLElement;
    fire(zone, 'pointerdown', 2, 100, 300);
    fire(zone, 'pointermove', 2, 100, 190);
    expect(source.moveY).toBeGreaterThan(0.8);
    expect(source.moveX).toBeCloseTo(0, 5);
    fire(zone, 'pointermove', 9, 500, 300); // another pointer must not steal the stick
    expect(source.moveY).toBeGreaterThan(0.8);
    fire(zone, 'pointercancel', 2, 100, 250);
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

  it('releases everything on visibility loss and when hidden', () => {
    const fireButton = layer.querySelector('[data-touch-control="fire"]') as HTMLElement;
    const zone = layer.querySelector('.tqc-touch__zone--move') as HTMLElement;
    fire(fireButton, 'pointerdown', 5);
    fire(zone, 'pointerdown', 2, 100, 300);
    fire(zone, 'pointermove', 2, 140, 300);
    expect(source.isHeld('Fire')).toBe(true);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(source.isHeld('Fire')).toBe(false);
    expect(source.moveX).toBe(0);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    fire(fireButton, 'pointerdown', 8);
    hud.setVisible(false);
    expect(source.isHeld('Fire')).toBe(false);
  });

  it('applies the configurable joystick dead zone and sprint threshold', () => {
    hud.tuning = { deadZone: 0.3, sprintThreshold: 0.8, sprintLock: true };
    const zone = layer.querySelector('.tqc-touch__zone--move') as HTMLElement;
    fire(zone, 'pointerdown', 2, 100, 300);
    fire(zone, 'pointermove', 2, 100, 290); // 10px on a ~115px radius: inside the dead zone
    expect(source.moveY).toBe(0);
    fire(zone, 'pointermove', 2, 100, 150); // far past the edge: full deflection
    expect(source.moveY).toBeCloseTo(1, 5);
    for (let i = 0; i < 30; i += 1) hud.update({ equippedPistol: true, canReload: false, hasFlashlight: false, promptVisible: false }, 1 / 60);
    expect(source.isHeld('Sprint')).toBe(true);
    fire(zone, 'pointermove', 2, 100, 270); // relax below the release point
    hud.update({ equippedPistol: true, canReload: false, hasFlashlight: false, promptVisible: false }, 1 / 60);
    expect(source.isHeld('Sprint')).toBe(false);
    fire(zone, 'pointerup', 2, 100, 270);
  });

  it('accumulates look deltas from the right zone and resets after polling', () => {
    const zone = layer.querySelector('.tqc-touch__zone--look') as HTMLElement;
    fire(zone, 'pointerdown', 11, 600, 200);
    fire(zone, 'pointermove', 11, 640, 190);
    expect(source.lookDx).toBe(40);
    expect(source.lookDy).toBe(-10);
    fire(zone, 'pointerup', 11, 640, 190);
  });
});
