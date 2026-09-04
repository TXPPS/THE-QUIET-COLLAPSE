import type { AssetLibrary } from '@/assets/AssetLibrary';
import { assetFile, assetKeys } from '@/assets/manifest';

const AUDIO_PREFIX = 'audio.';

/**
 * Decoded Freesound cues by role. Roles ending in a number form a variation group
 * (`foot-concrete-1..4` → `foot-concrete`) and `pick` rotates through them without repeats.
 * Precached cues decode right after the first user gesture; long beds decode on request.
 */
export class SampleBank {
  private readonly decoded = new Map<string, AudioBuffer>();
  private readonly pending = new Map<string, Promise<AudioBuffer | null>>();
  private readonly groups = new Map<string, string[]>();
  private readonly lastPick = new Map<string, string>();

  constructor(private readonly assets: AssetLibrary) {
    for (const key of assetKeys(AUDIO_PREFIX)) {
      const role = key.slice(AUDIO_PREFIX.length);
      const group = groupOf(role);
      const list = this.groups.get(group) ?? [];
      list.push(role);
      this.groups.set(group, list);
    }
  }

  /** True when at least one variation of the group is decoded and ready to play. */
  has(group: string): boolean {
    return (this.groups.get(group) ?? []).some((role) => this.decoded.has(role));
  }

  /** Decodes every precached cue (short, ~1 MB in total); streamed beds are left for `ensure`. */
  async decodePrecached(ctx: AudioContext): Promise<void> {
    const jobs: Promise<unknown>[] = [];
    for (const roles of this.groups.values()) {
      for (const role of roles) if (assetFile(`${AUDIO_PREFIX}${role}`).precache) jobs.push(this.ensure(ctx, role));
    }
    await Promise.all(jobs);
  }

  /** Fetches (network or service-worker cache) and decodes one role; memoised, null on failure. */
  ensure(ctx: AudioContext, role: string): Promise<AudioBuffer | null> {
    const ready = this.decoded.get(role);
    if (ready) return Promise.resolve(ready);
    let job = this.pending.get(role);
    if (!job) {
      job = this.assets
        .bytes(`${AUDIO_PREFIX}${role}`)
        .then((bytes) => ctx.decodeAudioData(bytes.slice(0)))
        .then((buffer) => {
          this.decoded.set(role, buffer);
          return buffer;
        })
        .catch(() => null);
      this.pending.set(role, job);
    }
    return job;
  }

  /** A decoded buffer for the group, rotating variations; null when nothing is ready. */
  pick(group: string): AudioBuffer | null {
    const roles = (this.groups.get(group) ?? []).filter((role) => this.decoded.has(role));
    if (roles.length === 0) return null;
    let role = roles[Math.floor(Math.random() * roles.length)] as string;
    if (roles.length > 1 && role === this.lastPick.get(group)) role = roles[(roles.indexOf(role) + 1) % roles.length] as string;
    this.lastPick.set(group, role);
    return this.decoded.get(role) ?? null;
  }

  /** Roles in a group (for streamed beds that must be requested explicitly). */
  roles(group: string): string[] {
    return this.groups.get(group) ?? [];
  }
}

function groupOf(role: string): string {
  return role.replace(/-\d+$/, '');
}
