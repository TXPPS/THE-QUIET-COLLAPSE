/**
 * Renders sources.mjs into assets/ledger.json (machine-readable) and docs/assets/ASSET_LEDGER.md.
 * Both files are committed; `pnpm check:assets` fails when they drift from sources.mjs.
 */
import { writeFileSync } from 'node:fs';
import { ALLOWED_LICENSES, ALLOWED_LIBRARY_LICENSES, LIBRARIES, PLACEHOLDERS, SOURCES } from './sources.mjs';

export function buildLedger() {
  const entries = SOURCES.map((entry) => ({
    id: entry.id,
    source: entry.source,
    name: entry.name,
    version: entry.version,
    url: entry.url,
    download: typeof entry.archive === 'string' ? entry.archive : `itch.io: ${entry.archive.itch}`,
    license: entry.license,
    licenseUrl: entry.licenseUrl,
    retrieved: entry.retrieved,
    files: entry.files.map((f) => f.to),
    largeFiles: entry.files.filter((f) => f.large).map((f) => f.to),
    modifications: entry.modifications,
    ...(entry.role ? { role: entry.role } : {}),
  }));
  return {
    version: 1,
    allowedLicenses: ALLOWED_LICENSES,
    allowedLibraryLicenses: ALLOWED_LIBRARY_LICENSES,
    entries,
    libraries: LIBRARIES.map((lib) => ({ ...lib, files: lib.files.map((f) => f.to) })),
    placeholders: PLACEHOLDERS,
  };
}

function bySource(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const list = groups.get(entry.source) ?? [];
    list.push(entry);
    groups.set(entry.source, list);
  }
  return groups;
}

export function renderMarkdown(ledger) {
  const lines = [
    '# Asset ledger',
    '',
    'Generated from `scripts/assets/sources.mjs` by `pnpm assets:ledger`. Do not edit by hand.',
    `Allowed content licences: ${ledger.allowedLicenses.join(', ')}. ` +
      `\`pnpm check:assets\` fails the build when a file under \`assets/\` is missing from this list, a licence is not allowed, or \`public/assets/manifest.json\` references an unknown source.`,
    '',
    `Rows: ${ledger.entries.length} external sources, ${ledger.libraries.length} runtime libraries, ${ledger.placeholders.length} placeholders.`,
    '',
  ];
  for (const [source, entries] of bySource(ledger.entries)) {
    lines.push(`## ${source}`, '', '| Id | Name | Version | Retrieved from | Licence | Local files | Modifications |', '|---|---|---|---|---|---|---|');
    for (const entry of entries) {
      const files = entry.files.length > 6 ? `${entry.files.slice(0, 4).map((f) => `\`${f}\``).join('<br>')}<br>… ${entry.files.length} files` : entry.files.map((f) => `\`${f}\``).join('<br>');
      const large = entry.largeFiles.length ? `<br>Git-ignored (>5 MB): ${entry.largeFiles.map((f) => `\`${f}\``).join(', ')} — re-fetch with \`pnpm assets:fetch\`.` : '';
      lines.push(`| \`${entry.id}\` | ${entry.name} | ${entry.version} | [page](${entry.url}) · ${entry.download.startsWith('itch.io') ? `[itch.io](${entry.download.slice(9)})` : `[download](${entry.download})`} (${entry.retrieved}) | [${entry.license}](${entry.licenseUrl}) | ${files}${large} | ${entry.modifications} |`);
    }
    lines.push('');
  }
  lines.push('## Runtime libraries (code, shipped from `public/vendor`)', '', '| Id | Name | Version | Source | Licence | Files |', '|---|---|---|---|---|---|');
  for (const lib of ledger.libraries) lines.push(`| \`${lib.id}\` | ${lib.name} | ${lib.version} | [link](${lib.url}) | [${lib.license}](${lib.licenseUrl}) | ${lib.files.map((f) => `\`${f}\``).join('<br>')} |`);
  lines.push('', '## Placeholders and original work', '', '| Item | Where | Status | Note |', '|---|---|---|---|');
  for (const p of ledger.placeholders) lines.push(`| ${p.name} | \`${p.where}\` | ${p.status} | ${p.note} |`);
  lines.push('', 'Derived, hashed files under `public/assets/` are listed in `public/assets/manifest.json` with the source id each one came from.', '');
  return lines.join('\n');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/assets/ledger.mjs')) {
  const ledger = buildLedger();
  writeFileSync('assets/ledger.json', `${JSON.stringify(ledger, null, 2)}\n`);
  writeFileSync('docs/assets/ASSET_LEDGER.md', renderMarkdown(ledger));
  console.log(`assets:ledger — ${ledger.entries.length} entries written to assets/ledger.json and docs/assets/ASSET_LEDGER.md`);
}
