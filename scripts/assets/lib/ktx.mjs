/**
 * Texture preparation (sharp) and KTX2 / Basis Universal encoding (wasm encoder, see basis.mjs).
 * Every texture is resized to a power-of-two square before encoding.
 */
import sharp from 'sharp';
import { encodeRgbaToKtx2 } from './basis.mjs';

/**
 * @param {Buffer} image  Source image (any format sharp reads).
 * @param {{ size: number, srgb: boolean, mode?: 'etc1s' | 'uastc', quality?: number, mipmaps?: boolean }} options
 * @returns {Promise<Buffer>} KTX2 bytes
 */
export async function encodeKtx2(image, options) {
  const { size } = options;
  const data = await sharp(image).resize(size, size, { fit: 'fill', kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
  return encodeRgbaToKtx2({ data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width: size, height: size }, options);
}

/** Packs ambient occlusion (R) and roughness (G) into one linear RGB texture (glTF metallic-roughness layout with AO in red). */
export async function packOcclusionRoughness(aoJpeg, roughnessJpeg, size) {
  const ao = aoJpeg ? await sharp(aoJpeg).resize(size, size).greyscale().raw().toBuffer() : Buffer.alloc(size * size, 255);
  const rough = await sharp(roughnessJpeg).resize(size, size).greyscale().raw().toBuffer();
  const rgb = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i += 1) {
    rgb[i * 3] = ao[i];
    rgb[i * 3 + 1] = rough[i];
    rgb[i * 3 + 2] = 0;
  }
  return sharp(rgb, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}

/**
 * Turns the base-character suit albedo into plain dark clothing: desaturate, darken, add a fine
 * cloth-weave noise so the surface does not read as a rubber suit under the flashlight.
 */
export async function clothingAlbedo(png, { size, tint, weave = 0.08 }) {
  const base = await sharp(png).resize(size, size).removeAlpha().modulate({ saturation: 0.35, brightness: 0.72 }).raw().toBuffer();
  const out = Buffer.alloc(size * size * 3);
  const [tr, tg, tb] = tint;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 3;
      // Deterministic weave: two interleaved stripes at 2-texel pitch plus a hash-based speckle.
      const stripe = ((x >> 1) + (y >> 1)) & 1 ? 1 + weave : 1 - weave;
      const speckle = 1 + ((((x * 73856093) ^ (y * 19349663)) % 17) / 17) * weave - weave / 2;
      const gain = stripe * speckle;
      out[i] = Math.min(255, base[i] * tr * gain);
      out[i + 1] = Math.min(255, base[i + 1] * tg * gain);
      out[i + 2] = Math.min(255, base[i + 2] * tb * gain);
    }
  }
  return sharp(out, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}
