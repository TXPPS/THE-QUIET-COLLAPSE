import { CAMERA } from '@/config/gameplay';
import type { ButtonAction } from './actions';
import type { InputFrame } from './InputFrame';
import { TOUCH_SOURCE_ID, type InputSource, type SourceContext } from './InputSource';

export interface TouchTuning {
  stickSensitivity: number;
  invertY: boolean;
}

/**
 * Touch state written by the touch HUD (joystick vector, look drag deltas, button holds/pulses)
 * and read by the input layer. The HUD owns pointers; this class owns semantics.
 */
export class TouchSource implements InputSource {
  readonly id = TOUCH_SOURCE_ID;
  readonly kind = 'touch' as const;
  label = 'Touch';
  glyphFamily = 'touch' as const;
  confidence = 1;
  available = true;
  lastActivity = 0;
  moveX = 0;
  moveY = 0;
  lookDx = 0;
  lookDy = 0;
  navigateX = 0;
  navigateY = 0;
  private readonly held = new Set<ButtonAction>();
  private readonly pulsed = new Set<ButtonAction>();
  private tuning: TouchTuning = { stickSensitivity: 1, invertY: false };

  start(): void {
    /* Driven by the touch HUD. */
  }

  stop(): void {
    this.clear();
  }

  setTuning(tuning: TouchTuning): void {
    this.tuning = tuning;
  }

  markActivity(): void {
    this.lastActivity = performance.now();
  }

  hold(action: ButtonAction): void {
    this.held.add(action);
    this.pulsed.add(action);
    this.markActivity();
  }

  release(action: ButtonAction): void {
    this.held.delete(action);
  }

  pulse(action: ButtonAction): void {
    this.pulsed.add(action);
    this.markActivity();
  }

  isHeld(action: ButtonAction): boolean {
    return this.held.has(action);
  }

  addLook(dx: number, dy: number): void {
    this.lookDx += dx;
    this.lookDy += dy;
    if (dx !== 0 || dy !== 0) this.markActivity();
  }

  setMove(x: number, y: number): void {
    this.moveX = x;
    this.moveY = y;
    if (x !== 0 || y !== 0) this.markActivity();
  }

  clear(): void {
    this.held.clear();
    this.pulsed.clear();
    this.moveX = 0;
    this.moveY = 0;
    this.lookDx = 0;
    this.lookDy = 0;
    this.navigateX = 0;
    this.navigateY = 0;
  }

  poll(frame: InputFrame, context: SourceContext, _dt: number): void {
    if (context === 'game') {
      if (this.moveX !== 0 || this.moveY !== 0) frame.addAxis('Move', this.moveX, this.moveY);
      const s = CAMERA.lookSensitivityBase * 1.6 * this.tuning.stickSensitivity;
      frame.lookDeltaX += this.lookDx * s;
      frame.lookDeltaY += this.lookDy * s * (this.tuning.invertY ? -1 : 1);
    } else if (this.navigateX !== 0 || this.navigateY !== 0) {
      frame.addAxis('Navigate', this.navigateX, this.navigateY);
    }
    for (const action of this.held) frame.press(action);
    for (const action of this.pulsed) frame.pulse(action);
    this.pulsed.clear();
    this.lookDx = 0;
    this.lookDy = 0;
  }
}
