import type { Plugin, ResolvedConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PROJECT_ID } from '../src/config/project';

const SW_TEMPLATE = 'src/sw/service-worker.js';
const SW_OUTPUT = 'sw.js';
const EXCLUDED_SUFFIXES = ['.map', SW_OUTPUT];
const EXCLUDED_FILES = ['_headers', '_redirects', 'precache-manifest.json'];
/** Streamed assets (hi-res textures, ambience beds) are cached on first use, never precached. */
const EXCLUDED_PREFIXES = ['assets/stream/'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * Emits a precaching service worker after the production bundle is written.
 * The cache name changes whenever any precached file changes, so upgrades are deterministic.
 */
export function serviceWorkerPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'tqc-service-worker',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      const outDir = join(config.root, config.build.outDir);
      const files = walk(outDir)
        .map((file) => relative(outDir, file).split('\\').join('/'))
        .filter((file) => !EXCLUDED_SUFFIXES.some((suffix) => file.endsWith(suffix)) && !EXCLUDED_FILES.includes(file) && !EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix)))
        .sort();
      const hash = createHash('sha256');
      for (const file of files) hash.update(readFileSync(join(outDir, file)));
      const version = hash.digest('hex').slice(0, 12);
      const template = readFileSync(join(config.root, SW_TEMPLATE), 'utf8');
      const source = template
        .replace('__CACHE_NAME__', JSON.stringify(`${PROJECT_ID}-${version}`))
        .replace('__PRECACHE__', JSON.stringify(files.map((file) => `./${file}`)));
      writeFileSync(join(outDir, SW_OUTPUT), source);
      const totalBytes = files.reduce((sum, file) => sum + statSync(join(outDir, file)).size, 0);
      writeFileSync(join(outDir, 'precache-manifest.json'), JSON.stringify({ cacheName: `${PROJECT_ID}-${version}`, files, totalBytes }, null, 2));
      config.logger.info(`[tqc] service worker written with ${files.length} precached files, ${(totalBytes / 1024 / 1024).toFixed(2)} MB (${version})`);
    },
  };
}
