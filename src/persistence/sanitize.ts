import { clamp } from '@/core/math';
import { isFiniteNumber, isRecord } from './Storage';

export interface SanitizeRules {
  ranges: Record<string, [number, number]>;
  enums: Record<string, readonly string[]>;
}

/**
 * Rebuilds a settings-like object from `defaults`, accepting values from `input` only when they
 * have the same primitive type, are within range, and are allowed enum members. Unknown keys are
 * dropped, missing keys take defaults, so any corrupted or outdated payload yields a valid object.
 */
export function sanitize<T extends object>(defaults: T, input: unknown, rules: SanitizeRules, path = ''): T {
  const source = isRecord(input) ? input : {};
  const defaultsRecord = defaults as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(defaultsRecord)) {
    const fallback = defaultsRecord[key];
    const candidate = source[key];
    const fullPath = path ? `${path}.${key}` : key;
    result[key] = sanitizeLeaf(fallback, candidate, rules, fullPath);
  }
  return result as T;
}

function sanitizeLeaf(fallback: unknown, candidate: unknown, rules: SanitizeRules, path: string): unknown {
  if (isRecord(fallback)) return sanitize(fallback, candidate, rules, path);
  if (fallback === null) return candidate === null || isFiniteNumber(candidate) || typeof candidate === 'string' ? candidate : null;
  if (typeof fallback === 'number') {
    if (!isFiniteNumber(candidate)) return fallback;
    const range = rules.ranges[path];
    return range ? clamp(candidate, range[0], range[1]) : candidate;
  }
  if (typeof fallback === 'boolean') return typeof candidate === 'boolean' ? candidate : fallback;
  if (typeof fallback === 'string') {
    if (typeof candidate !== 'string') return fallback;
    const allowed = rules.enums[path];
    return allowed && !allowed.includes(candidate) ? fallback : candidate;
  }
  return fallback;
}
