/**
 * Procedural sound design (PLACEHOLDER_AUDIO). Every cue is built from oscillators and filtered
 * noise at call time; no samples are shipped. Levels are conservative and restrained.
 */

export interface Voice {
  output: AudioNode;
  stop: () => void;
}

let noiseBuffer: AudioBuffer | null = null;

export function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = white * 0.6 + last * 3;
  }
  noiseBuffer = buffer;
  return buffer;
}

function envelope(ctx: AudioContext, gain: GainNode, peak: number, attack: number, decay: number, start = ctx.currentTime): void {
  gain.gain.cancelScheduledValues(start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
}

function noiseBurst(ctx: AudioContext, filterType: BiquadFilterType, frequency: number, q: number, peak: number, attack: number, decay: number): Voice {
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);
  source.loop = true;
  source.playbackRate.value = 0.8 + Math.random() * 0.4;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = ctx.createGain();
  source.connect(filter).connect(gain);
  envelope(ctx, gain, peak, attack, decay);
  source.start();
  source.stop(ctx.currentTime + attack + decay + 0.05);
  return { output: gain, stop: () => source.stop() };
}

function tone(ctx: AudioContext, type: OscillatorType, from: number, to: number, peak: number, attack: number, decay: number): Voice {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), ctx.currentTime + attack + decay);
  const gain = ctx.createGain();
  osc.connect(gain);
  envelope(ctx, gain, peak, attack, decay);
  osc.start();
  osc.stop(ctx.currentTime + attack + decay + 0.05);
  return { output: gain, stop: () => osc.stop() };
}

