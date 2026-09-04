import { ACTIONS, type Action, type AxisAction, type ButtonAction } from './actions';

/** Per-frame accumulation of semantic input from every contributing source. */
export class InputFrame {
  readonly down = new Set<ButtonAction>();
  /** Actions with a fresh press since the previous poll (counts as an edge even if held before). */
  readonly pressedNow = new Set<ButtonAction>();
  readonly axes: Record<AxisAction, { x: number; y: number }> = {
    Move: { x: 0, y: 0 },
    Look: { x: 0, y: 0 },
    Navigate: { x: 0, y: 0 },
  };
  /** Look delta expressed in radians for pointer-style sources (added on top of stick look). */
  lookDeltaX = 0;
  lookDeltaY = 0;

  reset(): void {
    this.down.clear();
    this.pressedNow.clear();
    for (const action of ACTIONS) {
      const axis = this.axes[action as AxisAction];
      if (axis) {
        axis.x = 0;
        axis.y = 0;
      }
    }
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
  }

  press(action: ButtonAction): void {
    this.down.add(action);
  }

  /** A press that began since the last poll: down this frame and an edge regardless of last frame. */
  pulse(action: ButtonAction): void {
    this.down.add(action);
    this.pressedNow.add(action);
  }

  addAxis(action: AxisAction, x: number, y: number): void {
    const axis = this.axes[action];
    axis.x += x;
    axis.y += y;
  }
}

export interface ActionSnapshot {
  isDown(action: Action): boolean;
  justPressed(action: Action): boolean;
  justReleased(action: Action): boolean;
  axis(action: AxisAction): { x: number; y: number };
}
