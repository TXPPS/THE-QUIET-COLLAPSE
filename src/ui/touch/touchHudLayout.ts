import type { ControlRect, Viewport, ZoneRect } from './touchLayout';

/** Reads the safe-area insets applied through CSS variables on the root element. */
export function readViewport(root: HTMLElement): Viewport {
  const style = getComputedStyle(document.documentElement);
  const inset = (name: string) => parseFloat(style.getPropertyValue(name)) || 0;
  return {
    width: root.clientWidth || window.innerWidth,
    height: root.clientHeight || window.innerHeight,
    safe: { top: inset('--tqc-safe-top'), right: inset('--tqc-safe-right'), bottom: inset('--tqc-safe-bottom'), left: inset('--tqc-safe-left') },
  };
}

/** Positions a zone element from a pixel rectangle. */
export function placeZone(zone: HTMLElement, rect: ZoneRect): void {
  zone.style.left = `${rect.x0}px`;
  zone.style.top = `${rect.y0}px`;
  zone.style.width = `${Math.max(0, rect.x1 - rect.x0)}px`;
  zone.style.height = `${Math.max(0, rect.y1 - rect.y0)}px`;
}

/** Positions a circular control element from its rect and opacity. */
export function placeControl(element: HTMLElement, rect: ControlRect, opacity: number): void {
  element.style.left = `${rect.cx}px`;
  element.style.top = `${rect.cy}px`;
  element.style.width = `${rect.d}px`;
  element.style.height = `${rect.d}px`;
  element.style.opacity = String(opacity);
}

/** Tells the HUD how far the top-right button row reaches so the ammo readout sits under it. */
export function publishTopCluster(rects: Iterable<{ enabled: boolean; rect: ControlRect }>, viewport: Viewport): void {
  let bottom = viewport.safe.top;
  for (const entry of rects) {
    if (!entry.enabled || entry.rect.cy > viewport.height * 0.3) continue;
    bottom = Math.max(bottom, entry.rect.cy + entry.rect.r);
  }
  document.documentElement.style.setProperty('--tqc-touch-top-cluster', `${Math.round(bottom)}px`);
}
