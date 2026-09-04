import { DisposeBag } from '@/core/DisposeBag';

export interface SwCallbacks {
  onUpdateReady: (apply: () => void) => void;
  onOffline: () => void;
  onOnline: () => void;
}

/**
 * Registers the precaching service worker in production, surfaces "update available" with a
 * one-tap apply, and reports connectivity changes. Registration failure is non-fatal.
 */
export class ServiceWorkerClient {
  private readonly bag = new DisposeBag();
  private registration: ServiceWorkerRegistration | null = null;
  /** Set only when the player accepted an update; a first install must never reload under them. */
  private updateAccepted = false;

  constructor(private readonly callbacks: SwCallbacks) {
    this.bag.listen(window, 'offline', () => callbacks.onOffline());
    this.bag.listen(window, 'online', () => callbacks.onOnline());
  }

  async register(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;
    try {
      this.registration = await navigator.serviceWorker.register('./sw.js');
    } catch (error) {
      console.warn('[tqc] service worker registration failed', error);
      return;
    }
    const registration = this.registration;
    if (registration.waiting) this.announce(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) this.announce(installing);
      });
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !this.updateAccepted) return;
      reloading = true;
      window.location.reload();
    });
  }

  private announce(worker: ServiceWorker): void {
    this.callbacks.onUpdateReady(() => {
      this.updateAccepted = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  }

  dispose(): void {
    this.bag.dispose();
  }
}
