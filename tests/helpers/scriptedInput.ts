import type { Action, AxisAction } from '@/input/actions';
import type { SimInput } from '@/game/sim/Simulation';

/** Deterministic input for headless simulation tests. */
export class ScriptedInput implements SimInput {
  private readonly down = new Set<Action>();
  private readonly prev = new Set<Action>();
  private readonly pulses = new Set<Action>();
  move = { x: 0, y: 0 };
  look = { x: 0, y: 0 };

  press(action: Action): void {
    this.pulses.add(action);
  }

  hold(action: Action, held: boolean): void {
    if (held) this.down.add(action);
    else this.down.delete(action);
  }

  /** Call once per fixed step before `sim.step`. */
  beginStep(): void {
    this.prev.clear();
    for (const action of this.current) this.prev.add(action);
    this.current = new Set([...this.down, ...this.pulses]);
    this.pulses.clear();
  }

  private current = new Set<Action>();

  isDown(action: Action): boolean {
    return this.current.has(action);
  }

  justPressed(action: Action): boolean {
    return this.current.has(action) && !this.prev.has(action);
  }

  justReleased(action: Action): boolean {
    return !this.current.has(action) && this.prev.has(action);
  }

  axis(action: AxisAction): { x: number; y: number } {
    if (action === 'Move') return this.move;
    return { x: 0, y: 0 };
  }

  isEngaged(action: 'Aim' | 'Sprint'): boolean {
    return this.isDown(action);
  }

  clearToggle(): void {}

  lookDelta(): { x: number; y: number } {
    return this.look;
  }
}
