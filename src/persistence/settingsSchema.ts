export const SETTINGS_VERSION = 1;

export type QualityId = 'auto' | 'low' | 'balanced' | 'high';
export type ControlPolicy = 'auto' | 'locked';
export type HoldMode = 'hold' | 'toggle';
export type GlyphFamilyOverride = 'auto' | 'xbox' | 'playstation' | 'nintendo' | 'generic';
export type ReducedMotionPref = 'system' | 'on' | 'off';
export type NintendoConfirmPolicy = 'east' | 'south';

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
  mouseSensitivity: number;
  stickSensitivity: number;
  invertY: boolean;
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
  difficulty: 'normal' | 'hard';
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
    invertY: false,
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
  },
  accessibility: {
    reducedMotion: 'system',
    textScale: 1,
    highContrastUi: false,
    holdToInteract: false,
    largeHud: false,
    colorSafeHud: false,
  },
  meta: { warningsAccepted: false, controlsChooserSeen: false, lastSlot: null, difficulty: 'normal' },
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
  'controls.deadZoneRadial': [0, 0.6],
  'controls.deadZoneAxial': [0, 0.5],
  'controls.menuRepeatDelay': [0.15, 0.8],
  'controls.menuRepeatRate': [0.05, 0.4],
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
  'accessibility.reducedMotion': ['system', 'on', 'off'],
  'meta.difficulty': ['normal', 'hard'],
};
