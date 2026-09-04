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
export type SwState = 'unsupported' | 'disabled' | 'registering' | 'installed' | 'update-ready' | 'failed' | 'fresh-bypass';

export class ServiceWorkerClient {
  private readonly bag = new DisposeBag();
  private registration: ServiceWorkerRegistration | null = null;
  state: SwState = 'disabled';
  /** Set only when the player accepted an update; a first install must never reload under them. */
  private updateAccepted = false;

  constructor(private readonly callbacks: SwCallbacks) {
    this.bag.listen(window, 'offline', () => callbacks.onOffline());
    this.bag.listen(window, 'online', () => callbacks.onOnline());
  }

  /** `?fresh=1`: unregister every worker and wipe caches, then continue without a worker this load. */
  static async bypassIfRequested(): Promise<boolean> {
    if (new URLSearchParams(window.location.search).get('fresh') !== '1') return false;
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (error) {
      console.warn('[tqc] fresh bypass failed', error);
    }
    return true;
  }

  async register(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      this.state = 'unsupported';
      return;
    }
    if (new URLSearchParams(window.location.search).get('fresh') === '1') {
      this.state = 'fresh-bypass';
      return;
    }
    this.state = 'registering';
    try {
      this.registration = await navigator.serviceWorker.register('./sw.js');
    } catch (error) {
      this.state = 'failed';
      console.warn('[tqc] service worker registration failed', error);
      return;
    }
    const registration = this.registration;
    this.state = 'installed';
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
    this.state = 'update-ready';
    this.callbacks.onUpdateReady(() => {
      this.updateAccepted = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  }

  dispose(): void {
    this.bag.dispose();
  }
}
