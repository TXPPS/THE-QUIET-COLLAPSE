import type { Plugin } from 'vite';
import { verifyPresets } from '../src/ui/touch/touchPresets';

/**
 * Fails the production build when any touch preset overlaps, crowds the look zone or leaves the
 * safe-area margin at 19.5:9, 20:9, 4:3 or 16:10 (in both look-control modes). The same check runs
 * in the unit tests; this guard keeps a bad preset from ever shipping.
 */
export function touchLayoutCheckPlugin(): Plugin {
  return {
    name: 'tqc-touch-layout-check',
    apply: 'build',
    buildStart() {
      const failures = verifyPresets();
      if (failures.length === 0) {
        this.info(`touch layout check: ${['twoThumb', 'leftFire', 'compactPhone', 'tablet'].length} presets clean at 4 aspect ratios`);
        return;
      }
      this.error(`touch layout check failed:\n${failures.map((f) => `  - ${f.message}`).join('\n')}`);
    },
  };
}
