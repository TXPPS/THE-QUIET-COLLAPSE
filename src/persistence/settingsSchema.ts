export const SETTINGS_VERSION = 3;

export type QualityId = 'auto' | 'low' | 'balanced' | 'high';
export type ControlPolicy = 'auto' | 'locked';
export type HoldMode = 'hold' | 'toggle';
export type GlyphFamilyOverride = 'auto' | 'xbox' | 'playstation' | 'nintendo' | 'generic';
export type ReducedMotionPref = 'system' | 'on' | 'off';
export type NintendoConfirmPolicy = 'east' | 'south';
/** How the right thumb looks around on touch: drag anywhere in the look zone, or a visible stick. */
export type TouchLookControl = 'drag' | 'stick';
/** Difficulty presets (enemy speed, attack cooldown and damage; see src/config/enemies.ts). */
export type DifficultyPreset = 'accessible' | 'standard' | 'hard';

export interface VideoSettings {
  quality: QualityId;
  resolutionScale: number;
  fov: number;
  cameraShake: boolean;
  brightness: number;
  showFps: boolean;
}

export interface AudioSettings {
  master: number;
  ambience: number;
  sfx: number;
  ui: number;
  muteOnFocusLoss: boolean;
  subtitles: boolean;
}

export interface ControlSettings {
  policy: ControlPolicy;
  primarySource: string | null;
  /** Look sensitivity per source. */
  mouseSensitivity: number;
  stickSensitivity: number;
  touchSensitivity: number;
  /** Multiplier applied to look while aiming, per source (1 = unchanged). */
  aimSensitivityMouse: number;
  aimSensitivityGamepad: number;
  aimSensitivityTouch: number;
  /** Invert vertical look, per input source (each device has its own habit). */
  invertYMouse: boolean;
  invertYGamepad: boolean;
  invertYTouch: boolean;
  invertX: boolean;
  aimMode: HoldMode;
  sprintMode: HoldMode;
  deadZoneRadial: number;
  deadZoneAxial: number;
  glyphFamilyOverride: GlyphFamilyOverride;
  nintendoConfirm: NintendoConfirmPolicy;
  vibration: boolean;
  menuRepeatDelay: number;
  menuRepeatRate: number;
  touchDeadZone: number;
  touchSprintThreshold: number;
  touchSprintLock: boolean;
  touchLookControl: TouchLookControl;
}

export interface AccessibilitySettings {
  reducedMotion: ReducedMotionPref;
  textScale: number;
  highContrastUi: boolean;
  holdToInteract: boolean;
  largeHud: boolean;
  colorSafeHud: boolean;
}

export interface MetaSettings {
  warningsAccepted: boolean;
  controlsChooserSeen: boolean;
  lastSlot: number | null;
  difficulty: DifficultyPreset;
  /** The drag-to-look hint has been shown and used once. */
  touchLookHintSeen: boolean;
}

export interface Settings {
  video: VideoSettings;
  audio: AudioSettings;
  controls: ControlSettings;
  accessibility: AccessibilitySettings;
  meta: MetaSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  video: { quality: 'auto', resolutionScale: 1, fov: 58, cameraShake: true, brightness: 1, showFps: false },
  audio: { master: 0.8, ambience: 0.7, sfx: 0.9, ui: 0.7, muteOnFocusLoss: true, subtitles: true },
  controls: {
    policy: 'auto',
    primarySource: null,
    mouseSensitivity: 1,
    stickSensitivity: 1,
    touchSensitivity: 1,
    aimSensitivityMouse: 1,
    aimSensitivityGamepad: 1,
    aimSensitivityTouch: 1,
    invertYMouse: false,
    invertYGamepad: false,
    invertYTouch: false,
    invertX: false,
    aimMode: 'hold',
    sprintMode: 'hold',
    deadZoneRadial: 0.18,
    deadZoneAxial: 0.1,
    glyphFamilyOverride: 'auto',
    nintendoConfirm: 'east',
    vibration: true,
    menuRepeatDelay: 0.38,
    menuRepeatRate: 0.11,
    touchDeadZone: 0.12,
    touchSprintThreshold: 0.92,
    touchSprintLock: true,
    touchLookControl: 'drag',
  },
  accessibility: {
    reducedMotion: 'system',
    textScale: 1,
    highContrastUi: false,
    holdToInteract: false,
    largeHud: false,
    colorSafeHud: false,
  },
  meta: { warningsAccepted: false, controlsChooserSeen: false, lastSlot: null, difficulty: 'standard', touchLookHintSeen: false },
};

