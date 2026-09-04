import { EventBus } from '@/core/EventBus';
import type { SettingsStore } from '@/persistence/SettingsStore';
import type { Settings } from '@/persistence/settingsSchema';
import { type Action, type AxisAction, type ButtonAction, isAxisAction } from './actions';
import { BindingStore } from './BindingStore';
import { InputFrame, type ActionSnapshot } from './InputFrame';
import type { InputSource, SourceContext } from './InputSource';
import { InputSourceRegistry } from './InputSourceRegistry';
import { KeyboardMouseSource } from './KeyboardMouseSource';
import type { PadTuning } from './GamepadSource';
import { PromptGlyphService } from './PromptGlyphService';
import { TouchSource } from './TouchSource';

export interface InputEvents extends Record<string, unknown> {
  contextChanged: { context: SourceContext };
}

const ZERO = { x: 0, y: 0 };

/** Gameplay-facing view: edges latch until a fixed step consumes them, so no press is lost. */
class GameInputView implements ActionSnapshot {
  constructor(private readonly manager: InputManager) {}

  isDown(action: Action): boolean {
    return this.manager.isDown(action) || this.manager.pendingPressed.has(action as ButtonAction);
  }

  justPressed(action: Action): boolean {
    return this.manager.pendingPressed.has(action as ButtonAction);
  }

  justReleased(action: Action): boolean {
    return this.manager.pendingReleased.has(action as ButtonAction);
  }

  axis(action: AxisAction): { x: number; y: number } {
    return this.manager.axis(action);
  }

  isEngaged(action: 'Aim' | 'Sprint'): boolean {
    return this.manager.isEngaged(action);
  }

  clearToggle(action: 'Aim' | 'Sprint'): void {
    this.manager.clearToggle(action);
  }

  lookDelta(): { x: number; y: number } {
    return this.manager.lookDelta();
  }
}

/**
 * The semantic action layer. Systems ask for actions, never for keys or buttons. Only one context
 * is active at a time: while `ui` is active no gameplay action is reported, so open menus and
 * overlays can never leak movement or fire into the world underneath.
 */
export class InputManager implements ActionSnapshot {
  readonly events = new EventBus<InputEvents>();
  readonly bindings = new BindingStore();
  readonly registry: InputSourceRegistry;
  readonly keyboardMouse: KeyboardMouseSource;
  readonly touch: TouchSource;
  readonly glyphs: PromptGlyphService;
  private context: SourceContext = 'ui';
  private current = new InputFrame();
  private previous = new InputFrame();
  private readonly toggles = new Map<ButtonAction, boolean>();
  private lookX = 0;
  private lookY = 0;
  /** Actions already held when the context switched: no edge until they are released. */
  private readonly staleDown = new Set<ButtonAction>();
  /** Edges observed since the last fixed-step consumption. */
  readonly pendingPressed = new Set<ButtonAction>();
  readonly pendingReleased = new Set<ButtonAction>();
  /** Gameplay systems read this view; UI reads the manager directly (per-frame edges). */
  readonly game: GameInputView = new GameInputView(this);

  constructor(private readonly settings: SettingsStore) {
    const s = settings.get();
    this.registry = new InputSourceRegistry(this.bindings, padTuningFrom(s));
    this.keyboardMouse = new KeyboardMouseSource(this.bindings);
    this.touch = new TouchSource();
    this.registry.register(this.keyboardMouse);
    this.glyphs = new PromptGlyphService(this.bindings, this.registry);
    this.applySettings(s);
    settings.events.on('change', ({ settings: next }) => this.applySettings(next));
  }

  dispose(): void {
    this.registry.dispose();
    this.glyphs.dispose();
  }

  get currentContext(): SourceContext {
    return this.context;
  }

  setContext(context: SourceContext): void {
    if (this.context === context) return;
    this.context = context;
    this.current.reset();
    this.previous.reset();
    this.toggles.clear();
    this.pendingPressed.clear();
    this.pendingReleased.clear();
    // Keys held through the switch (the press that opened a menu, Space on "New run") stay inert
    // until released; fresh presses after the switch are never dropped.
    this.staleDown.clear();
    for (const source of this.registry.list()) source.poll(this.current, context, 0);
    for (const action of this.current.down) this.staleDown.add(action);
    this.current.reset();
    this.events.emit('contextChanged', { context });
  }

