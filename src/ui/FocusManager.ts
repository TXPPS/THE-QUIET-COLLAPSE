import type { NavDirection } from '@/input/MenuNavigator';

export const FOCUSABLE_SELECTOR = '[data-focusable]:not([hidden]):not([aria-disabled="true"])';

/**
 * Keyboard/controller focus for a screen. Elements opt in with `data-focusable`. Focus is
 * visible (class `is-focused` + native focus), scrolled into view, and trapped inside `root`.
 * Horizontal navigation is delegated to the focused element through `data-adjust` handlers.
 */
export class FocusManager {
  private index = -1;
  private readonly onAdjust = new Map<HTMLElement, (delta: number) => void>();

  constructor(private readonly root: HTMLElement) {}

  items(): HTMLElement[] {
    return Array.from(this.root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible);
  }

  get current(): HTMLElement | null {
    const items = this.items();
    return items[this.index] ?? null;
  }

  registerAdjust(element: HTMLElement, handler: (delta: number) => void): void {
    this.onAdjust.set(element, handler);
  }

  focusFirst(): void {
    this.focusIndex(0);
  }

  focusElement(element: HTMLElement | null): void {
    if (!element) return;
    const items = this.items();
    const index = items.indexOf(element);
    if (index >= 0) this.focusIndex(index);
  }

  /** Re-applies focus to the current index after content changes; clamps when items were removed. */
  refresh(): void {
    const items = this.items();
    if (items.length === 0) {
      this.index = -1;
      return;
    }
    this.focusIndex(Math.min(Math.max(this.index, 0), items.length - 1));
  }

  move(direction: NavDirection): boolean {
    const items = this.items();
    if (items.length === 0) return false;
    if (direction === 'left' || direction === 'right') {
      const current = items[this.index];
      const adjust = current ? this.onAdjust.get(current) : undefined;
      if (adjust) {
        adjust(direction === 'right' ? 1 : -1);
        return true;
      }
      if (!this.root.dataset['gridNav']) return false;
    }
    const step = direction === 'down' || direction === 'right' ? 1 : -1;
    const next = this.index < 0 ? (step > 0 ? 0 : items.length - 1) : (this.index + step + items.length) % items.length;
    this.focusIndex(next);
    return true;
  }

  activate(): boolean {
    const current = this.current;
    if (!current) return false;
    current.classList.add('is-pressed');
    window.setTimeout(() => current.classList.remove('is-pressed'), 90);
    current.click();
    return true;
  }

  blur(): void {
    for (const item of this.items()) item.classList.remove('is-focused');
    this.index = -1;
  }

  private focusIndex(index: number): void {
    const items = this.items();
    const target = items[index];
    if (!target) return;
    for (const item of items) if (item !== target) item.classList.remove('is-focused');
    this.index = index;
    target.classList.add('is-focused');
    try {
      target.focus({ preventScroll: true });
    } catch {
      // Elements without tabindex cannot take DOM focus; the visual class still applies.
    }
    if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function isVisible(element: HTMLElement): boolean {
  if (element.hidden || element.closest('[hidden]')) return false;
  if (element.getClientRects().length > 0 || element.offsetParent !== null) return true;
  // No layout information (detached, or a DOM without layout): fall back to computed style.
  return element.isConnected && getComputedStyle(element).display !== 'none';
}
