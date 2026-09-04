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
  /**
   * The Look action for this frame, in radians. One sign convention for every source:
   * `x > 0` turns right, `y > 0` looks DOWN (screen Y grows downward, so an un-inverted mouse
   * moved toward the player, a stick pushed down and a finger dragged down all produce `y > 0`).
   * Sources apply their own invert options before calling `addLook`; consumers never re-sign.
   */
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

  /** Adds to the Look action (see `lookDeltaX`/`lookDeltaY` for the sign convention). */
  addLook(dx: number, dy: number): void {
    this.lookDeltaX += dx;
    this.lookDeltaY += dy;
  }
}

export interface ActionSnapshot {
  isDown(action: Action): boolean;
  justPressed(action: Action): boolean;
  justReleased(action: Action): boolean;
  axis(action: AxisAction): { x: number; y: number };
}
