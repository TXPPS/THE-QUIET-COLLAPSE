/**
 * Touch HUD layout geometry. Pure functions, no imports: this module is also loaded by the Vite
 * build plugin that fails the build when a preset overlaps or leaves the safe area.
 *
 * Coordinates: `x`/`y` are 0..1 across the range of centres that keep the whole control inside the
 * safe area with an 8 px margin, so `x = 1` always means "touching the right margin" whatever the
 * aspect ratio. `size` is the diameter as a fraction of a clamped reference side, so controls stay
 * thumb-sized on tablets instead of growing with the screen.
 */

export type TouchControlId =
  | 'joystick'
  | 'lookStick'
  | 'fire'
  | 'fireLeft'
  | 'aim'
  | 'reload'
  | 'interact'
  | 'sprint'
  | 'dodge'
  | 'jump'
  | 'swap'
  | 'flashlight'
  | 'pause'
  | 'inventory'
  | 'map';

export type PresetId = 'twoThumb' | 'leftFire' | 'compactPhone' | 'tablet';

export interface TouchControlLayout {
  x: number;
  y: number;
  size: number;
  opacity: number;
  visible: boolean;
}

export type TouchControls = Record<TouchControlId, TouchControlLayout>;

export interface TouchProfile {
  version: number;
  preset: PresetId | 'custom';
  controls: TouchControls;
}

export interface Viewport {
  width: number;
  height: number;
  safe: { top: number; right: number; bottom: number; left: number };
}

export interface ControlRect {
  cx: number;
  cy: number;
  d: number;
  r: number;
}

export interface ZoneRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const TOUCH_CONTROL_IDS: readonly TouchControlId[] = [
  'joystick',
  'lookStick',
  'fire',
  'fireLeft',
  'aim',
  'reload',
  'interact',
  'sprint',
  'dodge',
  'jump',
  'swap',
  'flashlight',
  'pause',
  'inventory',
  'map',
];

/** Controls that must always stay on screen and visible. */
export const ESSENTIAL_CONTROLS: readonly TouchControlId[] = ['joystick', 'fire', 'aim', 'interact', 'pause'];
/** Primary combat targets get the larger minimum. */
export const PRIMARY_CONTROLS: ReadonlySet<TouchControlId> = new Set(['fire', 'fireLeft', 'aim']);
/** Left-thumb controls must never reach into the right-hand look zone. */
export const LEFT_HAND_CONTROLS: readonly TouchControlId[] = ['joystick', 'fireLeft', 'sprint', 'flashlight'];
/** Buttons that only appear when the action is valid; the layout still reserves their space. */
export const CONTEXTUAL_CONTROLS: readonly TouchControlId[] = ['reload', 'interact', 'fire', 'fireLeft', 'flashlight'];

export const MIN_TARGET_PX = 56;
export const MIN_PRIMARY_PX = 72;
export const MIN_GAP_PX = 12;
export const SAFE_EDGE_MARGIN_PX = 8;
/** Reference side used to scale `size`: the shorter viewport side clamped to this range. */
export const REF_SIDE_RANGE: readonly [number, number] = [320, 520];
export const SIZE_RANGE: readonly [number, number] = [0.1, 0.36];
export const OPACITY_RANGE: readonly [number, number] = [0.2, 1];
/** Minimum share of the look zone that must stay free of buttons for a drag to be comfortable. */
export const MIN_LOOK_ZONE_FREE = 0.6;

