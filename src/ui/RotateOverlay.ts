import { el, setHidden } from './dom';

/** Landscape-first gameplay: a quiet, full-screen rotate prompt for portrait phones. */
export class RotateOverlay {
  readonly root: HTMLElement;

  constructor(layer: HTMLElement) {
    this.root = el('div', { class: 'tqc-rotate', attrs: { role: 'status', 'aria-live': 'polite' } }, [
      el('div', {}, [
        el('div', { class: 'tqc-rotate__icon', attrs: { 'aria-hidden': 'true' } }),
        el('div', { class: 'tqc-eyebrow', text: 'Rotate your device' }),
        el('p', { class: 'tqc-body tqc-muted', text: 'The game plays in landscape. Menus work in any orientation.' }),
      ]),
    ]);
    this.root.hidden = true;
    layer.append(this.root);
  }

  setVisible(visible: boolean): void {
    setHidden(this.root, !visible);
  }
}
