import { PLAYER, RUN } from '@/config/gameplay';
import { DisposeBag } from '@/core/DisposeBag';
import { el, setHidden, setText, toggleClass } from '@/ui/dom';
import type { Prompts } from '@/ui/Prompts';
import { svgNode } from '@/ui/touch/touchIcons';

/** Original silhouettes for the equipped-item slot (handgun, first-aid pack). */
const ITEM_ICONS = {
  pistol: '<path d="M2 4h26v6h-5l-3 9h-7l3-9H2z"/><path d="M4 5h22" stroke="rgba(0,0,0,0.6)" stroke-width="1"/>',
  medkit: '<rect x="3" y="4" width="26" height="16" rx="2"/><path d="M16 8v8M12 12h8" stroke="#0b0c0d" stroke-width="2.6" fill="none"/>',
} as const;

export interface HudModel {
  health: number;
  stamina: number;
  condition: 'fine' | 'hurt' | 'critical';
  sprinting: boolean;
  ammoLoaded: number;
  ammoReserve: number;
  equipped: 'pistol' | 'medkit';
  medkits: number;
  hasFlashlight: boolean;
  flashlightOn: boolean;
  aiming: boolean;
  /** 0..1 aim blend; the crosshair fades in with it. */
  aimBlend: number;
  /** Quick-slot medical item and how many are carried. */
  quickItem: string;
  quickItemCount: number;
  reloading: boolean;
  usingMedkit: boolean;
  dead: boolean;
  mouseHint: boolean;
  fps: number | null;
}

/** Gameplay HUD: only justified information, updated by diffing values to avoid DOM churn. */
export class Hud {
  readonly root: HTMLElement;
  private readonly bag = new DisposeBag();
  private readonly condition: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly staminaBar: HTMLElement;
  private readonly staminaFill: HTMLElement;
  private readonly itemName: HTMLElement;
  private readonly itemIcon: HTMLElement;
  private itemIconKind: 'pistol' | 'medkit' | null = null;
  private readonly ammo: HTMLElement;
  private readonly status: HTMLElement;
  private readonly medkitsNode: HTMLElement;
  private readonly flashlightNode: HTMLElement;
  private readonly objective: HTMLElement;
  private readonly objectiveLabel: HTMLElement;
  private readonly message: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly promptVerb: HTMLElement;
  private readonly promptLabel: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly damage: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly fps: HTMLElement;
  private readonly caption: HTMLElement;
  private captionTimer = 0;
  private objectiveTimer = 0;
  private messageTimer = 0;
  private hitTimer = 0;
  private lastStaminaVisible = false;

  constructor(layer: HTMLElement, prompts: Prompts) {
    this.condition = el('div', { class: 'tqc-hud__condition', text: 'Condition' });
    this.healthFill = el('div', { class: 'tqc-hud__bar-fill' });
    this.staminaFill = el('div', { class: 'tqc-hud__bar-fill' });
    this.staminaBar = el('div', { class: 'tqc-hud__bar tqc-hud__bar--stamina', attrs: { role: 'presentation' } }, [this.staminaFill]);
    const vitals = el('div', { class: 'tqc-hud__vitals', attrs: { role: 'status', 'aria-live': 'off' } }, [
      this.condition,
      el('div', { class: 'tqc-hud__bar', attrs: { role: 'presentation' } }, [this.healthFill]),
      this.staminaBar,
    ]);
    this.itemName = el('div', { class: 'tqc-hud__item-name', text: 'Pistol' });
    this.itemIcon = el('div', { class: 'tqc-hud__item-icon', attrs: { 'aria-hidden': 'true' } });
    this.ammo = el('div', { class: 'tqc-hud__ammo' });
    this.status = el('div', { class: 'tqc-hud__status' });
    this.medkitsNode = el('span', { text: 'First-aid kit ×0' });
    this.flashlightNode = el('span', { text: 'Light' });
    const item = el('div', { class: 'tqc-hud__item' }, [
      this.itemIcon,
      this.itemName,
      this.ammo,
      this.status,
      el('div', { class: 'tqc-hud__secondary' }, [this.medkitsNode, this.flashlightNode]),
    ]);
    this.objectiveLabel = el('div', { class: 'tqc-hud__objective-label' });
    this.objective = el('div', { class: 'tqc-hud__objective', attrs: { 'aria-live': 'polite' } }, [
      el('div', { class: 'tqc-hud__objective-eyebrow', text: 'Objective' }),
      this.objectiveLabel,
    ]);
    this.message = el('div', { class: 'tqc-hud__message', attrs: { 'aria-live': 'polite' } });
    const [chip, release] = prompts.chip('Interact');
    this.bag.add(release);
    this.promptVerb = el('span', { class: 'tqc-hud__prompt-verb' });
    this.promptLabel = el('span');
    this.prompt = el('div', { class: 'tqc-hud__prompt' }, [chip, this.promptVerb, this.promptLabel]);
    this.crosshair = el('div', { class: 'tqc-hud__crosshair', attrs: { 'aria-hidden': 'true' } });
    this.damage = el('div', { class: 'tqc-hud__damage', attrs: { 'aria-hidden': 'true' } });
    this.hint = el('div', { class: 'tqc-hud__hint', text: 'Click the view to capture the mouse' });
    this.fps = el('div', { class: 'tqc-hud__fps' });
    this.caption = el('div', { class: 'tqc-hud__caption', attrs: { 'aria-live': 'polite' } });
    this.root = el('div', { class: 'tqc-hud', attrs: { 'aria-label': 'Heads-up display' } }, [
      el('div', { class: 'tqc-hud__vignette', attrs: { 'aria-hidden': 'true' } }),
      this.damage,
      vitals,
      item,
      this.objective,
      this.message,
      this.prompt,
      this.crosshair,
      this.hint,
      this.fps,
      this.caption,
    ]);
    layer.append(this.root);
  }

