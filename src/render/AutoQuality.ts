import type { FrameStats } from '@/core/GameLoop';

const SAMPLE_INTERVAL = 2.5;
const DOWN_THRESHOLD_MS = 30;
const UP_THRESHOLD_MS = 13;
const STEP = 0.1;
const MIN_SCALE = 0.6;
const MAX_SCALE = 1;
const UP_PATIENCE = 4;

/**
 * Honest adaptive resolution: when the measured median frame time stays high, the render scale
 * steps down; when it stays comfortably low, it steps back up. Only the drawing-buffer scale
 * changes, never input latency, UI resolution or readability.
 */
export class AutoQuality {
  scale = MAX_SCALE;
  private timer = 0;
  private calmSamples = 0;

  reset(): void {
    this.scale = MAX_SCALE;
    this.timer = 0;
    this.calmSamples = 0;
  }

  /** Returns true when the scale changed. */
  update(dt: number, stats: FrameStats): boolean {
    this.timer += dt;
    if (this.timer < SAMPLE_INTERVAL || stats.samples < 60) return false;
    this.timer = 0;
    if (stats.medianMs > DOWN_THRESHOLD_MS && this.scale > MIN_SCALE) {
      this.scale = Math.max(MIN_SCALE, Number((this.scale - STEP).toFixed(2)));
      this.calmSamples = 0;
      return true;
    }
    if (stats.medianMs < UP_THRESHOLD_MS && this.scale < MAX_SCALE) {
      this.calmSamples += 1;
      if (this.calmSamples >= UP_PATIENCE) {
        this.calmSamples = 0;
        this.scale = Math.min(MAX_SCALE, Number((this.scale + STEP).toFixed(2)));
        return true;
      }
    } else {
      this.calmSamples = 0;
    }
    return false;
  }
}
