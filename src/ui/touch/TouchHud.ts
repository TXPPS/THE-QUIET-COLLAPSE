import { DisposeBag } from '@/core/DisposeBag';
import type { ButtonAction } from '@/input/actions';
import type { TouchSource } from '@/input/TouchSource';
import type { TouchLookControl } from '@/persistence/settingsSchema';
import { el, setHidden, toggleClass, capturePointer } from '@/ui/dom';
import { lookHintNode, touchIconNode } from './touchIcons';
import { placeControl, placeZone, publishTopCluster, readViewport } from './touchHudLayout';
import { controlRect, lookZoneRect, moveZoneRect, type ControlRect, type TouchControlId, type TouchProfile, type Viewport } from './touchLayout';

export { readViewport } from './touchHudLayout';
import { CONTROL_LABELS } from './touchPresets';
import { PointerOwners, stickVector } from './touchStick';

const STICK_SPRINT_HOLD_SECONDS = 0.35;
/** Show/hide fade; no pointer is accepted while it runs. */
export const TOUCH_HUD_FADE_MS = 150;
/** Movement before the first-use look hint is considered understood. */
const LOOK_HINT_DISMISS_PX = 8;
const KNOB_TRAVEL = 0.6;

export interface TouchTuning {
  /** Radial dead zone of both sticks (fraction of the radius). */
  deadZone: number;
  /** Deflection at which sprint engages. */
  sprintThreshold: number;
  /** Keep sprinting until the stick relaxes (true) or only while at the edge (false). */
  sprintLock: boolean;
}

export const DEFAULT_TOUCH_TUNING: TouchTuning = { deadZone: 0.12, sprintThreshold: 0.92, sprintLock: true };

/** Contextual state: only actions valid right now get a button. */
export interface TouchHudState {
  fireVisible: boolean;
  canReload: boolean;
  hasFlashlight: boolean;
  promptVisible: boolean;
}

const BUTTON_ACTIONS: Partial<Record<TouchControlId, ButtonAction>> = {
  fire: 'Fire',
  fireLeft: 'Fire',
  aim: 'Aim',
  reload: 'Reload',
  interact: 'Interact',
  sprint: 'Sprint',
  dodge: 'Dodge',
  jump: 'Jump',
  swap: 'SwapItem',
  flashlight: 'Flashlight',
  pause: 'Pause',
  inventory: 'Inventory',
  map: 'Map',
};

/** Buttons that latch when tapped instead of requiring a hold (aim stays engaged until tapped again). */
const LATCHING: ReadonlySet<TouchControlId> = new Set(['aim']);
const OWNER_MOVE = 'joystick';
const OWNER_LOOK = 'look';
const OWNER_LOOK_STICK = 'lookStick';

interface ButtonEntry {
  id: TouchControlId;
  element: HTMLButtonElement;
  action: ButtonAction;
  latched: boolean;
  /** Visible in the profile (before contextual rules). */
  enabled: boolean;
  rect: ControlRect;
}

/**
 * On-screen touch controls. Every control owns at most one pointer id through a shared registry,
 * so a finger that started on a button can never drive the look zone and vice versa. Pointer
 * capture keeps each finger with its control; everything releases on pointerup, pointercancel,
 * lostpointercapture, blur and visibility loss so no move, look or fire state can stick.
 */
