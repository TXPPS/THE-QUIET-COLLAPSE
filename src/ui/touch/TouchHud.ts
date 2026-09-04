import { DisposeBag } from '@/core/DisposeBag';
import type { ButtonAction } from '@/input/actions';
import type { TouchSource } from '@/input/TouchSource';
import { el, setHidden, toggleClass } from '@/ui/dom';
import { touchIconSvg } from './touchIcons';
import { CONTROL_LABELS, controlRect, type TouchControlId, type TouchProfile, type Viewport } from './touchProfiles';

const STICK_SPRINT_THRESHOLD = 0.92;
const STICK_SPRINT_HOLD_SECONDS = 0.35;
const LOOK_PIXELS_TO_UNITS = 1;

export interface TouchHudState {
  equippedPistol: boolean;
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
  swap: 'SwapItem',
  flashlight: 'Flashlight',
  pause: 'Pause',
  inventory: 'Inventory',
  map: 'Map',
};

/** Buttons that latch when tapped instead of requiring a hold (aim stays engaged until tapped again). */
const LATCHING: ReadonlySet<TouchControlId> = new Set(['aim']);

interface ButtonEntry {
  id: TouchControlId;
  element: HTMLButtonElement;
  action: ButtonAction;
  pointerId: number | null;
  latched: boolean;
}

/**
 * On-screen touch controls. One pointer per control, pointer capture on every button, and a full
 * release on pointercancel, blur and visibility loss so no move or fire state can ever stick.
 */
