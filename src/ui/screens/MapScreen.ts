import type { App } from '@/app/App';
import { el } from '@/ui/dom';
import { footer, heading } from '@/ui/components';
import { Screen } from '@/ui/Screen';
import { InventoryScreen } from './InventoryScreen';
import { drawDistrictMap } from './mapDrawing';

/** District map with the current objective separated from navigation detail. */
export class MapScreen extends Screen {
  readonly id = 'map';
  private canvas!: HTMLCanvasElement;

  constructor(private readonly app: App) {
    super();
    this.root.classList.add('tqc-screen--menu');
  }

  protected build(): void {
    const world = this.app.session?.world;
    const objective = world?.currentObjective();
    this.canvas = el('canvas', { class: 'tqc-map', attrs: { role: 'img', 'aria-label': 'District map', tabindex: '-1', 'data-focusable': '' } });
    this.root.append(
      heading(world?.level.name ?? 'Map', 'District', true),
      el('div', { class: 'tqc-columns', attrs: { style: 'padding-top:var(--tqc-space-4);grid-template-columns:minmax(14rem,20rem) 1fr' } }, [
        el('div', { class: 'tqc-panel' }, [
          el('div', { class: 'tqc-eyebrow', text: 'Objective' }),
          el('p', { class: 'tqc-body', text: objective?.label ?? '—' }),
          el('p', { class: 'tqc-muted', text: objective?.detail ?? '' }),
          el('div', { class: 'tqc-eyebrow', text: 'Legend', attrs: { style: 'margin-top:var(--tqc-space-4)' } }),
          el('p', { class: 'tqc-muted', text: 'Amber marker: objective. Pale dot: you. Grey: buildings. Hatched: known blockage.' }),
        ]),
        el('div', { class: 'tqc-panel', attrs: { style: 'display:grid;place-items:center;padding:var(--tqc-space-2)' } }, [this.canvas]),
      ]),
      footer(this.app.prompts, this.bag, [
        ['TabNext', 'Items'],
        ['Cancel', 'Back'],
      ]),
    );
    this.bag.listen(window, 'resize', () => this.draw());
    this.draw();
  }

  protected override onEnter(): void {
    requestAnimationFrame(() => this.draw());
  }

  /** Back to the items tab (RB / LB on a controller). */
  override onTabNext(): void {
    this.app.screens.replace(new InventoryScreen(this.app));
  }

  override onTabPrev(): void {
    this.onTabNext();
  }

  private draw(): void {
    const world = this.app.session?.world;
    if (!world) return;
    const parent = this.canvas.parentElement;
    const width = Math.max(200, (parent?.clientWidth ?? 600) - 16);
    const height = Math.max(160, (parent?.clientHeight ?? 400) - 16);
    drawDistrictMap(this.canvas, world, width, height);
  }
}
