import { el } from './dom';

export type ToastKind = 'info' | 'warning' | 'danger';

/** Non-blocking system notices (autosave, objective updates, update available, offline). */
export class Toasts {
  private readonly root: HTMLElement;

  constructor(layer: HTMLElement) {
    this.root = el('div', { class: 'tqc-toasts', attrs: { 'aria-live': 'polite', role: 'status' } });
    layer.append(this.root);
  }

  show(text: string, kind: ToastKind = 'info', seconds = 3): HTMLElement {
    const node = el('div', { class: `tqc-toast tqc-toast--${kind}`, text });
    this.root.append(node);
    if (seconds > 0) window.setTimeout(() => node.remove(), seconds * 1000);
    return node;
  }

  clear(): void {
    while (this.root.firstChild) this.root.firstChild.remove();
  }
}
