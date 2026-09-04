import type { App } from '@/app/App';
import { el, setText } from '@/ui/dom';
import { footer, heading, menuItem, menuList } from '@/ui/components';
import { Screen } from '@/ui/Screen';
import type { InputSource } from '@/input/InputSource';

/**
 * "Choose Primary Controls": shown when more than one viable source exists. Auto follows the last
 * meaningful input; picking a device locks gameplay to it (Escape stays an emergency key).
 */
export class ChooseControlsScreen extends Screen {
  readonly id = 'chooseControls';
  private list!: HTMLElement;
  private live!: HTMLElement;
  private offSources: (() => void) | null = null;
  private offActive: (() => void) | null = null;

  constructor(
    private readonly app: App,
    private readonly onDone: () => void,
  ) {
    super();
    this.root.classList.add('tqc-screen--menu');
  }

  protected build(): void {
    this.list = el('div');
    this.live = el('p', { class: 'tqc-muted', attrs: { 'aria-live': 'polite' }, text: 'Press a button or move a stick to confirm a device.' });
    this.root.append(
      heading('Choose primary controls', 'Controls', true),
      el('div', { attrs: { style: 'display:grid;gap:var(--tqc-space-4);align-content:start;padding-top:var(--tqc-space-4)' } }, [
        el('p', { class: 'tqc-body tqc-muted', text: 'More than one way to play is connected. Auto switches prompts to whatever you used last. Choosing a device locks gameplay to it so a drifting stick or a nudged mouse cannot take over.' }),
        this.list,
        this.live,
      ]),
      footer(this.app.prompts, this.bag, [
        ['Navigate', 'Move'],
        ['Confirm', 'Select'],
        ['Cancel', 'Back'],
      ]),
    );
    this.render();
    const registry = this.app.input.registry;
    this.offSources = registry.events.on('sourcesChanged', () => this.render());
    this.offActive = registry.events.on('activeChanged', ({ source }) => {
      if (source) setText(this.live, `Detected: ${source.label}`);
    });
    this.bag.add(() => {
      this.offSources?.();
      this.offActive?.();
    });
  }

  private render(): void {
    const { app } = this;
    const settings = app.settings.get().controls;
    const sources = app.input.sources();
    const items: HTMLElement[] = [
      menuItem({
        label: 'Auto',
        hint: 'Follow the last input used. Prompts switch with a short delay.',
        value: settings.policy === 'auto' ? 'Current' : '',
        onSelect: () => this.choose('auto', null),
      }),
      ...sources.map((source) => this.sourceItem(source, settings.policy === 'locked' && settings.primarySource === source.id)),
    ];
    this.list.replaceChildren(menuList(items, true));
    this.focus.refresh();
  }

  private sourceItem(source: InputSource, current: boolean): HTMLElement {
    const confidence = source.kind === 'gamepad' ? ` · ${Math.round(source.confidence * 100)}% match` : '';
    return menuItem({
      label: source.label,
      hint: `${describeKind(source.kind)}${confidence}`,
      value: current ? 'Current' : '',
      onSelect: () => this.choose('locked', source.id),
    });
  }

  private choose(policy: 'auto' | 'locked', primary: string | null): void {
    this.app.settings.update({ controls: { policy, primarySource: primary }, meta: { controlsChooserSeen: true } });
    if (primary) this.app.input.registry.forceActive(primary);
    this.onDone();
  }
}

function describeKind(kind: InputSource['kind']): string {
  if (kind === 'keyboardMouse') return 'Keyboard and mouse';
  if (kind === 'touch') return 'On-screen touch controls';
  return 'Game controller';
}
