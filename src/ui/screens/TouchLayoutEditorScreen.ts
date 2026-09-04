import type { App } from '@/app/App';
import { el, setText, toggleClass, capturePointer } from '@/ui/dom';
import { menuItem, menuList, selectItem, sliderItem, toggleItem } from '@/ui/components';
import { Screen } from '@/ui/Screen';
import { readViewport } from '@/ui/touch/TouchHud';
import {
  checkLayout,
  clampProfile,
  CONTROL_LABELS,
  controlRect,
  describeReport,
  ESSENTIAL_CONTROLS,
  layoutFromCentre,
  lookZoneRect,
  OPACITY_RANGE,
  PRESET_IDS,
  PRESETS,
  presetProfile,
  SIZE_RANGE,
  TOUCH_CONTROL_IDS,
  type PresetId,
  type ProfileKind,
  type TouchControlId,
  type TouchProfile,
  type Viewport,
} from '@/ui/touch/touchProfiles';

/**
 * Touch layout editor: drag controls within the safe area, adjust size/opacity/visibility, apply
 * presets, switch between phone and tablet profiles and between the drag zone and the right stick,
 * and see overlap / edge / look-zone warnings before saving.
 */
export class TouchLayoutEditorScreen extends Screen {
  readonly id = 'touchEditor';
  private kind: ProfileKind;
  private draft: TouchProfile;
  private selected: TouchControlId = 'fire';
  private canvas!: HTMLElement;
  private panel!: HTMLElement;
  private warning!: HTMLElement;
  private safeGuide!: HTMLElement;
  private lookGuide!: HTMLElement;
  private readonly nodes = new Map<TouchControlId, HTMLElement>();
  private viewport: Viewport = { width: 1, height: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
  private drag: { id: TouchControlId; pointerId: number; offsetX: number; offsetY: number } | null = null;

  constructor(private readonly app: App) {
    super();
    this.root.className = 'tqc-editor';
    this.kind = app.touchProfileKind();
    this.draft = structuredClone(app.touchProfiles[this.kind]);
  }

  private get lookControl(): 'drag' | 'stick' {
    return this.app.settings.get().controls.touchLookControl;
  }

  protected build(): void {
    this.safeGuide = el('div', { class: 'tqc-editor__safe', attrs: { 'aria-hidden': 'true' } });
    this.lookGuide = el('div', { class: 'tqc-editor__look', attrs: { 'aria-hidden': 'true' } }, [el('span', { text: 'Look zone' })]);
    this.canvas = el('div', { attrs: { style: 'position:absolute;inset:0' } }, [this.safeGuide, this.lookGuide]);
    this.warning = el('div', { class: 'tqc-editor__warning', attrs: { 'aria-live': 'polite' } });
    this.panel = el('div', { class: 'tqc-editor__panel' });
    this.root.append(this.canvas, this.panel);
    for (const id of TOUCH_CONTROL_IDS) {
      const node = el('div', { class: 'tqc-editor__control', text: CONTROL_LABELS[id], attrs: { 'data-control': id, role: 'button', tabindex: '-1', 'aria-label': `${CONTROL_LABELS[id]} control` } });
      this.nodes.set(id, node);
      this.canvas.append(node);
      this.bag.listen(node, 'pointerdown', (event) => this.onDragStart(id, event));
      this.bag.listen(node, 'pointermove', (event) => this.onDragMove(event));
      this.bag.listen(node, 'pointerup', (event) => this.onDragEnd(event));
      this.bag.listen(node, 'pointercancel', (event) => this.onDragEnd(event));
    }
    this.bag.listen(window, 'resize', () => this.layout());
    this.layout();
    this.renderPanel();
  }

  /** The look stick only counts when the right-stick mode is on; the drag zone is drawn otherwise. */
  private effectiveDraft(): TouchProfile {
    const profile = structuredClone(this.draft);
    if (this.lookControl !== 'stick') profile.controls.lookStick.visible = false;
    return profile;
  }

  private layout(): void {
    this.viewport = readViewport(this.root);
    this.draft = clampProfile(this.draft);
    const { safe, width, height } = this.viewport;
    this.safeGuide.style.left = `${safe.left}px`;
    this.safeGuide.style.top = `${safe.top}px`;
    this.safeGuide.style.width = `${width - safe.left - safe.right}px`;
    this.safeGuide.style.height = `${height - safe.top - safe.bottom}px`;
    const zone = lookZoneRect(this.viewport);
    this.lookGuide.style.left = `${zone.x0}px`;
    this.lookGuide.style.top = `${zone.y0}px`;
    this.lookGuide.style.width = `${zone.x1 - zone.x0}px`;
    this.lookGuide.style.height = `${zone.y1 - zone.y0}px`;
    this.lookGuide.hidden = this.lookControl === 'stick';
    const effective = this.effectiveDraft();
    const report = checkLayout(effective, this.viewport);
    const flagged = new Set<TouchControlId>([...report.overlaps.flat(), ...report.safeViolations, ...report.lookIntrusions]);
    for (const [id, node] of this.nodes) {
      const layout = this.draft.controls[id];
      const rect = controlRect(id, layout, this.viewport);
      node.style.left = `${rect.cx}px`;
      node.style.top = `${rect.cy}px`;
      node.style.width = `${rect.d}px`;
      node.style.height = `${rect.d}px`;
      node.style.opacity = String(Math.max(0.35, layout.opacity));
      node.hidden = id === 'lookStick' && this.lookControl !== 'stick';
      toggleClass(node, 'is-selected', id === this.selected);
      toggleClass(node, 'is-overlap', flagged.has(id));
      toggleClass(node, 'is-hidden-control', !layout.visible);
    }
    setText(this.warning, describeReport(report, CONTROL_LABELS));
  }

  private renderPanel(): void {
    const layout = this.draft.controls[this.selected];
    const essential = ESSENTIAL_CONTROLS.includes(this.selected);
    const controlIds = this.lookControl === 'stick' ? TOUCH_CONTROL_IDS : TOUCH_CONTROL_IDS.filter((id) => id !== 'lookStick');
    const rows = [
      selectItem(this.focus, {
        label: 'Profile',
        values: ['phone', 'tablet'] as const,
        get: () => this.kind,
        set: (kind) => this.switchKind(kind),
        format: (v) => (v === 'phone' ? 'Phone' : 'Tablet'),
      }),
      selectItem(this.focus, {
        label: 'Look control',
        hint: 'Drag anywhere on the right half, or a visible right stick with its own position and size.',
        values: ['drag', 'stick'] as const,
        get: () => this.lookControl,
        set: (v) => this.setLookControl(v),
        format: (v) => (v === 'drag' ? 'Drag zone' : 'Right stick'),
      }),
      selectItem(this.focus, {
        label: 'Preset',
        hint: this.draft.preset === 'custom' ? 'Custom layout' : PRESETS[this.draft.preset].hint,
        values: PRESET_IDS,
        get: () => (this.draft.preset === 'custom' ? 'twoThumb' : this.draft.preset),
        set: (preset) => this.applyPreset(preset),
        format: (v) => PRESETS[v].label,
      }),
      selectItem(this.focus, {
        label: 'Control',
        hint: 'Drag any control on screen, or pick one here.',
        values: controlIds,
        get: () => this.selected,
        set: (id) => this.select(id),
        format: (v) => CONTROL_LABELS[v],
      }),
      sliderItem(this.focus, this.bag, {
        label: 'Size',
        min: SIZE_RANGE[0],
        max: SIZE_RANGE[1],
        step: 0.01,
        get: () => this.draft.controls[this.selected].size,
        set: (v) => this.edit({ size: v }),
        format: (v) => `${Math.round(v * 100)}`,
      }),
      sliderItem(this.focus, this.bag, {
        label: 'Opacity',
        min: OPACITY_RANGE[0],
        max: OPACITY_RANGE[1],
        step: 0.05,
        get: () => this.draft.controls[this.selected].opacity,
        set: (v) => this.edit({ opacity: v }),
        format: (v) => `${Math.round(v * 100)}%`,
      }),
      toggleItem(this.focus, {
        label: 'Visible',
        hint: essential ? 'Essential controls cannot be hidden.' : undefined,
        get: () => layout.visible,
        set: (v) => !essential && this.edit({ visible: v }),
      }),
      menuItem({ label: 'Save layout', onSelect: () => this.save() }),
      menuItem({ label: 'Reset this profile', danger: true, onSelect: () => this.applyPreset(this.kind === 'phone' ? 'twoThumb' : 'tablet') }),
      menuItem({ label: 'Cancel', onSelect: () => this.app.screens.pop() }),
    ];
    this.panel.replaceChildren(el('div', { class: 'tqc-eyebrow', text: `Touch layout · ${CONTROL_LABELS[this.selected]}` }), this.warning, menuList(rows, true));
    this.focus.refresh();
  }

  private setLookControl(mode: 'drag' | 'stick'): void {
    this.app.settings.update({ controls: { touchLookControl: mode } });
    if (mode === 'stick') this.draft.controls.lookStick.visible = true;
    if (mode === 'drag' && this.selected === 'lookStick') this.selected = 'fire';
    this.layout();
    this.renderPanel();
  }

  private switchKind(kind: ProfileKind): void {
    this.kind = kind;
    this.draft = structuredClone(this.app.touchProfiles[kind]);
    this.layout();
    this.renderPanel();
  }

  private applyPreset(preset: PresetId): void {
    this.draft = presetProfile(preset);
    if (this.lookControl === 'stick') this.draft.controls.lookStick.visible = true;
    this.layout();
    this.renderPanel();
  }

  private select(id: TouchControlId): void {
    this.selected = id;
    this.layout();
    this.renderPanel();
  }

  private edit(patch: Partial<TouchProfile['controls'][TouchControlId]>): void {
    Object.assign(this.draft.controls[this.selected], patch);
    this.draft.preset = 'custom';
    this.layout();
  }

  private save(): void {
    this.app.saveTouchProfile(this.kind, clampProfile(this.draft));
    this.app.toasts.show('Touch layout saved', 'info', 2);
    this.app.screens.pop();
  }

  private onDragStart(id: TouchControlId, event: PointerEvent): void {
    event.preventDefault();
    const node = this.nodes.get(id);
    if (!node || this.drag) return;
    capturePointer(node, event.pointerId);
    const rect = controlRect(id, this.draft.controls[id], this.viewport);
    this.drag = { id, pointerId: event.pointerId, offsetX: event.clientX - rect.cx, offsetY: event.clientY - rect.cy };
    if (this.selected !== id) {
      this.selected = id;
      this.renderPanel();
    }
  }

  private onDragMove(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const layout = this.draft.controls[this.drag.id];
    const next = layoutFromCentre(this.drag.id, layout, this.viewport, event.clientX - this.drag.offsetX, event.clientY - this.drag.offsetY);
    layout.x = next.x;
    layout.y = next.y;
    this.draft.preset = 'custom';
    this.layout();
  }

  private onDragEnd(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    this.drag = null;
    this.layout();
  }

  override onCancel(): boolean {
    return false;
  }
}
