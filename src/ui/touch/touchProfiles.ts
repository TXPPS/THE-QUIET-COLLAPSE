import { clamp } from '@/core/math';
import { isFiniteNumber, isRecord, readVersioned, removeRaw, writeVersioned } from '@/persistence/Storage';

export const TOUCH_PROFILE_VERSION = 1;
const STORAGE_NAME = 'touch.profiles';

export type TouchControlId = 'joystick' | 'fire' | 'fireLeft' | 'aim' | 'reload' | 'interact' | 'sprint' | 'dodge' | 'swap' | 'flashlight' | 'pause' | 'inventory' | 'map';
export type PresetId = 'twoThumb' | 'leftFire' | 'compactPhone' | 'tablet';
export type ProfileKind = 'phone' | 'tablet';

export interface TouchControlLayout {
  /** Centre as a fraction of the safe viewport (0..1). */
  x: number;
  y: number;
  /** Diameter as a fraction of the shorter viewport side. */
  size: number;
  opacity: number;
  visible: boolean;
}

export interface TouchProfile {
  version: number;
  preset: PresetId | 'custom';
  controls: Record<TouchControlId, TouchControlLayout>;
}

export interface TouchProfiles {
  phone: TouchProfile;
  tablet: TouchProfile;
}

export const TOUCH_CONTROL_IDS: readonly TouchControlId[] = ['joystick', 'fire', 'fireLeft', 'aim', 'reload', 'interact', 'sprint', 'dodge', 'swap', 'flashlight', 'pause', 'inventory', 'map'];

/** Controls that must always stay on screen and visible. */
export const ESSENTIAL_CONTROLS: readonly TouchControlId[] = ['joystick', 'fire', 'aim', 'interact', 'pause'];

export const CONTROL_LABELS: Record<TouchControlId, string> = {
  joystick: 'Move',
  fire: 'Fire',
  fireLeft: 'Fire (left)',
  aim: 'Aim',
  reload: 'Reload',
  interact: 'Use',
  sprint: 'Run',
  dodge: 'Step',
  swap: 'Swap',
  flashlight: 'Light',
  pause: 'Pause',
  inventory: 'Items',
  map: 'Map',
};

export const SIZE_RANGE: [number, number] = [0.09, 0.34];
export const OPACITY_RANGE: [number, number] = [0.2, 1];
/** Minimum diameter in CSS px so every control stays a comfortable target. */
export const MIN_TARGET_PX = 48;

type Partial3 = Partial<Record<TouchControlId, Partial<TouchControlLayout>>>;

function control(x: number, y: number, size: number, opacity = 0.75, visible = true): TouchControlLayout {
  return { x, y, size, opacity, visible };
}

const BASE_TWO_THUMB: Record<TouchControlId, TouchControlLayout> = {
  joystick: control(0.16, 0.7, 0.3),
  fire: control(0.9, 0.66, 0.2, 0.8),
  fireLeft: control(0.3, 0.62, 0.14, 0.6, false),
  aim: control(0.79, 0.82, 0.15, 0.75),
  reload: control(0.79, 0.46, 0.11, 0.7),
  interact: control(0.66, 0.68, 0.13, 0.8),
  sprint: control(0.3, 0.86, 0.12, 0.7),
  dodge: control(0.9, 0.36, 0.11, 0.7),
  swap: control(0.66, 0.42, 0.1, 0.65),
  flashlight: control(0.55, 0.88, 0.1, 0.65),
  pause: control(0.5, 0.08, 0.09, 0.6),
  inventory: control(0.58, 0.08, 0.09, 0.6),
  map: control(0.42, 0.08, 0.09, 0.6),
};

function withOverrides(base: Record<TouchControlId, TouchControlLayout>, overrides: Partial3): Record<TouchControlId, TouchControlLayout> {
  const result = {} as Record<TouchControlId, TouchControlLayout>;
  for (const id of TOUCH_CONTROL_IDS) result[id] = { ...base[id], ...(overrides[id] ?? {}) };
  return result;
}

