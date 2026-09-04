export const TAU = Math.PI * 2;
export const DEG_TO_RAD = Math.PI / 180;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential smoothing. `rate` is the fraction converged per second-ish. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

export function wrapAngle(angle: number): number {
  let a = angle % TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}

export function dampAngle(current: number, target: number, rate: number, dt: number): number {
  return current + wrapAngle(target - current) * (1 - Math.exp(-rate * dt));
}

export function length2(x: number, z: number): number {
  return Math.sqrt(x * x + z * z);
}

export function distance2(ax: number, az: number, bx: number, bz: number): number {
  return length2(bx - ax, bz - az);
}

export function approxEqual(a: number, b: number, epsilon = 1e-6): boolean {
  return Math.abs(a - b) <= epsilon;
}

/** Deterministic pseudo random generator (mulberry32) for reproducible placeholder variation. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