  /** Enables the touch source (registered only when a touch presentation is in use). */
  enableTouch(enabled: boolean): void {
    const registered = this.registry.get(this.touch.id) !== null;
    if (enabled && !registered) this.registry.register(this.touch);
    if (!enabled && registered) this.registry.unregister(this.touch.id);
  }

  update(dt: number): void {
    const now = performance.now();
    this.registry.update(now);
    const swap = this.previous;
    this.previous = this.current;
    this.current = swap;
    this.current.reset();
    const contributing = this.registry.contributing();
    for (const source of contributing) source.poll(this.current, this.context, dt);
    if (!contributing.includes(this.keyboardMouse) && this.keyboardMouse.available) {
      this.keyboardMouse.pollEmergency(this.current);
    }
    this.lookX = this.current.lookDeltaX;
    this.lookY = this.current.lookDeltaY;
    for (const action of this.staleDown) {
      if (!this.current.down.has(action) || this.current.pressedNow.has(action)) this.staleDown.delete(action);
      else this.current.down.delete(action);
    }
    for (const action of this.current.down) if (!this.previous.down.has(action) || this.current.pressedNow.has(action)) this.pendingPressed.add(action);
    for (const action of this.previous.down) if (!this.current.down.has(action)) this.pendingReleased.add(action);
    this.updateToggles();
  }

  /** Called after a fixed step has read gameplay edges. */
  consumeGameEdges(): void {
    this.pendingPressed.clear();
    this.pendingReleased.clear();
  }

  isDown(action: Action): boolean {
    if (isAxisAction(action)) return false;
    return this.current.down.has(action);
  }

  justPressed(action: Action): boolean {
    if (isAxisAction(action)) return false;
    return this.current.down.has(action) && (!this.previous.down.has(action) || this.current.pressedNow.has(action));
  }

  justReleased(action: Action): boolean {
    if (isAxisAction(action)) return false;
    return !this.current.down.has(action) && this.previous.down.has(action);
  }

  axis(action: AxisAction): { x: number; y: number } {
    const axis = this.current.axes[action];
    const length = Math.hypot(axis.x, axis.y);
    if (length > 1) return { x: axis.x / length, y: axis.y / length };
    return length === 0 ? ZERO : axis;
  }

  /** Look delta for this frame in radians (already scaled by sensitivity). */
  lookDelta(): { x: number; y: number } {
    return { x: this.lookX, y: this.lookY };
  }

  /** Hold or toggle semantics for Aim and Sprint, driven by settings. */
  isEngaged(action: 'Aim' | 'Sprint'): boolean {
    const mode = action === 'Aim' ? this.settings.get().controls.aimMode : this.settings.get().controls.sprintMode;
    if (mode === 'hold') return this.isDown(action);
    return this.toggles.get(action) ?? false;
  }

  clearToggle(action: 'Aim' | 'Sprint'): void {
    this.toggles.set(action, false);
  }

  private updateToggles(): void {
    for (const action of ['Aim', 'Sprint'] as const) {
      if (this.justPressed(action)) this.toggles.set(action, !(this.toggles.get(action) ?? false));
    }
  }

  private applySettings(s: Settings): void {
    this.keyboardMouse.tuning = {
      mouseSensitivity: s.controls.mouseSensitivity,
      invertY: s.controls.invertYMouse,
      invertX: s.controls.invertX,
    };
    this.registry.setPadTuning(padTuningFrom(s));
    this.registry.setPolicy(s.controls.policy, s.controls.primarySource);
    this.touch.setTuning({ stickSensitivity: s.controls.stickSensitivity, invertY: s.controls.invertYTouch });
  }

  /** Convenience for screens: list of sources for the chooser. */
  sources(): InputSource[] {
    return this.registry.list();
  }
}

export function padTuningFrom(s: Settings): PadTuning {
  return {
    deadZoneRadial: s.controls.deadZoneRadial,
    deadZoneAxial: s.controls.deadZoneAxial,
    stickSensitivity: s.controls.stickSensitivity,
    invertY: s.controls.invertYGamepad,
    invertX: s.controls.invertX,
    glyphFamilyOverride: s.controls.glyphFamilyOverride,
    nintendoConfirm: s.controls.nintendoConfirm,
    vibration: s.controls.vibration,
  };
}
