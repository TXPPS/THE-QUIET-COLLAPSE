/**
 * Generates docs/MANUAL.md: the controls table comes straight from the semantic action map and the
 * default bindings (src/input), so the manual can never drift from what the game actually binds.
 *   node scripts/manual.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const OUT = 'docs/MANUAL.md';
const PAD_NAMES = { 0: 'A / ✕ / B', 1: 'B / ○ / A', 2: 'X / □ / Y', 3: 'Y / △ / X', 4: 'LB / L1 / L', 5: 'RB / R1 / R', 6: 'LT / L2 / ZL', 7: 'RT / R2 / ZR', 8: 'View / Share / −', 9: 'Menu / Options / +', 10: 'LS press', 11: 'RS press', 12: 'D-pad ↑', 13: 'D-pad ↓', 14: 'D-pad ←', 15: 'D-pad →', 16: 'Guide / Home' };

function keyName(code) {
  const names = { Space: 'Space', Escape: 'Esc', Enter: 'Enter', NumpadEnter: 'Num Enter', Backspace: 'Backspace', Tab: 'Tab', ShiftLeft: 'Shift', ShiftRight: 'Right Shift', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', PageUp: 'PgUp', PageDown: 'PgDn' };
  if (names[code]) return names[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

function kbmText(binding) {
  if (binding.type === 'key') return keyName(binding.code);
  if (binding.type === 'mouse') return ['Left click', 'Middle click', 'Right click', 'Mouse 4', 'Mouse 5'][binding.button] ?? `Mouse ${binding.button + 1}`;
  return binding.dir === 'up' ? 'Wheel up' : 'Wheel down';
}

function padText(binding) {
  if (binding.type === 'stick') return binding.x === 0 ? 'Left stick' : 'Right stick';
  if (binding.type === 'axis') return `Axis ${binding.index}${binding.sign > 0 ? '+' : '−'}`;
  return PAD_NAMES[binding.index] ?? `Button ${binding.index + 1}`;
}

function axisKeys(map, action) {
  return ['up', 'left', 'down', 'right'].map((dir) => (map[`${action}.${dir}`] ?? []).map(kbmText).join('/')).join(' ');
}

async function main() {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const actions = await server.ssrLoadModule('/src/input/actions.ts');
    const bindings = await server.ssrLoadModule('/src/input/bindings.ts');
    const glyphs = await server.ssrLoadModule('/src/input/PromptGlyphService.ts');
    const touch = glyphs.TOUCH_LABELS ?? {};
    const rows = [];
    for (const action of actions.ACTIONS) {
      const meta = actions.ACTION_META[action];
      const isAxis = meta.kind === 'axis2d';
      const kbm = isAxis ? (action === 'Look' ? 'Mouse' : axisKeys(bindings.DEFAULT_KBM_BINDINGS, action)) : (bindings.DEFAULT_KBM_BINDINGS[action] ?? []).map(kbmText).join(', ');
      const pad = (bindings.DEFAULT_PAD_BINDINGS[action] ?? []).map(padText).join(', ') || (isAxis ? '' : '—');
      const touchLabel = touch[action] ? touch[action][0] : meta.label;
      rows.push(`| ${meta.label} | ${kbm || '—'} | ${pad} | ${touchLabel} | ${meta.context} | ${meta.rebindable ? 'yes' : 'no'} |`);
    }
    const template = readFileSync('docs/MANUAL.template.md', 'utf8');
    const table = ['| Action | Keyboard & mouse | Controller (Xbox / PlayStation / Nintendo) | Touch | Context | Rebindable |', '|---|---|---|---|---|---|', ...rows].join('\n');
    writeFileSync(OUT, template.replace('<!-- CONTROLS_TABLE -->', table));
    console.log(`docs:manual — ${rows.length} actions written to ${OUT}`);
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
