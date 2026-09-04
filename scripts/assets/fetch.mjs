/**
 * Re-downloads every external archive named in sources.mjs into assets/.cache and extracts the
 * listed files into assets/src. Idempotent: cached archives are reused, existing files skipped
 * unless --force. Quaternius packs come through itch.io's anonymous download flow.
 *
 *   node scripts/assets/fetch.mjs [--force] [--only <id-prefix>]
 */
import AdmZip from 'adm-zip';
import { createWriteStream, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { SOURCES } from './sources.mjs';

const ROOT = process.cwd();
const CACHE = join(ROOT, 'assets', '.cache');
const UA = { 'User-Agent': 'Mozilla/5.0 (asset fetch; THE QUIET COLLAPSE build)' };
const force = process.argv.includes('--force');
const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;

function ensureDir(file) {
  mkdirSync(dirname(file), { recursive: true });
}

async function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 0 && !force) return false;
  ensureDir(dest);
  const response = await fetch(url, { headers: UA });
  if (!response.ok || !response.body) throw new Error(`GET ${url} → ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
  return true;
}

/** itch.io: game page → csrf token → download page → per-upload signed CDN URL (no account needed for free packs). */
async function itchDownloadUrl(page) {
  const first = await fetch(page, { headers: UA });
  const html = await first.text();
  const csrf = (html.match(/name="csrf_token" value="([^"]+)"/) ?? [])[1];
  if (!csrf) throw new Error(`itch: no csrf token on ${page}`);
  const cookie = (first.headers.get('set-cookie') ?? '').split(/,(?=[^ ])/).map((c) => c.split(';')[0]).join('; ');
  const headers = { ...UA, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie };
  const body = `csrf_token=${encodeURIComponent(csrf)}`;
  const downloadPage = await (await fetch(`${page}/download_url`, { method: 'POST', headers, body })).json();
  const listing = await (await fetch(downloadPage.url, { headers: { ...UA, Cookie: cookie } })).text();
  const uploadId = (listing.match(/data-upload_id="(\d+)"/) ?? [])[1];
  if (!uploadId) throw new Error(`itch: no upload on ${page}`);
  const file = await (await fetch(`${page}/file/${uploadId}?source=view_game&as_prop=true`, { method: 'POST', headers, body })).json();
  if (!file.url) throw new Error(`itch: no file url for ${page}`);
  return file.url;
}

function cachePath(entry, key = '') {
  const archive = key ? entry.archives[key] : entry.archive;
  const url = typeof archive === 'string' ? archive : archive.itch;
  const ext = /\.hdr$/i.test(url) ? '.hdr' : /\.mp3$/i.test(url) ? '.mp3' : '.zip';
  return join(CACHE, `${entry.id}${key ? `-${key}` : ''}${ext}`);
}

async function fetchArchive(entry, key = '') {
  const archive = key ? entry.archives[key] : entry.archive;
  const dest = cachePath(entry, key);
  if (existsSync(dest) && !force) return dest;
  const url = typeof archive === 'string' ? archive : await itchDownloadUrl(archive.itch);
  console.log(`  ↓ ${entry.id}${key ? ` (${key})` : ''}`);
  await download(url, dest);
  return dest;
}

function extract(entry, archivePath, files) {
  if (!archivePath.endsWith('.zip')) {
    for (const file of files) {
      const dest = join(ROOT, file.to);
      if (existsSync(dest) && !force) continue;
      ensureDir(dest);
      copyFileSync(archivePath, dest);
    }
    return;
  }
  const zip = new AdmZip(archivePath);
  for (const file of files) {
    const dest = join(ROOT, file.to);
    if (existsSync(dest) && !force) continue;
    const zipEntry = zip.getEntry(file.from);
    if (!zipEntry) throw new Error(`${entry.id}: ${file.from} not found in ${archivePath}`);
    ensureDir(dest);
    zip.extractEntryTo(zipEntry, dirname(dest), false, true, false, dest.split(/[\\/]/).pop());
  }
}

async function main() {
  let count = 0;
  for (const entry of SOURCES) {
    if (only && !entry.id.startsWith(only)) continue;
    const primary = entry.files.filter((f) => !(entry.archives && f.from in entry.archives));
    const archivePath = await fetchArchive(entry);
    extract(entry, archivePath, primary);
    for (const key of Object.keys(entry.archives ?? {})) {
      const extra = entry.files.filter((f) => f.from === key);
      const path = await fetchArchive(entry, key);
      extract(entry, path, extra);
    }
    count += entry.files.length;
  }
  console.log(`assets:fetch — ${count} files present under assets/src`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