/** Numeric ranges used to clamp persisted values (corrupted or hand-edited storage). */
export const SETTINGS_RANGES: Record<string, [number, number]> = {
  'video.resolutionScale': [0.5, 1],
  'video.fov': [45, 80],
  'video.brightness': [0.6, 1.6],
  'audio.master': [0, 1],
  'audio.ambience': [0, 1],
  'audio.sfx': [0, 1],
  'audio.ui': [0, 1],
  'controls.mouseSensitivity': [0.2, 3],
  'controls.stickSensitivity': [0.2, 3],
  'controls.touchSensitivity': [0.2, 3],
  'controls.aimSensitivityMouse': [0.3, 2],
  'controls.aimSensitivityGamepad': [0.3, 2],
  'controls.aimSensitivityTouch': [0.3, 2],
  'controls.deadZoneRadial': [0, 0.6],
  'controls.deadZoneAxial': [0, 0.5],
  'controls.menuRepeatDelay': [0.15, 0.8],
  'controls.menuRepeatRate': [0.05, 0.4],
  'controls.touchDeadZone': [0, 0.4],
  'controls.touchSprintThreshold': [0.6, 1],
  'accessibility.textScale': [0.85, 1.5],
};

/** Allowed values for string enums; anything else falls back to the default. */
export const SETTINGS_ENUMS: Record<string, readonly string[]> = {
  'video.quality': ['auto', 'low', 'balanced', 'high'],
  'controls.policy': ['auto', 'locked'],
  'controls.aimMode': ['hold', 'toggle'],
  'controls.sprintMode': ['hold', 'toggle'],
  'controls.glyphFamilyOverride': ['auto', 'xbox', 'playstation', 'nintendo', 'generic'],
  'controls.nintendoConfirm': ['east', 'south'],
  'controls.touchLookControl': ['drag', 'stick'],
  'accessibility.reducedMotion': ['system', 'on', 'off'],
  'meta.difficulty': ['accessible', 'standard', 'hard'],
};

/**
 * Version migrations.
 * v1 -> v2: the single `controls.invertY` became one flag per input source, so a player who had
 * inverted look keeps it on every device.
 * v2 -> v3: touch look got its own sensitivity (seeded from the shared stick value) and the old
 * "normal" difficulty became the "standard" preset.
 */
export function migrateSettings(fromVersion: number, data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data;
  const record = data as Record<string, unknown>;
  const controls = record['controls'];
  if (fromVersion < 2 && typeof controls === 'object' && controls !== null) {
    const c = controls as Record<string, unknown>;
    if (c['invertY'] === true) {
      c['invertYMouse'] = c['invertYMouse'] ?? true;
      c['invertYGamepad'] = c['invertYGamepad'] ?? true;
      c['invertYTouch'] = c['invertYTouch'] ?? true;
    }
    delete c['invertY'];
  }
  if (fromVersion < 3) {
    if (typeof controls === 'object' && controls !== null) {
      const c = controls as Record<string, unknown>;
      if (typeof c['stickSensitivity'] === 'number' && c['touchSensitivity'] === undefined) c['touchSensitivity'] = c['stickSensitivity'];
    }
    const meta = record['meta'];
    if (typeof meta === 'object' && meta !== null) {
      const m = meta as Record<string, unknown>;
      if (m['difficulty'] === 'normal') m['difficulty'] = 'standard';
    }
  }
  return record;
}