export const SFX = {
  footstep(ctx: AudioContext, surface: string, sprint: boolean): Voice {
    const hard = surface === 'tile' || surface === 'concrete';
    const metal = surface === 'metal';
    const gravel = surface === 'gravel';
    const freq = metal ? 1800 : hard ? 900 : gravel ? 2600 : 500;
    const peak = (sprint ? 0.22 : 0.12) * (gravel ? 1.3 : 1);
    return noiseBurst(ctx, metal ? 'bandpass' : 'lowpass', freq, metal ? 6 : 0.8, peak, 0.006, hard ? 0.09 : 0.14);
  },
  gunshot(ctx: AudioContext): Voice {
    const gain = ctx.createGain();
    const crack = noiseBurst(ctx, 'highpass', 1200, 0.7, 0.9, 0.002, 0.16);
    const body = tone(ctx, 'triangle', 160, 40, 0.7, 0.004, 0.22);
    crack.output.connect(gain);
    body.output.connect(gain);
    return { output: gain, stop: () => (crack.stop(), body.stop()) };
  },
  dryFire(ctx: AudioContext): Voice {
    return tone(ctx, 'square', 900, 300, 0.12, 0.002, 0.05);
  },
  reload(ctx: AudioContext): Voice {
    const gain = ctx.createGain();
    const a = noiseBurst(ctx, 'bandpass', 2200, 8, 0.25, 0.004, 0.06);
    a.output.connect(gain);
    window.setTimeout(() => {
      const b = noiseBurst(ctx, 'bandpass', 1500, 6, 0.3, 0.004, 0.08);
      b.output.connect(gain);
    }, 700);
    return { output: gain, stop: () => a.stop() };
  },
  impact(ctx: AudioContext): Voice {
    return noiseBurst(ctx, 'bandpass', 3000, 3, 0.25, 0.002, 0.08);
  },
  pickup(ctx: AudioContext): Voice {
    return tone(ctx, 'sine', 520, 660, 0.18, 0.01, 0.16);
  },
  door(ctx: AudioContext): Voice {
    const gain = ctx.createGain();
    const creak = tone(ctx, 'sawtooth', 90, 130, 0.08, 0.15, 0.35);
    const latch = noiseBurst(ctx, 'bandpass', 1400, 5, 0.2, 0.003, 0.07);
    creak.output.connect(gain);
    latch.output.connect(gain);
    return { output: gain, stop: () => (creak.stop(), latch.stop()) };
  },
  hurt(ctx: AudioContext): Voice {
    const gain = ctx.createGain();
    const thud = tone(ctx, 'triangle', 120, 50, 0.5, 0.005, 0.25);
    const rush = noiseBurst(ctx, 'lowpass', 500, 0.7, 0.3, 0.01, 0.4);
    thud.output.connect(gain);
    rush.output.connect(gain);
    return { output: gain, stop: () => (thud.stop(), rush.stop()) };
  },
  heal(ctx: AudioContext): Voice {
    return noiseBurst(ctx, 'highpass', 2500, 0.5, 0.12, 0.2, 0.9);
  },
  threatVocal(ctx: AudioContext, kind: 'idle' | 'alert' | 'attack' | 'hurt' | 'death'): Voice {
    const base = kind === 'alert' ? 180 : kind === 'attack' ? 210 : kind === 'death' ? 140 : 110;
    const peak = kind === 'idle' ? 0.12 : 0.3;
    const gain = ctx.createGain();
    const voice = tone(ctx, 'sawtooth', base * (0.9 + Math.random() * 0.2), base * (kind === 'death' ? 0.4 : 0.8), peak, 0.08, kind === 'idle' ? 0.9 : 0.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 2;
    const breath = noiseBurst(ctx, 'bandpass', 600, 1.5, peak * 0.6, 0.06, 0.5);
    voice.output.connect(filter).connect(gain);
    breath.output.connect(gain);
    return { output: gain, stop: () => (voice.stop(), breath.stop()) };
  },
  uiMove(ctx: AudioContext): Voice {
    return tone(ctx, 'sine', 700, 640, 0.05, 0.003, 0.04);
  },
  uiConfirm(ctx: AudioContext): Voice {
    return tone(ctx, 'sine', 520, 780, 0.08, 0.005, 0.09);
  },
  uiCancel(ctx: AudioContext): Voice {
    return tone(ctx, 'sine', 480, 300, 0.07, 0.005, 0.09);
  },
  checkpoint(ctx: AudioContext): Voice {
    const gain = ctx.createGain();
    const a = tone(ctx, 'sine', 392, 392, 0.1, 0.02, 0.5);
    const b = tone(ctx, 'sine', 587, 587, 0.06, 0.15, 0.6);
    a.output.connect(gain);
    b.output.connect(gain);
    return { output: gain, stop: () => (a.stop(), b.stop()) };
  },
  heartbeat(ctx: AudioContext): Voice {
    return tone(ctx, 'sine', 70, 45, 0.35, 0.01, 0.16);
  },
  bodyHit(ctx: AudioContext): Voice {
    return noiseBurst(ctx, 'lowpass', 700, 0.8, 0.35, 0.004, 0.12);
  },
  death(ctx: AudioContext): Voice {
    const gain = ctx.createGain();
    const drone = tone(ctx, 'sine', 90, 30, 0.4, 0.4, 2.4);
    const rush = noiseBurst(ctx, 'lowpass', 300, 0.6, 0.25, 0.3, 2.0);
    drone.output.connect(gain);
    rush.output.connect(gain);
    return { output: gain, stop: () => (drone.stop(), rush.stop()) };
  },
  ending(ctx: AudioContext): Voice {
    const gain = ctx.createGain();
    const a = tone(ctx, 'sine', 196, 196, 0.12, 0.6, 3);
    const b = tone(ctx, 'sine', 294, 294, 0.08, 1.2, 3);
    a.output.connect(gain);
    b.output.connect(gain);
    return { output: gain, stop: () => (a.stop(), b.stop()) };
  },
  click(ctx: AudioContext): Voice {
    return noiseBurst(ctx, 'bandpass', 3200, 8, 0.18, 0.002, 0.03);
  },
  rustle(ctx: AudioContext): Voice {
    return noiseBurst(ctx, 'bandpass', 1800, 1.2, 0.12, 0.02, 0.14);
  },
  whoosh(ctx: AudioContext): Voice {
    return noiseBurst(ctx, 'bandpass', 900, 0.9, 0.2, 0.05, 0.22);
  },
};

/** Continuous wind/distant-city bed built from filtered noise with slow modulation. */
export function createAmbience(ctx: AudioContext): Voice {
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 140;
  lfo.connect(lfoGain).connect(filter.frequency);
  const gain = ctx.createGain();
  gain.gain.value = 0.16;
  source.connect(filter).connect(gain);
  source.start();
  lfo.start();
  return {
    output: gain,
    stop: () => {
      source.stop();
      lfo.stop();
    },
  };
}
