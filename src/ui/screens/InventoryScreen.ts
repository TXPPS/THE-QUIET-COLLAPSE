import type { App } from '@/app/App';
import { MEDKIT, PISTOL, PLAYER } from '@/config/gameplay';
import { tryMedkit, tryReload } from '@/game/sim/player';
import { el, setText } from '@/ui/dom';
import { footer, heading, menuItem, menuList } from '@/ui/components';
import { Screen } from '@/ui/Screen';

interface Entry {
  label: string;
  value: string;
  description: string;
  action?: { label: string; run: () => void; enabled: boolean };
}

/** Inventory: a dense list with a detail panel; use actions only where they make sense. */
export class InventoryScreen extends Screen {
  readonly id = 'inventory';
  private detail!: HTMLElement;
  private list!: HTMLElement;

  constructor(private readonly app: App) {
    super();
    this.root.classList.add('tqc-screen--menu');
  }

  protected build(): void {
    this.detail = el('div', { class: 'tqc-panel' });
    this.list = el('div');
    this.root.append(
      heading('Items', undefined, true),
      el('div', { class: 'tqc-columns', attrs: { style: 'padding-top:var(--tqc-space-4)' } }, [this.list, this.detail]),
      footer(this.app.prompts, this.bag, [
        ['Navigate', 'Select'],
        ['Confirm', 'Use / Read'],
        ['Cancel', 'Back'],
      ]),
    );
    this.render();
  }

  private entries(): Entry[] {
    const world = this.app.session?.world;
    if (!world) return [];
    const p = world.player;
    const entries: Entry[] = [
      {
        label: 'Pistol',
        value: `${p.ammoLoaded} / ${p.ammoReserve}`,
        description: `Compact service pistol. ${PISTOL.magazine}-round magazine. Rounds are scarce; every shot is a decision.`,
        action: { label: 'Reload', enabled: p.ammoLoaded < PISTOL.magazine && p.ammoReserve > 0, run: () => this.reload() },
      },
      {
        label: 'First-aid kit',
        value: `×${p.medkits}`,
        description: `Dressings and antiseptic. Restores ${MEDKIT.heal} health. Takes a moment to apply; do it somewhere quiet.`,
        action: { label: 'Use', enabled: p.medkits > 0 && p.health < PLAYER.maxHealth, run: () => this.useMedkit() },
      },
    ];
    if (p.hasFlashlight) {
      entries.push({
        label: 'Flashlight',
        value: p.flashlightOn ? 'On' : 'Off',
        description: 'Reliable, bright, and visible from a long way off.',
        action: { label: p.flashlightOn ? 'Switch off' : 'Switch on', enabled: true, run: () => this.toggleFlashlight() },
      });
    }
    for (const doc of world.level.documents) {
      if (!world.documentsRead.has(doc.id)) continue;
      entries.push({ label: doc.title, value: 'Document', description: doc.body.split('\n')[0] ?? '', action: { label: 'Read', enabled: true, run: () => this.app.showDocument(doc) } });
    }
    return entries;
  }

  private render(): void {
    const entries = this.entries();
    const items = entries.map((entry) => {
      const item = menuItem({ label: entry.label, value: entry.value, onSelect: () => entry.action?.enabled && entry.action.run() });
      item.addEventListener('focus', () => this.showDetail(entry));
      item.addEventListener('mouseenter', () => this.showDetail(entry));
      return item;
    });
    this.list.replaceChildren(menuList(items, true));
    if (entries[0]) this.showDetail(entries[0]);
    this.focus.refresh();
  }

  private showDetail(entry: Entry): void {
    const action = entry.action;
    this.detail.replaceChildren(
      el('div', { class: 'tqc-eyebrow', text: entry.label }),
      el('p', { class: 'tqc-body', text: entry.description }),
      action ? el('div', { class: `tqc-hint${action.enabled ? '' : ' tqc-faint'}`, text: action.enabled ? `Confirm: ${action.label}` : `${action.label} unavailable` }) : el('div'),
    );
  }

  /** Starts the reload; it takes its normal time once play resumes. */
  private reload(): void {
    const world = this.app.session?.world;
    if (!world) return;
    tryReload(world);
    this.app.toasts.show('Reloading when you return', 'info', 1.6);
    this.app.screens.clear();
  }

  /** Starts applying the dressing; the player is vulnerable while it takes effect. */
  private useMedkit(): void {
    const world = this.app.session?.world;
    if (!world) return;
    tryMedkit(world);
    this.app.toasts.show('Applying dressing', 'info', 1.6);
    this.app.screens.clear();
  }

  private toggleFlashlight(): void {
    const world = this.app.session?.world;
    if (!world) return;
    world.player.flashlightOn = !world.player.flashlightOn;
    world.events.emit('flashlight', { on: world.player.flashlightOn });
    this.render();
    setText(this.detail.querySelector('.tqc-eyebrow') as HTMLElement, 'Flashlight');
  }
}
