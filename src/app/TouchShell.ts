import type { DeviceCapabilityService, DeviceSnapshot } from '@/device/DeviceCapabilityService';
import type { InputManager } from '@/input/InputManager';
import type { SourceKind } from '@/input/InputSource';
import type { ControlPolicy, TouchLookControl } from '@/persistence/settingsSchema';
import { RotateOverlay } from '@/ui/RotateOverlay';
import { TouchHud, type TouchHudState, type TouchTuning } from '@/ui/touch/TouchHud';
import { loadProfiles, saveProfiles, type ProfileKind, type TouchProfile, type TouchProfiles } from '@/ui/touch/touchProfiles';

export interface TouchVisibilityInput {
  /** Gameplay is on screen with no menu above it. */
  inGame: boolean;
  /** The device is held in portrait and the rotate overlay is up. */
  needsRotate: boolean;
  policy: ControlPolicy;
  /** Locked primary source id (when the policy is locked). */
  primarySourceId: string | null;
  touchSourceId: string;
  /** Kind of the source currently driving prompts, null before any input. */
  activeKind: SourceKind | null;
  /** Touch can happen on this device at all. */
  touchViable: boolean;
  presentation: DeviceSnapshot['presentation'];
}

/**
 * The one rule for showing on-screen controls: locked-to-touch keeps them; otherwise they follow
 * the active source, hiding as soon as a gamepad or keyboard/mouse takes over and returning on the
 * first meaningful touch. Before any input they show on handheld presentations only.
 */
export function shouldShowTouchHud(input: TouchVisibilityInput): boolean {
  if (!input.inGame || input.needsRotate || !input.touchViable) return false;
  if (input.policy === 'locked') return input.primarySourceId === input.touchSourceId;
  if (input.activeKind === 'touch') return true;
  if (input.activeKind === null) return input.presentation !== 'desktop';
  return false;
}

/**
 * Owns the touch HUD, its persisted layout profiles and the rotate-device overlay. Touch controls
 * exist whenever the device can touch; they show only during gameplay in landscape while touch is
 * the active (or locked) source.
 */
export class TouchShell {
  profiles: TouchProfiles = loadProfiles();
  hud: TouchHud | null = null;
  /** Forces the phone or tablet profile (tests and the layout editor preview). */
  kindOverride: ProfileKind | null = null;
  /** Persists that the drag-to-look hint has been used. */
  onLookHintUsed: (() => void) | null = null;
  private readonly rotate: RotateOverlay;
  private pendingTuning: TouchTuning | null = null;
  private lookControl: TouchLookControl = 'drag';
  private lookHint = false;

  constructor(
    private readonly touchLayer: HTMLElement,
    systemLayer: HTMLElement,
    private readonly input: InputManager,
    private readonly device: DeviceCapabilityService,
  ) {
    this.rotate = new RotateOverlay(systemLayer);
  }

  profileKind(): ProfileKind {
    if (this.kindOverride) return this.kindOverride;
    return this.device.get().presentation === 'tablet_or_handheld' ? 'tablet' : 'phone';
  }

  saveProfile(kind: ProfileKind, profile: TouchProfile): void {
    this.profiles = { ...this.profiles, [kind]: profile };
    saveProfiles(this.profiles);
    if (kind === this.profileKind()) this.hud?.setProfile(profile);
  }

  private touchViable(snap: DeviceSnapshot): boolean {
    return snap.maxTouchPoints > 0 || snap.anyPointerCoarse || snap.touchSeen;
  }

  /** Creates the HUD once touch is viable; re-applies the profile for the current presentation. */
  syncDevice(): void {
    const snap = this.device.get();
    if (this.touchViable(snap) && !this.hud) {
      this.hud = new TouchHud(this.touchLayer, this.input.touch, this.profiles[this.profileKind()]);
      if (this.pendingTuning) this.hud.tuning = this.pendingTuning;
      this.hud.setLookControl(this.lookControl);
      this.hud.setLookHint(this.lookHint);
      this.hud.onLookUsed = () => this.onLookHintUsed?.();
      this.input.enableTouch(true);
      if (!snap.keyboardMouseSeen && snap.presentation !== 'desktop') this.input.registry.forceActive(this.input.touch.id);
    }
    this.hud?.setProfile(this.profiles[this.profileKind()]);
  }

  /** Whether the HUD would be shown for the current sources (see `shouldShowTouchHud`). */
  wantsHud(inGame: boolean, needsRotate: boolean): boolean {
    const snap = this.device.get();
    const registry = this.input.registry;
    return shouldShowTouchHud({
      inGame,
      needsRotate,
      policy: registry.currentPolicy,
      primarySourceId: registry.primarySourceId,
      touchSourceId: this.input.touch.id,
      activeKind: registry.activeSource?.kind ?? null,
      touchViable: this.touchViable(snap),
      presentation: snap.presentation,
    });
  }

  /** Returns true when gameplay must pause because the device is held in portrait. */
  updateOverlays(hasSession: boolean, inGame: boolean): boolean {
    const snap = this.device.get();
    const handheld = snap.presentation === 'phone' || snap.presentation === 'tablet_or_handheld';
    const needsRotate = handheld && snap.orientation === 'portrait' && hasSession;
    this.rotate.setVisible(needsRotate);
    this.hud?.setVisible(this.wantsHud(inGame, needsRotate));
    return needsRotate && inGame;
  }

  update(state: TouchHudState, dt: number): void {
    this.hud?.update(state, dt);
  }

  setTuning(tuning: TouchTuning): void {
    this.pendingTuning = tuning;
    if (this.hud) this.hud.tuning = tuning;
  }

  setLookControl(mode: TouchLookControl): void {
    this.lookControl = mode;
    this.hud?.setLookControl(mode);
  }

  setLookHint(wanted: boolean): void {
    this.lookHint = wanted;
    this.hud?.setLookHint(wanted);
  }

  hide(): void {
    this.hud?.setVisible(false);
  }
}
