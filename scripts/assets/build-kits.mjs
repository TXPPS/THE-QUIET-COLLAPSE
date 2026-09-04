/** Kenney kits → one glTF library per kit: every model as a named node at the origin, one KTX2 colormap. */
import { Document } from '@gltf-transform/core';
import { KHRTextureBasisu } from '@gltf-transform/extensions';
import { copyToDocument, dedup, meshopt, prune, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { basename } from 'node:path';
import { encodeKtx2 } from './lib/ktx.mjs';
import { gltfIO, mb } from './lib/io.mjs';

const COLORMAP_SIZE = 512;
/** Kenney city kits are authored at 1 unit = 10 m; the modular building kit at 1 unit = 4 m. */
const KIT_SCALE = { 'city-kit-roads': 10, 'city-kit-suburban': 10, 'city-kit-commercial': 10, 'city-kit-industrial': 10, 'modular-buildings': 4 };

export async function buildKits(manifest, sources) {
  const io = await gltfIO();
  const kits = sources.filter((entry) => entry.id.startsWith('kenney-') && entry.id !== 'kenney-input-prompts');
  for (const entry of kits) {
    const slug = entry.id.replace('kenney-', '');
    const target = new Document();
    const scene = target.createScene(slug);
    const models = [];
    for (const file of entry.files) {
      if (!file.to.endsWith('.glb')) continue;
      const source = await io.read(file.to);
      const root = source.getRoot().listScenes()[0]?.listChildren()[0];
      if (!root) throw new Error(`${file.to}: no root node`);
      const modelId = basename(file.to, '.glb');
      const copied = copyToDocument(target, source, [root]).get(root);
      copied.setName(modelId);
      scene.addChild(copied);
      models.push(modelId);
    }
    await target.transform(dedup(), prune(), unpartition());
    const textures = target.getRoot().listTextures();
    if (textures.length !== 1) throw new Error(`${slug}: expected one colormap after dedup, found ${textures.length}`);
    const ktx = await encodeKtx2(Buffer.from(textures[0].getImage()), { size: COLORMAP_SIZE, srgb: true, mipmaps: true });
    textures[0].setImage(ktx).setMimeType('image/ktx2').setURI('');
    target.createExtension(KHRTextureBasisu).setRequired(true);
    await target.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const glb = Buffer.from(await io.writeBinary(target));
    const path = manifest.emit(`kit.${slug}`, { dir: 'kits', name: slug, ext: 'glb', bytes: glb, sources: [entry.id], kind: 'gltf', meta: { scale: KIT_SCALE[slug] ?? 1, models } });
    console.log(`  kit ${slug}: ${models.length} models → ${path} (${mb(glb.length)})`);
  }
}
