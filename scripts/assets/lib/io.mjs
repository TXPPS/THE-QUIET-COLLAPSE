/** Shared plumbing for the asset pipeline: glTF IO, hashed outputs and the manifest. */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const OUT_ROOT = 'public/assets';
/** Files under this folder are never precached; the service worker caches them on first use. */
export const STREAM_DIR = 'stream';
export const HASH_LENGTH = 8;

let io = null;

export async function gltfIO() {
  if (io) return io;
  await MeshoptEncoder.ready;
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  return io;
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export class Manifest {
  constructor() {
    this.files = {};
    this.previous = existsSync(join(OUT_ROOT, 'manifest.json')) ? JSON.parse(readFileSync(join(OUT_ROOT, 'manifest.json'), 'utf8')) : null;
  }

  /**
   * Writes `bytes` to public/assets/<dir>/<name>-<hash>.<ext> and records it under `key`.
   * `sources` are ledger ids; `precache` false puts the file under the stream folder.
   */
  emit(key, { dir, name, ext, bytes, sources, kind, precache = true, meta = {} }) {
    const hash = sha256(bytes).slice(0, HASH_LENGTH);
    const relDir = precache ? dir : `${STREAM_DIR}/${dir}`;
    const path = `${relDir}/${name}-${hash}.${ext}`;
    const full = join(OUT_ROOT, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, bytes);
    this.files[key] = { path, bytes: bytes.length, sources, kind, precache, ...meta };
    return path;
  }

  write() {
    const keys = Object.keys(this.files).sort();
    const files = {};
    for (const key of keys) files[key] = this.files[key];
    const precached = keys.filter((k) => files[k].precache).reduce((sum, k) => sum + files[k].bytes, 0);
    const streamed = keys.filter((k) => !files[k].precache).reduce((sum, k) => sum + files[k].bytes, 0);
    const manifest = { version: 1, generated: new Date().toISOString(), precachedBytes: precached, streamedBytes: streamed, files };
    writeFileSync(join(OUT_ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  }
}

/** Removes every previous output so stale hashes never linger. */
export function cleanOutput() {
  if (existsSync(OUT_ROOT)) rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUT_ROOT, { recursive: true });
}

export function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
