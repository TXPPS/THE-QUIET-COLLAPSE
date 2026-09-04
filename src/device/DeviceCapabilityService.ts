import { EventBus } from '@/core/EventBus';
import { DisposeBag } from '@/core/DisposeBag';

export type PresentationClass = 'desktop' | 'phone' | 'tablet_or_handheld' | 'unknown';
export type Orientation = 'landscape' | 'portrait';
export type QualityHint = 'low' | 'balanced' | 'high';

export interface DeviceSnapshot {
  width: number;
  height: number;
  aspect: number;
  orientation: Orientation;
  dpr: number;
  safeAreaSupported: boolean;
  maxTouchPoints: number;
  pointerFine: boolean;
  pointerCoarse: boolean;
  anyPointerFine: boolean;
  anyPointerCoarse: boolean;
  hoverCapable: boolean;
  anyHover: boolean;
  keyboardMouseSeen: boolean;
  touchSeen: boolean;
  gamepadCount: number;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  reducedMotionSystem: boolean;
  presentation: PresentationClass;
  qualityHint: QualityHint;
}

export interface DeviceEvents extends Record<string, unknown> {
  change: DeviceSnapshot;
}

const PHONE_MAX_SHORT_SIDE_CSS = 500;
const TABLET_MAX_SHORT_SIDE_CSS = 1100;
const LOW_MEMORY_GB = 3;
const LOW_CORES = 4;

function media(query: string): boolean {
  return typeof matchMedia === 'function' ? matchMedia(query).matches : false;
}

/**
 * Observes viewport, pointer capabilities and activity to recommend a presentation class and a
 * conservative quality hint. It is a layout recommendation only; nothing is locked out by it.
 */
export class DeviceCapabilityService {
  readonly events = new EventBus<DeviceEvents>();
  private snapshot: DeviceSnapshot;
  private keyboardMouseSeen = false;
  private touchSeen = false;
  private measuredFrameMs = 0;
  private readonly bag = new DisposeBag();

  constructor(private readonly root: HTMLElement = document.documentElement) {
    this.snapshot = this.compute();
    this.bag.listen(window, 'resize', () => this.refresh());
    this.bag.listen(window, 'orientationchange', () => this.refresh());
    this.bag.listen(window, 'keydown', () => this.markKeyboardMouse(), { passive: true });
    this.bag.listen(window, 'pointermove', (event) => this.markPointer(event), { passive: true });
    this.bag.listen(window, 'pointerdown', (event) => this.markPointer(event), { passive: true });
    this.bag.listen(window, 'gamepadconnected', () => this.refresh());
    this.bag.listen(window, 'gamepaddisconnected', () => this.refresh());
  }

  get(): DeviceSnapshot {
    return this.snapshot;
  }

  reportFrameTime(medianMs: number): void {
    this.measuredFrameMs = medianMs;
  }

  refresh(): void {
    this.snapshot = this.compute();
    this.events.emit('change', this.snapshot);
  }

  dispose(): void {
    this.bag.dispose();
  }

  private markKeyboardMouse(): void {
    if (this.keyboardMouseSeen) return;
    this.keyboardMouseSeen = true;
    this.refresh();
  }

  private markPointer(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      if (this.touchSeen) return;
      this.touchSeen = true;
      this.refresh();
      return;
    }
    if (event.pointerType === 'mouse') this.markKeyboardMouse();
  }

  private compute(): DeviceSnapshot {
    const width = window.innerWidth || this.root.clientWidth || 1;
    const height = window.innerHeight || this.root.clientHeight || 1;
    const maxTouchPoints = navigator.maxTouchPoints ?? 0;
    const navAny = navigator as Navigator & { deviceMemory?: number; getGamepads?: () => (Gamepad | null)[] };
    const gamepadCount = countGamepads(navAny);
    const base: Omit<DeviceSnapshot, 'presentation' | 'qualityHint'> = {
      width,
      height,
      aspect: width / height,
      orientation: width >= height ? 'landscape' : 'portrait',
      dpr: window.devicePixelRatio || 1,
      safeAreaSupported: typeof CSS !== 'undefined' && CSS.supports('top: env(safe-area-inset-top)'),
      maxTouchPoints,
      pointerFine: media('(pointer: fine)'),
      pointerCoarse: media('(pointer: coarse)'),
      anyPointerFine: media('(any-pointer: fine)'),
      anyPointerCoarse: media('(any-pointer: coarse)'),
      hoverCapable: media('(hover: hover)'),
      anyHover: media('(any-hover: hover)'),
      keyboardMouseSeen: this.keyboardMouseSeen,
      touchSeen: this.touchSeen,
      gamepadCount,
      deviceMemoryGb: typeof navAny.deviceMemory === 'number' ? navAny.deviceMemory : null,
      hardwareConcurrency: typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null,
      reducedMotionSystem: media('(prefers-reduced-motion: reduce)'),
    };
    return { ...base, presentation: classify(base), qualityHint: this.hintQuality(base) };
  }

  private hintQuality(snap: Omit<DeviceSnapshot, 'presentation' | 'qualityHint'>): QualityHint {
    const lowMemory = snap.deviceMemoryGb !== null && snap.deviceMemoryGb <= LOW_MEMORY_GB;
    const lowCores = snap.hardwareConcurrency !== null && snap.hardwareConcurrency <= LOW_CORES;
    const coarseOnly = snap.pointerCoarse && !snap.anyPointerFine;
    if (this.measuredFrameMs > 28) return 'low';
    if (lowMemory || (coarseOnly && lowCores)) return 'low';
    if (coarseOnly || lowCores || this.measuredFrameMs > 18) return 'balanced';
    return 'high';
  }
}

function countGamepads(nav: Navigator & { getGamepads?: () => (Gamepad | null)[] }): number {
  try {
    return nav.getGamepads ? nav.getGamepads().filter((pad) => pad !== null).length : 0;
  } catch {
    return 0;
  }
}

export function classify(snap: Omit<DeviceSnapshot, 'presentation' | 'qualityHint'>): PresentationClass {
  const shortSide = Math.min(snap.width, snap.height);
  const touchy = snap.maxTouchPoints > 0 || snap.anyPointerCoarse || snap.touchSeen;
  const fineOnly = snap.anyPointerFine && !snap.anyPointerCoarse && snap.maxTouchPoints === 0;
  if (fineOnly || (!touchy && snap.keyboardMouseSeen)) return 'desktop';
  if (touchy && shortSide <= PHONE_MAX_SHORT_SIDE_CSS) return 'phone';
  if (touchy && shortSide <= TABLET_MAX_SHORT_SIDE_CSS) return 'tablet_or_handheld';
  if (touchy) return snap.anyPointerFine ? 'desktop' : 'tablet_or_handheld';
  return 'unknown';
}
