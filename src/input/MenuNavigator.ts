import type { ActionSnapshot } from './InputFrame';

export type NavDirection = 'up' | 'down' | 'left' | 'right';

export interface MenuNavEvents {
  navigate: (direction: NavDirection) => void;
  confirm: () => void;
  cancel: () => void;
  tabPrev: () => void;
  tabNext: () => void;
}

const AXIS_ENGAGE = 0.5;
const AXIS_RELEASE = 0.3;

/**
 * Turns the continuous Navigate axis and digital UI actions into discrete menu events with an
 * initial delay and a repeat rate, so held sticks cannot flood menus with navigation.
 */
export class MenuNavigator {
  repeatDelay = 0.38;
  repeatRate = 0.11;
  private heldDirection: NavDirection | null = null;
  private heldTime = 0;
  private nextRepeatAt = 0;

  constructor(private readonly handlers: MenuNavEvents) {}

  update(input: ActionSnapshot, dt: number): void {
    const axis = input.axis('Navigate');
    const direction = this.readDirection(axis.x, axis.y);
    if (direction === null) {
      this.heldDirection = null;
      this.heldTime = 0;
    } else if (direction !== this.heldDirection) {
      this.heldDirection = direction;
      this.heldTime = 0;
      this.nextRepeatAt = this.repeatDelay;
      this.handlers.navigate(direction);
    } else {
      this.heldTime += dt;
      if (this.heldTime >= this.nextRepeatAt) {
        this.nextRepeatAt += this.repeatRate;
        this.handlers.navigate(direction);
      }
    }
    if (input.justPressed('Confirm')) this.handlers.confirm();
    if (input.justPressed('Cancel')) this.handlers.cancel();
    if (input.justPressed('TabPrev')) this.handlers.tabPrev();
    if (input.justPressed('TabNext')) this.handlers.tabNext();
  }

  reset(): void {
    this.heldDirection = null;
    this.heldTime = 0;
  }

  private readDirection(x: number, y: number): NavDirection | null {
    const threshold = this.heldDirection ? AXIS_RELEASE : AXIS_ENGAGE;
    if (Math.abs(y) >= Math.abs(x)) {
      if (y > threshold) return 'up';
      if (y < -threshold) return 'down';
      return null;
    }
    if (x > threshold) return 'right';
    if (x < -threshold) return 'left';
    return null;
  }
}
