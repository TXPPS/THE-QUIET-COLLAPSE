import type { App } from '@/app/App';
import { CANON } from '@/config/canon';
import { PROJECT_TITLE, PROJECT_VERSION } from '@/config/project';
import { el } from '@/ui/dom';
import { footer, menuItem, menuList } from '@/ui/components';
import { Screen } from '@/ui/Screen';

/** Title / main menu: vertical hierarchy, quiet staging, contextual footer. */
export class MainMenuScreen extends Screen {
  readonly id = 'mainMenu';

  constructor(private readonly app: App) {
    super();
    this.root.classList.add('tqc-screen--menu', 'tqc-grain');
    this.root.style.background = 'linear-gradient(90deg, rgba(8,9,10,0.92) 0%, rgba(8,9,10,0.75) 45%, rgba(8,9,10,0.35) 100%)';
  }

  protected build(): void {
    const { app } = this;
    const recent = app.saves.mostRecentSlot();
    const items = [
      menuItem({
        label: 'Continue',
        hint: recent?.header ? `${recent.header.locationLabel} · ${formatPlaytime(recent.header.playtimeSec)}` : 'No saved run',
        disabled: !recent,
        onSelect: () => app.continueGame(),
      }),
      menuItem({ label: 'New run', hint: `${CANON.districtName}, nightfall`, onSelect: () => app.openSlotSelect('new') }),
      menuItem({ label: 'Load', onSelect: () => app.openSlotSelect('load') }),
      menuItem({ label: 'Options', onSelect: () => app.openOptions() }),
      menuItem({ label: 'Credits', onSelect: () => app.openCredits() }),
      menuItem({ label: 'Legal', onSelect: () => app.openLegal() }),
    ];
    this.root.append(
      el('header', {}, [el('div', { class: 'tqc-eyebrow', text: 'A survival story' }), el('h1', { class: 'tqc-title', text: PROJECT_TITLE })]),
      el('div', { attrs: { style: 'align-self:center' } }, [menuList(items)]),
      footer(
        app.prompts,
        this.bag,
        [
          ['Navigate', 'Move'],
          ['Confirm', 'Select'],
        ],
        `${PROJECT_VERSION}`,
      ),
    );
  }

  override onCancel(): boolean {
    return true;
  }
}

export function formatPlaytime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m ${Math.floor(seconds % 60)}s`;
}
