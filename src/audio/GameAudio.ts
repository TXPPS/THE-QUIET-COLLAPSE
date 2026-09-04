import type { World } from '@/game/sim/World';
import { PLAYER } from '@/config/gameplay';
import type { AudioEngine } from './AudioEngine';
import type { SampleBank } from './SampleBank';
import { createAmbience, SFX, type Voice } from './synth';

const MAX_SPATIAL_VOICES = 12;
const HEARTBEAT_INTERVAL = 0.95;
const SPATIAL_REF_DISTANCE = 2;
const SPATIAL_MAX_DISTANCE = 42;
const AMBIENCE_GAIN = 0.32;
const AMBIENCE_FADE_SECONDS = 2.5;
const RADIO_RANGE = 7;
const RADIO_GAIN = 0.28;
const THREAT_STEP_GAIN = 0.4;
const SPRINT_STEP_GAIN = 1.3;

export interface CaptionSink {
  caption(text: string, seconds?: number): void;
}

type VocalKind = 'idle' | 'alert' | 'attack' | 'hurt' | 'death';

/** A cue: the sample group to prefer and the synthesised stand-in (PLACEHOLDER_AUDIO) when it is missing. */
interface Cue {
  group: string;
  gain?: number;
  rate?: number;
  fallback: (ctx: AudioContext) => Voice;
}

const VOCAL_GROUP: Record<VocalKind, string> = { idle: 'threat-idle', alert: 'threat-alert', attack: 'threat-attack', hurt: 'threat-hurt', death: 'threat-death' };

function surfaceGroup(surface: string): string {
  if (surface === 'gravel') return 'foot-gravel';
  if (surface === 'metal') return 'foot-metal';
  if (surface === 'tile' || surface === 'wood') return 'foot-wood';
  return 'foot-concrete';
}

/**
 * Binds simulation events to cues. Recorded samples (Freesound, CC0) play when decoded; every
 * cue keeps its synthesised fallback so nothing goes silent offline or before decoding. Threat
 * and impact sounds are positioned with an equal-power panner (cheap on phones); footsteps
 * follow the surface under each character; the radio hisses when the player is near it.
 */
export class GameAudio {
  private readonly offs: Array<() => void> = [];
  private ambience: Voice | null = null;
  private ambienceSynthGain: GainNode | null = null;
  private ambienceSample: AudioBufferSourceNode | null = null;
  private radio: { source: AudioBufferSourceNode; gain: GainNode; panner: PannerNode } | null = null;
  private radioRequested = false;
  private heartbeatTimer = 0;
  private activeSpatial = 0;

