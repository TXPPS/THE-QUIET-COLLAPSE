import { EventBus } from '@/core/EventBus';
import { DisposeBag } from '@/core/DisposeBag';
import type { ControlPolicy } from '@/persistence/settingsSchema';
import type { BindingStore } from './BindingStore';
import { GamepadSource, type PadTuning } from './GamepadSource';
import { DEFAULT_LOOK_MODIFIER, type GlyphFamily, type InputSource, type LookModifier } from './InputSource';
import { KEYBOARD_MOUSE_SOURCE_ID, TOUCH_SOURCE_ID, gamepadSourceId } from './InputSource';

const SWITCH_DEBOUNCE_MS = 220;
/** Gamepads are also read on a timer so short presses survive slow or throttled frames. */
const GAMEPAD_POLL_MS = 8;

export interface RegistryEvents extends Record<string, unknown> {
  /** The source whose glyph family drives prompts changed. */
  activeChanged: { source: InputSource | null; family: GlyphFamily };
  /** A source appeared or disappeared. */
  sourcesChanged: { sources: InputSource[] };
  /** The locked primary source went away (controller unplugged). */
  primaryLost: { source: InputSource };
  gamepadConnected: { source: GamepadSource };
  gamepadDisconnected: { source: GamepadSource };
}

/**
 * Tracks every viable input source, its recent activity, and which one currently drives prompts.
 * Policy `auto`: the most recently active source (debounced) is active and every source drives
 * gameplay. Policy `locked`: only the chosen primary drives gameplay and prompts.
 */
export class InputSourceRegistry {
  readonly events = new EventBus<RegistryEvents>();
  private readonly sources = new Map<string, InputSource>();
  private readonly gamepads = new Map<number, GamepadSource>();
  private active: InputSource | null = null;
  private policy: ControlPolicy = 'auto';
  private primaryId: string | null = null;
  private padTuning: PadTuning;
  private readonly bag = new DisposeBag();
  private padsCache: (Gamepad | null)[] = [];

  constructor(
    private readonly bindings: BindingStore,
    padTuning: PadTuning,
    private readonly lookModifier: LookModifier = DEFAULT_LOOK_MODIFIER,
  ) {
    this.padTuning = padTuning;
    this.bag.listen(window, 'gamepadconnected', (event) => this.onGamepadConnected(event.gamepad));
    this.bag.listen(window, 'gamepaddisconnected', (event) => this.onGamepadDisconnected(event.gamepad));
    this.bag.interval(() => {
      if (this.gamepads.size > 0) this.pollGamepads();
    }, GAMEPAD_POLL_MS);
  }

  dispose(): void {
    this.bag.dispose();
    for (const source of this.sources.values()) source.stop();
    this.sources.clear();
    this.gamepads.clear();
  }

  register(source: InputSource): void {
    this.sources.set(source.id, source);
    source.start();
    this.events.emit('sourcesChanged', { sources: this.list() });
  }

  unregister(id: string): void {
    const source = this.sources.get(id);
    if (!source) return;
    source.stop();
    this.sources.delete(id);
    if (this.active === source) this.setActive(this.fallbackSource());
    this.events.emit('sourcesChanged', { sources: this.list() });
  }

  get(id: string): InputSource | null {
    return this.sources.get(id) ?? null;
  }

  list(): InputSource[] {
    return Array.from(this.sources.values()).filter((source) => source.available);
  }

  listGamepads(): GamepadSource[] {
    return Array.from(this.gamepads.values()).filter((source) => source.available);
  }

  get activeSource(): InputSource | null {
    return this.active;
  }

  get activeFamily(): GlyphFamily {
    return this.active?.glyphFamily ?? 'keyboard';
  }

  get currentPolicy(): ControlPolicy {
    return this.policy;
  }

  get primarySourceId(): string | null {
    return this.primaryId;
  }

