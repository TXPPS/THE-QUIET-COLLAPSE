import type { DeviceCapabilityService } from '@/device/DeviceCapabilityService';
import type { InputManager } from '@/input/InputManager';
import type { TouchLookControl } from '@/persistence/settingsSchema';
import { RotateOverlay } from '@/ui/RotateOverlay';
import { TouchHud, type TouchHudState, type TouchTuning } from '@/ui/touch/TouchHud';
import { loadProfiles, saveProfiles, type ProfileKind, type TouchProfile, type TouchProfiles } from '@/ui/touch/touchProfiles';

/**
 * Owns the touch HUD, its persisted layout profiles and the rotate-device overlay. Touch controls
 * exist whenever the device can touch; they show only during gameplay in landscape.
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

  /** Creates the HUD once touch is viable; re-applies the profile for the current presentation. */
  syncDevice(): void {
    const snap = this.device.get();
    const viable = snap.maxTouchPoints > 0 || snap.anyPointerCoarse || snap.touchSeen;
    if (viable && !this.hud) {
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

  /** Returns true when gameplay must pause because the device is held in portrait. */
  updateOverlays(hasSession: boolean, inGame: boolean): boolean {
    const snap = this.device.get();
    const handheld = snap.presentation === 'phone' || snap.presentation === 'tablet_or_handheld';
    const needsRotate = handheld && snap.orientation === 'portrait' && hasSession;
    this.rotate.setVisible(needsRotate);
    this.hud?.setVisible(inGame && !needsRotate);
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
