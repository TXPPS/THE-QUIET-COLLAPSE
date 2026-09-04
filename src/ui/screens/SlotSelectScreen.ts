import type { App } from '@/app/App';
import { el } from '@/ui/dom';
import { footer, heading, menuItem, menuList, selectItem } from '@/ui/components';
import { Screen } from '@/ui/Screen';
import type { SlotInfo } from '@/persistence/SaveSystem';
import { formatPlaytime } from './MainMenuScreen';

export type SlotMode = 'new' | 'load' | 'save';

function describe(info: SlotInfo): { value: string; hint: string } {
  if (info.status === 'empty') return { value: 'Empty', hint: 'No data' };
  if (info.status === 'corrupt') return { value: 'Damaged', hint: 'This save could not be read. Select to delete it.' };
  if (info.status === 'unsupported') return { value: 'Newer version', hint: `Saved by a newer build (${info.detail ?? ''}). Select to delete it.` };
  const header = info.header;
  if (!header) return { value: '—', hint: '' };
  const date = new Date(header.savedAt);
  return {
    value: formatPlaytime(header.playtimeSec),
    hint: `${header.locationLabel} · ${header.objectiveLabel} · ${date.toLocaleString()}`,
  };
}

/** Save/load/checkpoint slot selection with explicit corruption messaging. */
export class SlotSelectScreen extends Screen {
  readonly id = 'slots';
  private list!: HTMLElement;

  constructor(
    private readonly app: App,
    private readonly mode: SlotMode,
  ) {
    super();
    this.root.classList.add('tqc-screen--menu');
  }

  protected build(): void {
    const titles: Record<SlotMode, string> = { new: 'Start a new run', load: 'Load a run', save: 'Save the run' };
    this.list = el('div');
    this.root.append(
      heading(titles[this.mode], 'Save slots', true),
      el('div', { attrs: { style: 'align-self:start;padding-top:var(--tqc-space-4)' } }, [this.list]),
      footer(this.app.prompts, this.bag, [
        ['Confirm', 'Select'],
        ['Cancel', 'Back'],
      ]),
    );
    this.render();
  }

  private render(): void {
    const settings = this.app.settings;
    const difficultyRow =
      this.mode === 'new'
        ? [
            selectItem(this.focus, {
              label: 'Difficulty',
              hint: 'Hard: more damage taken, fewer rounds found. Changes apply to the new run only.',
              values: ['normal', 'hard'] as const,
              get: () => settings.get().meta.difficulty,
              set: (value) => settings.update({ meta: { difficulty: value } }),
              format: (value) => (value === 'normal' ? 'Normal' : 'Hard'),
            }),
          ]
        : [];
    const items = this.app.saves.listSlots().map((info) => {
      const { value, hint } = describe(info);
      return menuItem({
        label: `Slot ${info.slot}`,
        value,
        hint,
        disabled: this.mode === 'load' && info.status === 'empty',
        danger: info.status === 'corrupt' || info.status === 'unsupported',
        onSelect: () => this.select(info),
      });
    });
    this.list.replaceChildren(menuList([...difficultyRow, ...items], true));
    this.focus.refresh();
  }

  private select(info: SlotInfo): void {
    const { app } = this;
    if (info.status === 'corrupt' || info.status === 'unsupported') {
      app.confirm({
        title: 'Delete damaged save?',
        body: 'The data in this slot cannot be read by this version. Deleting it frees the slot.',
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: () => {
          app.saves.delete(info.slot);
          this.render();
        },
      });
      return;
    }
    if (this.mode === 'load') {
      if (info.status === 'ok') app.loadSlot(info.slot);
      return;
    }
    if (info.status === 'ok') {
      app.confirm({
        title: 'Overwrite this slot?',
        body: `Slot ${info.slot} holds a run at ${info.header?.locationLabel ?? 'an unknown location'}. It will be replaced.`,
        confirmLabel: 'Overwrite',
        danger: true,
        onConfirm: () => this.commit(info.slot),
      });
      return;
    }
    this.commit(info.slot);
  }

  private commit(slot: number): void {
    if (this.mode === 'new') this.app.newGame(slot);
    else this.app.saveToSlot(slot);
  }
}
