import type { App } from '@/app/App';
import { ACTION_META, GAMEPLAY_BINDING_ORDER, type Action, type BindingSlot } from '@/input/actions';
import { slotsOf, type KbmBinding, type PadBinding } from '@/input/bindings';
import { kbmBindingLabel } from '@/input/keyLabels';
import type { GlyphFamily } from '@/input/InputSource';
import { PAD_PROFILE_FAMILIES, PAD_PROFILE_LABELS, profileFamilyFor, type PadProfileFamily } from '@/input/padProfiles';
import { el, setText } from '@/ui/dom';
import { footer, heading, menuItem, menuList } from '@/ui/components';
import { Screen } from '@/ui/Screen';

type Tab = 'keyboard' | PadProfileFamily;
const TABS: readonly Tab[] = ['keyboard', ...PAD_PROFILE_FAMILIES];

const CAPTURE_TIMEOUT_MS = 6000;
const GAME_SLOTS: BindingSlot[] = GAMEPLAY_BINDING_ORDER.flatMap((action) => slotsOf(action)).filter((slot) => !slot.startsWith('Look'));

/**
 * Key/button remapping: one tab for the keyboard and one per controller family (each family is
 * its own stored profile). Pick a row, press the new input; conflicts in the same context clear.
 */
export class RemapScreen extends Screen {
  readonly id = 'remap';
  private tab: Tab = 'keyboard';
  private list!: HTMLElement;
  private status!: HTMLElement;
  private tabs!: HTMLElement;
  private capturing: BindingSlot | null = null;
  private captureTimer = 0;

  constructor(private readonly app: App) {
    super();
    this.root.classList.add('tqc-screen--menu');
    const family = app.input.registry.activeFamily;
    if (family !== 'keyboard' && family !== 'touch') this.tab = profileFamilyFor(family);
  }

  protected build(): void {
    this.tabs = el('div', { class: 'tqc-tabs', attrs: { role: 'tablist' } });
    this.list = el('div', { class: 'tqc-scroll' });
    this.status = el('div', { class: 'tqc-muted', attrs: { 'aria-live': 'polite', style: 'min-height:1.5em' } });
    this.root.append(
      heading('Bindings', 'Controls', true),
      el('div', { attrs: { style: 'display:grid;grid-template-rows:auto auto 1fr;gap:var(--tqc-space-3);min-height:0' } }, [this.tabs, this.status, this.list]),
      footer(this.app.prompts, this.bag, [
        ['TabPrev', 'Previous'],
        ['TabNext', 'Next'],
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

  private label(tab: Tab): string {
    return tab === 'keyboard' ? 'Keyboard & mouse' : PAD_PROFILE_LABELS[tab];
  }

  private renderTabs(): void {
    this.tabs.replaceChildren(
      ...TABS.map((tab) => {
        const button = el('button', { class: 'tqc-tab', text: this.label(tab), attrs: { type: 'button', role: 'tab', 'aria-selected': String(this.tab === tab) } });
        button.addEventListener('click', () => this.switchTab(tab));
        return button;
      }),
    );
  }

  private switchTab(tab: Tab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.cancelCapture();
    this.renderTabs();
    this.render();
    this.focus.focusFirst();
  }

  override onTabPrev(): void {
    const index = TABS.indexOf(this.tab);
    this.switchTab(TABS[(index - 1 + TABS.length) % TABS.length] ?? 'keyboard');
  }

  override onTabNext(): void {
    const index = TABS.indexOf(this.tab);
    this.switchTab(TABS[(index + 1) % TABS.length] ?? 'keyboard');
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
            body: 'Keyboard, mouse and every controller profile return to their defaults.',
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
    if (this.tab === 'keyboard') return bindings.kbmFor(slot).map((b) => kbmBindingLabel(b).text).join(' / ');
    const family: GlyphFamily = this.tab;
    return bindings
      .padFor(slot, this.tab)
      .map((binding) => this.app.input.glyphs.padBindingGlyph(binding, family).text)
      .join(' / ');
  }

  private beginCapture(slot: BindingSlot): void {
    this.capturing = slot;
    this.captureTimer = CAPTURE_TIMEOUT_MS / 1000;
    setText(this.status, this.tab === 'keyboard' ? 'Press a key or mouse button. Escape cancels.' : `Press a controller button (saved to the ${this.label(this.tab)} profile).`);
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
    if (!slot || this.tab !== 'keyboard') return;
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
    if (!slot || this.tab === 'keyboard') return;
    this.app.input.bindings.rebindPad(slot, binding, GAME_SLOTS, this.tab);
    this.finishCapture(this.app.input.glyphs.padBindingGlyph(binding, this.tab).aria);
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
