type Disposer = () => void;

/**
 * Collects teardown callbacks so every listener, timer and observer created by a system is
 * released exactly once when the system despawns. Prevents leaked listeners across
 * new/load/death/menu transitions.
 */
export class DisposeBag {
  private disposers: Disposer[] = [];
  private disposed = false;

  add(disposer: Disposer): void {
    if (this.disposed) {
      disposer();
      return;
    }
    this.disposers.push(disposer);
  }

  listen<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    handler: (event: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    handler: (event: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions): void;
  listen(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions): void {
    target.addEventListener(type, handler, options);
    this.add(() => target.removeEventListener(type, handler, options));
  }

  timeout(callback: () => void, ms: number): void {
    const id = window.setTimeout(callback, ms);
    this.add(() => window.clearTimeout(id));
  }

  interval(callback: () => void, ms: number): void {
    const id = window.setInterval(callback, ms);
    this.add(() => window.clearInterval(id));
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const list = this.disposers;
    this.disposers = [];
    for (let i = list.length - 1; i >= 0; i -= 1) list[i]?.();
  }
}
