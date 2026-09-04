import type { AudioEngine } from '@/audio/AudioEngine';
import type { SampleBank } from '@/audio/SampleBank';
import { SFX } from '@/audio/synth';
import type { Toasts } from '@/ui/Toasts';

export type UiFeedback = 'move' | 'confirm' | 'cancel';

/** UI sound cues and system notices (update available, connectivity) shared by the shell. */
export class ShellNotices {
  /** Recorded UI cues once decoded; synthesised until then. */
  samples: SampleBank | null = null;

  constructor(
    private readonly audio: AudioEngine,
    private readonly toasts: Toasts,
  ) {}

  playUi(kind: UiFeedback): void {
    const ctx = this.audio.ctx;
    const bus = this.audio.bus('ui');
    if (!ctx || !bus || !this.audio.isReady) return;
    const buffer = this.samples?.pick(`ui-${kind}`) ?? null;
    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(bus);
      source.start();
      return;
    }
    const voice = kind === 'move' ? SFX.uiMove(ctx) : kind === 'confirm' ? SFX.uiConfirm(ctx) : SFX.uiCancel(ctx);
    voice.output.connect(bus);
  }

  offerUpdate(apply: () => void): void {
    const toast = this.toasts.show('Update available — tap to reload', 'info', 0);
    toast.setAttribute('role', 'button');
    toast.tabIndex = 0;
    toast.addEventListener('click', apply);
  }

  offline(): void {
    this.toasts.show('Offline — saved games and settings stay on this device', 'warning', 4);
  }

  online(): void {
    this.toasts.show('Back online', 'info', 2);
  }
}
