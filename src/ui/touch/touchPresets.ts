import {
  checkLayout,
  describeReport,
  TOUCH_CONTROL_IDS,
  VERIFICATION_VIEWPORTS,
  type LayoutReport,
  type PresetId,
  type TouchControlId,
  type TouchControlLayout,
  type TouchControls,
  type TouchProfile,
} from './touchLayout';

export const TOUCH_PROFILE_VERSION = 2;

export const CONTROL_LABELS: Record<TouchControlId, string> = {
  joystick: 'Move',
  lookStick: 'Look',
  fire: 'Fire',
  fireLeft: 'Fire (left)',
  aim: 'Aim',
  reload: 'Reload',
  interact: 'Use',
  sprint: 'Run',
  dodge: 'Step',
  jump: 'Jump',
  swap: 'Swap',
  flashlight: 'Light',
  pause: 'Pause',
  inventory: 'Items',
  map: 'Map',
};

type Overrides = Partial<Record<TouchControlId, Partial<TouchControlLayout>>>;

function control(x: number, y: number, size: number, opacity = 0.75, visible = true): TouchControlLayout {
  return { x, y, size, opacity, visible };
}

/*
 * Phone default, built against a 19.5:9 phone (844×390, 44 px notch insets) and real thumb reach:
 * the move stick sits in the lower-left corner, fire is the largest button in the lower-right
 * corner, aim above-left of fire, reload and use above aim, step left of fire, jump left of step, swap
 * and pause in the top-right corner. Nothing lives in the top-centre band. Sprint is push-past on the stick, so
 * its button, the secondary fire, items and map start hidden.
 */
const PHONE_TWO_THUMB: TouchControls = {
  joystick: control(0.05, 1, 0.3, 0.75),
  lookStick: control(0.7, 0.72, 0.27, 0.7, false),
  fire: control(1, 1, 0.21, 0.85),
  fireLeft: control(0.32, 0.67, 0.165, 0.7, false),
  aim: control(0.86, 0.72, 0.165, 0.8),
  reload: control(0.94, 0.42, 0.15, 0.7),
  interact: control(0.8, 0.4, 0.15, 0.8),
  sprint: control(0.17, 0.56, 0.15, 0.7, false),
  dodge: control(0.83, 0.99, 0.15, 0.7),
  jump: control(0.6, 0.99, 0.15, 0.7),
  swap: control(0.88, 0, 0.145, 0.65),
  flashlight: control(0.31, 1, 0.145, 0.65),
  pause: control(1, 0, 0.145, 0.6),
  inventory: control(0.76, 0, 0.145, 0.6, false),
  map: control(0.64, 0, 0.145, 0.6, false),
};

function withOverrides(base: TouchControls, overrides: Overrides): TouchControls {
  const result = {} as TouchControls;
  for (const id of TOUCH_CONTROL_IDS) result[id] = { ...base[id], ...(overrides[id] ?? {}) };
  return result;
}

export interface PresetDef {
  label: string;
  hint: string;
  controls: TouchControls;
}

export const PRESETS: Record<PresetId, PresetDef> = {
  twoThumb: { label: 'Two-thumb default', hint: 'Move left, look and act right. Push the stick past its edge to run.', controls: PHONE_TWO_THUMB },
  leftFire: {
    label: 'Left fire',
    hint: 'A second fire button under the left thumb so aiming and firing never share a hand.',
    controls: withOverrides(PHONE_TWO_THUMB, { fireLeft: { visible: true } }),
  },
  compactPhone: {
    label: 'Compact phone',
    hint: 'Smaller controls pulled toward the corners for narrow screens.',
    controls: withOverrides(PHONE_TWO_THUMB, {
      joystick: { size: 0.26 },
      fire: { size: 0.19 },
      aim: { size: 0.15, x: 0.87, y: 0.73 },
      reload: { size: 0.145, x: 0.95, y: 0.44 },
      interact: { size: 0.145, x: 0.81, y: 0.42 },
      dodge: { size: 0.145, x: 0.84 },
      jump: { size: 0.145, x: 0.6 },
      flashlight: { x: 0.3 },
    }),
  },
  tablet: {
    label: 'Tablet',
    hint: 'Larger margins and smaller controls for wide screens held with both hands.',
    controls: withOverrides(PHONE_TWO_THUMB, {
      joystick: { x: 0.04, y: 0.96, size: 0.24 },
      lookStick: { x: 0.68, y: 0.66, size: 0.22 },
      fire: { x: 0.96, y: 0.95, size: 0.17 },
      fireLeft: { x: 0.28, y: 0.66, size: 0.14 },
      aim: { x: 0.85, y: 0.7, size: 0.14 },
      reload: { x: 0.92, y: 0.44, size: 0.125 },
      interact: { x: 0.8, y: 0.42, size: 0.125 },
      dodge: { x: 0.82, y: 0.95, size: 0.125 },
      jump: { x: 0.62, y: 0.95, size: 0.125 },
      swap: { x: 0.86, y: 0.03, size: 0.12 },
      sprint: { x: 0.16, y: 0.55, size: 0.125 },
      flashlight: { x: 0.27, y: 0.96, size: 0.12 },
      pause: { x: 0.97, y: 0.03, size: 0.12 },
      inventory: { x: 0.75, y: 0.03, size: 0.12 },
      map: { x: 0.64, y: 0.03, size: 0.12 },
    }),
  },
};

export const PRESET_IDS: readonly PresetId[] = ['twoThumb', 'leftFire', 'compactPhone', 'tablet'];

export function presetProfile(preset: PresetId): TouchProfile {
  return { version: TOUCH_PROFILE_VERSION, preset, controls: structuredClone(PRESETS[preset].controls) };
}

export interface PresetFailure {
  preset: PresetId;
  aspect: string;
  lookControl: 'drag' | 'stick';
  report: LayoutReport;
  message: string;
}

/**
 * Checks every preset at every verification aspect, in both look-control modes (the right stick
 * adds a control that must fit too). Used by the unit tests and by the Vite build plugin.
 */
export function verifyPresets(): PresetFailure[] {
  const failures: PresetFailure[] = [];
  for (const preset of PRESET_IDS) {
    for (const lookControl of ['drag', 'stick'] as const) {
      const profile = presetProfile(preset);
      profile.controls.lookStick.visible = lookControl === 'stick';
      for (const [aspect, viewport] of Object.entries(VERIFICATION_VIEWPORTS)) {
        const report = checkLayout(profile, viewport);
        if (!report.ok) failures.push({ preset, aspect, lookControl, report, message: `${preset} @ ${aspect} (${lookControl}): ${describeReport(report, CONTROL_LABELS)}` });
      }
    }
  }
  return failures;
}
