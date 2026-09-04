import { modelProp } from './kitModels';
import type { BlockDef, ModelDef } from './types';

/*
 * Set dressing for the district (Kenney kits). Coordinates in metres; +X east, +Z south.
 * Roads run along the kit's Z axis, so Ferry Street tiles are turned a quarter turn.
 * Every placement has a job: route reading, blocked-route language, light sources, or skyline.
 */

const ROAD_Y = -0.19; // road tiles are 0.2 m thick; the surface sits 1 cm above the ground plane
const FERRY_Z = 23;
const ROUTE4_X = 61;
const QUARTER = Math.PI / 2;
const FENCE_LENGTH = 4.8;
const WINDOW_ROWS = [2.4, 5.6];
const WINDOW_PITCH = 3.6;

let n = 0;
function model(kit: ModelDef['kit'], name: string, x: number, z: number, extra: Partial<ModelDef> = {}): ModelDef {
  n += 1;
  return { id: `m_${name}_${n}`, kit, name, x, z, ...extra };
}

/* ---------- streets ---------- */

function roads(): ModelDef[] {
  const out: ModelDef[] = [];
  for (let x = -9; x <= 101; x += 10) {
    if (x === ROUTE4_X) continue;
    out.push(model('city-kit-roads', 'road-straight', x, FERRY_Z, { y: ROAD_Y, yaw: QUARTER }));
  }
  out.push(model('city-kit-roads', 'road-crossroad', ROUTE4_X, FERRY_Z, { y: ROAD_Y }));
  for (const z of [-7, 3, 13, 33, 43]) out.push(model('city-kit-roads', 'road-straight', ROUTE4_X, z, { y: ROAD_Y }));
  return out;
}

/** Street lights stand where the level's light sources are; the arm reaches over the road. */
function streetFurniture(): ModelDef[] {
  return [
    model('city-kit-roads', 'light-curved', 18, 17.6, { yaw: Math.PI, ground: true }),
    model('city-kit-roads', 'light-curved', 46, 28.4, { yaw: 0, ground: true }),
    model('city-kit-roads', 'light-curved', 86, 17.6, { yaw: Math.PI, ground: true }),
    model('city-kit-roads', 'light-curved', 55, 44, { yaw: -QUARTER, ground: true }),
    model('city-kit-roads', 'traffic-light', 55.4, 17.4, { yaw: Math.PI * 0.75, ground: true }),
    model('city-kit-roads', 'road-sign-street', 66.6, 28.6, { yaw: -QUARTER, ground: true }),
    model('city-kit-roads', 'road-sign-stop', 55.2, 28.8, { yaw: QUARTER, ground: true }),
    model('city-kit-roads', 'sign-highway', 67.2, 42, { yaw: 0, ground: true }),
    model('city-kit-roads', 'electricity-pole', 8, 28.9, { yaw: 0, ground: true }),
    model('city-kit-roads', 'electricity-pole', 32, 28.9, { yaw: 0, ground: true }),
    model('city-kit-roads', 'electricity-pole', 80, 28.9, { yaw: 0, ground: true }),
    model('city-kit-roads', 'construction-light', 57.2, 30.4, { yaw: 0.3, ground: true }),
    model('city-kit-roads', 'construction-light', 64.8, 30.6, { yaw: -0.2, ground: true }),
    model('city-kit-roads', 'construction-cone', 58.8, 29.6, { ground: true }),
    model('city-kit-roads', 'construction-cone', 61.4, 29.2, { ground: true }),
    model('city-kit-roads', 'construction-cone', 63.6, 29.8, { ground: true }),
    model('city-kit-roads', 'construction-cone', 60.2, 41.4, { ground: true }),
  ];
}

/* ---------- blocked route: containers and barriers around the wreck (colliders) ---------- */

export function blockedRouteProps(): BlockDef[] {
  return [
    modelProp('city-kit-roads', 'construction-barrier', 57.4, 31, QUARTER, 'barrier', { lowObstacle: true }),
    modelProp('city-kit-roads', 'construction-barrier', 59.6, 31.1, QUARTER, 'barrier', { lowObstacle: true }),
    modelProp('city-kit-roads', 'construction-barrier', 62.6, 31.1, QUARTER + 0.1, 'barrier', { lowObstacle: true }),
    modelProp('city-kit-roads', 'construction-barrier', 64.8, 31, QUARTER, 'barrier', { lowObstacle: true }),
    modelProp('city-kit-roads', 'construction-fence', 56.4, 33.4, QUARTER, 'fence', { lowObstacle: true }),
    modelProp('city-kit-roads', 'construction-fence', 66, 33.8, QUARTER - 0.2, 'fence', { lowObstacle: true }),
    modelProp('city-kit-industrial', 'shipping-container-a', 56.6, 39.4, 0.35),
    modelProp('city-kit-industrial', 'shipping-container-c', 65.6, 40.2, -0.25),
    modelProp('city-kit-industrial', 'shipping-container-b', 57.6, 45.8, 0.12),
    modelProp('city-kit-roads', 'dumpster', 27, 17.6, 0),
    modelProp('city-kit-roads', 'dumpster', 53.2, 29.2, 0.15),
    modelProp('city-kit-roads', 'dumpster', 84.5, 47.8, QUARTER),
    modelProp('city-kit-suburban', 'planter', 44, 68.6, 0),
    modelProp('city-kit-suburban', 'planter', 78, 68.6, 0),
    modelProp('city-kit-suburban', 'tree-small', 43, 75.5, 0.4),
    modelProp('city-kit-suburban', 'tree-small', 79, 75.2, -0.8),
    modelProp('city-kit-industrial', 'detail-tank', 100, 46, 0),
  ];
}

/* ---------- fences: the level's fence blocks become tiled kit fences ---------- */

