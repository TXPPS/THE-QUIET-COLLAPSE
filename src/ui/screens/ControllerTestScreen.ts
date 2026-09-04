import type { App } from '@/app/App';
import type { GamepadSource } from '@/input/GamepadSource';
import { applyDeadZones } from '@/input/GamepadSource';
import { el, setText } from '@/ui/dom';
import { footer, heading, menuItem, menuList, selectItem, sliderItem } from '@/ui/components';
import { Screen } from '@/ui/Screen';

const STICK_SIZE = 96;

/** Live axes/buttons, dead-zone preview, detected family, glyph override, vibration test, reset. */
export class ControllerTestScreen extends Screen {
  readonly id = 'controllerTest';
  private info!: HTMLElement;
  private buttons!: HTMLElement;
  private sticks!: HTMLCanvasElement;
  private controls!: HTMLElement;

  constructor(private readonly app: App) {
    super();
    this.root.classList.add('tqc-screen--menu');
  }

  protected build(): void {
    this.info = el('dl', { class: 'tqc-kv' });
    this.buttons = el('div', { class: 'tqc-chip-row', attrs: { 'aria-label': 'Buttons' } });
    this.sticks = el('canvas', { attrs: { width: String(STICK_SIZE * 2 + 24), height: String(STICK_SIZE), 'aria-label': 'Stick positions', role: 'img' } });
    this.controls = el('div');
    this.root.append(
      heading('Controller test', 'Controls', true),
      el('div', { class: 'tqc-columns', attrs: { style: 'padding-top:var(--tqc-space-4)' } }, [
        el('div', { class: 'tqc-panel', attrs: { style: 'display:grid;gap:var(--tqc-space-4);align-content:start' } }, [this.info, this.sticks, this.buttons]),
        this.controls,
      ]),
      footer(this.app.prompts, this.bag, [
        ['Navigate', 'Adjust'],
        ['Cancel', 'Back'],
      ]),
    );
    this.renderControls();
    this.bag.add(this.app.input.registry.events.on('sourcesChanged', () => this.renderControls()));
  }

  private pad(): GamepadSource | null {
    return this.app.input.registry.listGamepads()[0] ?? null;
  }

  private renderControls(): void {
    const s = this.app.settings;
    const pad = this.pad();
    const items = [
      sliderItem(this.focus, this.bag, { label: 'Radial dead zone', min: 0, max: 0.6, step: 0.02, get: () => s.get().controls.deadZoneRadial, set: (v) => s.update({ controls: { deadZoneRadial: v } }), format: (v) => v.toFixed(2) }),
      sliderItem(this.focus, this.bag, { label: 'Axial dead zone', min: 0, max: 0.5, step: 0.02, get: () => s.get().controls.deadZoneAxial, set: (v) => s.update({ controls: { deadZoneAxial: v } }), format: (v) => v.toFixed(2) }),
      selectItem(this.focus, {
        label: 'Button prompts',
        values: ['auto', 'xbox', 'playstation', 'nintendo', 'generic'] as const,
        get: () => s.get().controls.glyphFamilyOverride,
        set: (v) => s.update({ controls: { glyphFamilyOverride: v } }),
        format: (v) => ({ auto: 'Detect', xbox: 'Xbox', playstation: 'PlayStation', nintendo: 'Nintendo', generic: 'Generic' })[v],
      }),
      menuItem({
        label: 'Test vibration',
        disabled: !pad,
        onSelect: () => {
          const source = this.pad();
          if (!source) return;
          void source.vibrate(this.app.input.registry.gamepadFor(source.index), 400).then((ok) => this.app.toasts.show(ok ? 'Vibration sent' : 'Vibration not supported here', ok ? 'info' : 'warning', 2));
        },
      }),
      menuItem({ label: 'Reset controller settings', danger: true, onSelect: () => s.update({ controls: { deadZoneRadial: 0.18, deadZoneAxial: 0.1, glyphFamilyOverride: 'auto', vibration: true } }) }),
    ];
    this.controls.replaceChildren(menuList(items, true));
    this.focus.refresh();
  }

  override update(): void {
    const pad = this.pad();
    const s = this.app.settings.get().controls;
    if (!pad) {
      this.info.replaceChildren(el('dt', { text: 'Status' }), el('dd', { text: 'No controller detected. Connect one and press any button.' }));
      this.buttons.replaceChildren();
      this.drawSticks([0, 0, 0, 0], s.deadZoneRadial, s.deadZoneAxial);
      return;
    }
    this.info.replaceChildren(
      el('dt', { text: 'Detected' }),
      el('dd', { text: pad.label }),
      el('dt', { text: 'Family' }),
      el('dd', { text: `${pad.family} (${Math.round(pad.confidence * 100)}%) → ${pad.glyphFamily} prompts` }),
      el('dt', { text: 'Mapping' }),
      el('dd', { text: pad.mapping || 'non-standard' }),
      el('dt', { text: 'Raw id' }),
      el('dd', { text: pad.gamepadId }),
    );
    const chips = pad.raw.buttons.map((value, index) => {
      const chip = el('span', { class: 'tqc-glyph', text: String(index) });
      if (value > 0.5) chip.style.background = 'var(--tqc-focus)';
      if (value > 0.5) chip.style.color = 'var(--tqc-bg)';
      return chip;
    });
    this.buttons.replaceChildren(...chips);
    this.drawSticks(pad.raw.axes, s.deadZoneRadial, s.deadZoneAxial);
  }

  private drawSticks(axes: number[], radial: number, axial: number): void {
    const ctx = this.sticks.getContext('2d');
    if (!ctx) return;
    const { width, height } = this.sticks;
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < 2; i += 1) {
      const cx = STICK_SIZE / 2 + i * (STICK_SIZE + 24);
      const cy = STICK_SIZE / 2;
      const r = STICK_SIZE / 2 - 2;
      ctx.strokeStyle = '#5b5952';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#8a3a2c';
      ctx.beginPath();
      ctx.arc(cx, cy, r * radial, 0, Math.PI * 2);
      ctx.stroke();
      const rawX = axes[i * 2] ?? 0;
      const rawY = axes[i * 2 + 1] ?? 0;
      const filtered = applyDeadZones(rawX, rawY, radial, axial);
      ctx.fillStyle = '#5b5952';
      ctx.beginPath();
      ctx.arc(cx + rawX * r, cy + rawY * r, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e6dcc3';
      ctx.beginPath();
      ctx.arc(cx + filtered.x * r, cy + filtered.y * r, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    setText(this.sticks, '');
  }
}
