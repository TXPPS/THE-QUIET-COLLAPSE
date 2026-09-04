/** Kenney Input Prompts vectors → one SVG sprite sheet of <symbol>s filled with currentColor. */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { mb } from './lib/io.mjs';

const VIEWBOX = '0 0 64 64';

function symbolFor(name, svg) {
  const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/?>/g)].map((m) => `<path d="${m[1]}"/>`);
  if (paths.length === 0) throw new Error(`prompt ${name}: no <path> elements`);
  return `<symbol id="${name}" viewBox="${VIEWBOX}">${paths.join('')}</symbol>`;
}

export function buildPrompts(manifest, sources) {
  const entry = sources.find((e) => e.id === 'kenney-input-prompts');
  const symbols = [];
  const ids = [];
  for (const file of entry.files) {
    if (!file.to.endsWith('.svg')) continue;
    const name = basename(file.to, '.svg');
    symbols.push(symbolFor(name, readFileSync(file.to, 'utf8')));
    ids.push(name);
  }
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor">${symbols.join('')}</svg>`;
  const bytes = Buffer.from(sheet, 'utf8');
  const path = manifest.emit('ui.prompts', { dir: 'ui', name: 'prompts', ext: 'svg', bytes, sources: [entry.id], kind: 'svg', meta: { symbols: ids } });
  console.log(`  prompts: ${ids.length} glyphs → ${path} (${mb(bytes.length)})`);
}
