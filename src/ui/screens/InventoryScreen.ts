import type { App } from '@/app/App';
import { PISTOL, PLAYER } from '@/config/gameplay';
import { canCombine, carriedItems, combineItem, itemDef, type ItemDef, type ItemId } from '@/game/items/registry';
import { tryMedkit, tryReload } from '@/game/sim/player';
import type { World } from '@/game/sim/World';
import { el } from '@/ui/dom';
import { footer, heading, menuItem, menuList } from '@/ui/components';
import { Screen } from '@/ui/Screen';

interface Entry {
  id: string;
  label: string;
  value: string;
  examine: string;
  /** Confirm. */
  use?: { label: string; enabled: boolean; run: () => void };
  /** Next tab. */
  combine?: { label: string; enabled: boolean; run: () => void };
}

/**
 * Inventory: registry-driven list with an examine panel. Confirm uses the focused item, the
 * next-tab action combines it, documents open the reader. Every row exists because the player
 * carries the thing; nothing decorative.
 */
export class InventoryScreen extends Screen {
  readonly id = 'inventory';
  private detail!: HTMLElement;
  private list!: HTMLElement;
  private current: Entry | null = null;

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
        ['TabNext', 'Combine'],
        ['Cancel', 'Back'],
      ]),
    );
    this.render();
  }

  private entries(): Entry[] {
    const world = this.app.session?.world;
    if (!world) return [];
    const p = world.player;
    const entries = carriedItems(p).map((entry) => this.itemEntry(world, entry.def, entry.count));
    for (const doc of world.level.documents) {
      if (!world.documentsRead.has(doc.id)) continue;
      entries.push({ id: doc.id, label: doc.title, value: 'Document', examine: doc.body.split('\n')[0] ?? '', use: { label: 'Read', enabled: true, run: () => this.app.showDocument(doc) } });
    }
    return entries;
  }

  private itemEntry(world: World, def: ItemDef, count: number): Entry {
    const p = world.player;
    const value = def.id === 'pistol' ? `${p.ammoLoaded} / ${p.ammoReserve}` : def.id === 'flashlight' ? (p.flashlightOn ? 'On' : 'Off') : `×${count}`;
    const entry: Entry = { id: def.id, label: def.name, value, examine: def.examine };
    const use = def.use;
    if (use?.kind === 'reload') entry.use = { label: 'Reload', enabled: p.ammoLoaded < PISTOL.magazine && p.ammoReserve > 0, run: () => this.reload(world) };
    else if (use?.kind === 'heal') entry.use = { label: 'Use', enabled: p.health < PLAYER.maxHealth, run: () => this.heal(world, def.id) };
    else if (use?.kind === 'toggleLight') entry.use = { label: p.flashlightOn ? 'Switch off' : 'Switch on', enabled: true, run: () => this.toggleFlashlight(world) };
    if (def.combine) {
      const partner = itemDef(def.combine.with);
      entry.combine = { label: `Combine with ${partner.name.toLowerCase()}`, enabled: canCombine(p, def.id), run: () => this.combine(world, def.id) };
    }
    return entry;
  }

  private render(): void {
    const entries = this.entries();
    const items = entries.map((entry) => {
      const item = menuItem({ label: entry.label, value: entry.value, onSelect: () => entry.use?.enabled && entry.use.run() });
      item.addEventListener('focus', () => this.showDetail(entry));
      item.addEventListener('mouseenter', () => this.showDetail(entry));
      return item;
    });
    this.list.replaceChildren(menuList(items, true));
    const first = entries[0];
    if (first) this.showDetail(first);
    else this.detail.replaceChildren(el('p', { class: 'tqc-muted', text: 'Nothing carried.' }));
    this.focus.refresh();
  }

  private showDetail(entry: Entry): void {
    this.current = entry;
    const line = (action: Entry['use'] | Entry['combine'], prompt: string) =>
      action ? el('div', { class: `tqc-hint${action.enabled ? '' : ' tqc-faint'}`, text: action.enabled ? `${prompt}: ${action.label}` : `${action.label} unavailable` }) : el('div');
    this.detail.replaceChildren(el('div', { class: 'tqc-eyebrow', text: entry.label }), el('p', { class: 'tqc-body', text: entry.examine }), line(entry.use, 'Confirm'), line(entry.combine, 'Next'));
  }

  override onTabNext(): void {
    const action = this.current?.combine;
    if (action?.enabled) action.run();
  }

  private reload(world: World): void {
    tryReload(world);
    this.app.toasts.show('Reloading when you return', 'info', 1.6);
    this.app.screens.clear();
  }

  /** Starts applying the dressing or kit; the player is vulnerable while it takes effect. */
  private heal(world: World, id: ItemId): void {
    tryMedkit(world, id);
    this.app.toasts.show(`Applying ${itemDef(id).name.toLowerCase()}`, 'info', 1.6);
    this.app.screens.clear();
  }

  private combine(world: World, id: ItemId): void {
    const result = combineItem(world, id);
    if (!result) return;
    this.app.toasts.show(`Made ${itemDef(result).name.toLowerCase()}`, 'info', 2);
    this.render();
  }

  private toggleFlashlight(world: World): void {
    world.player.flashlightOn = !world.player.flashlightOn;
    world.events.emit('flashlight', { on: world.player.flashlightOn });
    this.render();
  }
}
