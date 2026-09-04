import { DisposeBag } from '@/core/DisposeBag';
import { CAMERA } from '@/config/gameplay';
import { ACTION_META, BUTTON_ACTIONS, type AxisAction, type BindingSlot, type ButtonAction } from './actions';
import type { BindingStore } from './BindingStore';
import type { KbmBinding } from './bindings';
import type { InputFrame } from './InputFrame';
import { KEYBOARD_MOUSE_SOURCE_ID, type InputSource, type SourceContext } from './InputSource';

const MOUSE_JITTER_PX = 2;
/** Browsers can report one huge movement when the pointer locks or the window regains focus. */
const MAX_MOUSE_DELTA_PX = 250;
const WHEEL_THRESHOLD = 1;
const KEYS_TO_PREVENT = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace']);

export interface KbmTuning {
  mouseSensitivity: number;
  invertY: boolean;
  invertX: boolean;
}

/**
 * Keyboard and mouse source. Pointer look only applies while the pointer is locked to the game
 * surface, so menus never leak mouse motion into the camera. Fast taps that begin and end
 * between frames are preserved through the pulsed sets.
 */
export class KeyboardMouseSource implements InputSource {
  readonly id = KEYBOARD_MOUSE_SOURCE_ID;
  readonly kind = 'keyboardMouse' as const;
  label = 'Keyboard & Mouse';
  glyphFamily = 'keyboard' as const;
  confidence = 1;
  available = true;
  lastActivity = 0;
  tuning: KbmTuning = { mouseSensitivity: 1, invertY: false, invertX: false };
  /** Element whose pointer lock enables mouse look. */
  lockTarget: HTMLElement | null = null;

  private readonly keys = new Set<string>();
  private readonly keysPulsed = new Set<string>();
  private readonly buttons = new Set<number>();
  private readonly buttonsPulsed = new Set<number>();
  private wheelAccum = 0;
  private wheelPulse: 'up' | 'down' | null = null;
  private mouseDx = 0;
  private mouseDy = 0;
  private ignoreNextMove = false;
  private bag: DisposeBag | null = null;
  /** Records the last raw input observed so remapping screens can capture it. */
  lastRawBinding: KbmBinding | null = null;
  onRawBinding: ((binding: KbmBinding) => void) | null = null;

  constructor(private readonly bindings: BindingStore) {}

  start(): void {
    if (this.bag) return;
    const bag = new DisposeBag();
    this.bag = bag;
    bag.listen(window, 'keydown', this.onKeyDown);
    bag.listen(window, 'keyup', this.onKeyUp);
    // Pointer events carry pointerType, so compatibility mouse events synthesised after touches
    // never count as mouse activity.
    bag.listen(window, 'pointerdown', this.onMouseDown);
    bag.listen(window, 'pointerup', this.onMouseUp);
    bag.listen(window, 'pointermove', this.onMouseMove, { passive: true });
    bag.listen(window, 'wheel', this.onWheel, { passive: false });
    bag.listen(window, 'blur', this.clearAll);
    bag.listen(document, 'visibilitychange', () => {
      if (document.hidden) this.clearAll();
    });
    bag.listen(document, 'pointerlockchange', () => {
      this.ignoreNextMove = true;
      if (!this.isPointerLocked) this.buttons.clear();
    });
  }

  stop(): void {
    this.bag?.dispose();
    this.bag = null;
    this.clearAll();
  }

  get isPointerLocked(): boolean {
    return this.lockTarget !== null && document.pointerLockElement === this.lockTarget;
  }

  poll(frame: InputFrame, context: SourceContext, _dt: number): void {
    if (context === 'game') {
      this.pollAxis(frame, 'Move');
      const s = CAMERA.lookSensitivityBase * this.tuning.mouseSensitivity;
      if (this.isPointerLocked) {
        frame.lookDeltaX += this.mouseDx * s * (this.tuning.invertX ? -1 : 1);
        frame.lookDeltaY += this.mouseDy * s * (this.tuning.invertY ? -1 : 1);
      }
    } else {
      this.pollAxis(frame, 'Navigate');
    }
    for (const action of BUTTON_ACTIONS) {
      const meta = ACTION_META[action];
      if (meta.context !== 'both' && meta.context !== context) continue;
      if (this.isSlotFresh(action, context)) frame.pulse(action);
      else if (this.isSlotActive(action, context)) frame.press(action);
    }
    this.endFrame();
  }