export const PRESETS: Record<PresetId, { label: string; hint: string; controls: Record<TouchControlId, TouchControlLayout> }> = {
  twoThumb: { label: 'Two-thumb default', hint: 'Move left, look and act right.', controls: BASE_TWO_THUMB },
  leftFire: {
    label: 'Left fire',
    hint: 'A second fire button under the left thumb so aiming and firing never share a hand.',
    controls: withOverrides(BASE_TWO_THUMB, { fireLeft: { visible: true, x: 0.32, y: 0.58, size: 0.16, opacity: 0.75 }, sprint: { x: 0.34, y: 0.86 } }),
  },
  compactPhone: {
    label: 'Compact phone',
    hint: 'Smaller controls pulled toward the corners for narrow screens.',
    controls: withOverrides(BASE_TWO_THUMB, {
      joystick: { x: 0.14, y: 0.72, size: 0.26 },
      fire: { x: 0.91, y: 0.7, size: 0.18 },
      aim: { x: 0.8, y: 0.86, size: 0.13 },
      interact: { x: 0.69, y: 0.72, size: 0.12 },
      reload: { x: 0.8, y: 0.5, size: 0.1 },
      dodge: { x: 0.91, y: 0.42, size: 0.1 },
      swap: { x: 0.69, y: 0.46, size: 0.09 },
      sprint: { x: 0.3, y: 0.88, size: 0.11 },
      flashlight: { x: 0.56, y: 0.9, size: 0.09 },
    }),
  },
  tablet: {
    label: 'Tablet',
    hint: 'Larger spacing for wide screens held with both hands.',
    controls: withOverrides(BASE_TWO_THUMB, {
      joystick: { x: 0.13, y: 0.72, size: 0.24 },
      fire: { x: 0.92, y: 0.68, size: 0.16 },
      aim: { x: 0.83, y: 0.84, size: 0.12 },
      interact: { x: 0.73, y: 0.7, size: 0.11 },
      reload: { x: 0.83, y: 0.5, size: 0.09 },
      dodge: { x: 0.92, y: 0.4, size: 0.09 },
      swap: { x: 0.73, y: 0.46, size: 0.09 },
      sprint: { x: 0.26, y: 0.88, size: 0.1 },
      flashlight: { x: 0.6, y: 0.9, size: 0.09 },
    }),
  },
};

export function presetProfile(preset: PresetId): TouchProfile {
  return { version: TOUCH_PROFILE_VERSION, preset, controls: structuredClone(PRESETS[preset].controls) };
}

export function defaultProfiles(): TouchProfiles {
  return { phone: presetProfile('twoThumb'), tablet: presetProfile('tablet') };
}

export interface Viewport {
  width: number;
  height: number;
  safe: { top: number; right: number; bottom: number; left: number };
}

/** Pixel rectangle of a control for a viewport (centre + diameter). */
export function controlRect(layout: TouchControlLayout, viewport: Viewport): { cx: number; cy: number; d: number } {
  const innerW = viewport.width - viewport.safe.left - viewport.safe.right;
  const innerH = viewport.height - viewport.safe.top - viewport.safe.bottom;
  const d = Math.max(MIN_TARGET_PX, layout.size * Math.min(viewport.width, viewport.height));
  return { cx: viewport.safe.left + layout.x * innerW, cy: viewport.safe.top + layout.y * innerH, d };
}

/** Clamps every control inside the safe area and enforces essential visibility and ranges. */
export function clampProfile(profile: TouchProfile, viewport: Viewport): TouchProfile {
  const innerW = Math.max(1, viewport.width - viewport.safe.left - viewport.safe.right);
  const innerH = Math.max(1, viewport.height - viewport.safe.top - viewport.safe.bottom);
  const controls = {} as Record<TouchControlId, TouchControlLayout>;
  for (const id of TOUCH_CONTROL_IDS) {
    const source = profile.controls[id] ?? PRESETS.twoThumb.controls[id];
    const size = clamp(source.size, SIZE_RANGE[0], SIZE_RANGE[1]);
    const dPx = Math.max(MIN_TARGET_PX, size * Math.min(viewport.width, viewport.height));
    const halfX = dPx / 2 / innerW;
    const halfY = dPx / 2 / innerH;
    controls[id] = {
      x: clamp(source.x, Math.min(0.5, halfX), Math.max(0.5, 1 - halfX)),
      y: clamp(source.y, Math.min(0.5, halfY), Math.max(0.5, 1 - halfY)),
      size,
      opacity: clamp(source.opacity, OPACITY_RANGE[0], OPACITY_RANGE[1]),
      visible: ESSENTIAL_CONTROLS.includes(id) ? true : source.visible,
    };
  }
  return { version: TOUCH_PROFILE_VERSION, preset: profile.preset, controls };
}

/** Pairs of visible controls whose circles overlap for the given viewport. */
export function findOverlaps(profile: TouchProfile, viewport: Viewport): Array<[TouchControlId, TouchControlId]> {
  const result: Array<[TouchControlId, TouchControlId]> = [];
  const ids = TOUCH_CONTROL_IDS.filter((id) => profile.controls[id].visible);
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = controlRect(profile.controls[ids[i] as TouchControlId], viewport);
      const b = controlRect(profile.controls[ids[j] as TouchControlId], viewport);
      if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < (a.d + b.d) / 2) result.push([ids[i] as TouchControlId, ids[j] as TouchControlId]);
    }
  }
  return result;
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
  const controls = {} as Record<TouchControlId, TouchControlLayout>;
  for (const id of TOUCH_CONTROL_IDS) {
    const candidate = value.controls[id];
    controls[id] = isLayout(candidate) ? { ...candidate } : { ...fallback.controls[id] };
  }
  const preset = (value.preset in PRESETS || value.preset === 'custom' ? value.preset : 'custom') as TouchProfile['preset'];
  return { version: TOUCH_PROFILE_VERSION, preset, controls };
}

function isProfiles(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

/** Migrates older payloads; version 0 (unversioned experiments) simply resets. */
export function migrateProfiles(fromVersion: number, data: unknown): Record<string, unknown> | null {
  if (fromVersion < 1) return null;
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
