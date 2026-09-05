/**
 * Every external asset the project uses, with the exact URL it was retrieved from, its licence and
 * the files kept under assets/src. `pnpm assets:ledger` renders this into assets/ledger.json and
 * docs/assets/ASSET_LEDGER.md; `pnpm assets:fetch` re-downloads the archives and extracts the same
 * files; `pnpm check:assets` fails the build when assets/ drifts from this list or a licence is not
 * on the allow-list. Nothing outside these sources is permitted.
 */

export const ALLOWED_LICENSES = ['CC0-1.0', 'OFL-1.1', 'MIT', 'Public Domain'];
/** Runtime libraries shipped from public/vendor (code, not content) may additionally use these. */
export const ALLOWED_LIBRARY_LICENSES = [...ALLOWED_LICENSES, 'Apache-2.0', 'Zlib'];

const CC0 = { license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' };
const RETRIEVED = '2026-09-04';

/* ---------- Kenney ---------- */

const KENNEY_ROADS = [
  'road-straight', 'road-straight-half', 'road-crossroad', 'road-intersection', 'road-bend', 'road-end', 'road-side',
  'road-straight-barrier', 'road-straight-barrier-half', 'road-crossroad-barrier',
  'construction-barrier', 'construction-cone', 'construction-fence', 'construction-light', 'dumpster',
  'light-curved', 'light-square', 'road-sign-warning', 'road-sign-stop', 'road-sign-street', 'sign-highway',
  'traffic-light', 'electricity-pole', 'bridge-pillar', 'tile-low',
];
const KENNEY_COMMERCIAL = [
  'building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-f', 'building-g', 'building-h',
  'low-detail-building-a', 'low-detail-building-b', 'low-detail-building-c', 'low-detail-building-d', 'low-detail-building-e', 'low-detail-building-f',
  'low-detail-building-wide-a', 'detail-awning', 'detail-awning-wide', 'detail-overhang',
];
const KENNEY_SUBURBAN = ['building-type-a', 'building-type-b', 'building-type-c', 'building-type-d', 'building-type-e', 'building-type-f', 'fence', 'fence-low', 'fence-1x2', 'planter', 'tree-small', 'tree-large', 'path-short'];
const KENNEY_INDUSTRIAL = ['building-a', 'building-b', 'building-c', 'shipping-container-a', 'shipping-container-b', 'shipping-container-c', 'detail-tank', 'detail-tank-large', 'water-tower', 'chimney-small'];
const KENNEY_MODULAR = [
  'building-window', 'building-window-sill', 'building-door', 'building-block', 'building-corner', 'building-corner-window', 'building-windows',
  'building-window-large', 'door-white', 'door-brown', 'window-white', 'roof-flat-center', 'roof-flat-border-straight', 'roof-flat-border-corner',
  'roof-flat-awning-a', 'detail-ac-a', 'building-steps-wide',
];

function kenneyKit(slug, name, version, archive, models, extra = []) {
  const dir = `assets/src/kenney/${slug}`;
  return {
    id: `kenney-${slug}`,
    source: 'Kenney',
    name,
    version,
    url: `https://kenney.nl/assets/${slug}`,
    archive,
    ...CC0,
    retrieved: RETRIEVED,
    files: [
      ...models.map((m) => ({ from: `Models/GLB format/${m}.glb`, to: `${dir}/${m}.glb` })),
      { from: 'Models/Textures/variation-a.png', to: `${dir}/Textures/colormap.png` },
      { from: 'License.txt', to: `${dir}/License.txt` },
      ...extra,
    ],
    modifications: 'Models merged per kit into one glTF library (dedup, prune, meshopt compression); colormap re-encoded to KTX2 (ETC1S). Geometry unchanged.',
  };
}

const PROMPT_FAMILIES = {
  'Keyboard & Mouse': [
    ...'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => `keyboard_${c}`),
    ...'0123456789'.split('').map((c) => `keyboard_${c}`),
    ...Array.from({ length: 12 }, (_, i) => `keyboard_f${i + 1}`),
    'keyboard_space', 'keyboard_shift', 'keyboard_ctrl', 'keyboard_alt', 'keyboard_tab', 'keyboard_enter', 'keyboard_escape', 'keyboard_backspace',
    'keyboard_arrow_up', 'keyboard_arrow_down', 'keyboard_arrow_left', 'keyboard_arrow_right', 'keyboard_arrows_all', 'keyboard_page_up', 'keyboard_page_down',
    'keyboard_capslock', 'keyboard_home', 'keyboard_end', 'keyboard_delete', 'keyboard_insert', 'keyboard_apostrophe', 'keyboard_comma', 'keyboard_period',
    'keyboard_slash_forward', 'keyboard_slash_back', 'keyboard_semicolon', 'keyboard_bracket_open', 'keyboard_bracket_close', 'keyboard_minus', 'keyboard_equals',
    'keyboard_tilde', 'keyboard_numpad_enter', 'keyboard_any',
    'mouse', 'mouse_left', 'mouse_right', 'mouse_scroll', 'mouse_scroll_up', 'mouse_scroll_down', 'mouse_move', 'mouse_side_back', 'mouse_side_forward',
  ],
  'Xbox Series': [
    'xbox_button_a', 'xbox_button_b', 'xbox_button_x', 'xbox_button_y', 'xbox_lb', 'xbox_rb', 'xbox_lt', 'xbox_rt', 'xbox_ls', 'xbox_rs',
    'xbox_stick_l', 'xbox_stick_r', 'xbox_stick_l_press', 'xbox_stick_r_press', 'xbox_dpad', 'xbox_dpad_up', 'xbox_dpad_down', 'xbox_dpad_left', 'xbox_dpad_right',
    'xbox_dpad_all', 'xbox_button_view', 'xbox_button_menu', 'xbox_guide',
  ],
  'PlayStation Series': [
    'playstation_button_cross', 'playstation_button_circle', 'playstation_button_square', 'playstation_button_triangle',
    'playstation_trigger_l1', 'playstation_trigger_r1', 'playstation_trigger_l2', 'playstation_trigger_r2', 'playstation_button_l3', 'playstation_button_r3',
    'playstation_stick_l', 'playstation_stick_r', 'playstation_stick_l_press', 'playstation_stick_r_press', 'playstation_dpad', 'playstation_dpad_up', 'playstation_dpad_down',
    'playstation_dpad_left', 'playstation_dpad_right', 'playstation_dpad_all', 'playstation5_button_options', 'playstation5_button_create', 'playstation4_button_share', 'playstation4_button_options',
  ],
  'Nintendo Switch': [
    'switch_button_a', 'switch_button_b', 'switch_button_x', 'switch_button_y', 'switch_button_l', 'switch_button_r', 'switch_button_zl', 'switch_button_zr',
    'switch_button_plus', 'switch_button_minus', 'switch_button_home', 'switch_stick_l', 'switch_stick_r', 'switch_stick_l_press', 'switch_stick_r_press',
    'switch_dpad', 'switch_dpad_up', 'switch_dpad_down', 'switch_dpad_left', 'switch_dpad_right', 'switch_dpad_all',
  ],
  Generic: ['generic_button_circle', 'generic_button_square', 'generic_button_trigger_a', 'generic_button_trigger_b', 'generic_stick', 'generic_stick_press', 'generic_joystick', 'generic_button'],
};

const promptFiles = Object.entries(PROMPT_FAMILIES).flatMap(([family, names]) => {
  const dir = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return names.map((n) => ({ from: `${family}/Vector/${n}.svg`, to: `assets/src/kenney/input-prompts/${dir}/${n}.svg` }));
});

/* ---------- Quaternius ---------- */

const UBC = 'Universal Base Characters[Standard]';
const UBC_DIR = 'assets/src/quaternius/universal-base-characters';
const UAL = 'Universal Animation Library[Standard]';
const UAL2 = 'Universal Animation Library 2[Standard]';

/* ---------- Freesound ---------- */

function fs(id, slug, title, author, preview, seconds) {
  return {
    id: `freesound-${id}`,
    source: 'Freesound',
    name: `${title} (${author})`,
    version: `sound ${id}`,
    url: `https://freesound.org/s/${id}/`,
    archive: `https://cdn.freesound.org/previews/${preview}`,
    ...CC0,
    retrieved: RETRIEVED,
    files: [{ from: '', to: `assets/src/freesound/${slug}-${id}.mp3` }],
    modifications: `Freesound HQ preview transcode (MP3, ${seconds.toFixed(2)} s) used as-is; gain trimmed in the mixer, no re-encode.`,
    role: slug,
  };
}

/* ---------- ambientCG / Poly Haven ---------- */

function ambientcg(id, name) {
  const dir = `assets/src/ambientcg/${id.toLowerCase()}`;
  return {
    id: `ambientcg-${id.toLowerCase()}`,
    source: 'ambientCG',
    name: `${name} (${id})`,
    version: '1K-JPG',
    url: `https://ambientcg.com/view?id=${id}`,
    archive: `https://ambientcg.com/get?file=${id}_1K-JPG.zip`,
    ...CC0,
    retrieved: RETRIEVED,
    files: ['Color', 'NormalGL', 'Roughness', 'AmbientOcclusion']
      .filter((map) => !(id === 'Concrete034' && map === 'AmbientOcclusion') && !(id === 'PaintedPlaster017' && map === 'AmbientOcclusion'))
      .map((map) => ({ from: `${id}_1K-JPG_${map}.jpg`, to: `${dir}/${map.toLowerCase()}.jpg` })),
    modifications: 'Re-encoded to KTX2 (ETC1S for colour/AO, UASTC for normals) at 1024² for the precached set; roughness packed into the metallic-roughness channel.',
  };
}

export const SOURCES = [
  kenneyKit('city-kit-roads', 'City Kit (Roads)', '2.1', 'https://kenney.nl/media/pages/assets/city-kit-roads/74288c9459-1787042796/kenney_city-kit-roads.zip', KENNEY_ROADS),
  kenneyKit('city-kit-suburban', 'City Kit (Suburban)', '2.0', 'https://kenney.nl/media/pages/assets/city-kit-suburban/2c871b7af2-1745479373/kenney_city-kit-suburban_20.zip', KENNEY_SUBURBAN),
  kenneyKit('city-kit-commercial', 'City Kit (Commercial)', '2.1', 'https://kenney.nl/media/pages/assets/city-kit-commercial/a742d900eb-1753115042/kenney_city-kit-commercial_2.1.zip', KENNEY_COMMERCIAL),
  kenneyKit('city-kit-industrial', 'City Kit (Industrial)', '2.0', 'https://kenney.nl/media/pages/assets/city-kit-industrial/0ec35b139d-1788171848/kenney_city-kit-industrial_2.0.zip', KENNEY_INDUSTRIAL),
  kenneyKit('modular-buildings', 'Modular Buildings', '2.1', 'https://kenney.nl/media/pages/assets/modular-buildings/3253b4219a-1707397411/kenney_modular-buildings.zip', KENNEY_MODULAR),
  {
    id: 'kenney-input-prompts',
    source: 'Kenney',
    name: 'Input Prompts',
    version: '1.5A',
    url: 'https://kenney.nl/assets/input-prompts',
    archive: 'https://kenney.nl/media/pages/assets/input-prompts/8de120163f-1783763952/kenney_input-prompts_1.5.zip',
    ...CC0,
    retrieved: RETRIEVED,
    files: [...promptFiles, { from: 'License.txt', to: 'assets/src/kenney/input-prompts/License.txt' }],
    modifications: 'Selected vector glyphs combined into one SVG sprite sheet (symbols); fill colour driven by CSS currentColor. Shapes unchanged.',
  },
  {
    id: 'quaternius-universal-base-characters',
    source: 'Quaternius',
    name: 'Universal Base Characters (Standard)',
    version: 'itch.io upload 15861669',
    url: 'https://quaternius.com/packs/universalbasecharacters.html',
    archive: { itch: 'https://quaternius.itch.io/universal-base-characters' },
    ...CC0,
    retrieved: RETRIEVED,
    files: [
      { from: `${UBC}/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf`, to: `${UBC_DIR}/Superhero_Male_FullBody.gltf` },
      { from: `${UBC}/Base Characters/Godot - UE/Superhero_Male_FullBody.bin`, to: `${UBC_DIR}/Superhero_Male_FullBody.bin` },
      { from: `${UBC}/Base Characters/Godot - UE/T_Superhero_Male_Dark.png`, to: `${UBC_DIR}/T_Superhero_Male_Dark.png` },
      { from: `${UBC}/Base Characters/Textures/T_Superhero_Male_Ligh.png`, to: `${UBC_DIR}/T_Superhero_Male_Light.png` },
      { from: `${UBC}/Base Characters/Godot - UE/T_Superhero_Male_Normal.png`, to: `${UBC_DIR}/T_Superhero_Male_Normal.png` },
      { from: `${UBC}/Base Characters/Godot - UE/T_Superhero_Male_Roughness.png`, to: `${UBC_DIR}/T_Superhero_Male_Roughness.png` },
      { from: `${UBC}/Base Characters/Godot - UE/T_Eye_Brown.png`, to: `${UBC_DIR}/T_Eye_Brown.png` },
      { from: `${UBC}/Base Characters/Godot - UE/T_Eye_Normal.png`, to: `${UBC_DIR}/T_Eye_Normal.png` },
      { from: `${UBC}/Base Characters/Godot - UE/T_Hair_1_BaseColor.png`, to: `${UBC_DIR}/T_Hair_1_BaseColor.png` },
      { from: `${UBC}/Base Characters/Godot - UE/T_Hair_1_Normal.png`, to: `${UBC_DIR}/T_Hair_1_Normal.png` },
      { from: `${UBC}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_Buzzed.gltf`, to: `${UBC_DIR}/hair/Hair_Buzzed.gltf` },
      { from: `${UBC}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_Buzzed.bin`, to: `${UBC_DIR}/hair/Hair_Buzzed.bin` },
      { from: `${UBC}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_SimpleParted.gltf`, to: `${UBC_DIR}/hair/Hair_SimpleParted.gltf` },
      { from: `${UBC}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_SimpleParted.bin`, to: `${UBC_DIR}/hair/Hair_SimpleParted.bin` },
      { from: `${UBC}/License_Standard.txt`, to: `${UBC_DIR}/License_Standard.txt` },
    ],
    modifications:
      'Base body + one rigged hairstyle merged into one skinned glTF per character (player, affected). The suit albedo is desaturated/darkened and overlaid with a cloth-weave noise so it reads as plain dark street clothing (the Standard pack ships no outfit meshes; see PLACEHOLDER_ART in the ledger). Textures resized to 1024² (precached) and 2048² (desktop stream), KTX2. Skeleton unchanged.',
  },
  {
    id: 'quaternius-universal-animation-library',
    source: 'Quaternius',
    name: 'Universal Animation Library (Standard)',
    version: 'itch.io upload 17958403',
    url: 'https://quaternius.com/packs/universalanimationlibrary.html',
    archive: { itch: 'https://quaternius.itch.io/universal-animation-library' },
    ...CC0,
    retrieved: RETRIEVED,
    files: [
      { from: `${UAL}/Unreal-Godot/UAL1_Standard.glb`, to: 'assets/src/quaternius/universal-animation-library/UAL1_Standard.glb', large: true },
      { from: `${UAL}/License.txt`, to: 'assets/src/quaternius/universal-animation-library/License.txt' },
      { from: `${UAL}/README.txt`, to: 'assets/src/quaternius/universal-animation-library/README.txt' },
    ],
    modifications: 'Only the clips the state machine uses are kept (idle, walk, jog, sprint, pistol idle/aim/shoot/reload, hit, death, interact, roll, torch idle, jump start/loop/land, punch); the mannequin mesh is stripped. Non root-motion variant.',
  },
  {
    id: 'quaternius-universal-animation-library-2',
    source: 'Quaternius',
    name: 'Universal Animation Library 2 (Standard)',
    version: 'itch.io upload 17958478',
    url: 'https://quaternius.com/packs/universalanimationlibrary2.html',
    archive: { itch: 'https://quaternius.itch.io/universal-animation-library-2' },
    ...CC0,
    retrieved: RETRIEVED,
    files: [
      { from: `${UAL2}/Unreal-Godot/UAL2_Standard.glb`, to: 'assets/src/quaternius/universal-animation-library-2/UAL2_Standard.glb', large: true },
      { from: `${UAL2}/License.txt`, to: 'assets/src/quaternius/universal-animation-library-2/License.txt' },
    ],
    modifications: 'Only the affected-resident clips plus the vault climb and get-up are kept (Zombie_Idle_Loop, Zombie_Walk_Fwd_Loop, Zombie_Scratch, Hit_Knockback, Melee_Hook, ClimbUp_1m, LayToIdle); mesh stripped. Non root-motion variant.',
  },
  {
    id: 'polyhaven-aarfontein-dusk',
    source: 'Poly Haven',
    name: 'Aarfontein Dusk (HDRI)',
    version: '1k / 2k HDR',
    url: 'https://polyhaven.com/a/aarfontein_dusk',
    archive: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aarfontein_dusk_1k.hdr',
    archives: {
      '2k': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/aarfontein_dusk_2k.hdr',
    },
    ...CC0,
    retrieved: RETRIEVED,
    files: [
      { from: '', to: 'assets/src/polyhaven/aarfontein_dusk_1k.hdr' },
      { from: '2k', to: 'assets/src/polyhaven/aarfontein_dusk_2k.hdr', large: true },
    ],
    modifications: 'Downsampled to 512×256 (precached, mobile) and 1024×512 (desktop stream) RGBE; exposure unchanged. Used for image-based lighting only.',
  },
  ambientcg('Asphalt033', 'Asphalt'),
  ambientcg('Concrete034', 'Concrete'),
  ambientcg('Bricks104', 'Bricks'),
  ambientcg('PaintedPlaster017', 'Painted plaster'),
  fs(166509, 'foot-concrete-1', 'concrete footstep 1', 'Yoyodaman234', '166/166509_2792951-hq.mp3', 0.53),
  fs(166508, 'foot-concrete-2', 'concrete footstep 2', 'Yoyodaman234', '166/166508_2792951-hq.mp3', 0.49),
  fs(166507, 'foot-concrete-3', 'concrete footstep 3', 'Yoyodaman234', '166/166507_2792951-hq.mp3', 0.48),
  fs(166506, 'foot-concrete-4', 'concrete footstep 4', 'Yoyodaman234', '166/166506_2792951-hq.mp3', 0.42),
  fs(166511, 'foot-gravel-1', 'dirt/gravel footstep 1', 'Yoyodaman234', '166/166511_2792951-hq.mp3', 0.68),
  fs(166510, 'foot-gravel-2', 'dirt/gravel footstep 2', 'Yoyodaman234', '166/166510_2792951-hq.mp3', 0.52),
  fs(340983, 'foot-wood-1', 'Footstep on wood', 'SoundsAreGr8', '340/340983_4978149-hq.mp3', 0.5),
  fs(812363, 'foot-wood-2', 'Knocking once on wood, single footstep', 'CuboRodante', '812/812363_17517436-hq.mp3', 1.11),
  fs(565489, 'foot-wood-3', 'Footstep Wood/Concrete Chamber Echo 10', 'Jakegwizdak', '565/565489_2383554-hq.mp3', 0.44),
  fs(398554, 'foot-metal-1', 'footstep_metal.ogg', 'raceynovel', '398/398554_7590843-hq.mp3', 0.27),
  fs(816413, 'foot-metal-2', 'metal footstep', 'atleastrelatively', '816/816413_17614127-hq.mp3', 0.31),
  fs(421151, 'foot-metal-3', 'Footstep_Metal_Crouch_5.wav', 'GiocoSound', '421/421151_5820033-hq.mp3', 0.43),
  fs(371440, 'pistol-shot-1', 'Single Pistol Gunshot 2.wav', 'morganpurkis', '371/371440_5937039-hq.mp3', 1.14),
  fs(385811, 'pistol-shot-2', 'Single Pistol Gunshot 3.wav', 'morganpurkis', '385/385811_5937039-hq.mp3', 2.14),
  fs(386744, 'pistol-reload-1', 'Handgun_Reload.wav', 'ken788', '386/386744_5768130-hq.mp3', 1.74),
  fs(159406, 'pistol-reload-2', 'Handgun reload', 'Jackjan', '159/159406_2683908-hq.mp3', 1.74),
  fs(448989, 'pistol-dry', 'Weapon, Dryfire', 'LilMati', '448/448989_6142149-hq.mp3', 0.15),
  fs(426628, 'threat-idle-1', 'Zombie Moan.wav', 'mrh4hn', '426/426628_8238671-hq.mp3', 4.13),
  fs(445995, 'threat-idle-2', 'Zombie moan 3', 'Breviceps', '445/445995_9159316-hq.mp3', 1.42),
  fs(323819, 'threat-idle-3', 'zombie growl', 'adharca', '323/323819_4366671-hq.mp3', 4.15),
  fs(555417, 'threat-alert-1', 'Zombie Growl 5.wav', 'tonsil5', '555/555417_8247784-hq.mp3', 2.64),
  fs(133974, 'threat-alert-2', 'Horrific Zombie Growl', 'MrPokephile', '133/133974_2449149-hq.mp3', 3.85),
  fs(560594, 'threat-attack', 'Z-Roar 04a.wav', 'angelkunev', '560/560594_245685-hq.mp3', 1.41),
  fs(555420, 'threat-hurt', 'Zombie Hit 1.wav', 'tonsil5', '555/555420_8247784-hq.mp3', 0.57),
  fs(577033, 'threat-death', 'MaleDeathSound12.wav', 'Blankened', '577/577033_6512859-hq.mp3', 1.74),
  fs(464486, 'player-hurt-1', 'Male Grunting In Pain', 'elynch0901', '464/464486_4814007-hq.mp3', 0.57),
  fs(547209, 'player-hurt-2', 'Voice_AdultMale_PainGrunts_09.wav', 'MrFossy', '547/547209_129727-hq.mp3', 0.32),
  fs(554443, 'player-death', 'Male Death Sound', 'Blankened', '554/554443_6512859-hq.mp3', 1.01),
  fs(138481, 'body-hit-1', 'Bullet Blood 4', 'JustInvoke', '138/138481_758593-hq.mp3', 0.22),
  fs(276600, 'body-hit-2', 'body_hit.wav', 'insanity54', '276/276600_464940-hq.mp3', 0.84),
  fs(496187, 'melee-hit-1', 'Light Body thud (on clothing)', 'JonasTisell', '496/496187_3910073-hq.mp3', 0.33),
  fs(842508, 'melee-hit-2', 'Hit_Impact', 'gulfstreamav', '842/842508_18255452-hq.mp3', 0.55),
  fs(459344, 'ui-move', 'Select, Granted 03.wav', 'LilMati', '459/459344_6142149-hq.mp3', 0.07),
  fs(455202, 'ui-confirm', 'Select, Granted 02.wav', 'LilMati', '455/455202_6142149-hq.mp3', 0.26),
  fs(476817, 'ui-cancel', 'menuBack.wav', 'victorium183', '476/476817_7813468-hq.mp3', 0.22),
  fs(459771, 'ui-denied', 'Select, Denied 02.wav', 'LilMati', '459/459771_6142149-hq.mp3', 0.72),
  fs(523763, 'ui-checkpoint', 'Select, Granted 06.wav', 'LilMati', '523/523763_6142149-hq.mp3', 0.78),
  fs(459675, 'ambience-night-1', 'Night Ambience', 'brunoboselli', '459/459675_300738-hq.mp3', 44.79),
  fs(699143, 'ambience-night-2', 'Night_Suburb_Crickets_wind.wav', 'roisin.gleeson', '699/699143_12896641-hq.mp3', 43.41),
  fs(552160, 'radio-static-1', 'Radio tuning-static-interference', 'quantumriver', '552/552160_716433-hq.mp3', 18.55),
  fs(684896, 'radio-static-2', 'Radio Static', 'Takimeko', '684/684896_9603502-hq.mp3', 6.91),
  fs(244425, 'door-1', 'creaking-door-open01.flac', 'Aiyumi', '244/244425_2326086-hq.mp3', 1.07),
  fs(547024, 'door-2', 'Door_handle_opening_creak.wav', 'bouncyballblue', '547/547024_11531251-hq.mp3', 2.11),
  fs(175960, 'pickup-1', 'zip2.wav', 'Snapper4298', '175/175960_33044-hq.mp3', 0.58),
  fs(527773, 'pickup-2', 'Zipping A Huge Black Bag.wav', 'LilMati', '527/527773_6142149-hq.mp3', 0.72),
  fs(659458, 'medkit-use', 'Zipping A Huge Black Bag, Remastered.wav', 'LilMati', '659/659458_6142149-hq.mp3', 0.72),
  fs(784658, 'heartbeat', 'heartbeat sub kick - softer', 'music_is_wiggly_air', '784/784658_16749461-hq.mp3', 0.25),
  fs(617587, 'flashlight-click', 'Click_Button_BatteryRechargerFlashlight.wav', 'sweet_niche', '617/617587_5332155-hq.mp3', 0.26),
];

/** Runtime libraries copied into public/vendor (code shipped alongside the game, not content). */
export const LIBRARIES = [
  {
    id: 'basis-universal-transcoder',
    source: 'three.js r185 examples (Binomial LLC Basis Universal)',
    name: 'KTX2 / Basis Universal transcoder (basis_transcoder.js + .wasm)',
    version: 'three@0.185.1',
    url: 'https://github.com/mrdoob/three.js/tree/r185/examples/jsm/libs/basis',
    license: 'Apache-2.0',
    licenseUrl: 'https://github.com/BinomialLLC/basis_universal/blob/master/LICENSE',
    files: [{ from: 'node_modules/three/examples/jsm/libs/basis/basis_transcoder.js', to: 'public/vendor/basis/basis_transcoder.js' }, { from: 'node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm', to: 'public/vendor/basis/basis_transcoder.wasm' }],
    modifications: 'None.',
  },
];

/** Original, in-repo art and audio kept as documented stand-ins. */
export const PLACEHOLDERS = [
  { name: 'Crashed transit bus (blocked route centrepiece)', where: 'src/game/level/districtLevel.ts → WorldRenderer box', status: 'PLACEHOLDER_ART', note: 'No vehicle kit is on the approved source list; the wreck is dressed with Kenney barriers and containers around a procedural box.' },
  { name: 'Character outfit', where: 'scripts/assets/build-characters.mjs', status: 'PLACEHOLDER_ART', note: 'The Standard base-character pack ships no clothing meshes and quaternius.com/packs/modularcharacteroutfits.html does not exist (404). The suit albedo is treated as dark street clothing until an outfit rigged to the universal skeleton is dropped into assets/incoming/.' },
  { name: 'Held handgun, medkit, torch', where: 'src/render/WeaponRig.ts', status: 'PLACEHOLDER_ART', note: 'Low-poly procedural meshes attached to the hand joints.' },
  { name: 'Radio body, pickups, documents, signage', where: 'src/render/WorldRenderer.ts', status: 'PLACEHOLDER_ART', note: 'Procedural markers; grounded by the raycast placer.' },
  { name: 'Synthesised cues', where: 'src/audio/synth.ts', status: 'PLACEHOLDER_AUDIO', note: 'Fallback when a sample has not loaded (offline first boot, decode failure).' },
  { name: 'Touch control icons, HUD item silhouettes, app icon', where: 'src/ui/touch/touchIcons.ts, src/ui/hud/Hud.ts, public/icons', status: 'Original', note: 'Kept as original work.' },
];
