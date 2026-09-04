import { clamp } from './math';

export interface FrameStats {
  /** Median frame time (ms) over the sampling window. */
  medianMs: number;
  /** Worst frame time (ms) over the sampling window. */
  worstMs: number;
  /** Frames per second derived from the median frame time. */
  fps: number;
  /** Samples gathered so far in the current window. */
  samples: number;
}

export interface LoopCallbacks {
  /** Called once per animation frame before any fixed step (input sampling). */
  beginFrame: (dtSeconds: number) => void;
  /** Called at a fixed rate; may run several times per animation frame. */
  fixedUpdate: (dtSeconds: number) => void;
  /** Called once per animation frame with the variable delta (clamped). */
  update: (dtSeconds: number, alpha: number) => void;
  render: () => void;
}

const FIXED_STEP = 1 / 60;
const MAX_FRAME_DT = 0.1;
const MAX_FIXED_STEPS_PER_FRAME = 4;
const STATS_WINDOW = 120;

/**
 * Single requestAnimationFrame loop with a fixed simulation step and variable render.
 * Only one loop may exist; starting twice is a no-op so duplicate animation loops cannot occur.
 */
export class GameLoop {
  private rafId = 0;
  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private readonly samples = new Float32Array(STATS_WINDOW);
  private sampleIndex = 0;
  private sampleCount = 0;
  private readonly sorted: number[] = [];

  constructor(private readonly callbacks: LoopCallbacks) {}

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  /** Reset timing after a suspension so a long tab hide does not produce a giant step. */
  resetClock(): void {
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  resetStats(): void {
    this.sampleIndex = 0;
    this.sampleCount = 0;
  }

  getStats(): FrameStats {
    const count = this.sampleCount;
    if (count === 0) return { medianMs: 0, worstMs: 0, fps: 0, samples: 0 };
    this.sorted.length = 0;
    let worst = 0;
    for (let i = 0; i < count; i += 1) {
      const value = this.samples[i] ?? 0;
      this.sorted.push(value);
      if (value > worst) worst = value;
    }
    this.sorted.sort((a, b) => a - b);
    const median = this.sorted[Math.floor(count / 2)] ?? 0;
    return { medianMs: median, worstMs: worst, fps: median > 0 ? 1000 / median : 0, samples: count };
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.recordSample(rawDt * 1000);
    const dt = clamp(rawDt, 0, MAX_FRAME_DT);
    this.callbacks.beginFrame(dt);
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < MAX_FIXED_STEPS_PER_FRAME) {
      this.callbacks.fixedUpdate(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (steps === MAX_FIXED_STEPS_PER_FRAME) this.accumulator = 0;
    this.callbacks.update(dt, this.accumulator / FIXED_STEP);
    this.callbacks.render();
  };

  private recordSample(ms: number): void {
    this.samples[this.sampleIndex] = ms;
    this.sampleIndex = (this.sampleIndex + 1) % STATS_WINDOW;
    if (this.sampleCount < STATS_WINDOW) this.sampleCount += 1;
  }
}

export { FIXED_STEP };
