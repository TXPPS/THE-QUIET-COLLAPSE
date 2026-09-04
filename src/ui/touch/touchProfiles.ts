import { isFiniteNumber, isRecord, readVersioned, removeRaw, writeVersioned } from '@/persistence/Storage';
import { clampProfile as clampProfileWithFallback, TOUCH_CONTROL_IDS, type TouchControlLayout, type TouchProfile } from './touchLayout';
import { PRESETS, presetProfile, TOUCH_PROFILE_VERSION } from './touchPresets';

export type { PresetId, TouchControlId, TouchControlLayout, TouchProfile, Viewport } from './touchLayout';
export {
  checkLayout,
  controlRect,
  describeReport,
  ESSENTIAL_CONTROLS,
  findOverlaps,
  layoutFromCentre,
  lookZoneRect,
  MIN_TARGET_PX,
  OPACITY_RANGE,
  SIZE_RANGE,
  TOUCH_CONTROL_IDS,
} from './touchLayout';
export { CONTROL_LABELS, PRESET_IDS, PRESETS, presetProfile, TOUCH_PROFILE_VERSION } from './touchPresets';

const STORAGE_NAME = 'touch.profiles';

export type ProfileKind = 'phone' | 'tablet';

export interface TouchProfiles {
  phone: TouchProfile;
  tablet: TouchProfile;
}

export function defaultProfiles(): TouchProfiles {
  return { phone: presetProfile('twoThumb'), tablet: presetProfile('tablet') };
}

/** Clamps every control into range; missing controls take the default preset's values. */
export function clampProfile(profile: TouchProfile): TouchProfile {
  return clampProfileWithFallback(profile, PRESETS.twoThumb.controls, TOUCH_PROFILE_VERSION);
}

function isLayout(value: unknown): value is TouchControlLayout {
  return isRecord(value) && ['x', 'y', 'size', 'opacity'].every((k) => isFiniteNumber(value[k])) && typeof value['visible'] === 'boolean';
}

function isProfile(value: unknown): value is TouchProfile {
  if (!isRecord(value) || !isRecord(value['controls'])) return false;
  return typeof value['preset'] === 'string';
}

function sanitizeProfile(value: unknown, fallback: TouchProfile): TouchProfile {
  if (!isProfile(value)) return fallback;
  const controls = {} as TouchProfile['controls'];
  for (const id of TOUCH_CONTROL_IDS) {
    const candidate = value.controls[id];
    controls[id] = isLayout(candidate) ? { ...candidate } : { ...fallback.controls[id] };
  }
  const preset = (value.preset in PRESETS || value.preset === 'custom' ? value.preset : 'custom') as TouchProfile['preset'];
  return clampProfile({ version: TOUCH_PROFILE_VERSION, preset, controls });
}

function isProfiles(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

/**
 * Migrates older payloads. Version 1 positioned controls as fractions of the whole safe area with
 * the old size scale; those numbers do not map onto the edge-anchored v2 layout, so v1 resets to
 * the new presets (a one-time loss of custom layouts, announced in the release notes).
 */
export function migrateProfiles(fromVersion: number, data: unknown): Record<string, unknown> | null {
  if (fromVersion < 2) return null;
  return isRecord(data) ? data : null;
}

export function loadProfiles(): TouchProfiles {
  const defaults = defaultProfiles();
  const result = readVersioned<Record<string, unknown>>(STORAGE_NAME, TOUCH_PROFILE_VERSION, isProfiles, migrateProfiles);
  if (!result.ok) return defaults;
  return { phone: sanitizeProfile(result.value['phone'], defaults.phone), tablet: sanitizeProfile(result.value['tablet'], defaults.tablet) };
}

export function saveProfiles(profiles: TouchProfiles): boolean {
  return writeVersioned(STORAGE_NAME, TOUCH_PROFILE_VERSION, profiles);
}

export function resetProfiles(): TouchProfiles {
  removeRaw(STORAGE_NAME);
  return defaultProfiles();
}
