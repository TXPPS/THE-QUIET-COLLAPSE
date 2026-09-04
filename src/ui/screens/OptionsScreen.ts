import type { App } from '@/app/App';
import { el } from '@/ui/dom';
import { footer, heading, menuItem, menuList, selectItem, sliderItem, toggleItem } from '@/ui/components';
import { Screen } from '@/ui/Screen';
import type { DeepPartial } from '@/persistence/SettingsStore';
import type { AudioSettings, ControlSettings } from '@/persistence/settingsSchema';

type TabId = 'video' | 'audio' | 'controls' | 'accessibility';
const TABS: Array<[TabId, string]> = [
  ['video', 'Video'],
  ['audio', 'Audio'],
  ['controls', 'Controls'],
  ['accessibility', 'Accessibility'],
];

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
        const button = el('button', { class: 'tqc-tab', text: label, attrs: { type: 'button', role: 'tab', 'aria-selected': String(id === this.tab) } });
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

  override onTabPrev(): void {
    const index = TABS.findIndex(([id]) => id === this.tab);
    this.switchTo(TABS[(index - 1 + TABS.length) % TABS.length]?.[0] ?? 'video');
  }

  override onTabNext(): void {
    const index = TABS.findIndex(([id]) => id === this.tab);
    this.switchTo(TABS[(index + 1) % TABS.length]?.[0] ?? 'video');
  }

  private renderPanel(): void {
    const rows = this.tab === 'video' ? this.videoRows() : this.tab === 'audio' ? this.audioRows() : this.tab === 'controls' ? this.controlRows() : this.accessibilityRows();
    this.panel.replaceChildren(menuList(rows, true));
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
    const holdToggle = (label: string, key: 'aimMode' | 'sprintMode') =>
      selectItem(this.focus, { label, values: ['hold', 'toggle'] as const, get: () => s.get().controls[key], set: (v) => s.update({ controls: { [key]: v } as DeepPartial<ControlSettings> }), format: (v) => (v === 'hold' ? 'Hold' : 'Toggle') });
    return [
      menuItem({ label: 'Choose primary controls', hint: 'Pick which device drives the game, or let it follow your last input.', onSelect: () => this.app.openControlsChooser(true) }),
      menuItem({ label: 'Key and button bindings', onSelect: () => this.app.openRemap() }),
      menuItem({ label: 'Controller test', onSelect: () => this.app.openControllerTest() }),
      menuItem({ label: 'Touch layout', hint: 'Position, size and opacity of on-screen controls.', onSelect: () => this.app.openTouchEditor() }),
      sliderItem(this.focus, this.bag, { label: 'Mouse sensitivity', min: 0.2, max: 3, step: 0.1, get: () => s.get().controls.mouseSensitivity, set: (v) => s.update({ controls: { mouseSensitivity: v } }), format: (v) => v.toFixed(1) }),
      sliderItem(this.focus, this.bag, { label: 'Stick / touch sensitivity', min: 0.2, max: 3, step: 0.1, get: () => s.get().controls.stickSensitivity, set: (v) => s.update({ controls: { stickSensitivity: v } }), format: (v) => v.toFixed(1) }),
      toggleItem(this.focus, { label: 'Invert vertical look', get: () => s.get().controls.invertY, set: (v) => s.update({ controls: { invertY: v } }) }),
      holdToggle('Aim', 'aimMode'),
      holdToggle('Sprint', 'sprintMode'),
      sliderItem(this.focus, this.bag, { label: 'Stick dead zone', hint: 'Radial dead zone for both sticks.', min: 0, max: 0.6, step: 0.02, get: () => s.get().controls.deadZoneRadial, set: (v) => s.update({ controls: { deadZoneRadial: v } }), format: (v) => v.toFixed(2) }),
      selectItem(this.focus, {
        label: 'Button prompts',
        hint: 'Override the detected controller family.',
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
      sliderItem(this.focus, this.bag, { label: 'Touch joystick dead zone', min: 0, max: 0.4, step: 0.02, get: () => s.get().controls.touchDeadZone, set: (v) => s.update({ controls: { touchDeadZone: v } }), format: (v) => v.toFixed(2) }),
      sliderItem(this.focus, this.bag, { label: 'Touch sprint threshold', hint: 'How far the joystick must be pushed before you start running.', min: 0.6, max: 1, step: 0.02, get: () => s.get().controls.touchSprintThreshold, set: (v) => s.update({ controls: { touchSprintThreshold: v } }), format: (v) => `${Math.round(v * 100)}%` }),
      toggleItem(this.focus, { label: 'Touch sprint lock', hint: 'Keep running until the joystick relaxes.', get: () => s.get().controls.touchSprintLock, set: (v) => s.update({ controls: { touchSprintLock: v } }) }),
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
