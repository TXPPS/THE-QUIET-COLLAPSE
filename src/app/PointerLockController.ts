import { DisposeBag } from '@/core/DisposeBag';

export interface PointerLockHost {
  canvas: () => HTMLElement | null;
  /** True while gameplay is running with no screen open and the keyboard/mouse family active. */
  wantsLock: () => boolean;
  /** Called when a held lock is released while gameplay is active (browsers swallow Escape). */
  onLockLost: () => void;
}

/** Requests, releases and tracks pointer lock on the game surface. */
export class PointerLockController {
  private readonly bag = new DisposeBag();
  private wasLocked = false;

  constructor(private readonly host: PointerLockHost) {
    this.bag.listen(document, 'pointerlockchange', () => this.onChange());
  }

  get isLocked(): boolean {
    const canvas = this.host.canvas();
    return canvas !== null && document.pointerLockElement === canvas;
  }

  request(): void {
    const canvas = this.host.canvas();
    if (!canvas || !this.host.wantsLock() || this.isLocked) return;
    try {
      const result = canvas.requestPointerLock() as unknown;
      if (result instanceof Promise) result.catch(() => undefined);
    } catch {
      // Pointer lock needs a user gesture; the HUD hint tells the player to click.
    }
  }

  release(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private onChange(): void {
    const locked = this.isLocked;
    if (this.wasLocked && !locked && this.host.wantsLock()) this.host.onLockLost();
    this.wasLocked = locked;
  }

  dispose(): void {
    this.bag.dispose();
  }
}
