import { PROJECT_ID } from '@/config/project';

export type StorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'missing' | 'corrupt' | 'unsupported-version' | 'invalid'; detail?: string };

export interface Envelope<T> {
  v: number;
  savedAt: string;
  data: T;
}

export type Validator<T> = (data: unknown) => data is T;
export type Migrator<T> = (fromVersion: number, data: unknown) => T | null;

const memoryFallback = new Map<string, string>();

function backend(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    const store = globalThis.localStorage;
    if (store) return store;
  } catch {
    // Access to localStorage can throw in private modes or sandboxed frames.
  }
  return {
    getItem: (key) => memoryFallback.get(key) ?? null,
    setItem: (key, value) => void memoryFallback.set(key, value),
    removeItem: (key) => void memoryFallback.delete(key),
  };
}

export function storageKey(name: string): string {
  return `${PROJECT_ID}.${name}`;
}

export function readRaw(name: string): string | null {
  try {
    return backend().getItem(storageKey(name));
  } catch {
    return null;
  }
}

export function writeRaw(name: string, value: string): boolean {
  try {
    backend().setItem(storageKey(name), value);
    return true;
  } catch {
    return false;
  }
}

export function removeRaw(name: string): void {
  try {
    backend().removeItem(storageKey(name));
  } catch {
    // Nothing to do; storage is unavailable.
  }
}

/**
 * Reads a versioned envelope, validates it, and migrates older versions when a migrator is given.
 * Never throws; corruption is reported so the UI can message it and offer a reset.
 */
export function readVersioned<T>(
  name: string,
  version: number,
  validate: Validator<T>,
  migrate?: Migrator<T>,
): StorageResult<T> {
  const raw = readRaw(name);
  if (raw === null) return { ok: false, reason: 'missing' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { ok: false, reason: 'corrupt', detail: error instanceof Error ? error.message : 'parse error' };
  }
  if (!isEnvelope(parsed)) return { ok: false, reason: 'corrupt', detail: 'not an envelope' };
  if (parsed.v > version) return { ok: false, reason: 'unsupported-version', detail: `v${parsed.v}` };
  let data: unknown = parsed.data;
  if (parsed.v < version) {
    const migrated = migrate ? migrate(parsed.v, data) : null;
    if (migrated === null) return { ok: false, reason: 'unsupported-version', detail: `v${parsed.v}` };
    data = migrated;
  }
  if (!validate(data)) return { ok: false, reason: 'invalid', detail: 'validation failed' };
  return { ok: true, value: data };
}

export function writeVersioned<T>(name: string, version: number, data: T): boolean {
  const envelope: Envelope<T> = { v: version, savedAt: new Date().toISOString(), data };
  return writeRaw(name, JSON.stringify(envelope));
}

export function readEnvelopeMeta(name: string): { v: number; savedAt: string } | null {
  const raw = readRaw(name);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isEnvelope(parsed) ? { v: parsed.v, savedAt: parsed.savedAt } : null;
  } catch {
    return null;
  }
}

function isEnvelope(value: unknown): value is Envelope<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['v'] === 'number' && typeof v['savedAt'] === 'string' && 'data' in v;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
