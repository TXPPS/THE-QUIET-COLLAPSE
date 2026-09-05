import type { App } from '@/app/App';
import { DIFFICULTY_ORDER, DIFFICULTY_PRESETS, resolveEnemyStats } from '@/config/enemies';
import { el } from '@/ui/dom';
import { footer, heading, menuItem, menuList, selectItem, sliderItem, toggleItem } from '@/ui/components';
import { Screen } from '@/ui/Screen';
import type { DeepPartial } from '@/persistence/SettingsStore';
import type { AudioSettings, ControlSettings } from '@/persistence/settingsSchema';

type TabId = 'game' | 'video' | 'audio' | 'controls' | 'accessibility';
const TABS: Array<[TabId, string]> = [
  ['game', 'Game'],
  ['video', 'Video'],
  ['audio', 'Audio'],
  ['controls', 'Controls'],
  ['accessibility', 'Accessibility'],
];

type NumericControl = { [K in keyof ControlSettings]: ControlSettings[K] extends number ? K : never }[keyof ControlSettings];

/** Options with tabbed groups. Each row states its consequence in the hint. */
export class OptionsScreen extends Screen {
  readonly id = 'options';
  private tab: TabId = 'video';
  private tabBar!: HTMLElement;
  private panel!: HTMLElement;

  constructor(private readonly app: App) {
    super();
    this.root.classList.add('tqc-screen--menu');
  }

  protected build(): void {
    this.tabBar = el('div', { class: 'tqc-tabs', attrs: { role: 'tablist' } });
    this.panel = el('div', { class: 'tqc-scroll', attrs: { style: 'padding-top:var(--tqc-space-4)' } });
    this.root.append(
      heading('Options', undefined, true),
      el('div', { attrs: { style: 'display:grid;grid-template-rows:auto 1fr;min-height:0' } }, [this.tabBar, this.panel]),
      footer(this.app.prompts, this.bag, [
        ['TabPrev', 'Previous'],
        ['TabNext', 'Next'],
        ['Navigate', 'Adjust'],
        ['Cancel', 'Back'],
      ]),
    );
    this.renderTabs();
    this.renderPanel();
  }

  private renderTabs(): void {
    this.tabBar.replaceChildren(
      ...TABS.map(([id, label]) => {
        const button = el('button', { class: 'tqc-tab', text: label, attrs: { type: 'button', role: 'tab', 'aria-selected': String(id === this.tab), 'data-tab': id } });
        button.addEventListener('click', () => this.switchTo(id));
        return button;
      }),
    );
  }

