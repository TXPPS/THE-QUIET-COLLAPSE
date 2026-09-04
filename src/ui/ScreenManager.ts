import { EventBus } from '@/core/EventBus';
import type { InputManager } from '@/input/InputManager';
import { MenuNavigator } from '@/input/MenuNavigator';
import type { Screen } from './Screen';

export interface ScreenEvents extends Record<string, unknown> {
  changed: { top: Screen | null; depth: number };
  /** Discrete UI feedback moments for audio. */
  feedback: { kind: 'move' | 'confirm' | 'cancel' };
}

/**
 * Stack of screens. Only the top screen receives navigation. Transitions run synchronously and
 * are guarded so a single input edge can never open or close two screens.
 */
export class ScreenManager {
  readonly events = new EventBus<ScreenEvents>();
  private readonly stack: Screen[] = [];
  private transitioning = false;
  private readonly navigator: MenuNavigator;

  constructor(
    private readonly screenLayer: HTMLElement,
    private readonly modalLayer: HTMLElement,
    private readonly input: InputManager,
  ) {
    this.navigator = new MenuNavigator({
      navigate: (direction) => {
        this.top?.onNavigate(direction);
        this.events.emit('feedback', { kind: 'move' });
      },
      confirm: () => {
        this.top?.onConfirm();
        this.events.emit('feedback', { kind: 'confirm' });
      },
      cancel: () => {
        this.cancel();
        this.events.emit('feedback', { kind: 'cancel' });
      },
      tabPrev: () => {
        this.top?.onTabPrev();
        this.events.emit('feedback', { kind: 'move' });
      },
      tabNext: () => {
        this.top?.onTabNext();
        this.events.emit('feedback', { kind: 'move' });
      },
    });
  }

  get top(): Screen | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  get depth(): number {
    return this.stack.length;
  }

  /** True when any mounted screen pauses the simulation. */
  get pausesGame(): boolean {
    return this.stack.some((screen) => screen.pausesGame);
  }

  has(id: string): boolean {
    return this.stack.some((screen) => screen.id === id);
  }

  setRepeat(delay: number, rate: number): void {
    this.navigator.repeatDelay = delay;
    this.navigator.repeatRate = rate;
  }

  push(screen: Screen): void {
    this.guard(() => {
      const previous = this.top;
      if (previous) previous.unmount();
      this.stack.push(screen);
      screen.mount(this.layerFor(screen));
      this.afterChange();
    });
  }

  /** Pushes a modal above the current screen without unmounting it. */
  pushModal(screen: Screen): void {
    this.guard(() => {
      this.stack.push(screen);
      screen.mount(this.layerFor(screen));
      this.afterChange();
    });
  }

  pop(): void {
    this.guard(() => {
      const screen = this.stack.pop();
      if (!screen) return;
      screen.unmount();
      screen.dispose();
      const next = this.top;
      if (next) {
        if (!next.root.isConnected) next.mount(this.layerFor(next));
        else next.resume();
      }
      this.afterChange();
    });
  }

  replace(screen: Screen): void {
    this.guard(() => {
      const current = this.stack.pop();
      if (current) {
        current.unmount();
        current.dispose();
      }
      this.stack.push(screen);
      screen.mount(this.layerFor(screen));
      this.afterChange();
    });
  }

  clear(): void {
    this.guard(() => {
      while (this.stack.length > 0) {
        const screen = this.stack.pop();
        if (screen) {
          screen.unmount();
          screen.dispose();
        }
      }
      this.afterChange();
    });
  }

  /** Replaces the whole stack with a single screen. */
  reset(screen: Screen): void {
    this.clear();
    this.push(screen);
  }

  cancel(): void {
    const top = this.top;
    if (!top) return;
    if (!top.onCancel()) this.pop();
  }

  update(dt: number): void {
    const top = this.top;
    if (!top) return;
    this.navigator.update(this.input, dt);
    top.update(dt);
  }

  private guard(transition: () => void): void {
    if (this.transitioning) return;
    this.transitioning = true;
    try {
      transition();
    } finally {
      this.transitioning = false;
    }
  }

  private layerFor(screen: Screen): HTMLElement {
    return screen.layer === 'modal' ? this.modalLayer : this.screenLayer;
  }

  private afterChange(): void {
    this.navigator.reset();
    this.input.setContext(this.stack.length > 0 ? 'ui' : 'game');
    this.events.emit('changed', { top: this.top, depth: this.stack.length });
  }
}
