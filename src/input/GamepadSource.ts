import { CAMERA } from '@/config/gameplay';
import { ACTION_META, BUTTON_ACTIONS, type AxisAction, type BindingSlot } from './actions';
import type { BindingStore } from './BindingStore';
import { PAD, PAD_AXIS, type PadBinding } from './bindings';
import { classifyGamepad, friendlyGamepadName, glyphFamilyFor, type ControllerFamily, type FamilyClassification } from './gamepadFamilies';
import type { InputFrame } from './InputFrame';
import { DEFAULT_LOOK_MODIFIER, gamepadSourceId, type GlyphFamily, type InputSource, type LookModifier, type SourceContext } from './InputSource';
import { profileFamilyFor, type PadProfileFamily } from './padProfiles';
import { isTriggerIndex, TriggerReader } from './triggers';

const ACTIVITY_MARGIN = 0.12;
const AXIS_AS_BUTTON_THRESHOLD = 0.6;

export interface PadTuning {
  deadZoneRadial: number;
  deadZoneAxial: number;
  stickSensitivity: number;
  /** Multiplier on stick look while aiming (before the field-of-view ratio). */
  aimSensitivity: number;
  invertY: boolean;
  invertX: boolean;
  glyphFamilyOverride: 'auto' | 'xbox' | 'playstation' | 'nintendo' | 'generic';
  nintendoConfirm: 'east' | 'south';
  vibration: boolean;
}

export interface RawPadState {
  /** Analog value per button index (triggers carry their normalised analog value). */
  buttons: number[];
  axes: number[];
}

/** Exponential response for stick look: fine control near centre, fast turns at the edge. */
export function lookCurve(v: number): number {
  return Math.sign(v) * v * v;
}

/** Applies a radial dead zone (magnitude) then an axial dead zone (per component) and rescales. */
export function applyDeadZones(x: number, y: number, radial: number, axial: number): { x: number; y: number } {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= radial) return { x: 0, y: 0 };
  const scale = Math.min(1, (magnitude - radial) / (1 - radial)) / magnitude;
  let outX = x * scale;
  let outY = y * scale;
  if (Math.abs(outX) < axial) outX = 0;
  if (Math.abs(outY) < axial) outY = 0;
  return { x: outX, y: outY };
}

/**
 * One source per gamepad index. Polled from the frame loop via `readPad`; browsers only update
 * `navigator.getGamepads()` snapshots between frames. Triggers are read as analog values with
 * hysteresis (axis fallback for non-standard mappings); bindings come from the profile of the
 * controller's family.
 */
export class GamepadSource implements InputSource {
  readonly id: string;
  readonly kind = 'gamepad' as const;
  label: string;
  glyphFamily: GlyphFamily;
  confidence: number;
  available = true;
  lastActivity = 0;
  tuning: PadTuning;
  classification: FamilyClassification;
  readonly raw: RawPadState = { buttons: [], axes: [] };
  readonly triggers: TriggerReader;
  onRawBinding: ((binding: PadBinding) => void) | null = null;
  private readonly prevButtons: boolean[] = [];
  private readonly pulsed = new Set<number>();
  private readonly held = new Set<number>();
  private stickCache = { x: 0, y: 0 };

  constructor(
    readonly index: number,
    readonly gamepadId: string,
    readonly mapping: string,
    private readonly bindings: BindingStore,
    tuning: PadTuning,
    private readonly lookModifier: LookModifier = DEFAULT_LOOK_MODIFIER,
  ) {
    this.id = gamepadSourceId(index);
    this.tuning = tuning;
    this.classification = classifyGamepad(gamepadId, mapping);
    this.label = friendlyGamepadName(gamepadId, this.classification);
    this.confidence = this.classification.confidence;
    this.glyphFamily = this.resolveGlyphFamily();
    this.triggers = new TriggerReader(mapping);
  }

  get family(): ControllerFamily {
    return this.classification.family;
  }

  /** The binding profile this pad reads from (follows the glyph family, override included). */
  get profileFamily(): PadProfileFamily {
    return profileFamilyFor(this.glyphFamily);
  }

  start(): void {
    /* Polling driven by the registry each frame. */
  }

  stop(): void {
    this.available = false;
    this.held.clear();
    this.pulsed.clear();
    this.triggers.reset();
  }

  setTuning(tuning: PadTuning): void {
    this.tuning = tuning;
    this.glyphFamily = this.resolveGlyphFamily();
  }

  /** Copies the latest browser snapshot; call once per frame before `poll`. */
  readPad(pad: Gamepad | null): void {
    if (!pad) {
      this.raw.buttons.length = 0;
      this.raw.axes.length = 0;
      this.held.clear();
      this.triggers.reset();
      return;
    }
    let active = false;
    const buttons = pad.buttons;
    const count = Math.max(buttons.length, PAD.r2 + 1);
    for (let i = 0; i < count; i += 1) {
      const button = buttons[i];
      let value: number;
      let pressed: boolean;
      if (isTriggerIndex(i)) {
        const sample = this.triggers.read(buttons, pad.axes, i);
        value = sample.value;
        pressed = sample.pressed;
      } else {
        value = button ? button.value : 0;
        pressed = button ? button.pressed || value > AXIS_AS_BUTTON_THRESHOLD : false;
      }
      this.raw.buttons[i] = value;
      if (pressed) {
        active = true;
        this.held.add(i);
        if (!this.prevButtons[i]) {
          this.pulsed.add(i);
          this.onRawBinding?.({ type: 'button', index: i });
        }
      } else {
        this.held.delete(i);
      }
      this.prevButtons[i] = pressed;
    }
    for (let i = 0; i < pad.axes.length; i += 1) {
      const value = pad.axes[i] ?? 0;
      this.raw.axes[i] = value;
      if (i <= PAD_AXIS.rightY && Math.abs(value) > this.tuning.deadZoneRadial + ACTIVITY_MARGIN) active = true;
    }
    if (active) this.lastActivity = performance.now();
  }

