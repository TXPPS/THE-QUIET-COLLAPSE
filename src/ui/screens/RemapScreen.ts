import type { App } from '@/app/App';
import { ACTION_META, GAMEPLAY_BINDING_ORDER, type Action, type BindingSlot } from '@/input/actions';
import { slotsOf, type KbmBinding, type PadBinding } from '@/input/bindings';
import { kbmBindingLabel } from '@/input/keyLabels';
import type { GlyphFamily } from '@/input/InputSource';
import { el, setText } from '@/ui/dom';
import { footer, heading, menuItem, menuList } from '@/ui/components';
import { Screen } from '@/ui/Screen';

type Family = 'keyboard' | 'gamepad';

const CAPTURE_TIMEOUT_MS = 6000;
const GAME_SLOTS: BindingSlot[] = GAMEPLAY_BINDING_ORDER.flatMap((action) => slotsOf(action)).filter((slot) => !slot.startsWith('Look'));

/** Key/button remapping: pick a row, press the new input, conflicts in the same context are cleared. */
export class RemapScreen extends Screen {
  readonly id = 'remap';
  private family: Family = 'keyboard';
  private list!: HTMLElement;
  private status!: HTMLElement;
  private tabs!: HTMLElement;
  private capturing: BindingSlot | null = null;
  private captureTimer = 0;

  constructor(private readonly app: App) {
    super();
    this.root.classList.add('tqc-screen--menu');
    if (app.input.registry.activeFamily !== 'keyboard' && app.input.registry.activeFamily !== 'touch') this.family = 'gamepad';
  }

  protected build(): void {
    this.tabs = el('div', { class: 'tqc-tabs', attrs: { role: 'tablist' } });
    this.list = el('div', { class: 'tqc-scroll' });
    this.status = el('div', { class: 'tqc-muted', attrs: { 'aria-live': 'polite', style: 'min-height:1.5em' } });
    this.root.append(
      heading('Bindings', 'Controls', true),
      el('div', { attrs: { style: 'display:grid;grid-template-rows:auto auto 1fr;gap:var(--tqc-space-3);min-height:0' } }, [this.tabs, this.status, this.list]),
      footer(this.app.prompts, this.bag, [
        ['TabPrev', 'Keyboard'],
        ['TabNext', 'Controller'],
        ['Confirm', 'Rebind'],
        ['Cancel', 'Back'],
      ]),
    );
    this.renderTabs();
    this.render();
    this.app.input.keyboardMouse.onRawBinding = (binding) => this.onRawKbm(binding);
    this.bag.add(() => {
      this.app.input.keyboardMouse.onRawBinding = null;
      for (const pad of this.app.input.registry.listGamepads()) pad.onRawBinding = null;
    });
  }

  private renderTabs(): void {
    const make = (family: Family, label: string) => {
      const button = el('button', { class: 'tqc-tab', text: label, attrs: { type: 'button', role: 'tab', 'aria-selected': String(this.family === family) } });
      button.addEventListener('click', () => this.switchFamily(family));
      return button;
    };
    this.tabs.replaceChildren(make('keyboard', 'Keyboard & mouse'), make('gamepad', 'Controller'));
  }

  private switchFamily(family: Family): void {
    if (this.family === family) return;
    this.family = family;
    this.cancelCapture();
    this.renderTabs();
    this.render();
    this.focus.focusFirst();
  }

  override onTabPrev(): void {
    this.switchFamily('keyboard');
  }

  override onTabNext(): void {
    this.switchFamily('gamepad');
  }

  private render(): void {
    const items = GAME_SLOTS.map((slot) => {
      const [action, direction] = slot.split('.') as [Action, string | undefined];
      const label = direction ? `${ACTION_META[action].label} ${direction}` : ACTION_META[action].label;
      const value = this.capturing === slot ? 'Press…' : this.describe(slot) || 'Unbound';
      return menuItem({ label, value, onSelect: () => this.beginCapture(slot) });
    });
    items.push(
      menuItem({
        label: 'Reset all bindings',
        danger: true,
        onSelect: () =>
          this.app.confirm({
            title: 'Reset bindings?',
            body: 'Keyboard, mouse and controller bindings return to their defaults.',
            confirmLabel: 'Reset',
            danger: true,
            onConfirm: () => {
              this.app.input.bindings.resetAll();
              this.render();
            },
          }),
      }),
    );
    this.list.replaceChildren(menuList(items, true));
    this.focus.refresh();
  }

  private describe(slot: BindingSlot): string {
    const bindings = this.app.input.bindings;
    if (this.family === 'keyboard') return bindings.kbmFor(slot).map((b) => kbmBindingLabel(b).text).join(' / ');
    const family: GlyphFamily = this.padGlyphFamily();
    return bindings
      .padFor(slot)
      .map((binding) => this.app.input.glyphs.padBindingGlyph(binding, family).text)
      .join(' / ');
  }

  private padGlyphFamily(): GlyphFamily {
    const pad = this.app.input.registry.listGamepads()[0];
    return pad ? pad.glyphFamily : 'generic';
  }

  private beginCapture(slot: BindingSlot): void {
    this.capturing = slot;
    this.captureTimer = CAPTURE_TIMEOUT_MS / 1000;
    setText(this.status, this.family === 'keyboard' ? 'Press a key or mouse button. Escape cancels.' : 'Press a controller button.');
    for (const pad of this.app.input.registry.listGamepads()) pad.onRawBinding = (binding) => this.onRawPad(binding);
    this.render();
  }

  private cancelCapture(): void {
    this.capturing = null;
    setText(this.status, '');
    for (const pad of this.app.input.registry.listGamepads()) pad.onRawBinding = null;
  }

  private onRawKbm(binding: KbmBinding): void {
    const slot = this.capturing;
    if (!slot || this.family !== 'keyboard') return;
    if (binding.type === 'key' && binding.code === 'Escape') {
      this.cancelCapture();
      this.render();
      return;
    }
    this.app.input.bindings.rebindKbm(slot, binding, GAME_SLOTS);
    this.finishCapture(kbmBindingLabel(binding).text);
  }

  private onRawPad(binding: PadBinding): void {
    const slot = this.capturing;
    if (!slot || this.family !== 'gamepad') return;
    this.app.input.bindings.rebindPad(slot, binding, GAME_SLOTS);
    this.finishCapture(describePad(binding));
  }

  private finishCapture(text: string): void {
    const slot = this.capturing;
    this.cancelCapture();
    setText(this.status, `${slot} → ${text}`);
    this.render();
  }

  override update(dt: number): void {
    if (!this.capturing) return;
    this.captureTimer -= dt;
    if (this.captureTimer <= 0) {
      this.cancelCapture();
      this.render();
    }
  }

  override onConfirm(): void {
    if (this.capturing) return;
    super.onConfirm();
  }

  override onCancel(): boolean {
    if (this.capturing) {
      this.cancelCapture();
      this.render();
      return true;
    }
    return false;
  }
}

function describePad(binding: PadBinding): string {
  if (binding.type === 'button') return `Button ${binding.index}`;
  if (binding.type === 'axis') return `Axis ${binding.index}${binding.sign > 0 ? '+' : '−'}`;
  return `Stick ${binding.x}/${binding.y}`;
}
