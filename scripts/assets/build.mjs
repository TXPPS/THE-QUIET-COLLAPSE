/**
 * Asset pipeline: assets/src → public/assets (hashed, compressed) + public/assets/manifest.json.
 * KTX2 textures are encoded with the Basis Universal wasm encoder (fetched once into assets/.cache).
 * Run `pnpm assets:fetch` first.
 */
import { buildAudio } from './build-audio.mjs';
import { buildCharacters } from './build-characters.mjs';
import { buildKits } from './build-kits.mjs';
import { buildPrompts } from './build-prompts.mjs';
import { buildTextures } from './build-textures.mjs';
import { Manifest, cleanOutput, mb } from './lib/io.mjs';
import { ensureBasisEncoder } from './lib/basis.mjs';
import { SOURCES } from './sources.mjs';

/** Precache budgets from the wave brief: the test-area bundle must stay under 25 MB in total. */
const PRECACHE_BUDGET_BYTES = 25 * 1024 * 1024;

async function main() {
  console.log(`assets:build — ${await ensureBasisEncoder()}`);
  cleanOutput();
  const manifest = new Manifest();
  await buildKits(manifest, SOURCES);
  await buildCharacters(manifest, SOURCES);
  await buildTextures(manifest, SOURCES);
  buildPrompts(manifest, SOURCES);
  buildAudio(manifest, SOURCES);
  const result = manifest.write();
  const entries = Object.entries(result.files);
  const largest = entries.sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 8);
  console.log(`assets:build — ${entries.length} files, precached ${mb(result.precachedBytes)}, streamed ${mb(result.streamedBytes)}`);
  for (const [key, file] of largest) console.log(`    ${mb(file.bytes).padStart(9)}  ${key}${file.precache ? '' : ' (stream)'}`);
  if (result.precachedBytes > PRECACHE_BUDGET_BYTES) {
    console.error(`assets:build — precache budget exceeded: ${mb(result.precachedBytes)} > ${mb(PRECACHE_BUDGET_BYTES)}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
