import type { App } from '@/app/App';
import { CANON } from '@/config/canon';
import { el } from '@/ui/dom';
import { footer, menuItem, menuList } from '@/ui/components';
import { Screen } from '@/ui/Screen';

/** Run-complete state. Restrained: a few lines, then credits or the menu. */
export class EndingScreen extends Screen {
  readonly id = 'ending';

  constructor(private readonly app: App) {
    super();
    this.root.classList.add('tqc-screen--menu', 'tqc-screen--opaque');
  }

  protected build(): void {
    const { app } = this;
    const lines = CANON.ending.map((line) => el('p', { class: 'tqc-body', text: line }));
    this.root.append(
      el('header', {}, [el('div', { class: 'tqc-eyebrow', text: 'Day one, night' }), el('h1', { class: 'tqc-title', text: CANON.endingTitle })]),
      el('div', { attrs: { style: 'align-self:center;display:grid;gap:var(--tqc-space-5)' } }, [
        el('div', {}, lines),
        menuList([
          menuItem({ label: 'Credits', onSelect: () => app.openCredits() }),
          menuItem({ label: 'Return to menu', onSelect: () => app.quitToMenu() }),
        ]),
      ]),
      footer(app.prompts, this.bag, [['Confirm', 'Select']]),
    );
  }

  override onCancel(): boolean {
    return true;
  }
}
