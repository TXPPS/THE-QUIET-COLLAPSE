/**
 * Licence and provenance gate. Fails when:
 *  - assets/ledger.json or docs/assets/ASSET_LEDGER.md is stale relative to scripts/assets/sources.mjs;
 *  - any file under assets/src is not listed in the ledger (or a listed non-large file is missing);
 *  - any ledger licence is outside the allow-list;
 *  - a file in public/assets is not in public/assets/manifest.json, or a manifest entry names an
 *    unknown source id;
 *  - anything under assets/incoming is present (drop-ins must be moved into sources.mjs first).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildLedger, renderMarkdown } from './assets/ledger.mjs';

const problems = [];
const norm = (p) => p.split('\\').join('/');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(norm(relative(process.cwd(), full)));
  }
  return out;
}

const ledger = buildLedger();
const committed = existsSync('assets/ledger.json') ? readFileSync('assets/ledger.json', 'utf8') : '';
if (committed.replace(/\r\n/g, '\n') !== `${JSON.stringify(ledger, null, 2)}\n`) problems.push('assets/ledger.json is stale — run `pnpm assets:ledger`');
const md = existsSync('docs/assets/ASSET_LEDGER.md') ? readFileSync('docs/assets/ASSET_LEDGER.md', 'utf8') : '';
if (md.replace(/\r\n/g, '\n') !== renderMarkdown(ledger)) problems.push('docs/assets/ASSET_LEDGER.md is stale — run `pnpm assets:ledger`');

const allowed = new Set(ledger.allowedLicenses);
const allowedLib = new Set(ledger.allowedLibraryLicenses);
for (const entry of ledger.entries) if (!allowed.has(entry.license)) problems.push(`${entry.id}: licence ${entry.license} is not allowed`);
for (const lib of ledger.libraries) if (!allowedLib.has(lib.license)) problems.push(`${lib.id}: library licence ${lib.license} is not allowed`);

const listed = new Map();
for (const entry of ledger.entries) for (const file of entry.files) listed.set(file, entry);
const large = new Set(ledger.entries.flatMap((e) => e.largeFiles));
for (const file of walk('assets/src')) {
  if (!listed.has(file)) problems.push(`unlisted file under assets/src: ${file}`);
}
for (const [file] of listed) {
  if (!existsSync(file) && !large.has(file)) problems.push(`listed file missing: ${file} (run \`pnpm assets:fetch\`)`);
}
for (const lib of ledger.libraries) for (const file of lib.files) if (!existsSync(file)) problems.push(`library file missing: ${file}`);

const incoming = walk('assets/incoming').filter((f) => !f.endsWith('.gitkeep') && !f.endsWith('README.md'));
for (const file of incoming) problems.push(`assets/incoming holds ${file}: register it in scripts/assets/sources.mjs and move it under assets/src`);

const manifestPath = 'public/assets/manifest.json';
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const knownIds = new Set([...ledger.entries.map((e) => e.id), ...ledger.libraries.map((l) => l.id), 'original']);
  const outputs = new Set(Object.values(manifest.files ?? {}).map((f) => `public/assets/${f.path}`));
  for (const [key, file] of Object.entries(manifest.files ?? {})) {
    for (const id of file.sources ?? []) if (!knownIds.has(id)) problems.push(`manifest ${key}: unknown source id ${id}`);
    if (!existsSync(`public/assets/${file.path}`)) problems.push(`manifest ${key}: missing output public/assets/${file.path}`);
  }
  for (const file of walk('public/assets')) {
    if (file === manifestPath) continue;
    if (!outputs.has(file)) problems.push(`public/assets file not in manifest: ${file}`);
  }
} else if (walk('public/assets').length > 0) {
  problems.push('public/assets exists without manifest.json — run `pnpm assets:build`');
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`check-assets: ${problem}`);
  console.error(`check-assets: ${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`check-assets: ${ledger.entries.length} sources, ${listed.size} files, licences ${[...allowed].join('/')} — clean.`);
