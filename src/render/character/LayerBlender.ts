import * as THREE from 'three';

interface Entry {
  action: THREE.AnimationAction;
  weight: number;
  target: number;
  rate: number;
  oneShot: boolean;
}

/**
 * Weight bookkeeping over one AnimationMixer. Every action has a target weight that the blender
 * approaches at its own rate; actions at zero are stopped so the mixer only evaluates what shows.
 * The mixer normalises weights per property, so overlapping layers blend without summing to one.
 */
export class LayerBlender {
  private readonly entries = new Map<string, Entry>();

  constructor(readonly mixer: THREE.AnimationMixer) {}

  register(id: string, clip: THREE.AnimationClip, options: { loop?: boolean; timeScale?: number } = {}): THREE.AnimationAction {
    const action = this.mixer.clipAction(clip);
    action.setLoop(options.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = options.loop === false;
    action.timeScale = options.timeScale ?? 1;
    action.enabled = true;
    action.setEffectiveWeight(0);
    this.entries.set(id, { action, weight: 0, target: 0, rate: 8, oneShot: options.loop === false });
    return action;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  action(id: string): THREE.AnimationAction | null {
    return this.entries.get(id)?.action ?? null;
  }

  /** Sets the target weight; `seconds` is the time to fade all the way. */
  set(id: string, target: number, seconds: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.target = target;
    entry.rate = 1 / Math.max(0.016, seconds);
  }

  /** Restarts a one-shot from its first frame at full weight. */
  fire(id: string, seconds: number, timeScale = 1): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.action.reset();
    entry.action.timeScale = timeScale;
    entry.action.play();
    this.set(id, 1, seconds);
  }

  weight(id: string): number {
    return this.entries.get(id)?.weight ?? 0;
  }

  /** True while a one-shot is still running (not yet clamped at its end). */
  playing(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    const { action } = entry;
    return action.isRunning() && action.time < action.getClip().duration / Math.max(1e-3, Math.abs(action.timeScale) || 1) * Math.abs(action.timeScale || 1) - 1e-3;
  }

  /** Remaining seconds of a one-shot at its current time scale. */
  remaining(id: string): number {
    const entry = this.entries.get(id);
    if (!entry) return 0;
    const { action } = entry;
    const scale = Math.max(1e-3, Math.abs(action.timeScale));
    return (action.getClip().duration - action.time) / scale;
  }

  /** Advances weights and the mixer. */
  update(dt: number): void {
    for (const entry of this.entries.values()) {
      if (entry.weight === entry.target) continue;
      const step = entry.rate * dt;
      entry.weight = entry.weight < entry.target ? Math.min(entry.target, entry.weight + step) : Math.max(entry.target, entry.weight - step);
      if (entry.weight > 0 && !entry.action.isRunning() && !entry.oneShot) entry.action.play();
      entry.action.setEffectiveWeight(entry.weight);
      if (entry.weight === 0 && entry.target === 0 && !entry.oneShot) entry.action.stop();
    }
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.entries.clear();
  }
}
