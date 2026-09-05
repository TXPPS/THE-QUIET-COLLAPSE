import { DisposeBag } from '@/core/DisposeBag';
import { HELD_ITEM_SOCKETS, type HeldItemId, type ItemSocketDef } from '@/game/items/registry';
import { el, setText } from '@/ui/dom';

const ITEMS: readonly HeldItemId[] = ['pistol', 'medkit', 'flashlight'];
const POSITION_RANGE_M = 0.2;
const POSITION_STEP_M = 0.001;
const ROTATION_STEP_DEG = 0.5;
const DEG = 180 / Math.PI;

type Axis = 0 | 1 | 2;
const AXES: readonly Axis[] = [0, 1, 2];
const AXIS_NAMES = ['x', 'y', 'z'] as const;

/**
 * QA overlay panel: sliders for a held item's socket (position in metres, rotation in degrees) and a
 * copy-JSON button. Values apply live to the current run's player rig and are never persisted; the
 * copied JSON is meant to be pasted into `src/game/items/registry.ts` and committed.
 */
export class SocketTuner {
  readonly root: HTMLElement;
  onChange: ((item: HeldItemId, socket: ItemSocketDef) => void) | null = null;
  private readonly bag = new DisposeBag();
  private readonly readout: HTMLElement;
  private readonly status: HTMLElement;
  private readonly sliders = new Map<string, HTMLInputElement>();
  private item: HeldItemId = 'pistol';
  private readonly drafts: Record<HeldItemId, { position: [number, number, number]; rotation: [number, number, number] }> = {
    pistol: draftFrom(HELD_ITEM_SOCKETS.pistol),
    medkit: draftFrom(HELD_ITEM_SOCKETS.medkit),
    flashlight: draftFrom(HELD_ITEM_SOCKETS.flashlight),
  };

  constructor(parent: HTMLElement) {
    const select = el('select', { class: 'tqc-debug__select', attrs: { 'aria-label': 'Held item' } }) as HTMLSelectElement;
    for (const id of ITEMS) select.append(el('option', { text: id, attrs: { value: id } }));
    this.readout = el('pre', { class: 'tqc-debug__json', attrs: { 'aria-live': 'off' } });
    this.status = el('span', { class: 'tqc-debug__status' });
    const copy = el('button', { class: 'tqc-debug__toggle', text: 'copy JSON', attrs: { type: 'button' } });
    const reset = el('button', { class: 'tqc-debug__toggle', text: 'reset', attrs: { type: 'button' } });
    const rows = el('div', { class: 'tqc-debug__rows' });
    for (const axis of AXES) rows.append(this.slider(`pos${axis}`, `pos ${AXIS_NAMES[axis]} (m)`, -POSITION_RANGE_M, POSITION_RANGE_M, POSITION_STEP_M));
    for (const axis of AXES) rows.append(this.slider(`rot${axis}`, `rot ${AXIS_NAMES[axis]} (°)`, -180, 180, ROTATION_STEP_DEG));
    this.root = el('div', { class: 'tqc-debug__tuner' }, [el('div', { class: 'tqc-debug__line', text: 'socket tuner' }), select, rows, el('div', { class: 'tqc-debug__actions' }, [copy, reset, this.status]), this.readout]);
    parent.append(this.root);
    this.bag.listen(select, 'change', () => {
      this.item = select.value as HeldItemId;
      this.syncSliders();
    });
    this.bag.listen(copy, 'click', () => void this.copy());
    this.bag.listen(reset, 'click', () => {
      this.drafts[this.item] = draftFrom(HELD_ITEM_SOCKETS[this.item]);
      this.syncSliders();
      this.emit();
    });
    this.syncSliders();
  }

  private slider(key: string, label: string, min: number, max: number, step: number): HTMLElement {
    const input = el('input', { attrs: { type: 'range', min: String(min), max: String(max), step: String(step), 'aria-label': label } }) as HTMLInputElement;
    const value = el('span', { class: 'tqc-debug__value' });
    this.sliders.set(key, input);
    this.bag.listen(input, 'input', () => {
      this.readSliders();
      setText(value, input.value);
      this.emit();
    });
    this.bag.listen(input, 'pointerdown', (event) => event.stopPropagation());
    return el('label', { class: 'tqc-debug__row' }, [el('span', { text: label }), input, value]);
  }

  private syncSliders(): void {
    const draft = this.drafts[this.item];
    for (const axis of AXES) {
      const pos = this.sliders.get(`pos${axis}`);
      const rot = this.sliders.get(`rot${axis}`);
      if (pos) pos.value = String(draft.position[axis]);
      if (rot) rot.value = String(Math.round(draft.rotation[axis] * DEG * 2) / 2);
    }
    for (const [key, input] of this.sliders) {
      const value = input.parentElement?.querySelector<HTMLElement>('.tqc-debug__value');
      if (value) setText(value, key.startsWith('rot') ? `${input.value}°` : input.value);
    }
    this.render();
  }

  private readSliders(): void {
    const draft = this.drafts[this.item];
    for (const axis of AXES) {
      draft.position[axis] = Number(this.sliders.get(`pos${axis}`)?.value ?? 0);
      draft.rotation[axis] = Number(this.sliders.get(`rot${axis}`)?.value ?? 0) / DEG;
    }
  }

  current(): ItemSocketDef {
    const draft = this.drafts[this.item];
    return { joint: HELD_ITEM_SOCKETS[this.item].joint, positionOffset: [...draft.position], rotationOffset: [...draft.rotation] };
  }

  /** The registry-shaped JSON for the selected item (what "copy JSON" puts on the clipboard). */
  json(): string {
    const socket = this.current();
    const round = (v: number, digits: number) => Number(v.toFixed(digits));
    return JSON.stringify({ [this.item]: { joint: socket.joint, positionOffset: socket.positionOffset.map((v) => round(v, 4)), rotationOffset: socket.rotationOffset.map((v) => round(v, 4)) } });
  }

  private render(): void {
    setText(this.readout, this.json());
  }

  private emit(): void {
    this.render();
    this.onChange?.(this.item, this.current());
  }

  private async copy(): Promise<void> {
    const text = this.json();
    try {
      await navigator.clipboard.writeText(text);
      setText(this.status, 'copied');
    } catch {
      setText(this.status, 'clipboard blocked; select the JSON below');
    }
  }

  dispose(): void {
    this.bag.dispose();
    this.root.remove();
  }
}

function draftFrom(socket: ItemSocketDef): { position: [number, number, number]; rotation: [number, number, number] } {
  return { position: [...socket.positionOffset], rotation: [...socket.rotationOffset] };
}
