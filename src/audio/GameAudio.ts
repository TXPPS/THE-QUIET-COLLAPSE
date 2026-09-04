import type { World } from '@/game/sim/World';
import { PLAYER } from '@/config/gameplay';
import type { AudioEngine } from './AudioEngine';
import { createAmbience, SFX, type Voice } from './synth';

const MAX_SPATIAL_VOICES = 12;
const HEARTBEAT_INTERVAL = 0.95;
const SPATIAL_REF_DISTANCE = 2;
const SPATIAL_MAX_DISTANCE = 42;

export interface CaptionSink {
  caption(text: string, seconds?: number): void;
}

/**
 * Binds simulation events to synthesised cues. Threat and impact sounds are positioned with an
 * equal-power panner (cheap on phones); footsteps follow the surface under the player.
 */
export class GameAudio {
  private readonly offs: Array<() => void> = [];
  private ambience: Voice | null = null;
  private heartbeatTimer = 0;
  private activeSpatial = 0;

  constructor(
    private readonly engine: AudioEngine,
    private readonly world: World,
    private readonly captions: CaptionSink,
    private readonly subtitles: () => boolean,
  ) {
    const e = world.events;
    this.offs.push(
      e.on('footstep', ({ surface, sprint }) => this.play(SFX.footstep, 'sfx', surface, sprint)),
      e.on('shot', () => this.play(SFX.gunshot, 'sfx')),
      e.on('dryFire', () => this.play(SFX.dryFire, 'sfx')),
      e.on('reloadStart', () => this.play(SFX.reload, 'sfx')),
      e.on('impact', ({ x, z }) => this.playAt(SFX.impact, x, z)),
      e.on('pickup', () => this.play(SFX.pickup, 'ui')),
      e.on('door', () => this.play(SFX.door, 'sfx')),
      e.on('playerHurt', () => this.play(SFX.hurt, 'sfx')),
      e.on('medkitUsed', () => this.play(SFX.heal, 'sfx')),
      e.on('checkpoint', () => this.play(SFX.checkpoint, 'ui')),
      e.on('threatVocal', ({ x, z, kind }) => this.threatVocal(x, z, kind)),
      e.on('objective', () => this.play(SFX.uiConfirm, 'ui')),
    );
  }

  start(): void {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('ambience');
    if (!ctx || !bus || this.ambience) return;
    this.ambience = createAmbience(ctx);
    this.ambience.output.connect(bus);
  }

  update(dt: number): void {
    if (!this.ambience && this.engine.isReady) this.start();
    const p = this.world.player;
    if (p.condition === 'critical' && !p.dead) {
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        this.heartbeatTimer = HEARTBEAT_INTERVAL;
        this.play(SFX.heartbeat, 'sfx');
      }
    }
    const listener = this.engine.listener;
    listener.x = p.x;
    listener.z = p.z;
    listener.fx = Math.sin(this.world.look.yaw);
    listener.fz = Math.cos(this.world.look.yaw);
  }

  private play<A extends unknown[]>(factory: (ctx: AudioContext, ...args: A) => Voice, bus: 'sfx' | 'ui' | 'ambience', ...args: A): void {
    const ctx = this.engine.ctx;
    const target = this.engine.bus(bus);
    if (!ctx || !target || !this.engine.isReady) return;
    const voice = factory(ctx, ...args);
    voice.output.connect(target);
  }

  private playAt<A extends unknown[]>(factory: (ctx: AudioContext, ...args: A) => Voice, x: number, z: number, ...args: A): void {
    const ctx = this.engine.ctx;
    const target = this.engine.bus('sfx');
    if (!ctx || !target || !this.engine.isReady || this.activeSpatial >= MAX_SPATIAL_VOICES) return;
    const voice = factory(ctx, ...args);
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = SPATIAL_REF_DISTANCE;
    panner.maxDistance = SPATIAL_MAX_DISTANCE;
    panner.rolloffFactor = 1.4;
    // Relative placement: rotate the source into listener space so the panner's default forward works.
    const l = this.engine.listener;
    const dx = x - l.x;
    const dz = z - l.z;
    const right = dx * l.fz - dz * l.fx;
    const ahead = dx * l.fx + dz * l.fz;
    panner.positionX.value = right;
    panner.positionY.value = 0;
    panner.positionZ.value = -ahead;
    voice.output.connect(panner).connect(target);
    this.activeSpatial += 1;
    window.setTimeout(() => {
      this.activeSpatial = Math.max(0, this.activeSpatial - 1);
      panner.disconnect();
    }, 1500);
  }

  private threatVocal(x: number, z: number, kind: 'idle' | 'alert' | 'attack' | 'hurt' | 'death'): void {
    const distance = Math.hypot(x - this.world.player.x, z - this.world.player.z);
    if (distance > SPATIAL_MAX_DISTANCE) return;
    this.playAt(SFX.threatVocal, x, z, kind);
    if (!this.subtitles() || distance > PLAYER.sprintNoiseRadius * 2.5) return;
    const text = kind === 'alert' ? '[a ragged shout, close]' : kind === 'attack' ? '[snarling]' : kind === 'death' ? '[a body falls]' : kind === 'hurt' ? '[a pained grunt]' : '[laboured breathing nearby]';
    this.captions.caption(text, 2.2);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.ambience?.stop();
    this.ambience = null;
  }
}
