// Verifies the production output never references the private reference screenshots.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  'RE2_REFERENCE_CONTACT_SHEET',
  'MOBILE_TOUCH_CONTACT_SHEET',
  '_main_menu.png',
  '_story_selection.png',
  '_pause_menu.png',
  '_camera_settings.png',
  '_objective_gameplay_prompt.png',
  '_context_interaction.png',
  '_inventory_grid.png',
  '_inventory_actions.png',
  '_item_inspection.png',
  '_item_use_context.png',
  '_map_objectives.png',
  '_documents_notebook.png',
  '_controller_settings.png',
  '_keyboard_mouse_settings.png',
  '_graphics_settings.png',
  '_screen_safe_area.png',
  '_autosave_notice.png',
  '_rewards_progress.png',
  '_misc_menu_overlay.png',
  '_puzzle_input.png',
  '_game_over_flow.jpeg',
  '_cod_mobile_gameplay_hud.jpg',
  '_pubg_mobile_gameplay_hud.png',
  '_pubg_mobile_hud_customization.jpg',
  '_cod_mobile_advanced_controls.jpg',
  'references/re2_2019',
  'references/mobile_touch',
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const dist = process.argv[2] ?? 'dist';
let hits = 0;
for (const file of walk(dist)) {
  const text = readFileSync(file, 'latin1');
  for (const needle of FORBIDDEN) {
    if (text.includes(needle)) {
      hits += 1;
      console.error(`FORBIDDEN reference "${needle}" found in ${file}`);
    }
  }
  if (/\.(png|jpe?g)$/i.test(file) && !file.includes(`icons${process.platform === 'win32' ? '\\' : '/'}`)) {
    hits += 1;
    console.error(`Unexpected raster image in bundle: ${file}`);
  }
}
if (hits > 0) {
  console.error(`check-bundle: ${hits} forbidden reference(s) found.`);
  process.exit(1);
}
console.log('check-bundle: production output contains no reference screenshots.');