  /** Sources that contribute to gameplay this frame under the current policy. */
  contributing(): InputSource[] {
    const all = this.list();
    if (this.policy !== 'locked' || !this.primaryId) return all;
    const primary = this.sources.get(this.primaryId);
    return primary && primary.available ? [primary] : [];
  }

  setPolicy(policy: ControlPolicy, primaryId: string | null): void {
    this.policy = policy;
    this.primaryId = primaryId;
    if (policy === 'locked' && primaryId) {
      const primary = this.sources.get(primaryId);
      if (primary && primary.available) this.setActive(primary);
    }
  }

  setPadTuning(tuning: PadTuning): void {
    this.padTuning = tuning;
    for (const pad of this.gamepads.values()) pad.setTuning(tuning);
    if (this.active?.kind === 'gamepad') this.events.emit('activeChanged', { source: this.active, family: this.activeFamily });
  }

  /** Forces the active (prompt) source, e.g. after the player picks one in the chooser. */
  forceActive(id: string): void {
    const source = this.sources.get(id);
    if (source && source.available) this.setActive(source);
  }

  /** Reads gamepad snapshots and refreshes which source is active. Call once per frame. */
  update(now: number): void {
    this.pollGamepads();
    if (this.policy === 'locked') return;
    let best = this.active;
    let bestTime = best ? best.lastActivity : -Infinity;
    for (const source of this.sources.values()) {
      if (!source.available || source === best) continue;
      if (source.lastActivity > bestTime + SWITCH_DEBOUNCE_MS && now - source.lastActivity < SWITCH_DEBOUNCE_MS * 4) {
        best = source;
        bestTime = source.lastActivity;
      }
    }
    if (best !== this.active) this.setActive(best);
  }

  /** Whether more than one viable source exists (drives the chooser prompt). */
  hasMultipleSources(): boolean {
    return this.list().length > 1;
  }

  private pollGamepads(): void {
    const nav = navigator as Navigator & { getGamepads?: () => (Gamepad | null)[] };
    if (!nav.getGamepads) return;
    try {
      this.padsCache = nav.getGamepads();
    } catch {
      return;
    }
    for (let i = 0; i < this.padsCache.length; i += 1) {
      const pad = this.padsCache[i] ?? null;
      const source = this.gamepads.get(i);
      if (pad && !source) this.onGamepadConnected(pad);
      else if (pad && source) source.readPad(pad);
    }
  }

  gamepadFor(index: number): Gamepad | null {
    return this.padsCache[index] ?? null;
  }

  private onGamepadConnected(pad: Gamepad): void {
    if (this.gamepads.has(pad.index)) return;
    const source = new GamepadSource(pad.index, pad.id, pad.mapping, this.bindings, this.padTuning, this.lookModifier);
    this.gamepads.set(pad.index, source);
    this.sources.set(source.id, source);
    source.start();
    this.events.emit('gamepadConnected', { source });
    this.events.emit('sourcesChanged', { sources: this.list() });
  }

  private onGamepadDisconnected(pad: Gamepad): void {
    const source = this.gamepads.get(pad.index);
    if (!source) return;
    source.stop();
    this.gamepads.delete(pad.index);
    this.sources.delete(source.id);
    this.events.emit('gamepadDisconnected', { source });
    this.events.emit('sourcesChanged', { sources: this.list() });
    if (this.policy === 'locked' && this.primaryId === gamepadSourceId(pad.index)) {
      this.events.emit('primaryLost', { source });
    }
    if (this.active === source) this.setActive(this.fallbackSource());
  }

  private fallbackSource(): InputSource | null {
    return this.sources.get(KEYBOARD_MOUSE_SOURCE_ID) ?? this.sources.get(TOUCH_SOURCE_ID) ?? this.list()[0] ?? null;
  }

  private setActive(source: InputSource | null): void {
    if (this.active === source) return;
    this.active = source;
    this.events.emit('activeChanged', { source, family: this.activeFamily });
  }
}
