import { DisposeBag } from '@/core/DisposeBag';
import type { FrameStats } from '@/core/GameLoop';
import { PROJECT_BUILD_STAMP } from '@/config/project';
import { el, setHidden, setText } from '@/ui/dom';

export interface DebugSnapshot {
  stats: FrameStats;
  bufferWidth: number;
  bufferHeight: number;
  cssWidth: number;
  cssHeight: number;
  renderScale: number;
  inputSource: string;
  swState: string;
  online: boolean;
  scene: string;
}

const THREE_FINGER_WINDOW_MS = 400;
const REFRESH_MS = 250;
const LINE_KEYS = ['build', 'fps', 'frame', 'res', 'input', 'sw', 'scene'] as const;

/**
 * Hidden QA overlay toggled with F9 or a three-finger tap. Costs nothing while hidden: the host
 * only calls `update` when `visible` is true and the DOM is untouched otherwise.
 */
export class DebugOverlay {
  readonly root: HTMLElement;
  visible = false;
  private readonly bag = new DisposeBag();
  private readonly lines = new Map<string, HTMLElement>();
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
    layer.append(this.root);
    this.bag.listen(window, 'keydown', (event) => {
      if (event.code !== 'F9') return;
      event.preventDefault();
      this.toggle();
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

  update(now: number, snapshot: DebugSnapshot): void {
    if (!this.visible || now - this.lastRender < REFRESH_MS) return;
    this.lastRender = now;
    const { stats } = snapshot;
    setText(this.line('fps'), `fps ${stats.fps.toFixed(0)} (median)`);
    setText(this.line('frame'), `frame ${stats.medianMs.toFixed(1)} ms median / ${stats.worstMs.toFixed(1)} ms worst`);
    setText(this.line('res'), `buffer ${snapshot.bufferWidth}x${snapshot.bufferHeight} / css ${snapshot.cssWidth}x${snapshot.cssHeight} / scale ${snapshot.renderScale.toFixed(2)}`);
    setText(this.line('input'), `input ${snapshot.inputSource}`);
    setText(this.line('sw'), `sw ${snapshot.swState} / ${snapshot.online ? 'online' : 'offline'}`);
    setText(this.line('scene'), `scene ${snapshot.scene}`);
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
    this.bag.dispose();
    this.root.remove();
  }
}