function clampNumber(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function referenceSide(viewport: Viewport): number {
  return clampNumber(Math.min(viewport.width, viewport.height), REF_SIDE_RANGE[0], REF_SIDE_RANGE[1]);
}

export function controlDiameter(id: TouchControlId, layout: TouchControlLayout, viewport: Viewport): number {
  const min = PRIMARY_CONTROLS.has(id) ? MIN_PRIMARY_PX : MIN_TARGET_PX;
  return Math.max(min, layout.size * referenceSide(viewport));
}

function centreRange(viewport: Viewport, r: number): { x0: number; x1: number; y0: number; y1: number } {
  const { safe } = viewport;
  const inset = SAFE_EDGE_MARGIN_PX + r;
  return {
    x0: safe.left + inset,
    x1: Math.max(safe.left + inset, viewport.width - safe.right - inset),
    y0: safe.top + inset,
    y1: Math.max(safe.top + inset, viewport.height - safe.bottom - inset),
  };
}

/** Pixel rectangle of a control (centre, diameter, radius) for a viewport. */
export function controlRect(id: TouchControlId, layout: TouchControlLayout, viewport: Viewport): ControlRect {
  const d = controlDiameter(id, layout, viewport);
  const r = d / 2;
  const range = centreRange(viewport, r);
  return { cx: range.x0 + layout.x * (range.x1 - range.x0), cy: range.y0 + layout.y * (range.y1 - range.y0), d, r };
}

/** Inverse of `controlRect` for dragging in the editor: pixel centre to layout fractions. */
export function layoutFromCentre(id: TouchControlId, layout: TouchControlLayout, viewport: Viewport, cx: number, cy: number): { x: number; y: number } {
  const r = controlDiameter(id, layout, viewport) / 2;
  const range = centreRange(viewport, r);
  const spanX = range.x1 - range.x0;
  const spanY = range.y1 - range.y0;
  return { x: spanX > 0 ? clampNumber((cx - range.x0) / spanX, 0, 1) : 0.5, y: spanY > 0 ? clampNumber((cy - range.y0) / spanY, 0, 1) : 0.5 };
}

/** The drag-to-look zone: the right half of the surface inside the safe area (buttons sit on top). */
export function lookZoneRect(viewport: Viewport): ZoneRect {
  const { safe } = viewport;
  return { x0: Math.max(viewport.width / 2, safe.left), y0: safe.top, x1: viewport.width - safe.right, y1: viewport.height - safe.bottom };
}

/** The floating-joystick zone: the left half inside the safe area. */
export function moveZoneRect(viewport: Viewport): ZoneRect {
  const { safe } = viewport;
  return { x0: safe.left, y0: safe.top, x1: Math.min(viewport.width / 2, viewport.width - safe.right), y1: viewport.height - safe.bottom };
}

/** Clamps every control into range and enforces essential visibility; missing controls take `fallback`. */
export function clampProfile(profile: TouchProfile, fallback: TouchControls, version: number): TouchProfile {
  const controls = {} as TouchControls;
  for (const id of TOUCH_CONTROL_IDS) {
    const source = profile.controls[id] ?? fallback[id];
    controls[id] = {
      x: clampNumber(source.x, 0, 1),
      y: clampNumber(source.y, 0, 1),
      size: clampNumber(source.size, SIZE_RANGE[0], SIZE_RANGE[1]),
      opacity: clampNumber(source.opacity, OPACITY_RANGE[0], OPACITY_RANGE[1]),
      visible: ESSENTIAL_CONTROLS.includes(id) ? true : source.visible,
    };
  }
  return { version, preset: profile.preset, controls };
}

function visibleIds(profile: TouchProfile): TouchControlId[] {
  return TOUCH_CONTROL_IDS.filter((id) => profile.controls[id].visible);
}

/** Pairs of visible controls whose circles come closer than `gap` pixels. */
export function findOverlaps(profile: TouchProfile, viewport: Viewport, gap = MIN_GAP_PX): Array<[TouchControlId, TouchControlId]> {
  const result: Array<[TouchControlId, TouchControlId]> = [];
  const ids = visibleIds(profile);
  const rects = ids.map((id) => controlRect(id, profile.controls[id], viewport));
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = rects[i] as ControlRect;
      const b = rects[j] as ControlRect;
      if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.r + b.r + gap) result.push([ids[i] as TouchControlId, ids[j] as TouchControlId]);
    }
  }
  return result;
}

/** Visible controls closer than `margin` pixels to a safe-area edge. */
export function findSafeAreaViolations(profile: TouchProfile, viewport: Viewport, margin = SAFE_EDGE_MARGIN_PX): TouchControlId[] {
  const { safe } = viewport;
  const epsilon = 0.01;
  return visibleIds(profile).filter((id) => {
    const rect = controlRect(id, profile.controls[id], viewport);
    return (
      rect.cx - rect.r < safe.left + margin - epsilon ||
      rect.cx + rect.r > viewport.width - safe.right - margin + epsilon ||
      rect.cy - rect.r < safe.top + margin - epsilon ||
      rect.cy + rect.r > viewport.height - safe.bottom - margin + epsilon
    );
  });
}

