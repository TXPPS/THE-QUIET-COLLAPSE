import { DisposeBag } from '@/core/DisposeBag';
import type { AudioSettings } from '@/persistence/settingsSchema';

export type Bus = 'ambience' | 'sfx' | 'ui';

/**
 * WebAudio mixer: master → {ambience, sfx, ui}. The context is created lazily and resumed on the
 * first user gesture (mobile autoplay policy); focus loss suspends it when the setting asks.
 * All sounds are synthesised — there are no audio files, so nothing can fail to load.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buses = new Map<Bus, GainNode>();
  private readonly bag = new DisposeBag();
  private settings: AudioSettings;
  private duck = 1;
  private unlocked = false;
  private readonly unlockListeners: Array<(ctx: AudioContext) => void> = [];
  readonly listener = { x: 0, y: 1.5, z: 0, fx: 0, fz: 1 };

  constructor(settings: AudioSettings) {
    this.settings = settings;
    const unlock = () => void this.unlock();
    this.bag.listen(window, 'pointerdown', unlock, { passive: true });
    this.bag.listen(window, 'keydown', unlock, { passive: true });
    this.bag.listen(window, 'touchstart', unlock, { passive: true });
    this.bag.listen(document, 'visibilitychange', () => this.onVisibility());
    this.bag.listen(window, 'blur', () => this.onVisibility());
    this.bag.listen(window, 'focus', () => this.onVisibility());
  }

  get isReady(): boolean {
    return this.context !== null && this.context.state === 'running';
  }

  get ctx(): AudioContext | null {
    return this.context;
  }

  bus(name: Bus): GainNode | null {
    return this.buses.get(name) ?? null;
  }

  /** Creates or resumes the context; safe to call repeatedly. */
  async unlock(): Promise<void> {
    if (!this.context) {
      const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.context = new Ctor({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      for (const name of ['ambience', 'sfx', 'ui'] as const) {
        const gain = this.context.createGain();
        gain.connect(this.master);
        this.buses.set(name, gain);
      }
      this.applySettings(this.settings);
    }
    if (this.context.state !== 'running') {
      try {
        await this.context.resume();
      } catch {
        return;
      }
    }
    if (!this.unlocked) {
      this.unlocked = true;
      for (const listener of this.unlockListeners) listener(this.context);
    }
  }

  /** Runs once the context is running (immediately when it already is): sample decoding hooks here. */
  onUnlocked(listener: (ctx: AudioContext) => void): void {
    if (this.unlocked && this.context) listener(this.context);
    else this.unlockListeners.push(listener);
  }

  applySettings(settings: AudioSettings): void {
    this.settings = settings;
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.master * this.duck, t, 0.05);
    this.buses.get('ambience')?.gain.setTargetAtTime(settings.ambience, t, 0.05);
    this.buses.get('sfx')?.gain.setTargetAtTime(settings.sfx, t, 0.05);
    this.buses.get('ui')?.gain.setTargetAtTime(settings.ui, t, 0.05);
  }

  /** Ducks the master bus (pause menus, documents) without touching user volumes. */
  setDuck(amount: number): void {
    this.duck = amount;
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.settings.master * amount, this.context.currentTime, 0.12);
  }

  private onVisibility(): void {
    if (!this.context || !this.unlocked) return;
    const hidden = document.hidden || !document.hasFocus();
    if (hidden && this.settings.muteOnFocusLoss) void this.context.suspend().catch(() => undefined);
    else if (!hidden && this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
  }

  dispose(): void {
    this.bag.dispose();
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }
}
