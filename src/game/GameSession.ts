import { RUN } from '@/config/gameplay';
import { countItem, itemDef, type ItemId } from '@/game/items/registry';
import { CANON } from '@/config/canon';
import type { DocumentDef, LevelData } from '@/game/level/types';
import type { InputManager } from '@/input/InputManager';
import type { SaveSystem } from '@/persistence/SaveSystem';
import type { SettingsStore } from '@/persistence/SettingsStore';
import type { GameView } from '@/render/GameView';
import type { Renderer } from '@/render/Renderer';
import type { Hud } from '@/ui/hud/Hud';
import type { Toasts } from '@/ui/Toasts';
import { Simulation } from './sim/Simulation';
import type { RunState } from './sim/types';
import { World } from './sim/World';

export interface SessionHost {
  onGameOver(): void;
  onEnding(): void;
  onDocument(document: DocumentDef): void;
  onSaveRequest(): void;
}

export interface SessionDeps {
  level: LevelData;
  /** True when the player asked for reduced motion (setting or system preference). */
  reducedMotion: () => boolean;
  runState: RunState;
  slot: number;
  input: InputManager;
  settings: SettingsStore;
  saves: SaveSystem<RunState>;
  renderer: Renderer;
  toasts: Toasts;
  hud: Hud;
  createView: (world: World) => GameView;
  host: SessionHost;
}

/**
 * One run of the game. Owns the world, the simulation, the view and HUD bindings; everything is
 * created in the constructor and released in `dispose`, so a restart never leaks state.
 */
export class GameSession {
  readonly world: World;
  readonly sim: Simulation;
  readonly view: GameView;
  slot: number;
  paused = false;
  private readonly offs: Array<() => void> = [];
  private gameOverSent = false;
  private endingSent = false;
  private endingTimer = 0;

  constructor(private readonly deps: SessionDeps) {
    this.slot = deps.slot;
    this.world = new World(deps.level, deps.runState);
    this.sim = new Simulation(this.world);
    this.view = deps.createView(this.world);
    this.bindEvents();
    const objective = this.world.currentObjective();
    if (objective) deps.hud.showObjective(objective.label, RUN.objectiveToastSeconds * 1.5);
  }

  private bindEvents(): void {
    const { hud, toasts, host } = this.deps;
    const events = this.world.events;
    this.offs.push(
      events.on('objective', ({ label }) => {
        hud.showObjective(label);
      }),
      events.on('checkpoint', () => {
        if (this.save('checkpoint')) toasts.show('Checkpoint saved', 'info', RUN.autosaveToastSeconds);
      }),
      events.on('pickup', ({ label, item, amount }) => {
        const suffix = item === 'rounds' ? ` ×${amount}` : '';
        toasts.show(`${label}${suffix}`, 'info', 2.2);
      }),
      events.on('message', ({ text }) => hud.showMessage(text)),
      events.on('document', ({ document }) => host.onDocument(document)),
      events.on('saveRequest', () => host.onSaveRequest()),
      events.on('ending', () => {
        this.endingTimer = RUN.endingFadeDelay;
      }),
      events.on('playerHurt', () => hud.flashDamage()),
      events.on('interactionPromptChanged', ({ verb, label }) => hud.setPrompt(verb, label)),
      events.on('flashlight', ({ on }) => hud.showMessage(on ? 'Flashlight on' : 'Flashlight off', 1.2)),
      events.on('quickItemChanged', ({ item }) => hud.showMessage(`Quick item: ${itemDef(item as ItemId).name}`, 1.4)),
    );
  }

  /** Persists the current world into the session's slot. */
  save(reason: 'checkpoint' | 'manual'): boolean {
    const objective = this.world.currentObjective();
    return this.deps.saves.save(
      this.slot,
      {
        playtimeSec: Math.round(this.world.playtimeSec),
        objectiveLabel: this.world.completed ? 'Run complete' : (objective?.label ?? ''),
        locationLabel: reason === 'manual' ? CANON.shelterLabel : this.checkpointLabel(),
        difficulty: this.world.difficulty,
        checkpointId: this.world.checkpointId,
      },
      this.world.toRunState(),
    );
  }

  private checkpointLabel(): string {
    switch (this.world.checkpointId) {
      case 'street':
        return 'Ferry Street';
      case 'route4_south':
        return 'Route 4, south of the wreck';
      case 'plaza':
        return 'Crossing plaza';
      default:
        return CANON.startLocationLabel;
    }
  }

  fixedUpdate(dt: number): void {
    if (this.paused) return;
    this.sim.holdToInteract = this.deps.settings.get().accessibility.holdToInteract;
    this.sim.step(this.deps.input.game, dt);
    // Run-time delays tick in simulation time so slow frames never stretch them.
    if (this.endingTimer > 0) this.endingTimer -= dt;
  }

  update(dt: number, alpha: number, fps: number | null): void {
    const { input, settings, hud, host } = this.deps;
    const s = settings.get();
    if (!this.paused && !this.world.player.dead) {
      const look = input.lookDelta();
      if (look.x !== 0 || look.y !== 0) this.sim.applyLook(look.x, look.y);
    }
    this.view.update(dt, alpha, { baseFov: s.video.fov, shakeEnabled: s.video.cameraShake && !this.deps.reducedMotion() });
    const p = this.world.player;
    // Look scaling for the next frame: the aim multiplier gate and the narrowed field of view.
    input.setLookModifier(this.view.cameraRig.fovRatio, p.aiming && !p.dead);
    hud.update(
      {
        health: p.health,
        stamina: p.stamina,
        condition: p.condition,
        sprinting: p.sprinting,
        ammoLoaded: p.ammoLoaded,
        ammoReserve: p.ammoReserve,
        equipped: p.equipped,
        medkits: p.medkits,
        hasFlashlight: p.hasFlashlight,
        flashlightOn: p.flashlightOn,
        aiming: p.aiming,
        aimBlend: this.view.cameraRig.aimBlend,
        quickItem: itemDef(p.quickItem).name,
        quickItemCount: countItem(p, p.quickItem),
        reloading: p.reloadTimer > 0,
        usingMedkit: p.medkitTimer > 0,
        dead: p.dead,
        mouseHint: !this.paused && input.registry.activeFamily === 'keyboard' && !input.keyboardMouse.isPointerLocked,
        fps: s.video.showFps ? fps : null,
      },
      dt,
    );
    if (this.world.endingReached && this.endingTimer <= 0 && !this.endingSent) {
      this.endingSent = true;
      host.onEnding();
    }
    if (this.sim.gameOverReady && !this.gameOverSent) {
      this.gameOverSent = true;
      host.onGameOver();
    }
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.view.dispose();
    this.sim.dispose();
    this.world.dispose();
    this.deps.hud.setPrompt(null, null);
  }
}
