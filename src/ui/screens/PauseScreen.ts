import type { App } from '@/app/App';
import { el } from '@/ui/dom';
import { footer, heading, menuItem, menuList } from '@/ui/components';
import { Screen } from '@/ui/Screen';

/** Pause: dimmed live context, immediate resume, objective recap. */
export class PauseScreen extends Screen {
  readonly id = 'pause';

  constructor(private readonly app: App) {
    super();
    this.root.classList.add('tqc-screen--menu');
  }

  protected build(): void {
    const { app } = this;
    const session = app.session;
    const objective = session?.world.currentObjective();
    const items = [
      menuItem({ label: 'Resume', onSelect: () => app.resume() }),
      menuItem({ label: 'Objective', hint: objective?.label ?? '', onSelect: () => app.openMap() }),
      menuItem({ label: 'Items', onSelect: () => app.openInventory() }),
      menuItem({ label: 'Options', onSelect: () => app.openOptions() }),
      menuItem({
        label: 'Quit to menu',
        hint: 'Progress since the last checkpoint will be lost.',
        danger: true,
        onSelect: () =>
          app.confirm({
            title: 'Quit to the main menu?',
            body: 'Anything since the last checkpoint will be lost.',
            confirmLabel: 'Quit',
            danger: true,
            onConfirm: () => app.quitToMenu(),
          }),
      }),
    ];
    this.root.append(
      heading('Paused', undefined, true),
      el('div', { attrs: { style: 'align-self:center' } }, [menuList(items)]),
      footer(app.prompts, this.bag, [
        ['Navigate', 'Move'],
        ['Confirm', 'Select'],
        ['Cancel', 'Resume'],
      ]),
    );
  }

  override onCancel(): boolean {
    this.app.resume();
    return true;
  }
}