export class TouchHud {
  readonly root: HTMLElement;
  private readonly bag = new DisposeBag();
  private readonly moveZone: HTMLElement;
  private readonly lookZone: HTMLElement;
  private readonly stick: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly buttons = new Map<TouchControlId, ButtonEntry>();
  private profile: TouchProfile;
  private viewport: Viewport = { width: 1, height: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
  private stickPointer: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private stickRadius = 60;
  private sprintHold = 0;
  private sprintLatched = false;
  private lookPointer: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private gameplayActive = false;

  constructor(
    layer: HTMLElement,
    private readonly source: TouchSource,
    profile: TouchProfile,
  ) {
    this.profile = profile;
    this.knob = el('div', { class: 'tqc-touch__knob' });
    this.stick = el('div', { class: 'tqc-touch__stick', attrs: { 'aria-hidden': 'true' } }, [this.knob]);
    this.moveZone = el('div', { class: 'tqc-touch__zone tqc-touch__zone--move', attrs: { 'aria-label': 'Movement joystick area', role: 'application' } });
    this.lookZone = el('div', { class: 'tqc-touch__zone tqc-touch__zone--look', attrs: { 'aria-label': 'Look area', role: 'application' } });
    this.root = el('div', { class: 'tqc-touch', attrs: { 'aria-label': 'Touch controls' } }, [this.moveZone, this.lookZone, this.stick]);
    layer.append(this.root);
    for (const [id, action] of Object.entries(BUTTON_ACTIONS) as Array<[TouchControlId, ButtonAction]>) this.createButton(id, action);
    this.bindZones();
    this.bag.listen(window, 'blur', () => this.releaseAll());
    this.bag.listen(document, 'visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
    this.bag.listen(window, 'resize', () => this.layout());
    this.layout();
    this.setVisible(false);
  }

  setProfile(profile: TouchProfile): void {
    this.profile = profile;
    this.layout();
  }

  setVisible(visible: boolean): void {
    this.gameplayActive = visible;
    setHidden(this.root, !visible);
    if (!visible) this.releaseAll();
  }

  /** Contextual visibility: only actions valid for the current state are shown. */
  update(state: TouchHudState, dt: number): void {
    const show = (id: TouchControlId, on: boolean) => {
      const entry = this.buttons.get(id);
      if (entry) setHidden(entry.element, !on || !this.profile.controls[id].visible);
    };
    show('fire', state.equippedPistol);
    show('fireLeft', state.equippedPistol);
    show('reload', state.equippedPistol && state.canReload);
    show('flashlight', state.hasFlashlight);
    const interact = this.buttons.get('interact');
    if (interact) toggleClass(interact.element, 'is-hinted', state.promptVisible);
    this.updateSprint(dt);
  }

  private createButton(id: TouchControlId, action: ButtonAction): void {
    const element = el('button', {
      class: `tqc-touch__btn${id === 'fire' || id === 'aim' ? ' tqc-touch__btn--primary' : ''}`,
      attrs: { type: 'button', 'aria-label': CONTROL_LABELS[id], 'data-touch-control': id },
    });
    element.innerHTML = touchIconSvg(id);
    element.append(el('span', { text: CONTROL_LABELS[id] }));
    const entry: ButtonEntry = { id, element, action, pointerId: null, latched: false };
    this.buttons.set(id, entry);
    this.root.append(element);
    this.bag.listen(element, 'pointerdown', (event) => this.onButtonDown(entry, event));
    this.bag.listen(element, 'pointerup', (event) => this.onButtonUp(entry, event));
    this.bag.listen(element, 'pointercancel', (event) => this.onButtonUp(entry, event));
    this.bag.listen(element, 'lostpointercapture', (event) => this.onButtonUp(entry, event));
    this.bag.listen(element, 'contextmenu', (event) => event.preventDefault());
  }

  private onButtonDown(entry: ButtonEntry, event: PointerEvent): void {
    if (entry.pointerId !== null) return;
    event.preventDefault();
    entry.pointerId = event.pointerId;
    entry.element.setPointerCapture(event.pointerId);
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
    if (entry.pointerId !== event.pointerId) return;
    entry.pointerId = null;
    entry.element.classList.remove('is-down');
    if (!LATCHING.has(entry.id)) this.source.release(entry.action);
  }

  private bindZones(): void {
    this.bag.listen(this.moveZone, 'pointerdown', (event) => this.onStickDown(event));
    this.bag.listen(this.moveZone, 'pointermove', (event) => this.onStickMove(event));
    this.bag.listen(this.moveZone, 'pointerup', (event) => this.onStickUp(event));
    this.bag.listen(this.moveZone, 'pointercancel', (event) => this.onStickUp(event));
    this.bag.listen(this.moveZone, 'lostpointercapture', (event) => this.onStickUp(event));
    this.bag.listen(this.lookZone, 'pointerdown', (event) => this.onLookDown(event));
    this.bag.listen(this.lookZone, 'pointermove', (event) => this.onLookMove(event));
    this.bag.listen(this.lookZone, 'pointerup', (event) => this.onLookUp(event));
    this.bag.listen(this.lookZone, 'pointercancel', (event) => this.onLookUp(event));
    this.bag.listen(this.lookZone, 'lostpointercapture', (event) => this.onLookUp(event));
    for (const zone of [this.moveZone, this.lookZone]) this.bag.listen(zone, 'contextmenu', (event) => event.preventDefault());
  }

  private onStickDown(event: PointerEvent): void {
    if (this.stickPointer !== null || !this.gameplayActive) return;
    event.preventDefault();
    this.stickPointer = event.pointerId;
    this.moveZone.setPointerCapture(event.pointerId);
    const rect = controlRect(this.profile.controls.joystick, this.viewport);
    // Floating joystick: it appears where the thumb lands inside the movement zone.
    this.stickOrigin = { x: event.clientX, y: event.clientY };
    this.stickRadius = rect.d / 2;
    this.stick.style.left = `${this.stickOrigin.x}px`;
    this.stick.style.top = `${this.stickOrigin.y}px`;
    this.stick.classList.add('is-active');
    this.source.markActivity();
    this.updateStick(event.clientX, event.clientY);
  }

  private onStickMove(event: PointerEvent): void {
    if (event.pointerId !== this.stickPointer) return;
    this.updateStick(event.clientX, event.clientY);
  }

  private onStickUp(event: PointerEvent): void {
    if (event.pointerId !== this.stickPointer) return;
    this.stickPointer = null;
    this.source.setMove(0, 0);
    this.stick.classList.remove('is-active', 'is-sprint');
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.sprintHold = 0;
    this.sprintLatched = false;
    this.source.release('Sprint');
    this.placeStickAtRest();
  }

  private updateStick(clientX: number, clientY: number): void {
    const dx = clientX - this.stickOrigin.x;
    const dy = clientY - this.stickOrigin.y;
    const distance = Math.hypot(dx, dy);
    const clamped = Math.min(1, distance / this.stickRadius);
    const nx = distance > 0 ? (dx / distance) * clamped : 0;
    const ny = distance > 0 ? (dy / distance) * clamped : 0;
    this.source.setMove(nx, -ny);
    this.knob.style.transform = `translate(calc(-50% + ${nx * this.stickRadius * 0.6}px), calc(-50% + ${ny * this.stickRadius * 0.6}px))`;
  }

  /** Pushing the stick to its edge for a moment engages sprint; it stays engaged until the stick relaxes. */
  private updateSprint(dt: number): void {
    if (this.stickPointer === null) return;
    const magnitude = Math.hypot(this.source.moveX, this.source.moveY);
    if (magnitude >= STICK_SPRINT_THRESHOLD) {
      this.sprintHold += dt;
      if (!this.sprintLatched && this.sprintHold >= STICK_SPRINT_HOLD_SECONDS) {
        this.sprintLatched = true;
        this.source.hold('Sprint');
        this.stick.classList.add('is-sprint');
      }
    } else if (magnitude < 0.5 && this.sprintLatched) {
      this.sprintLatched = false;
      this.sprintHold = 0;
      this.source.release('Sprint');
      this.stick.classList.remove('is-sprint');
    } else if (!this.sprintLatched) {
      this.sprintHold = 0;
    }
  }

  private onLookDown(event: PointerEvent): void {
    if (this.lookPointer !== null || !this.gameplayActive) return;
    event.preventDefault();
    this.lookPointer = event.pointerId;
    this.lookZone.setPointerCapture(event.pointerId);
    this.lookLast = { x: event.clientX, y: event.clientY };
    this.source.markActivity();
  }

  private onLookMove(event: PointerEvent): void {
    if (event.pointerId !== this.lookPointer) return;
    const dx = (event.clientX - this.lookLast.x) * LOOK_PIXELS_TO_UNITS;
    const dy = (event.clientY - this.lookLast.y) * LOOK_PIXELS_TO_UNITS;
    this.lookLast = { x: event.clientX, y: event.clientY };
    this.source.addLook(dx, dy);
  }

  private onLookUp(event: PointerEvent): void {
    if (event.pointerId !== this.lookPointer) return;
    this.lookPointer = null;
  }

  /** Releases every pointer-held state (window blur, tab hidden, OS gesture interruption). */
  releaseAll(): void {
    this.stickPointer = null;
    this.lookPointer = null;
    this.sprintHold = 0;
    this.sprintLatched = false;
    this.stick.classList.remove('is-active', 'is-sprint');
    for (const entry of this.buttons.values()) {
      entry.pointerId = null;
      entry.latched = false;
      entry.element.classList.remove('is-down', 'is-latched');
    }
    this.source.clear();
    this.placeStickAtRest();
  }

  private placeStickAtRest(): void {
    const rect = controlRect(this.profile.controls.joystick, this.viewport);
    this.stick.style.left = `${rect.cx}px`;
    this.stick.style.top = `${rect.cy}px`;
    this.stick.style.width = `${rect.d}px`;
    this.stick.style.height = `${rect.d}px`;
    this.stick.style.opacity = String(this.profile.controls.joystick.opacity);
    this.stick.classList.add('is-fixed');
  }

  /** Positions every control from the profile for the current viewport and safe-area insets. */
  layout(): void {
    this.viewport = readViewport(this.root);
    for (const entry of this.buttons.values()) {
      const layout = this.profile.controls[entry.id];
      const rect = controlRect(layout, this.viewport);
      const element = entry.element;
      element.style.left = `${rect.cx}px`;
      element.style.top = `${rect.cy}px`;
      element.style.width = `${rect.d}px`;
      element.style.height = `${rect.d}px`;
      element.style.opacity = String(layout.opacity);
      setHidden(element, !layout.visible);
    }
    this.placeStickAtRest();
  }

  dispose(): void {
    this.releaseAll();
    this.bag.dispose();
    this.root.remove();
  }
}

/** Reads the safe-area insets applied through CSS variables on the root element. */
export function readViewport(root: HTMLElement): Viewport {
  const style = getComputedStyle(document.documentElement);
  const inset = (name: string) => parseFloat(style.getPropertyValue(name)) || 0;
  return {
    width: root.clientWidth || window.innerWidth,
    height: root.clientHeight || window.innerHeight,
    safe: { top: inset('--tqc-safe-top'), right: inset('--tqc-safe-right'), bottom: inset('--tqc-safe-bottom'), left: inset('--tqc-safe-left') },
  };
}
