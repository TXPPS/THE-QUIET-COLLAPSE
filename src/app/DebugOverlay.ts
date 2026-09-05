import { DisposeBag } from '@/core/DisposeBag';
import type { FrameStats } from '@/core/GameLoop';
import { PROJECT_BUILD_STAMP } from '@/config/project';
import type { HeldItemId, ItemSocketDef } from '@/game/items/registry';
import { el, setHidden, setText, toggleClass } from '@/ui/dom';
import { SocketTuner } from './SocketTuner';

export interface DebugSnapshot {
  stats: FrameStats;
  bufferWidth: number;
  bufferHeight: number;
  cssWidth: number;
  cssHeight: number;
  renderScale: number;
  inputSource: string;
  /** Touch pointers currently owned, e.g. "1:joystick 2:look". */
  touchPointers: string;
  swState: string;
  online: boolean;
  scene: string;
  nav: string;
  /** Difficulty preset with the resolved enemy numbers. */
  difficulty: string;
}

const THREE_FINGER_WINDOW_MS = 400;
const REFRESH_MS = 250;
const LINE_KEYS = ['build', 'fps', 'frame', 'res', 'input', 'touch', 'sw', 'scene', 'nav', 'difficulty'] as const;

/**
 * Hidden QA overlay toggled with F9 or a three-finger tap. Costs nothing while hidden: the host
 * only calls `update` when `visible` is true and the DOM is untouched otherwise. F10 (or the
 * button) toggles the spawn-ray debug draw that shows where props and pickups were grounded. The
 * socket tuner re-seats the held items live; its JSON is copied by hand into the item registry.
 */
export class DebugOverlay {
  readonly root: HTMLElement;
  visible = false;
  spawnRays = false;
  onSpawnRays: ((visible: boolean) => void) | null = null;
  onSocket: ((item: HeldItemId, socket: ItemSocketDef) => void) | null = null;
  readonly tuner: SocketTuner;
  private readonly bag = new DisposeBag();
  private readonly lines = new Map<string, HTMLElement>();
  private readonly raysButton: HTMLButtonElement;
  private lastRender = 0;
  private readonly activeTouches = new Set<number>();
  private threeFingerAt = 0;

  constructor(
    layer: HTMLElement,
    private readonly onToggle: (visible: boolean) => void,
  ) {
    this.root = el('div', { class: 'tqc-debug', attrs: { role: 'status', 'aria-live': 'off' } });
    this.root.hidden = true;
    for (const key of LINE_KEYS) {
      const line = el('div', { class: 'tqc-debug__line' });
      this.lines.set(key, line);
      this.root.append(line);
    }
    this.line('build').textContent = PROJECT_BUILD_STAMP;
    this.raysButton = el('button', { class: 'tqc-debug__toggle', text: 'spawn rays: off', attrs: { type: 'button', 'aria-pressed': 'false' } });
    this.root.append(this.raysButton);
    this.tuner = new SocketTuner(this.root);
    this.tuner.onChange = (item, socket) => this.onSocket?.(item, socket);
    layer.append(this.root);
    this.bag.listen(this.raysButton, 'click', () => this.toggleSpawnRays());
    this.bag.listen(window, 'keydown', (event) => {
      if (event.code === 'F9') {
        event.preventDefault();
        this.toggle();
      } else if (event.code === 'F10') {
        event.preventDefault();
        this.toggleSpawnRays();
      }
    });
    this.bag.listen(window, 'pointerdown', (event) => this.onPointerDown(event), { passive: true });
    this.bag.listen(window, 'pointerup', (event) => this.activeTouches.delete(event.pointerId), { passive: true });
    this.bag.listen(window, 'pointercancel', (event) => this.activeTouches.delete(event.pointerId), { passive: true });
  }

  toggle(): void {
    this.visible = !this.visible;
    setHidden(this.root, !this.visible);
    this.onToggle(this.visible);
  }

  toggleSpawnRays(): void {
    this.spawnRays = !this.spawnRays;
    setText(this.raysButton, `spawn rays: ${this.spawnRays ? 'on' : 'off'}`);
    this.raysButton.setAttribute('aria-pressed', String(this.spawnRays));
    toggleClass(this.raysButton, 'is-on', this.spawnRays);
    this.onSpawnRays?.(this.spawnRays);
  }

  update(now: number, snapshot: DebugSnapshot): void {
    if (!this.visible || now - this.lastRender < REFRESH_MS) return;
    this.lastRender = now;
    const { stats } = snapshot;
    setText(this.line('fps'), `fps ${stats.fps.toFixed(0)} (median)`);
    setText(this.line('frame'), `frame ${stats.medianMs.toFixed(1)} ms median / ${stats.worstMs.toFixed(1)} ms worst`);
    setText(this.line('res'), `buffer ${snapshot.bufferWidth}x${snapshot.bufferHeight} / css ${snapshot.cssWidth}x${snapshot.cssHeight} / scale ${snapshot.renderScale.toFixed(2)}`);
    setText(this.line('input'), `input ${snapshot.inputSource}`);
    setText(this.line('touch'), `touch ${snapshot.touchPointers || '-'}`);
    setText(this.line('sw'), `sw ${snapshot.swState} / ${snapshot.online ? 'online' : 'offline'}`);
    setText(this.line('scene'), `scene ${snapshot.scene}`);
    setText(this.line('nav'), `nav ${snapshot.nav}`);
    setText(this.line('difficulty'), `difficulty ${snapshot.difficulty}`);
  }

  private line(key: string): HTMLElement {
    return this.lines.get(key) as HTMLElement;
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch') return;
    this.activeTouches.add(event.pointerId);
    if (this.activeTouches.size >= 3 && performance.now() - this.threeFingerAt > THREE_FINGER_WINDOW_MS) {
      this.threeFingerAt = performance.now();
      this.toggle();
    }
  }

  dispose(): void {
    this.tuner.dispose();
    this.bag.dispose();
    this.root.remove();
  }
}