  /** Subtitle line for significant sounds; separate from objective and system messages. */
  showCaption(text: string, seconds = 2): void {
    setText(this.caption, text);
    this.caption.classList.add('is-visible');
    this.captionTimer = seconds;
  }

  setVisible(visible: boolean): void {
    setHidden(this.root, !visible);
  }

  setDimmed(dimmed: boolean): void {
    toggleClass(this.root, 'is-dimmed', dimmed);
  }

  showObjective(label: string, seconds: number = RUN.objectiveToastSeconds): void {
    setText(this.objectiveLabel, label);
    this.objective.classList.add('is-visible');
    this.objectiveTimer = seconds;
  }

  showMessage(text: string, seconds = 4): void {
    setText(this.message, text);
    this.message.classList.add('is-visible');
    this.messageTimer = seconds;
  }

  setPrompt(verb: string | null, label: string | null): void {
    const visible = verb !== null && label !== null;
    toggleClass(this.prompt, 'is-visible', visible);
    if (visible) {
      setText(this.promptVerb, verb);
      setText(this.promptLabel, label);
    }
  }

  flashDamage(): void {
    this.hitTimer = 0.25;
    this.damage.classList.add('is-hit');
  }

  update(model: HudModel, dt: number): void {
    this.condition.dataset['condition'] = model.condition;
    setText(this.condition, model.condition === 'fine' ? 'Condition · Fine' : model.condition === 'hurt' ? 'Condition · Hurt' : 'Condition · Critical');
    this.healthFill.style.width = `${Math.round((model.health / PLAYER.maxHealth) * 100)}%`;
    const staminaVisible = model.stamina < PLAYER.maxStamina - 0.5 || model.sprinting;
    if (staminaVisible !== this.lastStaminaVisible) {
      this.lastStaminaVisible = staminaVisible;
      toggleClass(this.staminaBar, 'is-visible', staminaVisible);
    }
    this.staminaFill.style.width = `${Math.round((model.stamina / PLAYER.maxStamina) * 100)}%`;
    this.setItemIcon(model.equipped);
    if (model.equipped === 'pistol') {
      setText(this.itemName, 'Pistol');
      this.ammo.textContent = '';
      this.ammo.append(document.createTextNode(String(model.ammoLoaded)), el('small', { text: ` / ${model.ammoReserve}` }));
      toggleClass(this.ammo, 'is-empty', model.ammoLoaded === 0 && model.ammoReserve === 0);
    } else {
      setText(this.itemName, 'First aid');
      setText(this.ammo, `×${model.medkits}`);
      toggleClass(this.ammo, 'is-empty', model.medkits === 0);
    }
    setText(this.status, model.reloading ? 'Reloading' : model.usingMedkit ? 'Applying dressing' : model.ammoLoaded === 0 && model.equipped === 'pistol' && model.ammoReserve > 0 ? 'Reload' : '');
    setText(this.medkitsNode, `${model.quickItem} ×${model.quickItemCount}`);
    toggleClass(this.medkitsNode, 'is-empty', model.quickItemCount === 0);
    setHidden(this.flashlightNode, !model.hasFlashlight);
    toggleClass(this.flashlightNode, 'is-on', model.flashlightOn);
    const aim = model.dead ? 0 : model.aimBlend;
    toggleClass(this.crosshair, 'is-visible', aim > 0.02);
    this.crosshair.style.opacity = String(aim > 0.02 ? aim : 0);
    toggleClass(this.crosshair, 'is-busy', model.reloading || model.usingMedkit);
    toggleClass(this.damage, 'is-critical', model.condition === 'critical' && !model.dead);
    setHidden(this.hint, !model.mouseHint);
    if (model.fps !== null) setText(this.fps, `${Math.round(model.fps)} fps`);
    setHidden(this.fps, model.fps === null);
    this.tickTimers(dt);
  }

  private setItemIcon(kind: 'pistol' | 'medkit'): void {
    if (this.itemIconKind === kind) return;
    this.itemIconKind = kind;
    const icon = svgNode(ITEM_ICONS[kind], '0 0 32 22');
    this.itemIcon.replaceChildren(...(icon ? [icon] : []));
  }

  private tickTimers(dt: number): void {
    if (this.objectiveTimer > 0) {
      this.objectiveTimer -= dt;
      if (this.objectiveTimer <= 0) this.objective.classList.remove('is-visible');
    }
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message.classList.remove('is-visible');
    }
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.damage.classList.remove('is-hit');
    }
    if (this.captionTimer > 0) {
      this.captionTimer -= dt;
      if (this.captionTimer <= 0) this.caption.classList.remove('is-visible');
    }
  }

  dispose(): void {
    this.bag.dispose();
    this.root.remove();
  }
}
