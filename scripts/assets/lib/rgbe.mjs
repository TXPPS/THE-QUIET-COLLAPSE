/** Minimal Radiance .hdr (RGBE) reader/writer used to downsample environment maps. */

function parseHeader(bytes) {
  let offset = 0;
  const lines = [];
  while (offset < bytes.length) {
    let end = bytes.indexOf(0x0a, offset);
    if (end < 0) throw new Error('rgbe: unterminated header');
    const line = bytes.subarray(offset, end).toString('latin1');
    offset = end + 1;
    if (line.length === 0) break; // blank line ends the header
    lines.push(line);
  }
  const resolution = bytes.indexOf(0x0a, offset);
  const [, height, , width] = bytes.subarray(offset, resolution).toString('latin1').trim().split(/\s+/);
  return { width: Number(width), height: Number(height), dataOffset: resolution + 1, lines };
}

/** @returns {{ width: number, height: number, data: Float32Array }} linear RGB floats */
export function decodeRgbe(bytes) {
  const { width, height, dataOffset } = parseHeader(bytes);
  const rgbe = new Uint8Array(width * height * 4);
  let pos = dataOffset;
  let out = 0;
  for (let y = 0; y < height; y += 1) {
    const isRle = width >= 8 && width < 0x8000 && bytes[pos] === 2 && bytes[pos + 1] === 2 && (bytes[pos + 2] & 0x80) === 0;
    if (!isRle) {
      rgbe.set(bytes.subarray(pos, pos + width * 4), out);
      pos += width * 4;
      out += width * 4;
      continue;
    }
    pos += 4;
    const scan = new Uint8Array(width * 4);
    for (let channel = 0; channel < 4; channel += 1) {
      let x = 0;
      while (x < width) {
        let count = bytes[pos++];
        if (count > 128) {
          count -= 128;
          const value = bytes[pos++];
          for (let i = 0; i < count; i += 1) scan[(x++) * 4 + channel] = value;
        } else {
          for (let i = 0; i < count; i += 1) scan[(x++) * 4 + channel] = bytes[pos++];
        }
      }
    }
    rgbe.set(scan, out);
    out += width * 4;
  }
  const data = new Float32Array(width * height * 3);
  for (let i = 0; i < width * height; i += 1) {
    const e = rgbe[i * 4 + 3];
    const scale = e === 0 ? 0 : Math.pow(2, e - 128 - 8);
    data[i * 3] = rgbe[i * 4] * scale;
    data[i * 3 + 1] = rgbe[i * 4 + 1] * scale;
    data[i * 3 + 2] = rgbe[i * 4 + 2] * scale;
  }
  return { width, height, data };
}

/** Box-filter downsample by an integer factor. */
export function downsample(image, factor) {
  const width = Math.floor(image.width / factor);
  const height = Math.floor(image.height / factor);
  const data = new Float32Array(width * height * 3);
  const norm = 1 / (factor * factor);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          const i = ((y * factor + dy) * image.width + (x * factor + dx)) * 3;
          r += image.data[i];
          g += image.data[i + 1];
          b += image.data[i + 2];
        }
      }
      const o = (y * width + x) * 3;
      data[o] = r * norm;
      data[o + 1] = g * norm;
      data[o + 2] = b * norm;
    }
  }
  return { width, height, data };
}

/** Writes flat (non-RLE) RGBE, which every loader accepts. */
export function encodeRgbe(image) {
  const header = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${image.height} +X ${image.width}\n`, 'latin1');
  const pixels = Buffer.alloc(image.width * image.height * 4);
  for (let i = 0; i < image.width * image.height; i += 1) {
    const r = image.data[i * 3];
    const g = image.data[i * 3 + 1];
    const b = image.data[i * 3 + 2];
    const max = Math.max(r, g, b);
    if (max < 1e-32) continue;
    const exponent = Math.ceil(Math.log2(max));
    const scale = Math.pow(2, -exponent) * 256;
    pixels[i * 4] = Math.min(255, Math.floor(r * scale));
    pixels[i * 4 + 1] = Math.min(255, Math.floor(g * scale));
    pixels[i * 4 + 2] = Math.min(255, Math.floor(b * scale));
    pixels[i * 4 + 3] = exponent + 128;
  }
  return Buffer.concat([header, pixels]);
}
