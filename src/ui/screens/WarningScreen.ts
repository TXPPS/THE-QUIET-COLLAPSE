import type { App } from '@/app/App';
import { PROJECT_TITLE } from '@/config/project';
import { el } from '@/ui/dom';
import { footer, menuItem, menuList, selectItem, sliderItem } from '@/ui/components';
import { Screen } from '@/ui/Screen';

/** First-launch content/photosensitivity notice with the accessibility basics up front. */
export class WarningScreen extends Screen {
  readonly id = 'warning';

  constructor(private readonly app: App) {
    super();
    this.root.classList.add('tqc-screen--opaque', 'tqc-screen--center');
  }

  protected build(): void {
    const { app } = this;
    const settings = app.settings;
    const items = [
      selectItem(this.focus, {
        label: 'Reduced motion',
        hint: 'Limits camera shake and screen transitions.',
        values: ['system', 'on', 'off'] as const,
        get: () => settings.get().accessibility.reducedMotion,
        set: (value) => settings.update({ accessibility: { reducedMotion: value } }),
        format: (value) => (value === 'system' ? 'Follow system' : value === 'on' ? 'On' : 'Off'),
      }),
      sliderItem(this.focus, this.bag, {
        label: 'Text size',
        min: 0.85,
        max: 1.5,
        step: 0.05,
        get: () => settings.get().accessibility.textScale,
        set: (value) => settings.update({ accessibility: { textScale: value } }),
        format: (value) => `${Math.round(value * 100)}%`,
      }),
      menuItem({
        label: 'Continue',
        onSelect: () => {
          settings.update({ meta: { warningsAccepted: true } });
          app.showMainMenu();
        },
      }),
    ];
    this.root.append(
      el('div', { attrs: { style: 'display:grid;gap:var(--tqc-space-5);max-width:44rem;width:100%' } }, [
        el('div', { class: 'tqc-eyebrow', text: PROJECT_TITLE }),
        el('h1', { class: 'tqc-title tqc-title--small', text: 'Before you begin' }),
        el('p', { class: 'tqc-body tqc-muted', text: 'This game depicts a civil emergency, injury and death in a restrained, realistic way. It contains sudden loud sounds, flickering lights and low-light scenes. Play in a landscape orientation on phones.' }),
        menuList(items, true),
        footer(app.prompts, this.bag, [
          ['Navigate', 'Move'],
          ['Confirm', 'Select'],
        ]),
      ]),
    );
  }

  override onCancel(): boolean {
    return true;
  }
}