function circleTouchesZone(rect: ControlRect, zone: ZoneRect): boolean {
  const nx = clampNumber(rect.cx, zone.x0, zone.x1);
  const ny = clampNumber(rect.cy, zone.y0, zone.y1);
  return Math.hypot(rect.cx - nx, rect.cy - ny) < rect.r;
}

/** Left-thumb controls that reach into the look zone (the look zone would swallow their touches). */
export function findLookZoneIntrusions(profile: TouchProfile, viewport: Viewport): TouchControlId[] {
  const zone = lookZoneRect(viewport);
  return LEFT_HAND_CONTROLS.filter((id) => profile.controls[id].visible && circleTouchesZone(controlRect(id, profile.controls[id], viewport), zone));
}

/** Share of the look zone not covered by visible controls (sampled on a grid). */
export function lookZoneFreeFraction(profile: TouchProfile, viewport: Viewport): number {
  const zone = lookZoneRect(viewport);
  const rects = visibleIds(profile).map((id) => controlRect(id, profile.controls[id], viewport));
  const steps = 40;
  let free = 0;
  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < steps; j += 1) {
      const x = zone.x0 + ((i + 0.5) / steps) * (zone.x1 - zone.x0);
      const y = zone.y0 + ((j + 0.5) / steps) * (zone.y1 - zone.y0);
      if (!rects.some((rect) => Math.hypot(rect.cx - x, rect.cy - y) < rect.r + MIN_GAP_PX / 2)) free += 1;
    }
  }
  return free / (steps * steps);
}

export interface LayoutReport {
  overlaps: Array<[TouchControlId, TouchControlId]>;
  safeViolations: TouchControlId[];
  lookIntrusions: TouchControlId[];
  lookFreeFraction: number;
  ok: boolean;
}

/** Everything the editor warns about and the build refuses. */
export function checkLayout(profile: TouchProfile, viewport: Viewport): LayoutReport {
  const overlaps = findOverlaps(profile, viewport);
  const safeViolations = findSafeAreaViolations(profile, viewport);
  const lookIntrusions = findLookZoneIntrusions(profile, viewport);
  const lookFreeFraction = lookZoneFreeFraction(profile, viewport);
  return { overlaps, safeViolations, lookIntrusions, lookFreeFraction, ok: overlaps.length === 0 && safeViolations.length === 0 && lookIntrusions.length === 0 && lookFreeFraction >= MIN_LOOK_ZONE_FREE };
}

export function describeReport(report: LayoutReport, labels: Record<TouchControlId, string>): string {
  const parts: string[] = [];
  if (report.overlaps.length > 0) parts.push(`Overlapping: ${report.overlaps.map(([a, b]) => `${labels[a]} / ${labels[b]}`).join(', ')}`);
  if (report.safeViolations.length > 0) parts.push(`Too close to the edge: ${report.safeViolations.map((id) => labels[id]).join(', ')}`);
  if (report.lookIntrusions.length > 0) parts.push(`Inside the look zone: ${report.lookIntrusions.map((id) => labels[id]).join(', ')}`);
  if (report.lookFreeFraction < MIN_LOOK_ZONE_FREE) parts.push(`Look zone crowded (${Math.round(report.lookFreeFraction * 100)}% free)`);
  return parts.join(' · ');
}

/** Aspect ratios every preset is verified against (§8 touch QA). */
export const VERIFICATION_VIEWPORTS: Record<string, Viewport> = {
  '19.5:9': { width: 844, height: 390, safe: { top: 0, right: 44, bottom: 20, left: 44 } },
  '20:9': { width: 880, height: 396, safe: { top: 0, right: 40, bottom: 0, left: 40 } },
  '4:3': { width: 1024, height: 768, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  '16:10': { width: 1280, height: 800, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
};
