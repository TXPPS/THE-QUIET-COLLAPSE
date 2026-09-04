/**
 * KTX2 encoding through the Basis Universal WebAssembly encoder (Apache-2.0, build tool only —
 * never shipped). The two files are fetched once into assets/.cache/basis from a pinned commit, so
 * the pipeline needs no native installs and behaves identically on every machine.
 */
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const COMMIT = '99f52d63aa6799cbdaecfe977111dc5ec3b31d47';
const BASE = `https://raw.githubusercontent.com/BinomialLLC/basis_universal/${COMMIT}/webgl/encoder/build/`;
const DIR = resolve('assets/.cache/basis');
/** The JS glue is saved as .cjs so Node loads it as CommonJS regardless of the package type. */
const FILES = [['basis_encoder.js', 'basis_encoder.cjs'], ['basis_encoder.wasm', 'basis_encoder.wasm']];
/** Output scratch buffer: comfortably above any 2048² ETC1S/UASTC texture with mipmaps. */
const OUTPUT_CAPACITY = 24 * 1024 * 1024;

let modulePromise = null;

export async function ensureBasisEncoder() {
  mkdirSync(DIR, { recursive: true });
  for (const [file, local] of FILES) {
    const dest = join(DIR, local);
    if (existsSync(dest)) continue;
    const response = await fetch(BASE + file);
    if (!response.ok || !response.body) throw new Error(`basis encoder download failed: ${file} → ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
  }
  return `basis_universal@${COMMIT.slice(0, 7)}`;
}

async function loadModule() {
  if (!modulePromise) {
    modulePromise = (async () => {
      await ensureBasisEncoder();
      const require = createRequire(import.meta.url);
      const factory = require(join(DIR, 'basis_encoder.cjs'));
      const module = await factory({ locateFile: (file) => join(DIR, file), print: () => undefined, printErr: (line) => console.error(line) });
      module.initializeBasis();
      return module;
    })();
  }
  return modulePromise;
}

/**
 * @param {{ data: Uint8Array, width: number, height: number }} rgba  Raw 8-bit RGBA pixels.
 * @param {{ srgb: boolean, mode?: 'etc1s' | 'uastc', quality?: number, mipmaps?: boolean }} options
 * @returns {Promise<Buffer>} KTX2 file bytes
 */
export async function encodeRgbaToKtx2(rgba, options) {
  const { srgb, mode = 'etc1s', quality = 128, mipmaps = true } = options;
  const module = await loadModule();
  const encoder = new module.BasisEncoder();
  try {
    if (typeof encoder.controlThreading === 'function') encoder.controlThreading(false, 0);
    if (typeof encoder.setStatusOutput === 'function') encoder.setStatusOutput(false);
    encoder.setCreateKTX2File(true);
    encoder.setKTX2UASTCSupercompression(true);
    encoder.setPerceptual(srgb);
    encoder.setKTX2AndBasisSRGBTransferFunc(srgb);
    encoder.setMipSRGB(srgb);
    encoder.setSliceSourceImage(0, rgba.data, rgba.width, rgba.height, module.ldr_image_type.cRGBA32.value);
    encoder.setFormatMode(mode === 'uastc' ? module.basis_tex_format.cUASTC_LDR_4x4.value : module.basis_tex_format.cETC1S.value);
    if (mode === 'etc1s') {
      encoder.setQualityLevel(quality);
      encoder.setETC1SCompressionLevel(2);
    } else {
      encoder.setPackUASTCFlags(2);
      encoder.setRDOUASTC(true);
    }
    encoder.setMipGen(mipmaps);
    encoder.setCheckForAlpha(false);
    const out = new Uint8Array(OUTPUT_CAPACITY);
    const length = encoder.encode(out);
    if (length <= 0) throw new Error('basis encoder returned no data');
    return Buffer.from(out.subarray(0, length));
  } finally {
    encoder.delete();
  }
}
