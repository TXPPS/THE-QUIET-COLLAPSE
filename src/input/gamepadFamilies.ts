import type { GlyphFamily } from './InputSource';

export type ControllerFamily = 'xbox' | 'playstation' | 'nintendo' | 'generic' | 'unknown';

export interface FamilyClassification {
  family: ControllerFamily;
  confidence: number;
  label: string;
}

interface FamilyRule {
  pattern: RegExp;
  family: ControllerFamily;
  confidence: number;
  label: string;
}

/**
 * Ordered, conservative rules over the (non-standardized) Gamepad `id` string. First match wins.
 * Vendor ids: 045e Microsoft, 054c Sony, 057e Nintendo, 28de Valve. Low-confidence matches fall
 * back to generic glyphs unless the player overrides the family manually.
 */
export const FAMILY_RULES: readonly FamilyRule[] = [
  { pattern: /dualsense|dualshock|playstation|054c|sony/i, family: 'playstation', confidence: 0.95, label: 'PlayStation controller' },
  { pattern: /nintendo|joy-con|switch pro|pro controller|057e/i, family: 'nintendo', confidence: 0.95, label: 'Nintendo controller' },
  { pattern: /xbox|045e|xinput/i, family: 'xbox', confidence: 0.9, label: 'Xbox controller' },
  { pattern: /steam|28de/i, family: 'xbox', confidence: 0.6, label: 'Steam controller' },
  { pattern: /^wireless controller/i, family: 'playstation', confidence: 0.55, label: 'Wireless controller' },
  { pattern: /8bitdo/i, family: 'nintendo', confidence: 0.5, label: '8BitDo controller' },
  { pattern: /gamepad|joystick|controller/i, family: 'generic', confidence: 0.4, label: 'Generic controller' },
];

const FAMILY_CONFIDENCE_FLOOR = 0.6;

export function classifyGamepad(id: string, mapping: string): FamilyClassification {
  for (const rule of FAMILY_RULES) {
    if (rule.pattern.test(id)) {
      const standardBonus = mapping === 'standard' ? 0 : -0.1;
      return { family: rule.family, confidence: Math.max(0, rule.confidence + standardBonus), label: rule.label };
    }
  }
  return { family: 'unknown', confidence: 0.2, label: 'Unknown controller' };
}

/** Glyph family used for prompts: low-confidence or unknown classifications use generic glyphs. */
export function glyphFamilyFor(classification: FamilyClassification): GlyphFamily {
  if (classification.confidence < FAMILY_CONFIDENCE_FLOOR) return 'generic';
  if (classification.family === 'unknown' || classification.family === 'generic') return 'generic';
  return classification.family;
}

/** Trims the browser's verbose id ("Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)"). */
export function friendlyGamepadName(id: string, classification: FamilyClassification): string {
  const trimmed = id.replace(/\(.*?\)/g, '').replace(/vendor:.*$/i, '').trim();
  if (trimmed.length >= 3 && trimmed.length <= 40) return trimmed;
  return classification.label;
}
