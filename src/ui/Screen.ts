import { DisposeBag } from '@/core/DisposeBag';
import type { NavDirection } from '@/input/MenuNavigator';
import { FocusManager } from './FocusManager';

export type ScreenLayer = 'screen' | 'modal';

/**
 * Base class for every DOM screen. A screen builds its DOM once in `build()`, is mounted by the
 * ScreenManager, receives navigation from the semantic input layer, and releases everything it
 * created through its DisposeBag when it leaves.
 */
export abstract class Screen {
  abstract readonly id: string;
  readonly layer: ScreenLayer = 'screen';
  /** When true, the world underneath keeps rendering but the simulation is paused. */
  readonly pausesGame: boolean = true;
  readonly root: HTMLElement;
  readonly focus: FocusManager;
  protected readonly bag = new DisposeBag();
  private built = false;
  private lastFocused: HTMLElement | null = null;

  constructor() {
    this.root = document.createElement('section');
    this.root.className = 'tqc-screen';
    this.root.setAttribute('role', 'region');
    this.focus = new FocusManager(this.root);
  }

  /** Creates the DOM. Called once before the first mount. */
  protected abstract build(): void;

  mount(container: HTMLElement): void {
    if (!this.built) {
      this.build();
      this.built = true;
    }
    container.append(this.root);
    this.onEnter();
    this.root.setAttribute('aria-label', this.id);
    if (this.lastFocused && this.root.contains(this.lastFocused)) this.focus.focusElement(this.lastFocused);
    else this.focus.focusFirst();
  }

  unmount(): void {
    this.lastFocused = this.focus.current;
    this.onExit();
    this.root.remove();
  }

  /** Called when a screen above this one closes and focus returns here. */
  resume(): void {
    this.onResume();
    if (this.lastFocused && this.root.contains(this.lastFocused)) this.focus.focusElement(this.lastFocused);
    else this.focus.refresh();
  }

  dispose(): void {
    this.bag.dispose();
    this.root.remove();
  }

  /* ----- hooks ----- */
  protected onEnter(): void {}
  protected onExit(): void {}
  protected onResume(): void {}
  update(_dt: number): void {}

  onNavigate(direction: NavDirection): void {
    this.focus.move(direction);
  }

  onConfirm(): void {
    this.focus.activate();
  }

  /** Return true when handled; default asks the manager to pop. */
  onCancel(): boolean {
    return false;
  }

  onTabPrev(): void {}
  onTabNext(): void {}
}
