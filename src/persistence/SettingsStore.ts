import { EventBus } from '@/core/EventBus';
import { readVersioned, writeVersioned, removeRaw, isRecord } from './Storage';
import { sanitize } from './sanitize';
import { DEFAULT_SETTINGS, SETTINGS_ENUMS, SETTINGS_RANGES, SETTINGS_VERSION, migrateSettings, type Settings } from './settingsSchema';

const STORAGE_NAME = 'settings';

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export interface SettingsEvents extends Record<string, unknown> {
  change: { settings: Settings; previous: Settings };
}

/**
 * Versioned, validated settings with change events. Any unreadable payload is replaced by defaults
 * (the corruption is exposed through `loadStatus` so the UI can mention it once).
 */
export class SettingsStore {
  readonly events = new EventBus<SettingsEvents>();
  readonly loadStatus: 'ok' | 'defaults' | 'recovered';
  private current: Settings;

  constructor() {
    const result = readVersioned<unknown>(STORAGE_NAME, SETTINGS_VERSION, isRecord, migrateSettings);
    if (result.ok) {
      this.current = sanitize(DEFAULT_SETTINGS, result.value, { ranges: SETTINGS_RANGES, enums: SETTINGS_ENUMS });
      this.loadStatus = 'ok';
    } else {
      this.current = structuredClone(DEFAULT_SETTINGS);
      this.loadStatus = result.reason === 'missing' ? 'defaults' : 'recovered';
      if (result.reason !== 'missing') this.persist();
    }
  }

  get(): Settings {
    return this.current;
  }

  update(patch: DeepPartial<Settings>): void {
    const previous = this.current;
    const merged = mergeDeep(structuredClone(previous) as unknown as Record<string, unknown>, patch as Record<string, unknown>);
    this.current = sanitize(DEFAULT_SETTINGS, merged, { ranges: SETTINGS_RANGES, enums: SETTINGS_ENUMS });
    this.persist();
    this.events.emit('change', { settings: this.current, previous });
  }

  reset(section?: keyof Settings): void {
    const previous = this.current;
    if (section) {
      this.current = { ...this.current, [section]: structuredClone(DEFAULT_SETTINGS[section]) } as Settings;
    } else {
      this.current = structuredClone(DEFAULT_SETTINGS);
    }
    this.persist();
    this.events.emit('change', { settings: this.current, previous });
  }

  /** Removes the persisted payload entirely (used by the corruption recovery flow). */
  static wipe(): void {
    removeRaw(STORAGE_NAME);
  }

  private persist(): void {
    writeVersioned(STORAGE_NAME, SETTINGS_VERSION, this.current);
  }
}

function mergeDeep(target: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    const existing = target[key];
    if (isRecord(value) && isRecord(existing)) target[key] = mergeDeep(existing, value);
    else if (value !== undefined) target[key] = value;
  }
  return target;
}