  constructor(
    private readonly engine: AudioEngine,
    private readonly world: World,
    private readonly samples: SampleBank | null,
    private readonly captions: CaptionSink,
    private readonly subtitles: () => boolean,
  ) {
    const e = world.events;
    this.offs.push(
      e.on('footstep', ({ surface, sprint }) => this.play({ group: surfaceGroup(surface), gain: sprint ? SPRINT_STEP_GAIN : 1, fallback: (ctx) => SFX.footstep(ctx, surface, sprint) }, 'sfx')),
      e.on('threatFootstep', ({ x, z, surface }) => this.playAt({ group: surfaceGroup(surface), gain: THREAT_STEP_GAIN, fallback: (ctx) => SFX.footstep(ctx, surface, false) }, x, z)),
      e.on('shot', () => this.play({ group: 'pistol-shot', fallback: SFX.gunshot }, 'sfx')),
      e.on('dryFire', () => this.play({ group: 'pistol-dry', fallback: SFX.dryFire }, 'sfx')),
      e.on('reloadStart', () => this.play({ group: 'pistol-reload', fallback: SFX.reload }, 'sfx')),
      e.on('impact', ({ x, z }) => this.playAt({ group: 'body-hit', gain: 0.5, rate: 1.4, fallback: SFX.impact }, x, z)),
      e.on('pickup', () => this.play({ group: 'pickup', fallback: SFX.pickup }, 'ui')),
      e.on('itemCombined', () => this.play({ group: 'medkit-use', fallback: SFX.rustle }, 'ui')),
      e.on('door', () => this.play({ group: 'door', fallback: SFX.door }, 'sfx')),
      e.on('playerHurt', () => {
        this.play({ group: 'melee-hit', fallback: SFX.hurt }, 'sfx');
        this.play({ group: 'player-hurt', fallback: SFX.rustle }, 'sfx');
      }),
      e.on('medkitUsed', () => this.play({ group: 'medkit-use', fallback: SFX.heal }, 'sfx')),
      e.on('checkpoint', () => this.play({ group: 'ui-checkpoint', fallback: SFX.checkpoint }, 'ui')),
      e.on('threatVocal', ({ x, z, kind }) => this.threatVocal(x, z, kind)),
      e.on('objective', () => this.play({ group: 'ui-confirm', fallback: SFX.uiConfirm }, 'ui')),
      e.on('threatHit', ({ x, z }) => this.playAt({ group: 'body-hit', fallback: SFX.bodyHit }, x, z)),
      e.on('playerDied', () => this.play({ group: 'player-death', fallback: SFX.death }, 'sfx')),
      e.on('ending', () => this.play({ group: 'ending', fallback: SFX.ending }, 'ambience')),
      e.on('flashlight', () => this.play({ group: 'flashlight-click', fallback: SFX.click }, 'sfx')),
      e.on('equip', () => this.play({ group: 'pickup', gain: 0.6, rate: 0.8, fallback: SFX.rustle }, 'sfx')),
      e.on('dodge', () => this.play({ group: 'dodge', fallback: SFX.whoosh }, 'sfx')),
    );
  }

  start(): void {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('ambience');
    if (!ctx || !bus || this.ambience) return;
    this.ambience = createAmbience(ctx);
    this.ambienceSynthGain = ctx.createGain();
    this.ambience.output.connect(this.ambienceSynthGain).connect(bus);
    void this.startSampledAmbience(ctx, bus);
  }

  /** The recorded night bed streams in after boot; the synth bed fades out once it is playing. */
  private async startSampledAmbience(ctx: AudioContext, bus: GainNode): Promise<void> {
    if (!this.samples) return;
    const role = this.samples.roles('ambience-night')[0];
    if (!role) return;
    const buffer = await this.samples.ensure(ctx, role);
    if (!buffer || !this.ambience) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(AMBIENCE_GAIN, ctx.currentTime + AMBIENCE_FADE_SECONDS);
    source.connect(gain).connect(bus);
    source.start();
    this.ambienceSample = source;
    this.ambienceSynthGain?.gain.setTargetAtTime(0.0001, ctx.currentTime, AMBIENCE_FADE_SECONDS / 3);
  }

