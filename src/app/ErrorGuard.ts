import { DisposeBag } from '@/core/DisposeBag';

const ERROR_BURST_WINDOW_MS = 10_000;
const ERROR_BURST_COUNT = 3;

/**
 * Logs uncaught errors and unhandled rejections; a burst of them means the run is broken, so the
 * host is asked to surface a recoverable error screen instead of limping on.
 */
export class ErrorGuard {
  private readonly bag = new DisposeBag();
  private timestamps: number[] = [];
  private tripped = false;

  constructor(private readonly onBurst: (reason: unknown) => void) {
    this.bag.listen(window, 'error', (event) => this.record(event.error ?? event.message));
    this.bag.listen(window, 'unhandledrejection', (event) => this.record(event.reason));
  }

  private record(reason: unknown): void {
    if (this.tripped) return;
    console.error('[tqc] uncaught', reason);
    const now = performance.now();
    this.timestamps = this.timestamps.filter((t) => now - t < ERROR_BURST_WINDOW_MS);
    this.timestamps.push(now);
    if (this.timestamps.length >= ERROR_BURST_COUNT) {
      this.tripped = true;
      this.onBurst(reason);
    }
  }

  dispose(): void {
    this.bag.dispose();
  }
}
