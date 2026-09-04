/**
 * Quaternius universal characters: base body + rigged hair → two skinned glTFs (resident, affected)
 * sharing one KTX2 texture set, plus one animation-only glTF with the clips the state machine uses.
 */
import { Format } from '@gltf-transform/core';
import { KHRTextureBasisu } from '@gltf-transform/extensions';
import { copyToDocument, dedup, meshopt, prune, resample, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { clothingAlbedo, encodeKtx2 } from './lib/ktx.mjs';
import { gltfIO, mb, sha256 } from './lib/io.mjs';

const SRC = 'assets/src/quaternius';
const BODY = `${SRC}/universal-base-characters/Superhero_Male_FullBody.gltf`;
const HAIR = { resident: `${SRC}/universal-base-characters/hair/Hair_Buzzed.gltf`, affected: `${SRC}/universal-base-characters/hair/Hair_SimpleParted.gltf` };
const ALBEDO = `${SRC}/universal-base-characters/T_Superhero_Male_Dark.png`;
const UAL1 = `${SRC}/universal-animation-library/UAL1_Standard.glb`;
const UAL2 = `${SRC}/universal-animation-library-2/UAL2_Standard.glb`;
const SOURCE_IDS = ['quaternius-universal-base-characters'];

const MOBILE = 1024;
const DESKTOP = 2048;
const SMALL = 512;
/** Clothing tints: the resident in dark blue-grey work clothes; the affected in a paler, dirtied set. */
const TINT = { resident: [0.62, 0.66, 0.74], affected: [0.78, 0.72, 0.64] };

const PLAYER_CLIPS = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Pistol_Aim_Up', 'Pistol_Aim_Down', 'Pistol_Shoot', 'Pistol_Reload', 'Hit_Chest', 'Death01', 'Interact', 'Roll', 'Idle_Torch_Loop'];
const THREAT_CLIPS = ['Zombie_Idle_Loop', 'Zombie_Walk_Fwd_Loop', 'Zombie_Scratch', 'Hit_Knockback', 'Melee_Hook'];

/** The free pack references two textures by names that do not exist; the hair files sit one folder up. */
async function readPatched(io, file, patch) {
  const json = patch(readFileSync(file, 'utf8'));
  const temp = join(dirname(file), `_patched_${Date.now()}.gltf`);
  writeFileSync(temp, json);
  try {
    return await io.read(temp);
  } finally {
    unlinkSync(temp);
  }
}

function jointNames(skin) {
  return skin.listJoints().map((j) => j.getName()).join('|');
}

async function textureSet(manifest) {
  const albedoPng = readFileSync(ALBEDO);
  const set = {};
  const emitTex = async (key, png, { size, srgb, precache = true, mode }) => {
    const ktx = await encodeKtx2(png, { size, srgb, mode });
    const hash = sha256(ktx).slice(0, 8);
    const name = `${key}-${size}`;
    const path = manifest.emit(`character.tex.${key}.${size}`, { dir: 'characters/textures', name, ext: 'ktx2', bytes: ktx, sources: SOURCE_IDS, kind: 'ktx2', precache, meta: { size } });
    return { path, hash, bytes: ktx };
  };
  for (const variant of ['resident', 'affected']) {
    const png = await clothingAlbedo(albedoPng, { size: DESKTOP, tint: TINT[variant] });
    set[`${variant}.albedo`] = await emitTex(`${variant}-albedo`, png, { size: MOBILE, srgb: true });
    set[`${variant}.albedo.hi`] = await emitTex(`${variant}-albedo`, png, { size: DESKTOP, srgb: true, precache: false });
  }
  set.normal = await emitTex('body-normal', readFileSync(`${SRC}/universal-base-characters/T_Superhero_Male_Normal.png`), { size: MOBILE, srgb: false });
  set['normal.hi'] = await emitTex('body-normal', readFileSync(`${SRC}/universal-base-characters/T_Superhero_Male_Normal.png`), { size: DESKTOP, srgb: false, precache: false });
  set.roughness = await emitTex('body-roughness', readFileSync(`${SRC}/universal-base-characters/T_Superhero_Male_Roughness.png`), { size: MOBILE, srgb: false });
  set.eye = await emitTex('eye-albedo', readFileSync(`${SRC}/universal-base-characters/T_Eye_Brown.png`), { size: 256, srgb: true });
  set.eyeNormal = await emitTex('eye-normal', readFileSync(`${SRC}/universal-base-characters/T_Eye_Normal.png`), { size: 256, srgb: false });
  set.hair = await emitTex('hair-albedo', readFileSync(`${SRC}/universal-base-characters/T_Hair_1_BaseColor.png`), { size: SMALL, srgb: true });
  set.hairNormal = await emitTex('hair-normal', readFileSync(`${SRC}/universal-base-characters/T_Hair_1_Normal.png`), { size: SMALL, srgb: false });
  return set;
}

/** Points a glTF texture at an already emitted KTX2 file (relative to the character folder). */
function link(texture, emitted) {
  texture.setImage(emitted.bytes).setMimeType('image/ktx2').setURI(emitted.path.replace(/^characters\//, ''));
}

async function buildCharacter(io, manifest, variant, textures) {
  const body = await readPatched(io, BODY, (json) => json.replace(/_png\.png/g, '.png'));
  const hair = await readPatched(io, HAIR[variant], (json) => json.replace(/"uri":"T_Hair/g, '"uri":"../T_Hair'));
  const bodySkin = body.getRoot().listSkins()[0];
  const hairSkin = hair.getRoot().listSkins()[0];
  if (jointNames(bodySkin) !== jointNames(hairSkin)) throw new Error(`${variant}: hair skeleton differs from the body skeleton`);
  const hairNode = hair.getRoot().listNodes().find((n) => n.getMesh());
  const hairMesh = copyToDocument(body, hair, [hairNode.getMesh()]).get(hairNode.getMesh());
  const scene = body.getRoot().listScenes()[0];
  scene.addChild(body.createNode('hair').setMesh(hairMesh).setSkin(bodySkin));
  await body.transform(dedup(), prune(), unpartition());
  for (const material of body.getRoot().listMaterials()) {
    const name = material.getName();
    if (name.startsWith('MI_Superhero')) {
      link(material.getBaseColorTexture(), textures[`${variant}.albedo`]);
      link(material.getNormalTexture(), textures.normal);
      link(material.getMetallicRoughnessTexture(), textures.roughness);
      material.setMetallicFactor(0).setRoughnessFactor(1);
    } else if (name === 'MI_Eyes') {
      link(material.getBaseColorTexture(), textures.eye);
      link(material.getNormalTexture(), textures.eyeNormal);
    } else if (name.startsWith('MI_Hair')) {
      link(material.getBaseColorTexture(), textures.hair);
      link(material.getNormalTexture(), textures.hairNormal);
      material.setRoughnessFactor(0.85);
    }
  }
  await body.transform(dedup(), prune());
  body.createExtension(KHRTextureBasisu).setRequired(true);
  await body.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const buffer = body.getRoot().listBuffers()[0];
  const { json, resources } = await io.writeJSON(body, { format: Format.GLTF, basename: variant });
  // The buffer gets its own hashed name; textures already point at the emitted KTX2 files.
  const binKey = Object.keys(resources).find((k) => k.endsWith('.bin'));
  const bin = Buffer.from(resources[binKey]);
  const binPath = manifest.emit(`character.${variant}.bin`, { dir: 'characters', name: `${variant}`, ext: 'bin', bytes: bin, sources: SOURCE_IDS, kind: 'bin' });
  json.buffers[0].uri = binPath.replace(/^characters\//, '');
  buffer.setURI(json.buffers[0].uri);
  const gltf = Buffer.from(JSON.stringify(json));
  const path = manifest.emit(`character.${variant}`, { dir: 'characters', name: variant, ext: 'gltf', bytes: gltf, sources: SOURCE_IDS, kind: 'gltf' });
  console.log(`  character ${variant}: ${path} (${mb(gltf.length + bin.length)} + textures)`);
}

async function buildAnimations(io, manifest) {
  const doc = await io.read(UAL1);
  const extra = await io.read(UAL2);
  const wanted = new Set(PLAYER_CLIPS);
  for (const animation of doc.getRoot().listAnimations()) if (!wanted.has(animation.getName())) animation.dispose();
  const byName = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const threatClips = extra.getRoot().listAnimations().filter((a) => THREAT_CLIPS.includes(a.getName()));
  const map = copyToDocument(doc, extra, threatClips);
  for (const source of threatClips) {
    const animation = map.get(source);
    for (const channel of animation.listChannels()) {
      const target = channel.getTargetNode();
      const existing = target ? byName.get(target.getName()) : null;
      if (!existing) throw new Error(`animation ${animation.getName()}: joint ${target?.getName()} missing on the base skeleton`);
      channel.setTargetNode(existing);
    }
  }
  // Bone lengths and scales never animate: only root/pelvis translation and every rotation are kept.
  const MOVING = new Set(['root', 'pelvis']);
  for (const animation of doc.getRoot().listAnimations()) {
    for (const channel of animation.listChannels()) {
      const path = channel.getTargetPath();
      const joint = channel.getTargetNode()?.getName() ?? '';
      if (path === 'scale' || (path === 'translation' && !MOVING.has(joint))) {
        const sampler = channel.getSampler();
        channel.dispose();
        if (sampler && sampler.listParents().length <= 1) sampler.dispose();
      }
    }
  }
  for (const node of doc.getRoot().listNodes()) if (node.getMesh()) node.setMesh(null);
  for (const mesh of doc.getRoot().listMeshes()) mesh.dispose();
  for (const skin of doc.getRoot().listSkins()) skin.dispose();
  for (const scene of extra.getRoot().listScenes()) scene.dispose();
  await doc.transform(resample(), dedup(), prune({ keepLeaves: true }), unpartition(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const names = doc.getRoot().listAnimations().map((a) => a.getName());
  const missing = [...PLAYER_CLIPS, ...THREAT_CLIPS].filter((n) => !names.includes(n));
  if (missing.length) throw new Error(`animations missing: ${missing.join(', ')}`);
  const glb = Buffer.from(await io.writeBinary(doc));
  const path = manifest.emit('character.animations', { dir: 'characters', name: 'animations', ext: 'glb', bytes: glb, sources: ['quaternius-universal-animation-library', 'quaternius-universal-animation-library-2'], kind: 'gltf', meta: { clips: names } });
  console.log(`  animations: ${names.length} clips → ${path} (${mb(glb.length)})`);
}

export async function buildCharacters(manifest) {
  const io = await gltfIO();
  const textures = await textureSet(manifest);
  await buildCharacter(io, manifest, 'resident', textures);
  await buildCharacter(io, manifest, 'affected', textures);
  await buildAnimations(io, manifest);
}
