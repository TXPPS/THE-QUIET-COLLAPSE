import { el } from '@/ui/dom';

export interface Layers {
  hud: HTMLElement;
  touch: HTMLElement;
  screens: HTMLElement;
  modal: HTMLElement;
  toast: HTMLElement;
  system: HTMLElement;
}

/** Stacked DOM layers above the WebGL canvas, ordered by the z-index tokens in tokens.css. */
export function createLayers(root: HTMLElement): Layers {
  const layers: Layers = {
    hud: el('div', { class: 'tqc-layer tqc-layer--hud' }),
    touch: el('div', { class: 'tqc-layer tqc-layer--touch' }),
    screens: el('div', { class: 'tqc-layer tqc-layer--screens' }),
    modal: el('div', { class: 'tqc-layer tqc-layer--modal' }),
    toast: el('div', { class: 'tqc-layer tqc-layer--toast' }),
    system: el('div', { class: 'tqc-layer tqc-layer--system' }),
  };
  root.append(layers.hud, layers.touch, layers.screens, layers.modal, layers.toast, layers.system);
  return layers;
}