  update(dt: number): void {
    if (!this.ambience && this.engine.isReady) this.start();
    const p = this.world.player;
    if (p.condition === 'critical' && !p.dead) {
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        this.heartbeatTimer = HEARTBEAT_INTERVAL;
        this.play({ group: 'heartbeat', fallback: SFX.heartbeat }, 'sfx');
      }
    }
    const listener = this.engine.listener;
    listener.x = p.x;
    listener.z = p.z;
    listener.fx = Math.sin(this.world.look.yaw);
    listener.fz = Math.cos(this.world.look.yaw);
    this.updateRadio();
  }

  /** Radio static near the save point, positioned and attenuated by distance. */
  private updateRadio(): void {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('sfx');
    if (!ctx || !bus || !this.engine.isReady || !this.samples) return;
    const radio = this.world.level.interactables.find((item) => item.kind === 'radio');
    if (!radio) return;
    const p = this.world.player;
    const distance = Math.hypot(radio.x - p.x, radio.z - p.z);
    if (distance > RADIO_RANGE) {
      if (this.radio) {
        this.radio.source.stop();
        this.radio.panner.disconnect();
        this.radio = null;
      }
      return;
    }
    if (this.radio) {
      this.placePanner(this.radio.panner, radio.x, radio.z);
      return;
    }
    if (this.radioRequested) {
      const buffer = this.samples.pick('radio-static');
      if (!buffer) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = RADIO_GAIN;
      const panner = this.spatialPanner(ctx, radio.x, radio.z);
      source.connect(gain).connect(panner).connect(bus);
      source.start();
      this.radio = { source, gain, panner };
      return;
    }
    this.radioRequested = true;
    for (const role of this.samples.roles('radio-static')) void this.samples.ensure(ctx, role);
  }

  private voice(ctx: AudioContext, cue: Cue): Voice {
    const buffer = this.samples?.pick(cue.group) ?? null;
    if (!buffer) return cue.fallback(ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = (cue.rate ?? 1) * (0.96 + Math.random() * 0.08);
    const gain = ctx.createGain();
    gain.gain.value = cue.gain ?? 1;
    source.connect(gain);
    source.start();
    return { output: gain, stop: () => source.stop() };
  }

  private play(cue: Cue, bus: 'sfx' | 'ui' | 'ambience'): void {
    const ctx = this.engine.ctx;
    const target = this.engine.bus(bus);
    if (!ctx || !target || !this.engine.isReady) return;
    this.voice(ctx, cue).output.connect(target);
  }

  private spatialPanner(ctx: AudioContext, x: number, z: number): PannerNode {
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = SPATIAL_REF_DISTANCE;
    panner.maxDistance = SPATIAL_MAX_DISTANCE;
    panner.rolloffFactor = 1.4;
    this.placePanner(panner, x, z);
    return panner;
  }

  /** Relative placement: rotate the source into listener space so the panner's default forward works. */
  private placePanner(panner: PannerNode, x: number, z: number): void {
    const l = this.engine.listener;
    const dx = x - l.x;
    const dz = z - l.z;
    panner.positionX.value = dx * l.fz - dz * l.fx;
    panner.positionY.value = 0;
    panner.positionZ.value = -(dx * l.fx + dz * l.fz);
  }

  private playAt(cue: Cue, x: number, z: number): void {
    const ctx = this.engine.ctx;
    const target = this.engine.bus('sfx');
    if (!ctx || !target || !this.engine.isReady || this.activeSpatial >= MAX_SPATIAL_VOICES) return;
    const panner = this.spatialPanner(ctx, x, z);
    this.voice(ctx, cue).output.connect(panner).connect(target);
    this.activeSpatial += 1;
    window.setTimeout(() => {
      this.activeSpatial = Math.max(0, this.activeSpatial - 1);
      panner.disconnect();
    }, 1500);
  }

  private threatVocal(x: number, z: number, kind: VocalKind): void {
    const distance = Math.hypot(x - this.world.player.x, z - this.world.player.z);
    if (distance > SPATIAL_MAX_DISTANCE) return;
    this.playAt({ group: VOCAL_GROUP[kind], gain: kind === 'idle' ? 0.6 : 1, fallback: (ctx) => SFX.threatVocal(ctx, kind) }, x, z);
    if (!this.subtitles() || distance > PLAYER.sprintNoiseRadius * 2.5) return;
    const text = kind === 'alert' ? '[a ragged shout, close]' : kind === 'attack' ? '[snarling]' : kind === 'death' ? '[a body falls]' : kind === 'hurt' ? '[a pained grunt]' : '[laboured breathing nearby]';
    this.captions.caption(text, 2.2);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.ambience?.stop();
    this.ambience = null;
    this.ambienceSample?.stop();
    this.ambienceSample = null;
    if (this.radio) {
      this.radio.source.stop();
      this.radio.panner.disconnect();
      this.radio = null;
    }
  }
}
