import { RUN } from '@/config/gameplay';
import { CAMERA } from '@/config/gameplay';
import { clamp, wrapAngle } from '@/core/math';
import { findInteraction, performInteraction, type InteractionPrompt } from './interactions';
import { updateObjectives } from './objectives';
import { updatePlayer, type PlayerInput } from './player';
import { onNoise, updateThreats } from './threat';
import type { World } from './World';

export interface SimInput extends PlayerInput {
  lookDelta(): { x: number; y: number };
}

/**
 * Orchestrates one fixed step: look, player, threats, interactions, objectives. Owns nothing that
 * must be rendered; the render layer reads the world after each step.
 */
const HOLD_TO_INTERACT_SECONDS = 0.35;

export class Simulation {
  prompt: InteractionPrompt | null = null;
  /** Accessibility: require a short hold instead of a tap to interact. */
  holdToInteract = false;
  private interactHold = 0;
  private lastPromptLabel: string | null = null;
  private readonly offNoise: () => void;
  /** Seconds since death; drives the game-over delay. */
  deathElapsed = 0;

  constructor(readonly world: World) {
    this.offNoise = world.events.on('noise', (noise) => onNoise(world, noise));
  }

  dispose(): void {
    this.offNoise();
  }

  /**
   * Applies the Look action; called every render frame for responsiveness. Input convention:
   * `dx > 0` turns right, `dy > 0` looks down (screen Y is down). Positive pitch looks up, so the
   * vertical delta is subtracted.
   */
  applyLook(dx: number, dy: number): void {
    const look = this.world.look;
    look.yaw = wrapAngle(look.yaw - dx);
    look.pitch = clamp(look.pitch - dy, CAMERA.minPitch, CAMERA.maxPitch);
  }

  step(input: SimInput, dt: number): void {
    const world = this.world;
    world.playtimeSec += dt;
    // The prompt from the previous step decides whether a shared Jump/Interact button interacts.
    world.interactAvailable = this.prompt !== null;
    updatePlayer(world, input, dt);
    updateThreats(world, dt);
    updateObjectives(world);
    this.updatePrompt();
    if (this.wantsInteract(input, dt) && this.prompt && !world.player.isBusy) performInteraction(world, this.prompt);
    if (world.player.dead) this.deathElapsed += dt;
  }

  private wantsInteract(input: SimInput, dt: number): boolean {
    if (!this.holdToInteract) return input.justPressed('Interact');
    if (!input.isDown('Interact')) {
      this.interactHold = 0;
      return false;
    }
    this.interactHold += dt;
    if (this.interactHold < HOLD_TO_INTERACT_SECONDS) return false;
    this.interactHold = -Infinity; // fire once per hold
    return true;
  }

  get gameOverReady(): boolean {
    return this.world.player.dead && this.deathElapsed >= RUN.deathToGameOverDelay;
  }

  private updatePrompt(): void {
    const world = this.world;
    this.prompt = world.player.dead || world.player.isBusy ? null : findInteraction(world);
    const label = this.prompt ? `${this.prompt.target.verb}|${this.prompt.label}` : null;
    if (label !== this.lastPromptLabel) {
      this.lastPromptLabel = label;
      world.events.emit('interactionPromptChanged', {
        label: this.prompt ? this.prompt.label : null,
        verb: this.prompt ? this.prompt.target.verb : null,
      });
    }
  }
}