  /** Emergency contribution when this source is not the locked primary: Escape still pauses. */
  pollEmergency(frame: InputFrame): void {
    if (this.keysPulsed.has('Escape')) frame.pulse('Pause');
    else if (this.keys.has('Escape')) frame.press('Pause');
    this.endFrame();
  }

  private endFrame(): void {
    this.keysPulsed.clear();
    this.buttonsPulsed.clear();
    this.wheelPulse = null;
    this.mouseDx = 0;
    this.mouseDy = 0;
  }

  private pollAxis(frame: InputFrame, action: AxisAction): void {
    const x = (this.isSlotActive(`${action}.right`, 'game') ? 1 : 0) - (this.isSlotActive(`${action}.left`, 'game') ? 1 : 0);
    const y = (this.isSlotActive(`${action}.up`, 'game') ? 1 : 0) - (this.isSlotActive(`${action}.down`, 'game') ? 1 : 0);
    if (x !== 0 || y !== 0) frame.addAxis(action, x, y);
  }

  /** True when a binding of the slot was newly pressed since the last poll. */
  private isSlotFresh(slot: BindingSlot, context: SourceContext): boolean {
    for (const binding of this.bindings.kbmFor(slot)) {
      if (binding.type === 'key' && this.keysPulsed.has(binding.code)) return true;
      if (binding.type === 'mouse' && context === 'game' && this.buttonsPulsed.has(binding.button)) return true;
      if (binding.type === 'wheel' && context === 'game' && this.wheelPulse === binding.dir) return true;
    }
    return false;
  }

  private isSlotActive(slot: BindingSlot, context: SourceContext): boolean {
    for (const binding of this.bindings.kbmFor(slot)) {
      if (binding.type === 'key' && (this.keys.has(binding.code) || this.keysPulsed.has(binding.code))) return true;
      if (binding.type === 'mouse' && context === 'game' && (this.buttons.has(binding.button) || this.buttonsPulsed.has(binding.button)))
        return true;
      if (binding.type === 'wheel' && context === 'game' && this.wheelPulse === binding.dir) return true;
    }
    return false;
  }

  private markActivity(): void {
    this.lastActivity = performance.now();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (isTextEntry(event.target)) return;
    this.keys.add(event.code);
    this.keysPulsed.add(event.code);
    this.markActivity();
    this.captureRaw({ type: 'key', code: event.code });
    if (KEYS_TO_PREVENT.has(event.code)) event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onMouseDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    this.markActivity();
    this.captureRaw({ type: 'mouse', button: event.button });
    if (!this.isPointerLocked && !this.isGameSurface(event.target)) return;
    this.buttons.add(event.button);
    this.buttonsPulsed.add(event.button);
    if (event.button === 2 || event.button === 1) event.preventDefault();
  };

  private readonly onMouseUp = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    this.buttons.delete(event.button);
  };

  private readonly onMouseMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    const dx = event.movementX;
    const dy = event.movementY;
    if (Math.abs(dx) + Math.abs(dy) > MOUSE_JITTER_PX) this.markActivity();
    if (!this.isPointerLocked) return;
    if (this.ignoreNextMove) {
      this.ignoreNextMove = false;
      return;
    }
    if (Math.abs(dx) > MAX_MOUSE_DELTA_PX || Math.abs(dy) > MAX_MOUSE_DELTA_PX) return;
    this.mouseDx += dx;
    this.mouseDy += dy;
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (!this.isPointerLocked && !this.isGameSurface(event.target)) return;
    event.preventDefault();
    this.wheelAccum += event.deltaY;
    if (Math.abs(this.wheelAccum) >= WHEEL_THRESHOLD) {
      this.wheelPulse = this.wheelAccum > 0 ? 'down' : 'up';
      this.captureRaw({ type: 'wheel', dir: this.wheelPulse });
      this.wheelAccum = 0;
      this.markActivity();
    }
  };

  private readonly clearAll = (): void => {
    this.keys.clear();
    this.keysPulsed.clear();
    this.buttons.clear();
    this.buttonsPulsed.clear();
    this.wheelPulse = null;
    this.wheelAccum = 0;
    this.mouseDx = 0;
    this.mouseDy = 0;
  };

  private captureRaw(binding: KbmBinding): void {
    this.lastRawBinding = binding;
    this.onRawBinding?.(binding);
  }

  private isGameSurface(target: EventTarget | null): boolean {
    return this.lockTarget !== null && target === this.lockTarget;
  }

  /** Buttons currently held (used by hold/toggle modes and tests). */
  isButtonHeld(action: ButtonAction): boolean {
    return this.isSlotActive(action, 'game');
  }
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