export class TouchHud {
  readonly root: HTMLElement;
  tuning: TouchTuning = { ...DEFAULT_TOUCH_TUNING };
  /** Called the first time the player drags to look (dismisses the hint for good). */
  onLookUsed: (() => void) | null = null;
  private readonly bag = new DisposeBag();
  private readonly owners = new PointerOwners();
  private readonly moveZone: HTMLElement;
  private readonly lookZone: HTMLElement;
  private readonly lookHint: HTMLElement;
  private readonly stick: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly lookStick: HTMLElement;
  private readonly lookKnob: HTMLElement;
  private readonly buttons = new Map<TouchControlId, ButtonEntry>();
  private profile: TouchProfile;
  private viewport: Viewport = { width: 1, height: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
  private lookControl: TouchLookControl = 'drag';
  private hintWanted = false;
  private gameplayActive = false;
  private stickOrigin = { x: 0, y: 0 };
  private stickRadius = 60;
  private lookStickRect: ControlRect = { cx: 0, cy: 0, d: 1, r: 0.5 };
  private sprintHold = 0;
  private sprintLatched = false;
  private lookLast = { x: 0, y: 0 };
  private lookTravel = 0;
  private shown = false;
  private fadeTimer: number | null = null;
  /** False while fading in or out: pointers are ignored until the fade completes. */
  private inputEnabled = false;

  constructor(
    layer: HTMLElement,
    private readonly source: TouchSource,
    profile: TouchProfile,
  ) {
    this.profile = profile;
    this.knob = el('div', { class: 'tqc-touch__knob' });
    this.stick = el('div', { class: 'tqc-touch__stick tqc-touch__stick--move', attrs: { 'aria-hidden': 'true' } }, [this.knob]);
    this.lookKnob = el('div', { class: 'tqc-touch__knob' });
    this.lookStick = el('div', { class: 'tqc-touch__stick tqc-touch__stick--look', attrs: { 'aria-label': CONTROL_LABELS.lookStick, role: 'application', 'data-touch-control': 'lookStick' } }, [this.lookKnob]);
    this.lookHint = el('div', { class: 'tqc-touch__look-hint', attrs: { 'aria-hidden': 'true' } }, [lookHintNode(), el('span', { text: 'Drag to look' })]);
    this.moveZone = el('div', { class: 'tqc-touch__zone tqc-touch__zone--move', attrs: { 'aria-label': 'Movement joystick area', role: 'application' } });
    this.lookZone = el('div', { class: 'tqc-touch__zone tqc-touch__zone--look', attrs: { 'aria-label': 'Look area', role: 'application' } }, [this.lookHint]);
    this.root = el('div', { class: 'tqc-touch', attrs: { 'aria-label': 'Touch controls' } }, [this.moveZone, this.lookZone, this.stick, this.lookStick]);
    layer.append(this.root);
    for (const [id, action] of Object.entries(BUTTON_ACTIONS) as Array<[TouchControlId, ButtonAction]>) this.createButton(id, action);
    this.bindZones();
    this.bag.listen(window, 'blur', () => this.releaseAll());
    this.bag.listen(document, 'visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
    this.bag.listen(window, 'resize', () => this.layout());
    this.layout();
    setHidden(this.root, true);
    document.documentElement.dataset['touchHud'] = 'false';
  }

  setProfile(profile: TouchProfile): void {
    this.profile = profile;
    this.layout();
  }

  setLookControl(mode: TouchLookControl): void {
    if (this.lookControl === mode) return;
    this.lookControl = mode;
    this.releaseLook();
    this.releaseLookStick();
    this.layout();
  }

  /** Shows the subtle first-use hint in the drag zone until the player has dragged once. */
  setLookHint(wanted: boolean): void {
    this.hintWanted = wanted;
    this.updateHint();
  }

  /**
   * Shows or hides with a short fade. Hiding releases every pointer at once (a stick that was being
   * held stops driving movement immediately) and no input is accepted during either fade.
   */
  setVisible(visible: boolean): void {
    if (visible === this.shown) return;
    this.shown = visible;
    this.gameplayActive = visible;
    document.documentElement.dataset['touchHud'] = String(visible);
    if (this.fadeTimer !== null) window.clearTimeout(this.fadeTimer);
    this.inputEnabled = false;
    this.root.classList.add('is-fading');
    if (visible) {
      setHidden(this.root, false);
      this.root.classList.remove('is-hidden');
      this.fadeTimer = window.setTimeout(() => this.finishFade(), TOUCH_HUD_FADE_MS);
    } else {
      this.releaseAll();
      this.root.classList.add('is-hidden');
      this.fadeTimer = window.setTimeout(() => this.finishFade(), TOUCH_HUD_FADE_MS);
    }
    this.updateHint();
  }

  private finishFade(): void {
    this.fadeTimer = null;
    this.root.classList.remove('is-fading');
    if (this.shown) this.inputEnabled = true;
    else setHidden(this.root, true);
  }

  /** True once the show fade has finished and pointers are accepted. */
  get acceptsInput(): boolean {
    return this.inputEnabled;
  }

  get isShown(): boolean {
    return this.shown;
  }

  /** Contextual visibility: only actions valid for the current state are shown. */
  update(state: TouchHudState, dt: number): void {
    this.show('fire', state.fireVisible);
    this.show('fireLeft', state.fireVisible);
    this.show('reload', state.fireVisible && state.canReload);
    this.show('flashlight', state.hasFlashlight);
    this.show('interact', state.promptVisible);
    this.updateSprint(dt);
  }

  /** Pointer ids currently owned, keyed by control (tests and the QA overlay). */
  get ownedPointers(): ReadonlyMap<number, string> {
    return this.owners.entries();
  }

  private show(id: TouchControlId, on: boolean): void {
    const entry = this.buttons.get(id);
    if (!entry) return;
    const visible = on && entry.enabled;
    setHidden(entry.element, !visible);
    if (!visible) this.releaseButton(entry);
  }

  private createButton(id: TouchControlId, action: ButtonAction): void {
    const element = el('button', {
      class: `tqc-touch__btn${id === 'fire' || id === 'fireLeft' || id === 'aim' ? ' tqc-touch__btn--primary' : ''}`,
      attrs: { type: 'button', 'aria-label': CONTROL_LABELS[id], 'data-touch-control': id },
    });
    const icon = touchIconNode(id);
    if (icon) element.append(icon);
    element.append(el('span', { text: CONTROL_LABELS[id] }));
    const entry: ButtonEntry = { id, element, action, latched: false, enabled: true, rect: { cx: 0, cy: 0, d: 1, r: 0.5 } };
    this.buttons.set(id, entry);
    this.root.append(element);
    this.bag.listen(element, 'pointerdown', (event) => this.onButtonDown(entry, event));
    this.bag.listen(element, 'pointerup', (event) => this.onButtonUp(entry, event));
    this.bag.listen(element, 'pointercancel', (event) => this.onButtonUp(entry, event));
    this.bag.listen(element, 'lostpointercapture', (event) => this.onButtonUp(entry, event));
    this.bag.listen(element, 'contextmenu', (event) => event.preventDefault());
  }

  private onButtonDown(entry: ButtonEntry, event: PointerEvent): void {
    if (!this.inputEnabled || entry.element.hidden) return;
    if (this.owners.pointerOf(entry.id) !== null || !this.owners.claim(event.pointerId, entry.id)) return;
    event.preventDefault();
    event.stopPropagation();
    capturePointer(entry.element, event.pointerId);
    entry.element.classList.add('is-down');
    this.source.markActivity();
    if (LATCHING.has(entry.id)) {
      entry.latched = !entry.latched;
      toggleClass(entry.element, 'is-latched', entry.latched);
      if (entry.latched) this.source.hold(entry.action);
      else this.source.release(entry.action);
      return;
    }
    this.source.hold(entry.action);
  }

  private onButtonUp(entry: ButtonEntry, event: PointerEvent): void {
    if (this.owners.ownerOf(event.pointerId) !== entry.id) return;
    this.owners.release(event.pointerId, entry.id);
    entry.element.classList.remove('is-down');
    if (!LATCHING.has(entry.id)) this.source.release(entry.action);
  }

  private releaseButton(entry: ButtonEntry): void {
    const pointerId = this.owners.pointerOf(entry.id);
    if (pointerId !== null) this.owners.release(pointerId, entry.id);
    entry.element.classList.remove('is-down');
    if (!LATCHING.has(entry.id)) this.source.release(entry.action);
  }

  private bindZones(): void {
    const zones: Array<[HTMLElement, (e: PointerEvent) => void, (e: PointerEvent) => void, (e: PointerEvent) => void]> = [
      [this.moveZone, (e) => this.onStickDown(e), (e) => this.onStickMove(e), (e) => this.onStickUp(e)],
      [this.lookZone, (e) => this.onLookDown(e), (e) => this.onLookMove(e), (e) => this.onLookUp(e)],
      [this.lookStick, (e) => this.onLookStickDown(e), (e) => this.onLookStickMove(e), (e) => this.onLookStickUp(e)],
    ];
    for (const [zone, down, move, up] of zones) {
      this.bag.listen(zone, 'pointerdown', down);
      this.bag.listen(zone, 'pointermove', move);
      this.bag.listen(zone, 'pointerup', up);
      this.bag.listen(zone, 'pointercancel', up);
      this.bag.listen(zone, 'lostpointercapture', up);
      this.bag.listen(zone, 'contextmenu', (event) => event.preventDefault());
    }
  }

  /** True when a point lies on a visible button's hit circle (the look zone must never start there). */
  private hitsButton(x: number, y: number): boolean {
    for (const entry of this.buttons.values()) {
      if (entry.element.hidden) continue;
      if (Math.hypot(entry.rect.cx - x, entry.rect.cy - y) <= entry.rect.r) return true;
    }
    return this.lookControl === 'stick' && Math.hypot(this.lookStickRect.cx - x, this.lookStickRect.cy - y) <= this.lookStickRect.r;
  }

  /* ---------- move stick ---------- */

  private onStickDown(event: PointerEvent): void {
    if (!this.inputEnabled || this.owners.pointerOf(OWNER_MOVE) !== null) return;
    if (this.hitsButton(event.clientX, event.clientY) || !this.owners.claim(event.pointerId, OWNER_MOVE)) return;
    event.preventDefault();
    capturePointer(this.moveZone, event.pointerId);
    const rect = controlRect('joystick', this.profile.controls.joystick, this.viewport);
    // Floating joystick: it appears where the thumb lands inside the movement zone.
    this.stickOrigin = { x: event.clientX, y: event.clientY };
    this.stickRadius = rect.r;
    this.stick.style.left = `${this.stickOrigin.x}px`;
    this.stick.style.top = `${this.stickOrigin.y}px`;
    this.stick.classList.add('is-active');
    this.source.markActivity();
    this.updateStick(event.clientX, event.clientY);
  }

  private onStickMove(event: PointerEvent): void {
    if (this.owners.ownerOf(event.pointerId) !== OWNER_MOVE) return;
    this.updateStick(event.clientX, event.clientY);
  }

  private onStickUp(event: PointerEvent): void {
    if (this.owners.ownerOf(event.pointerId) !== OWNER_MOVE) return;
    this.owners.release(event.pointerId, OWNER_MOVE);
    this.releaseMove();
  }

  private releaseMove(): void {
    const pointerId = this.owners.pointerOf(OWNER_MOVE);
    if (pointerId !== null) this.owners.release(pointerId, OWNER_MOVE);
    this.source.setMove(0, 0);
    this.stick.classList.remove('is-active', 'is-sprint');
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.sprintHold = 0;
    this.sprintLatched = false;
    this.source.release('Sprint');
    this.placeSticksAtRest();
  }

  private updateStick(clientX: number, clientY: number): void {
    const v = stickVector(clientX - this.stickOrigin.x, clientY - this.stickOrigin.y, this.stickRadius, this.tuning.deadZone);
    this.source.setMove(v.x, v.y === 0 ? 0 : -v.y);
    this.knob.style.transform = `translate(calc(-50% + ${v.x * this.stickRadius * KNOB_TRAVEL}px), calc(-50% + ${v.y * this.stickRadius * KNOB_TRAVEL}px))`;
  }

  /** Pushing the stick past the threshold for a moment engages sprint; it stays engaged until the stick relaxes. */
  private updateSprint(dt: number): void {
    if (this.owners.pointerOf(OWNER_MOVE) === null) return;
    const magnitude = Math.hypot(this.source.moveX, this.source.moveY);
    const releaseBelow = this.tuning.sprintLock ? 0.5 : this.tuning.sprintThreshold - 0.08;
    if (magnitude >= this.tuning.sprintThreshold) {
      this.sprintHold += dt;
      if (!this.sprintLatched && this.sprintHold >= STICK_SPRINT_HOLD_SECONDS) {
        this.sprintLatched = true;
        this.source.hold('Sprint');
        this.stick.classList.add('is-sprint');
      }
    } else if (magnitude < releaseBelow && this.sprintLatched) {
      this.sprintLatched = false;
      this.sprintHold = 0;
      this.source.release('Sprint');
      this.stick.classList.remove('is-sprint');
    } else if (!this.sprintLatched) {
      this.sprintHold = 0;
    }
  }

  /* ---------- drag-to-look zone ---------- */

  private onLookDown(event: PointerEvent): void {
    if (!this.inputEnabled || this.lookControl !== 'drag' || this.owners.pointerOf(OWNER_LOOK) !== null) return;
    if (this.hitsButton(event.clientX, event.clientY) || !this.owners.claim(event.pointerId, OWNER_LOOK)) return;
    event.preventDefault();
    capturePointer(this.lookZone, event.pointerId);
    this.lookLast = { x: event.clientX, y: event.clientY };
    this.lookTravel = 0;
    this.source.markActivity();
  }

  private onLookMove(event: PointerEvent): void {
    if (this.owners.ownerOf(event.pointerId) !== OWNER_LOOK) return;
    const dx = event.clientX - this.lookLast.x;
    const dy = event.clientY - this.lookLast.y;
    this.lookLast = { x: event.clientX, y: event.clientY };
    this.source.addLook(dx, dy);
    if (this.hintWanted) {
      this.lookTravel += Math.abs(dx) + Math.abs(dy);
      if (this.lookTravel >= LOOK_HINT_DISMISS_PX) {
        this.hintWanted = false;
        this.updateHint();
        this.onLookUsed?.();
      }
    }
  }

  private onLookUp(event: PointerEvent): void {
    if (this.owners.ownerOf(event.pointerId) !== OWNER_LOOK) return;
    this.owners.release(event.pointerId, OWNER_LOOK);
  }

  private releaseLook(): void {
    const pointerId = this.owners.pointerOf(OWNER_LOOK);
    if (pointerId !== null) this.owners.release(pointerId, OWNER_LOOK);
  }

  private updateHint(): void {
    toggleClass(this.lookHint, 'is-visible', this.hintWanted && this.gameplayActive && this.lookControl === 'drag');
  }

  /* ---------- optional right look stick ---------- */

  private onLookStickDown(event: PointerEvent): void {
    if (!this.inputEnabled || this.lookControl !== 'stick' || this.owners.pointerOf(OWNER_LOOK_STICK) !== null) return;
    if (!this.owners.claim(event.pointerId, OWNER_LOOK_STICK)) return;
    event.preventDefault();
    event.stopPropagation();
    capturePointer(this.lookStick, event.pointerId);
    this.lookStick.classList.add('is-active');
    this.source.markActivity();
    this.updateLookStick(event.clientX, event.clientY);
  }

  private onLookStickMove(event: PointerEvent): void {
    if (this.owners.ownerOf(event.pointerId) !== OWNER_LOOK_STICK) return;
    this.updateLookStick(event.clientX, event.clientY);
  }

  private onLookStickUp(event: PointerEvent): void {
    if (this.owners.ownerOf(event.pointerId) !== OWNER_LOOK_STICK) return;
    this.owners.release(event.pointerId, OWNER_LOOK_STICK);
    this.releaseLookStick();
  }

  private releaseLookStick(): void {
    const pointerId = this.owners.pointerOf(OWNER_LOOK_STICK);
    if (pointerId !== null) this.owners.release(pointerId, OWNER_LOOK_STICK);
    this.source.setLookStick(0, 0);
    this.lookStick.classList.remove('is-active');
    this.lookKnob.style.transform = 'translate(-50%, -50%)';
  }

  private updateLookStick(clientX: number, clientY: number): void {
    const { cx, cy, r } = this.lookStickRect;
    const v = stickVector(clientX - cx, clientY - cy, r, this.tuning.deadZone);
    this.source.setLookStick(v.x, v.y);
    this.lookKnob.style.transform = `translate(calc(-50% + ${v.x * r * KNOB_TRAVEL}px), calc(-50% + ${v.y * r * KNOB_TRAVEL}px))`;
  }

  /* ---------- lifecycle ---------- */

  /** Releases every pointer-held state (window blur, tab hidden, OS gesture interruption). */
  releaseAll(): void {
    this.owners.clear();
    this.sprintHold = 0;
    this.sprintLatched = false;
    this.stick.classList.remove('is-active', 'is-sprint');
    this.lookStick.classList.remove('is-active');
    this.lookKnob.style.transform = 'translate(-50%, -50%)';
    for (const entry of this.buttons.values()) {
      entry.latched = false;
      entry.element.classList.remove('is-down', 'is-latched');
    }
    this.source.clear();
    this.placeSticksAtRest();
  }

  private placeSticksAtRest(): void {
    placeControl(this.stick, controlRect('joystick', this.profile.controls.joystick, this.viewport), this.profile.controls.joystick.opacity);
    this.stick.classList.add('is-fixed');
    const look = this.profile.controls.lookStick;
    this.lookStickRect = controlRect('lookStick', look, this.viewport);
    placeControl(this.lookStick, this.lookStickRect, look.opacity);
    setHidden(this.lookStick, !(this.lookControl === 'stick' && look.visible));
  }

  /** Positions every control and both zones from the profile, viewport and safe-area insets. */
  layout(): void {
    this.viewport = readViewport(this.root);
    placeZone(this.moveZone, moveZoneRect(this.viewport));
    placeZone(this.lookZone, lookZoneRect(this.viewport));
    for (const entry of this.buttons.values()) {
      const layout = this.profile.controls[entry.id];
      entry.rect = controlRect(entry.id, layout, this.viewport);
      entry.enabled = layout.visible;
      placeControl(entry.element, entry.rect, layout.opacity);
      setHidden(entry.element, !layout.visible);
    }
    this.placeSticksAtRest();
    publishTopCluster(this.buttons.values(), this.viewport);
  }

  dispose(): void {
    if (this.fadeTimer !== null) window.clearTimeout(this.fadeTimer);
    this.releaseAll();
    this.bag.dispose();
    this.root.remove();
  }
}

