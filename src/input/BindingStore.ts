import { EventBus } from '@/core/EventBus';
import { isRecord, readVersioned, writeVersioned, removeRaw } from '@/persistence/Storage';
import type { Action, BindingSlot } from './actions';
import { DEFAULT_KBM_BINDINGS, REQUIRED_SLOTS, bindingsEqual, padBindingsEqual, slotsOf, type KbmBinding, type KbmBindingMap, type PadBinding, type PadBindingMap, type PadSlot } from './bindings';
import { PAD_PROFILES, PAD_PROFILE_FAMILIES, defaultProfile, type PadProfileFamily } from './padProfiles';

export const BINDINGS_VERSION = 2;
const STORAGE_NAME = 'bindings';

type PadProfiles = Record<PadProfileFamily, PadBindingMap>;

interface PersistedBindings {
  kbm: KbmBindingMap;
  pads: Partial<PadProfiles>;
}

export interface BindingEvents extends Record<string, unknown> {
  change: { kbm: KbmBindingMap; pads: PadProfiles };
}

function isKbmBinding(value: unknown): value is KbmBinding {
  if (!isRecord(value)) return false;
  if (value['type'] === 'key') return typeof value['code'] === 'string';
  if (value['type'] === 'mouse') return typeof value['button'] === 'number';
  if (value['type'] === 'wheel') return value['dir'] === 'up' || value['dir'] === 'down';
  return false;
}

function isPadBinding(value: unknown): value is PadBinding {
  if (!isRecord(value)) return false;
  if (value['type'] === 'button') return typeof value['index'] === 'number';
  if (value['type'] === 'axis') return typeof value['index'] === 'number' && (value['sign'] === 1 || value['sign'] === -1);
  if (value['type'] === 'stick') return typeof value['x'] === 'number' && typeof value['y'] === 'number';
  return false;
}

function sanitizeMap<T>(input: unknown, isBinding: (value: unknown) => value is T): Partial<Record<string, T[]>> {
  const out: Partial<Record<string, T[]>> = {};
  if (!isRecord(input)) return out;
  for (const [slot, list] of Object.entries(input)) {
    if (!Array.isArray(list)) continue;
    out[slot] = list.filter(isBinding);
  }
  return out;
}

function isPersisted(value: unknown): value is PersistedBindings {
  return isRecord(value) && isRecord(value['kbm']) && isRecord(value['pads']);
}

/**
 * v1 stored one controller map for every pad. v2 keeps one profile per family; the old map becomes
 * the profile of every family so a remapped button keeps working on the pad the player owns.
 */
function migrateBindings(fromVersion: number, data: unknown): PersistedBindings | null {
  if (fromVersion >= 2) return data as PersistedBindings;
  if (!isRecord(data)) return null;
  const pads: Partial<PadProfiles> = {};
  const legacy = data['pad'];
  if (isRecord(legacy)) for (const family of PAD_PROFILE_FAMILIES) pads[family] = structuredClone(legacy) as PadBindingMap;
  return { kbm: (data['kbm'] ?? {}) as KbmBindingMap, pads };
}

function allDefaults(): PadProfiles {
  const out = {} as PadProfiles;
  for (const family of PAD_PROFILE_FAMILIES) out[family] = defaultProfile(family);
  return out;
}

/** Current keyboard/mouse map and one gamepad map per controller family, persisted with a schema version. */
export class BindingStore {
  readonly events = new EventBus<BindingEvents>();
  kbm: KbmBindingMap;
  pads: PadProfiles;

  constructor() {
    const result = readVersioned<PersistedBindings>(STORAGE_NAME, BINDINGS_VERSION, isPersisted, migrateBindings);
    this.kbm = structuredClone(DEFAULT_KBM_BINDINGS);
    this.pads = allDefaults();
    if (result.ok) {
      this.kbm = { ...this.kbm, ...(sanitizeMap(result.value.kbm, isKbmBinding) as KbmBindingMap) };
      for (const family of PAD_PROFILE_FAMILIES) {
        const stored = result.value.pads[family];
        if (stored) this.pads[family] = { ...this.pads[family], ...(sanitizeMap(stored, isPadBinding) as PadBindingMap) };
      }
      this.ensureRequired();
    }
  }

  kbmFor(slot: BindingSlot): KbmBinding[] {
    return this.kbm[slot] ?? [];
  }

  /** Bindings of a slot in one family's profile (the Xbox profile when no family is given). */
  padFor(slot: PadSlot, family: PadProfileFamily = 'xbox'): PadBinding[] {
    return this.pads[family][slot] ?? [];
  }

  /** Legacy accessor: the Xbox profile as one map. */
  get pad(): PadBindingMap {
    return this.pads.xbox;
  }

  /** Assigns a keyboard/mouse binding to a slot (primary position); removes conflicts in same context. */
  rebindKbm(slot: BindingSlot, binding: KbmBinding, conflictSlots: readonly BindingSlot[]): void {
    for (const other of conflictSlots) {
      if (other === slot) continue;
      const list = this.kbm[other];
      if (!list) continue;
      const filtered = list.filter((b) => !bindingsEqual(b, binding));
      if (filtered.length !== list.length) this.kbm[other] = filtered;
    }
    this.kbm[slot] = [binding];
    this.ensureRequired();
    this.persist();
  }

  rebindPad(slot: BindingSlot, binding: PadBinding, conflictSlots: readonly BindingSlot[], family: PadProfileFamily = 'xbox'): void {
    const profile = this.pads[family];
    for (const other of conflictSlots) {
      if (other === slot || sharesButton(slot, other)) continue;
      const list = profile[other];
      if (!list) continue;
      const filtered = list.filter((b) => !padBindingsEqual(b, binding));
      if (filtered.length !== list.length) profile[other] = filtered;
    }
    profile[slot] = [binding];
    this.ensureRequired();
    this.persist();
  }

  resetAll(): void {
    this.kbm = structuredClone(DEFAULT_KBM_BINDINGS);
    this.pads = allDefaults();
    removeRaw(STORAGE_NAME);
    this.events.emit('change', { kbm: this.kbm, pads: this.pads });
  }

  resetAction(action: Action): void {
    for (const slot of slotsOf(action)) {
      const kbmDefault = DEFAULT_KBM_BINDINGS[slot];
      if (kbmDefault) this.kbm[slot] = structuredClone(kbmDefault);
      for (const family of PAD_PROFILE_FAMILIES) {
        const padDefault = PAD_PROFILES[family][slot];
        if (padDefault) this.pads[family][slot] = structuredClone(padDefault);
      }
    }
    this.persist();
  }

  private ensureRequired(): void {
    for (const slot of REQUIRED_SLOTS) {
      if ((this.kbm[slot]?.length ?? 0) === 0) this.kbm[slot] = structuredClone(DEFAULT_KBM_BINDINGS[slot] ?? []);
      for (const family of PAD_PROFILE_FAMILIES) {
        if ((this.pads[family][slot]?.length ?? 0) === 0) this.pads[family][slot] = structuredClone(PAD_PROFILES[family][slot] ?? []);
      }
    }
  }

  private persist(): void {
    writeVersioned<PersistedBindings>(STORAGE_NAME, BINDINGS_VERSION, { kbm: this.kbm, pads: this.pads });
    this.events.emit('change', { kbm: this.kbm, pads: this.pads });
  }
}

/** Jump and Interact deliberately share one face button (interact wins when a prompt shows). */
const SHARED_PAIRS: ReadonlyArray<readonly [BindingSlot, BindingSlot]> = [['Jump', 'Interact']];

function sharesButton(a: BindingSlot, b: BindingSlot): boolean {
  return SHARED_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}