  /** Analog trigger value (0..1) for the aim and fire bindings; used by the controller test screen. */
  triggerValue(index: number): number {
    return this.raw.buttons[index] ?? 0;
  }

  poll(frame: InputFrame, context: SourceContext, dt: number): void {
    if (context === 'game') {
      const move = this.readStick('Move');
      if (move.x !== 0 || move.y !== 0) frame.addAxis('Move', move.x, -move.y);
      const look = this.readStick('Look');
      if (look.x !== 0 || look.y !== 0) {
        // Stick Y grows when pushed down, matching the Look convention (positive = look down).
        const aim = this.lookModifier.aiming ? this.tuning.aimSensitivity : 1;
        const rate = CAMERA.stickLookRateBase * this.tuning.stickSensitivity * aim * this.lookModifier.fovRatio * dt;
        frame.addLook(lookCurve(look.x) * rate * (this.tuning.invertX ? -1 : 1), lookCurve(look.y) * rate * (this.tuning.invertY ? -1 : 1));
      }
    } else {
      const nav = this.readStick('Navigate');
      const dpadX = (this.isSlotActive('Navigate.right') ? 1 : 0) - (this.isSlotActive('Navigate.left') ? 1 : 0);
      const dpadY = (this.isSlotActive('Navigate.up') ? 1 : 0) - (this.isSlotActive('Navigate.down') ? 1 : 0);
      const x = dpadX !== 0 ? dpadX : nav.x;
      const y = dpadY !== 0 ? dpadY : -nav.y;
      if (x !== 0 || y !== 0) frame.addAxis('Navigate', x, y);
    }
    for (const action of BUTTON_ACTIONS) {
      const meta = ACTION_META[action];
      if (meta.context !== 'both' && meta.context !== context) continue;
      const slot = this.remapForFamily(action, context);
      if (this.isSlotFresh(slot)) frame.pulse(action);
      else if (this.isSlotActive(slot)) frame.press(action);
    }
    this.pulsed.clear();
  }

  private padFor(slot: BindingSlot | AxisAction): PadBinding[] {
    return this.bindings.padFor(slot, this.profileFamily);
  }

  private isSlotFresh(slot: BindingSlot): boolean {
    for (const binding of this.padFor(slot)) {
      if (binding.type === 'button' && this.pulsed.has(binding.index)) return true;
    }
    return false;
  }

  /** Nintendo layouts: with the "east confirms" policy, swap Confirm/Cancel so A confirms. */
  private remapForFamily(action: BindingSlot, context: SourceContext): BindingSlot {
    if (context !== 'ui' || this.glyphFamily !== 'nintendo' || this.tuning.nintendoConfirm !== 'east') return action;
    if (action === 'Confirm') return 'Cancel';
    if (action === 'Cancel') return 'Confirm';
    return action;
  }

  private readStick(action: AxisAction): { x: number; y: number } {
    for (const binding of this.padFor(action)) {
      if (binding.type !== 'stick') continue;
      const x = this.raw.axes[binding.x] ?? 0;
      const y = this.raw.axes[binding.y] ?? 0;
      this.stickCache = applyDeadZones(x, y, this.tuning.deadZoneRadial, this.tuning.deadZoneAxial);
      return this.stickCache;
    }
    return { x: 0, y: 0 };
  }

  private isSlotActive(slot: BindingSlot): boolean {
    for (const binding of this.padFor(slot)) {
      if (binding.type === 'button' && (this.held.has(binding.index) || this.pulsed.has(binding.index))) return true;
      if (binding.type === 'axis') {
        const value = (this.raw.axes[binding.index] ?? 0) * binding.sign;
        if (value > AXIS_AS_BUTTON_THRESHOLD) return true;
      }
    }
    return false;
  }

  private resolveGlyphFamily(): GlyphFamily {
    if (this.tuning.glyphFamilyOverride !== 'auto') return this.tuning.glyphFamilyOverride;
    return glyphFamilyFor(this.classification);
  }

  async vibrate(pad: Gamepad | null, durationMs: number, strong = 0.6, weak = 0.4): Promise<boolean> {
    if (!this.tuning.vibration || !pad) return false;
    const actuator = (pad as Gamepad & { vibrationActuator?: { playEffect?: (type: string, params: object) => Promise<string> } })
      .vibrationActuator;
    if (!actuator?.playEffect) return false;
    try {
      await actuator.playEffect('dual-rumble', { duration: durationMs, strongMagnitude: strong, weakMagnitude: weak });
      return true;
    } catch {
      return false;
    }
  }
}

export { PAD, PAD_AXIS };
