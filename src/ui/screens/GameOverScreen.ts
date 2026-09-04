import type { App } from '@/app/App';
import { CANON } from '@/config/canon';
import { el } from '@/ui/dom';
import { footer, menuItem, menuList } from '@/ui/components';
import { Screen } from '@/ui/Screen';

/** Failure and immediate recovery: continue from checkpoint, load, or quit. */
export class GameOverScreen extends Screen {
  readonly id = 'gameOver';

  constructor(private readonly app: App) {
    super();
    this.root.classList.add('tqc-screen--menu');
    this.root.style.background = 'radial-gradient(ellipse at center, rgba(20,8,6,0.82) 0%, rgba(6,5,5,0.95) 75%)';
  }

  protected build(): void {
    const { app } = this;
    const hasCheckpoint = app.saves.inspect(app.session?.slot ?? 0).status === 'ok';
    const items = [
      menuItem({
        label: 'Continue',
        hint: hasCheckpoint ? 'From the last checkpoint' : 'Restart the run from the beginning',
        onSelect: () => app.restartFromCheckpoint(),
      }),
      menuItem({ label: 'Load', onSelect: () => app.openSlotSelect('load') }),
      menuItem({ label: 'Quit to menu', danger: true, onSelect: () => app.quitToMenu() }),
    ];
    this.root.append(
      el('header', {}, [el('h1', { class: 'tqc-title', text: CANON.deathTitle }), el('p', { class: 'tqc-subtitle', text: CANON.deathSubtitle })]),
      el('div', { attrs: { style: 'align-self:center' } }, [menuList(items)]),
      footer(app.prompts, this.bag, [
        ['Navigate', 'Move'],
        ['Confirm', 'Select'],
      ]),
    );
  }

  override onCancel(): boolean {
    return true;
  }
}