  private switchTo(tab: TabId): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.renderTabs();
    this.renderPanel();
    this.focus.focusFirst();
  }

  /** The selected tab id (tests and the QA overlay). */
  get currentTab(): TabId {
    return this.tab;
  }

  override onTabPrev(): void {
    const index = TABS.findIndex(([id]) => id === this.tab);
    this.switchTo(TABS[(index - 1 + TABS.length) % TABS.length]?.[0] ?? 'video');
  }

  override onTabNext(): void {
    const index = TABS.findIndex(([id]) => id === this.tab);
    this.switchTo(TABS[(index + 1) % TABS.length]?.[0] ?? 'video');
  }

  private renderPanel(): void {
    const rows =
      this.tab === 'game' ? this.gameRows() : this.tab === 'video' ? this.videoRows() : this.tab === 'audio' ? this.audioRows() : this.tab === 'controls' ? this.controlRows() : this.accessibilityRows();
    this.panel.replaceChildren(menuList(rows, true));
  }

  private gameRows(): HTMLElement[] {
    const s = this.app.settings;
    const describe = () => {
      const preset = s.get().meta.difficulty;
      const stats = resolveEnemyStats('affected', preset);
      return `${DIFFICULTY_PRESETS[preset].hint} Affected run ${stats.runSpeed.toFixed(1)} m/s, attack every ${stats.attackCooldown.toFixed(1)} s for ${stats.damage}. Applies to the next new run.`;
    };
    const row = selectItem(this.focus, {
      label: 'Difficulty',
      hint: describe(),
      values: DIFFICULTY_ORDER,
      get: () => s.get().meta.difficulty,
      set: (value) => {
        s.update({ meta: { difficulty: value } });
        const hint = row.querySelector<HTMLElement>('.tqc-item__hint');
        if (hint) hint.textContent = describe();
      },
      format: (value) => DIFFICULTY_PRESETS[value].label,
    });
    return [row];
  }

  private videoRows(): HTMLElement[] {
    const s = this.app.settings;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    return [
      selectItem(this.focus, {
        label: 'Quality',
        hint: 'Auto picks a tier from measured frame time. Lower tiers drop shadows and extra lights first.',
        values: ['auto', 'low', 'balanced', 'high'] as const,
        get: () => s.get().video.quality,
        set: (value) => s.update({ video: { quality: value } }),
        format: (v) => v.charAt(0).toUpperCase() + v.slice(1),
      }),
      sliderItem(this.focus, this.bag, { label: 'Resolution scale', hint: 'Render resolution relative to the screen.', min: 0.5, max: 1, step: 0.05, get: () => s.get().video.resolutionScale, set: (v) => s.update({ video: { resolutionScale: v } }), format: pct }),
      sliderItem(this.focus, this.bag, { label: 'Field of view', min: 45, max: 80, step: 1, get: () => s.get().video.fov, set: (v) => s.update({ video: { fov: v } }), format: (v) => `${v}°` }),
      sliderItem(this.focus, this.bag, { label: 'Brightness', min: 0.6, max: 1.6, step: 0.05, get: () => s.get().video.brightness, set: (v) => s.update({ video: { brightness: v } }), format: pct }),
      toggleItem(this.focus, { label: 'Camera shake', hint: 'Recoil and impact shake.', get: () => s.get().video.cameraShake, set: (v) => s.update({ video: { cameraShake: v } }) }),
      toggleItem(this.focus, { label: 'Show frame rate', get: () => s.get().video.showFps, set: (v) => s.update({ video: { showFps: v } }) }),
    ];
  }

  private audioRows(): HTMLElement[] {
    const s = this.app.settings;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const volume = (label: string, key: 'master' | 'ambience' | 'sfx' | 'ui') =>
      sliderItem(this.focus, this.bag, { label, min: 0, max: 1, step: 0.05, get: () => s.get().audio[key], set: (v) => s.update({ audio: { [key]: v } as DeepPartial<AudioSettings> }), format: pct });
    return [
      volume('Master volume', 'master'),
      volume('Ambience', 'ambience'),
      volume('Effects', 'sfx'),
      volume('Interface', 'ui'),
      toggleItem(this.focus, { label: 'Mute when in background', get: () => s.get().audio.muteOnFocusLoss, set: (v) => s.update({ audio: { muteOnFocusLoss: v } }) }),
      toggleItem(this.focus, { label: 'Subtitles', hint: 'Captions for spoken radio lines and significant sounds.', get: () => s.get().audio.subtitles, set: (v) => s.update({ audio: { subtitles: v } }) }),
    ];
  }

  private controlRows(): HTMLElement[] {
    const s = this.app.settings;
    const holdToggle = (label: string, key: 'aimMode' | 'sprintMode', hint?: string) =>
      selectItem(this.focus, { label, hint, values: ['hold', 'toggle'] as const, get: () => s.get().controls[key], set: (v) => s.update({ controls: { [key]: v } as DeepPartial<ControlSettings> }), format: (v) => (v === 'hold' ? 'Hold' : 'Toggle') });
    const numeric = (label: string, key: NumericControl, min: number, max: number, step: number, hint?: string, format: (v: number) => string = (v) => v.toFixed(1)) =>
      sliderItem(this.focus, this.bag, { label, hint, min, max, step, get: () => s.get().controls[key], set: (v) => s.update({ controls: { [key]: v } as DeepPartial<ControlSettings> }), format });
    return [
      menuItem({ label: 'Choose primary controls', hint: 'Pick which device drives the game, or let it follow your last input.', onSelect: () => this.app.openControlsChooser(true) }),
      menuItem({ label: 'Key and button bindings', hint: 'Keyboard, and one profile per controller family.', onSelect: () => this.app.openRemap() }),
      menuItem({ label: 'Controller test', onSelect: () => this.app.openControllerTest() }),
      menuItem({ label: 'Touch layout', hint: 'Position, size and opacity of on-screen controls.', onSelect: () => this.app.openTouchEditor() }),
      numeric('Mouse look sensitivity', 'mouseSensitivity', 0.2, 3, 0.1),
      numeric('Mouse aim multiplier', 'aimSensitivityMouse', 0.3, 2, 0.05, 'Look speed while aiming, on top of the narrower view.', (v) => `×${v.toFixed(2)}`),
      numeric('Controller look sensitivity', 'stickSensitivity', 0.2, 3, 0.1),
      numeric('Controller aim multiplier', 'aimSensitivityGamepad', 0.3, 2, 0.05, 'Look speed while aiming, on top of the narrower view.', (v) => `×${v.toFixed(2)}`),
      numeric('Touch look sensitivity', 'touchSensitivity', 0.2, 3, 0.1),
      numeric('Touch aim multiplier', 'aimSensitivityTouch', 0.3, 2, 0.05, 'Look speed while aiming, on top of the narrower view.', (v) => `×${v.toFixed(2)}`),
      toggleItem(this.focus, { label: 'Invert vertical look (mouse)', get: () => s.get().controls.invertYMouse, set: (v) => s.update({ controls: { invertYMouse: v } }) }),
      toggleItem(this.focus, { label: 'Invert vertical look (controller)', get: () => s.get().controls.invertYGamepad, set: (v) => s.update({ controls: { invertYGamepad: v } }) }),
      toggleItem(this.focus, { label: 'Invert vertical look (touch)', get: () => s.get().controls.invertYTouch, set: (v) => s.update({ controls: { invertYTouch: v } }) }),
      holdToggle('Aim', 'aimMode'),
      holdToggle('Sprint', 'sprintMode', 'Hold the stick click / key, or tap once to run until you stop.'),
      numeric('Stick dead zone', 'deadZoneRadial', 0, 0.6, 0.02, 'Radial dead zone for both sticks.', (v) => v.toFixed(2)),
      selectItem(this.focus, {
        label: 'Button prompts',
        hint: 'Override the detected controller family (also picks the binding profile).',
        values: ['auto', 'xbox', 'playstation', 'nintendo', 'generic'] as const,
        get: () => s.get().controls.glyphFamilyOverride,
        set: (v) => s.update({ controls: { glyphFamilyOverride: v } }),
        format: (v) => ({ auto: 'Detect', xbox: 'Xbox', playstation: 'PlayStation', nintendo: 'Nintendo', generic: 'Generic' })[v],
      }),
      selectItem(this.focus, {
        label: 'Nintendo confirm button',
        hint: 'Which face button confirms on Nintendo-style layouts.',
        values: ['east', 'south'] as const,
        get: () => s.get().controls.nintendoConfirm,
        set: (v) => s.update({ controls: { nintendoConfirm: v } }),
        format: (v) => (v === 'east' ? 'A (right)' : 'B (bottom)'),
      }),
      toggleItem(this.focus, { label: 'Controller vibration', get: () => s.get().controls.vibration, set: (v) => s.update({ controls: { vibration: v } }) }),
      numeric('Touch joystick dead zone', 'touchDeadZone', 0, 0.4, 0.02, undefined, (v) => v.toFixed(2)),
      numeric('Touch sprint threshold', 'touchSprintThreshold', 0.6, 1, 0.02, 'How far the joystick must be pushed before you start running.', (v) => `${Math.round(v * 100)}%`),
      toggleItem(this.focus, { label: 'Touch sprint lock', hint: 'Keep running until the joystick relaxes.', get: () => s.get().controls.touchSprintLock, set: (v) => s.update({ controls: { touchSprintLock: v } }) }),
      selectItem(this.focus, {
        label: 'Look control',
        hint: 'Drag anywhere on the right half of the screen, or use a visible right stick.',
        values: ['drag', 'stick'] as const,
        get: () => s.get().controls.touchLookControl,
        set: (v) => s.update({ controls: { touchLookControl: v } }),
        format: (v) => (v === 'drag' ? 'Drag zone' : 'Right stick'),
      }),
    ];
  }

  private accessibilityRows(): HTMLElement[] {
    const s = this.app.settings;
    return [
      selectItem(this.focus, {
        label: 'Reduced motion',
        hint: 'Limits camera shake and screen transitions.',
        values: ['system', 'on', 'off'] as const,
        get: () => s.get().accessibility.reducedMotion,
        set: (v) => s.update({ accessibility: { reducedMotion: v } }),
        format: (v) => (v === 'system' ? 'Follow system' : v === 'on' ? 'On' : 'Off'),
      }),
      sliderItem(this.focus, this.bag, { label: 'Text size', min: 0.85, max: 1.5, step: 0.05, get: () => s.get().accessibility.textScale, set: (v) => s.update({ accessibility: { textScale: v } }), format: (v) => `${Math.round(v * 100)}%` }),
      toggleItem(this.focus, { label: 'High-contrast interface', get: () => s.get().accessibility.highContrastUi, set: (v) => s.update({ accessibility: { highContrastUi: v } }) }),
      toggleItem(this.focus, { label: 'Larger HUD', get: () => s.get().accessibility.largeHud, set: (v) => s.update({ accessibility: { largeHud: v } }) }),
      toggleItem(this.focus, { label: 'Colour-safe HUD', hint: 'Condition shown with text and shape, not colour alone.', get: () => s.get().accessibility.colorSafeHud, set: (v) => s.update({ accessibility: { colorSafeHud: v } }) }),
      toggleItem(this.focus, { label: 'Hold to interact', hint: 'Use requires a short hold instead of a tap, preventing accidental pickups.', get: () => s.get().accessibility.holdToInteract, set: (v) => s.update({ accessibility: { holdToInteract: v } }) }),
      menuItem({
        label: 'Reset all settings',
        danger: true,
        onSelect: () =>
          this.app.confirm({
            title: 'Reset all settings?',
            body: 'Video, audio, controls and accessibility return to their defaults. Bindings and touch layouts are kept.',
            confirmLabel: 'Reset',
            danger: true,
            onConfirm: () => {
              s.reset();
              this.renderPanel();
              this.focus.focusFirst();
            },
          }),
      }),
    ];
  }
}