/** Ids of blocks whose box visual is replaced by these tiles (they stay colliders). */
export const FENCE_BLOCK_IDS = ['fence_w', 'fence_e', 'fence_n', 'fence_n0', 'fence_alley_n1', 'fence_pk_e', 'fence_plaza_w', 'fence_plaza_e', 'fence_river_w', 'fence_river_e', 'fence_ph_w', 'fence_ph_e'];

export function fenceTiles(blocks: readonly BlockDef[]): ModelDef[] {
  const out: ModelDef[] = [];
  for (const block of blocks) {
    if (!FENCE_BLOCK_IDS.includes(block.id)) continue;
    const alongX = block.w >= block.d;
    const length = alongX ? block.w : block.d;
    const count = Math.max(1, Math.ceil(length / FENCE_LENGTH));
    const step = length / count;
    for (let i = 0; i < count; i += 1) {
      const offset = -length / 2 + step * (i + 0.5);
      const x = alongX ? block.x + offset : block.x;
      const z = alongX ? block.z : block.z + offset;
      out.push(model('city-kit-suburban', 'fence', x, z, { y: block.y ?? 0, yaw: alongX ? 0 : QUARTER, scale: step / FENCE_LENGTH }));
    }
  }
  return out;
}

/* ---------- facades ---------- */

/** Windows along a facade segment: `zFace` is the wall plane; windows face the street. */
function facadeWindows(x0: number, x1: number, zFace: number, facing: 'south' | 'north'): ModelDef[] {
  const out: ModelDef[] = [];
  const z = facing === 'south' ? zFace + 0.03 : zFace - 0.03;
  const yaw = facing === 'south' ? 0 : Math.PI;
  for (const y of WINDOW_ROWS) {
    for (let x = x0 + WINDOW_PITCH / 2; x < x1 - 0.8; x += WINDOW_PITCH) {
      out.push(model('modular-buildings', 'window-white', x, z, { y, yaw }));
    }
  }
  return out;
}

function facades(): ModelDef[] {
  return [
    ...facadeWindows(0, 8, 16, 'south'),
    ...facadeWindows(14, 26, 16, 'south'),
    ...facadeWindows(28, 52, 16, 'south'),
    ...facadeWindows(68, 104, 16, 'south'),
    ...facadeWindows(0, 28, 30, 'north'),
    ...facadeWindows(96, 104, 30, 'north'),
    // Pharmacy front: three windows either side of the door, an awning over it.
    model('modular-buildings', 'window-white', 34, 29.97, { y: 1.5, yaw: Math.PI }),
    model('modular-buildings', 'window-white', 36.2, 29.97, { y: 1.5, yaw: Math.PI }),
    model('modular-buildings', 'window-white', 43.6, 29.97, { y: 1.5, yaw: Math.PI }),
    model('modular-buildings', 'window-white', 45.8, 29.97, { y: 1.5, yaw: Math.PI }),
    model('city-kit-commercial', 'detail-awning', 39.9, 29.9, { y: 2.7, yaw: Math.PI }),
    model('city-kit-commercial', 'detail-overhang', 11.2, 16.1, { y: 2.7, yaw: 0 }),
    model('modular-buildings', 'detail-ac-a', 30.2, 20, { y: 3.4, yaw: QUARTER }),
    model('modular-buildings', 'detail-ac-a', 52.1, 33, { y: 3.6, yaw: -QUARTER }),
    model('modular-buildings', 'detail-ac-a', 68, 36, { y: 4.2, yaw: QUARTER }),
    model('modular-buildings', 'detail-ac-a', 44.3, 41, { y: 2.4, yaw: 0 }),
    model('city-kit-industrial', 'water-tower', 54, 38, { y: 6, scale: 0.4 }),
    model('city-kit-industrial', 'chimney-small', 40, 8, { y: 10 }),
    model('city-kit-industrial', 'chimney-small', 90, 8, { y: 14 }),
  ];
}

/* ---------- skyline beyond the perimeter (never walkable) ---------- */

function skyline(): ModelDef[] {
  const out: ModelDef[] = [];
  const north: Array<[string, number]> = [['low-detail-building-a', -6], ['low-detail-building-wide-a', 6], ['low-detail-building-b', 18], ['low-detail-building-c', 30], ['low-detail-building-wide-a', 44], ['low-detail-building-d', 58], ['low-detail-building-e', 72], ['low-detail-building-b', 86], ['low-detail-building-f', 100], ['low-detail-building-a', 112]];
  for (const [name, x] of north) out.push(model('city-kit-commercial', name, x, -18, { yaw: 0 }));
  for (const [name, x] of [['building-c', -20], ['building-f', 124]] as Array<[string, number]>) out.push(model('city-kit-commercial', name, x, 4, { yaw: 0 }));
  const south: Array<[string, number]> = [['building-type-a', 20], ['building-type-c', 36], ['building-type-b', 54], ['building-type-d', 72], ['building-type-e', 88], ['building-type-f', 104]];
  for (const [name, x] of south) out.push(model('city-kit-suburban', name, x, 106, { yaw: Math.PI }));
  for (const x of [28, 46, 64, 82, 98]) out.push(model('city-kit-suburban', 'tree-large', x, 98, { yaw: x * 0.3 }));
  out.push(model('city-kit-industrial', 'building-a', 120, 66, { yaw: -QUARTER }));
  out.push(model('city-kit-industrial', 'building-b', -22, 70, { yaw: QUARTER }));
  return out;
}

/** Visual placements; colliders for containers, barriers and dumpsters come from `blockedRouteProps`. */
export function dressingModels(blocks: readonly BlockDef[]): ModelDef[] {
  return [...roads(), ...streetFurniture(), ...fenceTiles(blocks), ...facades(), ...skyline()];
}
