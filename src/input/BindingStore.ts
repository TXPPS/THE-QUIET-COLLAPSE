import { EventBus } from '@/core/EventBus';
import { isRecord, readVersioned, writeVersioned, removeRaw } from '@/persistence/Storage';
import type { Action, BindingSlot } from './actions';
import {
  DEFAULT_KBM_BINDINGS,
  DEFAULT_PAD_BINDINGS,
  REQUIRED_SLOTS,
  bindingsEqual,
  padBindingsEqual,
  slotsOf,
  type KbmBinding,
  type KbmBindingMap,
  type PadBinding,
  type PadBindingMap,
} from './bindings';

export const BINDINGS_VERSION = 1;
const STORAGE_NAME = 'bindings';

interface PersistedBindings {
  kbm: KbmBindingMap;
  pad: PadBindingMap;
}

export interface BindingEvents extends Record<string, unknown> {
  change: { kbm: KbmBindingMap; pad: PadBindingMap };
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
  return isRecord(value) && isRecord(value['kbm']) && isRecord(value['pad']);
}

/** Current keyboard/mouse and gamepad binding maps, persisted with a schema version. */
export class BindingStore {
  readonly events = new EventBus<BindingEvents>();
  kbm: KbmBindingMap;
  pad: PadBindingMap;

  constructor() {
    const result = readVersioned<PersistedBindings>(STORAGE_NAME, BINDINGS_VERSION, isPersisted);
    if (result.ok) {
      this.kbm = { ...DEFAULT_KBM_BINDINGS, ...(sanitizeMap(result.value.kbm, isKbmBinding) as KbmBindingMap) };
      this.pad = { ...DEFAULT_PAD_BINDINGS, ...(sanitizeMap(result.value.pad, isPadBinding) as PadBindingMap) };
      this.ensureRequired();
    } else {
      this.kbm = structuredClone(DEFAULT_KBM_BINDINGS);
      this.pad = structuredClone(DEFAULT_PAD_BINDINGS);
    }
  }

  kbmFor(slot: BindingSlot): KbmBinding[] {
    return this.kbm[slot] ?? [];
  }

  padFor(slot: BindingSlot | 'Move' | 'Look' | 'Navigate'): PadBinding[] {
    return this.pad[slot] ?? [];
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

  rebindPad(slot: BindingSlot, binding: PadBinding, conflictSlots: readonly BindingSlot[]): void {
    for (const other of conflictSlots) {
      if (other === slot) continue;
      const list = this.pad[other];
      if (!list) continue;
      const filtered = list.filter((b) => !padBindingsEqual(b, binding));
      if (filtered.length !== list.length) this.pad[other] = filtered;
    }
    this.pad[slot] = [binding];
    this.ensureRequired();
    this.persist();
  }

  resetAll(): void {
    this.kbm = structuredClone(DEFAULT_KBM_BINDINGS);
    this.pad = structuredClone(DEFAULT_PAD_BINDINGS);
    removeRaw(STORAGE_NAME);
    this.events.emit('change', { kbm: this.kbm, pad: this.pad });
  }

  resetAction(action: Action): void {
    for (const slot of slotsOf(action)) {
      const kbmDefault = DEFAULT_KBM_BINDINGS[slot];
      const padDefault = DEFAULT_PAD_BINDINGS[slot];
      if (kbmDefault) this.kbm[slot] = structuredClone(kbmDefault);
      if (padDefault) this.pad[slot] = structuredClone(padDefault);
    }
    this.persist();
  }

  private ensureRequired(): void {
    for (const slot of REQUIRED_SLOTS) {
      if ((this.kbm[slot]?.length ?? 0) === 0) this.kbm[slot] = structuredClone(DEFAULT_KBM_BINDINGS[slot] ?? []);
      if ((this.pad[slot]?.length ?? 0) === 0) this.pad[slot] = structuredClone(DEFAULT_PAD_BINDINGS[slot] ?? []);
    }
  }

  private persist(): void {
    writeVersioned<PersistedBindings>(STORAGE_NAME, BINDINGS_VERSION, { kbm: this.kbm, pad: this.pad });
    this.events.emit('change', { kbm: this.kbm, pad: this.pad });
  }
}
