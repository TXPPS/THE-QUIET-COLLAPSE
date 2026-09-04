import { clamp } from '@/core/math';
import type { Action } from '@/input/actions';
import type { DisposeBag } from '@/core/DisposeBag';
import type { FocusManager } from './FocusManager';
import type { Prompts } from './Prompts';
import { el, setText, capturePointer } from './dom';

export interface MenuItemOptions {
  label: string;
  hint?: string;
  value?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export function menuItem(options: MenuItemOptions): HTMLButtonElement {
  const button = el('button', {
    class: `tqc-item${options.danger ? ' tqc-item--danger' : ''}`,
    attrs: { type: 'button', 'data-focusable': '', tabindex: '-1' },
  });
  const labelWrap = el('span', { class: 'tqc-item__label' }, [el('span', { text: options.label })]);
  if (options.hint) labelWrap.append(el('span', { class: 'tqc-item__hint', text: options.hint }));
  button.append(labelWrap);
  if (options.value !== undefined) button.append(el('span', { class: 'tqc-item__value', text: options.value }));
  if (options.disabled) button.setAttribute('aria-disabled', 'true');
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-disabled') === 'true') return;
    options.onSelect();
  });
  return button;
}

export function setItemValue(item: HTMLElement, value: string): void {
  const node = item.querySelector<HTMLElement>('.tqc-item__value');
  if (node) setText(node, value);
}

export interface AdjustableOptions<T> {
  label: string;
  hint?: string;
  get: () => T;
  set: (value: T) => void;
  format: (value: T) => string;
}

export interface SliderOptions extends AdjustableOptions<number> {
  min: number;
  max: number;
  step: number;
}

/** A menu row with a horizontal slider; left/right (or drag) adjusts, confirm nudges up. */
export function sliderItem(focus: FocusManager, bag: DisposeBag, options: SliderOptions): HTMLElement {
  const fill = el('span', { class: 'tqc-slider__fill' });
  const track = el('span', { class: 'tqc-slider', attrs: { role: 'presentation' } }, [fill]);
  const valueText = el('span', { class: 'tqc-item__value', text: options.format(options.get()) });
  const row = menuItem({ label: options.label, hint: options.hint, onSelect: () => apply(options.get() + options.step) });
  row.setAttribute('role', 'slider');
  row.setAttribute('aria-valuemin', String(options.min));
  row.setAttribute('aria-valuemax', String(options.max));
  row.append(el('span', { class: 'tqc-chip-row' }, [track, valueText]));
  const render = () => {
    const value = options.get();
    const ratio = (value - options.min) / (options.max - options.min);
    fill.style.width = `${Math.round(clamp(ratio, 0, 1) * 100)}%`;
    setText(valueText, options.format(value));
    row.setAttribute('aria-valuenow', String(value));
    row.setAttribute('aria-valuetext', options.format(value));
  };
  const apply = (raw: number) => {
    const stepped = Math.round(raw / options.step) * options.step;
    const next = clamp(Number(stepped.toFixed(4)), options.min, options.max);
    if (next !== options.get()) options.set(next);
    render();
  };
  focus.registerAdjust(row, (delta) => apply(options.get() + delta * options.step));
  const onPointer = (event: PointerEvent) => {
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    apply(options.min + ratio * (options.max - options.min));
  };
  bag.listen(track, 'pointerdown', (event) => {
    event.stopPropagation();
    capturePointer(track, event.pointerId);
    onPointer(event);
  });
  bag.listen(track, 'pointermove', (event) => {
    if (track.hasPointerCapture(event.pointerId)) onPointer(event);
  });
  bag.listen(track, 'click', (event) => event.stopPropagation());
  render();
  return row;
}

export interface SelectOptions<T extends string> extends AdjustableOptions<T> {
  values: readonly T[];
}

/** A menu row cycling through discrete values with left/right/confirm. */
export function selectItem<T extends string>(focus: FocusManager, options: SelectOptions<T>): HTMLElement {
  const row = menuItem({ label: options.label, hint: options.hint, value: options.format(options.get()), onSelect: () => step(1) });
  const step = (delta: number) => {
    const index = options.values.indexOf(options.get());
    const next = options.values[(index + delta + options.values.length) % options.values.length];
    if (next !== undefined) options.set(next);
    setItemValue(row, options.format(options.get()));
  };
  focus.registerAdjust(row, step);
  return row;
}

export function toggleItem(focus: FocusManager, options: Omit<AdjustableOptions<boolean>, 'format'>): HTMLElement {
  const format = (value: boolean) => (value ? 'On' : 'Off');
  const row = menuItem({ label: options.label, hint: options.hint, value: format(options.get()), onSelect: () => flip() });
  row.setAttribute('role', 'switch');
  const flip = () => {
    options.set(!options.get());
    row.setAttribute('aria-checked', String(options.get()));
    setItemValue(row, format(options.get()));
  };
  row.setAttribute('aria-checked', String(options.get()));
  focus.registerAdjust(row, () => flip());
  return row;
}

export function heading(title: string, eyebrow?: string, small = false): HTMLElement {
  return el('header', {}, [
    eyebrow ? el('div', { class: 'tqc-eyebrow', text: eyebrow }) : null,
    el('h1', { class: `tqc-title${small ? ' tqc-title--small' : ''}`, text: title }),
  ]);
}

export function footer(prompts: Prompts, bag: DisposeBag, hints: Array<[Action, string]>, meta?: string): HTMLElement {
  const hintRow = el('div', { class: 'tqc-footer__hints' });
  for (const [action, label] of hints) {
    const [node, release] = prompts.hint(action, label);
    bag.add(release);
    hintRow.append(node);
  }
  return el('footer', { class: 'tqc-footer' }, [hintRow, meta ? el('div', { class: 'tqc-footer__meta', text: meta }) : null]);
}

export function menuList(items: HTMLElement[], wide = false): HTMLElement {
  return el('nav', { class: `tqc-menu${wide ? ' tqc-menu--wide' : ''}`, attrs: { role: 'menu' } }, items);
}
