/** ambientCG PBR sets → KTX2 (colour, normal, packed AO/roughness); Poly Haven HDRI → downsampled RGBE. */
import { existsSync, readFileSync } from 'node:fs';
import { encodeKtx2, packOcclusionRoughness } from './lib/ktx.mjs';
import { decodeRgbe, downsample, encodeRgbe } from './lib/rgbe.mjs';
import { mb } from './lib/io.mjs';

const TEXTURE_SIZE = 1024;
const HDRI_DIR = 'assets/src/polyhaven';

export async function buildTextures(manifest, sources) {
  for (const entry of sources.filter((e) => e.source === 'ambientCG')) {
    const slug = entry.id.replace('ambientcg-', '');
    const file = (map) => entry.files.find((f) => f.to.endsWith(`/${map}.jpg`))?.to;
    const color = readFileSync(file('color'));
    const normal = readFileSync(file('normalgl'));
    const roughness = readFileSync(file('roughness'));
    const ao = file('ambientocclusion') ? readFileSync(file('ambientocclusion')) : null;
    const emit = async (map, png, srgb) => {
      const ktx = await encodeKtx2(png, { size: TEXTURE_SIZE, srgb });
      return manifest.emit(`texture.${slug}.${map}`, { dir: 'textures', name: `${slug}-${map}`, ext: 'ktx2', bytes: ktx, sources: [entry.id], kind: 'ktx2', meta: { size: TEXTURE_SIZE, srgb } });
    };
    await emit('color', color, true);
    await emit('normal', normal, false);
    await emit('orm', await packOcclusionRoughness(ao, roughness, TEXTURE_SIZE), false);
    console.log(`  material ${slug}: colour + normal + AO/roughness at ${TEXTURE_SIZE}²`);
  }
  const hdri = sources.find((e) => e.id === 'polyhaven-aarfontein-dusk');
  const low = decodeRgbe(readFileSync(`${HDRI_DIR}/aarfontein_dusk_1k.hdr`));
  const mobile = encodeRgbe(downsample(low, 2));
  manifest.emit('env.dusk', { dir: 'env', name: 'aarfontein-dusk-512', ext: 'hdr', bytes: mobile, sources: [hdri.id], kind: 'hdr', meta: { width: 512, height: 256 } });
  console.log(`  hdri mobile 512×256: ${mb(mobile.length)}`);
  const hiFile = `${HDRI_DIR}/aarfontein_dusk_2k.hdr`;
  if (existsSync(hiFile)) {
    const desktop = encodeRgbe(downsample(decodeRgbe(readFileSync(hiFile)), 2));
    manifest.emit('env.dusk.hi', { dir: 'env', name: 'aarfontein-dusk-1024', ext: 'hdr', bytes: desktop, sources: [hdri.id], kind: 'hdr', precache: false, meta: { width: 1024, height: 512 } });
    console.log(`  hdri desktop 1024×512: ${mb(desktop.length)} (streamed)`);
  } else {
    console.warn('  hdri desktop variant skipped: assets/src/polyhaven/aarfontein_dusk_2k.hdr missing (pnpm assets:fetch)');
  }
}
