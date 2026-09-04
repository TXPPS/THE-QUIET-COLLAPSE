import { CANON } from '@/config/canon';
import { box, car, door, light, pillar, prop, surface, zone } from './builders';
import { FENCE_BLOCK_IDS, blockedRouteProps, dressingModels } from './dressing';
import { DOCUMENTS } from './documents';
import { groundLevel } from './grounding';
import type { BlockDef, LevelData } from './types';

/* Coordinates in metres on the XZ plane. +X is east, +Z is south. Yaw 0 faces +Z. */

const BUILDING_H = 11;
const EMBANKMENT_H = 7;
const WALL = 1;

const buildings: BlockDef[] = [
  // North side of Ferry Street
  box('bld_n0', -12, 0, -2, 16, 9, 'brick'),
  box('bld_n1_west', 0, 0, 8, 16, BUILDING_H, 'brick'),
  box('bld_n1_east', 14, 0, 26, 16, BUILDING_H, 'brick'),
  box('bld_n1_north', 8, 0, 14, 8, BUILDING_H, 'brick'),
  box('bld_n1_sw', 8, 15, 10.4, 16, BUILDING_H, 'brick'),
  box('bld_n1_se', 12, 15, 14, 16, BUILDING_H, 'brick'),
  box('bld_n2', 28, 0, 52, 16, 10, 'concrete'),
  box('bld_n3', 68, 0, 112, 16, 14, 'plaster'),
  // South side
  box('bld_s1', 0, 30, 28, 52, 9, 'concrete'),
  box('bld_s0', -12, 30, 0, 52, 6, 'brick'),
  // Pharmacy shell (hollow interior 31..49 x 31..45)
  box('ph_wall_n_w', 30, 30, 39, 31, 4, 'plaster'),
  box('ph_wall_n_e', 40.8, 30, 50, 31, 4, 'plaster'),
  box('ph_wall_w', 30, 30, 31, 46, 4, 'plaster'),
  box('ph_wall_e', 49, 30, 50, 46, 4, 'plaster'),
  box('ph_wall_s_w', 30, 45, 46, 46, 4, 'plaster'),
  box('ph_wall_s_e', 47.6, 45, 50, 46, 4, 'plaster'),
  box('ph_part_w', 44, 39, 44.6, 45, 3.4, 'plaster'),
  box('ph_part_n_w', 44, 39, 46.4, 39.6, 3.4, 'plaster'),
  box('ph_part_n_e', 48, 39, 49, 39.6, 3.4, 'plaster'),
  box('ph_roof', 30, 30, 50, 46, 0.4, 'concrete', { y: 4, noCollide: true }),
  // Fences sealing the gaps beside the pharmacy
  box('fence_ph_w', 28, 30.2, 30, 31, 2.6, 'fence'),
  box('fence_ph_e', 50, 30.2, 52, 31, 2.6, 'fence'),
  box('bld_s2', 52, 30, 56, 46, 6, 'brick'),
  // Parking structure shell (interior 69..93 x 31..51)
  box('pk_wall_n_w', 68, 30, 72, 31, 8, 'concrete'),
  box('pk_wall_n_e', 76, 30, 94, 31, 8, 'concrete'),
  box('pk_wall_w_n', 68, 31, 69, 46, 8, 'concrete'),
  box('pk_wall_w_s', 68, 50, 69, 52, 8, 'concrete'),
  box('pk_wall_e', 93, 30, 94, 52, 8, 'concrete'),
  box('pk_wall_s', 68, 51, 94, 52, 8, 'concrete'),
  box('pk_deck', 68, 30, 94, 52, 0.5, 'concrete', { y: 3.2, noCollide: true }),
  box('pk_upper', 68, 30, 94, 52, 4.3, 'concrete', { y: 3.7, noCollide: true }),
  box('bld_s4', 96, 30, 112, 52, 7, 'plaster'),
  // Rail embankment with the underpass cut through it
  box('emb_w', -12, 52, 58, 66, EMBANKMENT_H, 'concrete'),
  box('emb_e', 64, 52, 112, 66, EMBANKMENT_H, 'concrete'),
  box('emb_deck', 58, 52, 64, 66, 3.5, 'concrete', { y: 3.5, noCollide: true }),
  // South of the embankment
  box('bld_s5', -12, 66, 40, 92, 5, 'concrete'),
  box('bld_s6', 82, 66, 112, 92, 5, 'concrete'),
  // Perimeter fences (tall, keep the run inside the district)
  box('fence_w', -6, 16, -5.6, 30, 2.6, 'fence'),
  box('fence_e', 104, 16, 104.4, 30, 2.6, 'fence'),
  box('fence_n', 52, -4, 68, -3.6, 2.6, 'fence'),
  box('fence_n0', -2, 16.2, 0, 16.6, 2.6, 'fence'),
  box('fence_alley_n1', 26, 1.6, 28, 2, 2.6, 'fence'),
  box('fence_pk_e', 94, 30.2, 96, 31, 2.6, 'fence'),
  box('fence_plaza_w', 40, 66, 40.4, 78, 2.6, 'fence'),
  box('fence_plaza_e', 81.6, 66, 82, 78, 2.6, 'fence'),
  box('fence_river_w', 40, 78, 58, 78.4, 2.6, 'fence'),
  box('fence_river_e', 64, 78, 82, 78.4, 2.6, 'fence'),
  box('gate_post_w', 57.4, 77.6, 58, 78.8, 3, 'metal'),
  box('gate_post_e', 64, 77.6, 64.6, 78.8, 3, 'metal'),
  box('gate_bar', 58, 78, 64, 78.3, 2.6, 'fence', { lowObstacle: false }),
  box('bridge', 56, 78.4, 66, 110, 0.6, 'concrete', { y: -0.6, noCollide: true }),
];

const streetProps: BlockDef[] = [
  car(30, 21.6, 0.14),
  car(44.5, 25.6, -0.08, 'rust'),
  car(70.5, 20.4, 0.05),
  car(90, 25.8, 3.05),
  // Abandoned luggage: people left in a hurry, and on foot.
  prop('luggage', 36.5, 27.8, 0.7, 0.5, 0.45, 'tarp', 0.6, { noCollide: true }),
  prop('luggage', 47.2, 18.6, 0.6, 0.4, 0.4, 'tarp', -0.4, { noCollide: true }),
  // The crashed bus and the wreckage that seals Route 4
  prop('bus', 61.2, 34.2, 2.7, 12, 3.2, 'bus', 0.42),
  prop('rubble', 61.8, 36.6, 12.6, 1.6, 1.2, 'concrete', 0, { lowObstacle: true }),
  // "Road closed" board on its own stand in front of the wreck.
  prop('sign_closed', 61, 31.2, 1.6, 0.12, 1.8, 'barrier', 0, { noCollide: true }),
];

const stairwellProps: BlockDef[] = [
  // A dropped bag by the stairwell door; the flashlight sits on it.
  prop('bag', 9.4, 12.8, 0.6, 0.4, 0.35, 'tarp', 0.4, { noCollide: true }),
];

const pharmacyProps: BlockDef[] = [
  prop('shelf', 35, 35.2, 6, 1.1, 1.8, 'metal'),
  prop('shelf', 35, 40.2, 6, 1.1, 1.8, 'metal'),
  prop('counter', 41.5, 40.4, 3.2, 1.0, 1.0, 'wood'),
  prop('crate', 33, 43.6, 0.9, 0.9, 0.8, 'wood', 0.3),
  prop('desk', 47.8, 42.2, 1.4, 0.8, 0.85, 'wood'),
  prop('cabinet', 45.4, 44.2, 1.2, 0.6, 1.9, 'metal'),
];

const parkingProps: BlockDef[] = [
  pillar(75, 37, 3.2),
  pillar(81, 37, 3.2),
  pillar(87, 37, 3.2),
  pillar(75, 45, 3.2),
  pillar(81, 45, 3.2),
  pillar(87, 45, 3.2),
  car(78, 41, Math.PI / 2, 'car'),
  car(84, 48.6, 0.1, 'rust'),
  car(90.4, 40, Math.PI / 2 + 0.2),
  prop('booth', 70.6, 33, 2.4, 2.0, 2.4, 'metal'),
  // Attendant's ledge under the booth window (the notebook rests on it).
  prop('ledge', 70.6, 34.15, 1.2, 0.3, 0.95, 'metal', 0, { noCollide: true }),
  // Barrier arm on its post: the arm is the one deliberately elevated prop.
  prop('post', 72.3, 33.5, 0.22, 0.22, 1.0, 'metal'),
  prop('barrier_arm', 74, 33.5, 3.6, 0.15, 0.1, 'barrier', 0, { noCollide: true, y: 0.9, elevated: true }),
];

const southProps: BlockDef[] = [
  prop('debris', 57.5, 40, 1.6, 1.2, 0.6, 'concrete', 0.5, { lowObstacle: true }),
  prop('debris', 64.2, 47, 1.4, 1.4, 0.7, 'concrete', -0.4, { lowObstacle: true }),
  prop('cart', 60.6, 58.5, 0.8, 1.0, 1.0, 'metal', 0.3),
  prop('tent', 48, 74.5, 3, 3, 2.2, 'tarp'),
  prop('generator', 66.8, 75.6, 1.4, 0.9, 1.1, 'metal'),
];

/** Fence blocks keep their colliders but are drawn as tiled kit fences (see dressing.ts). */
function markModelled(blocks: BlockDef[]): BlockDef[] {
  return blocks.map((block) => (FENCE_BLOCK_IDS.includes(block.id) ? { ...block, modelled: true } : block));
}

const RAW_LEVEL: LevelData = {
  id: 'district',
  name: CANON.districtName,
  bounds: { minX: -12, minZ: -6, maxX: 112, maxZ: 92 },
  playerStart: { x: 11.2, z: 10.6, yaw: 0 },
  lookStart: { yaw: 0, pitch: 0.12 },
  blocks: markModelled([...buildings, ...stairwellProps, ...streetProps, ...pharmacyProps, ...parkingProps, ...southProps, ...blockedRouteProps()]),
  surfaces: [
    surface(-12, -6, 112, 92, 'concrete', -0.02),
    surface(-6, 18, 104, 28, 'asphalt'),
    surface(56, -4, 66, 54, 'asphalt'),
    surface(31, 31, 49, 45, 'tile', 0.01),
    surface(69, 31, 93, 51, 'concrete', 0.01),
    surface(28, 46, 56, 52, 'gravel', 0.01),
    surface(58, 54, 64, 66, 'concrete', 0.01),
    surface(40, 66, 82, 78, 'concrete', 0.01),
    surface(-12, 80, 112, 130, 'water', -0.8),
  ],
  lights: [
    light('l_stair', 11, 3.0, 11.5, 0xd8c39a, 1.6, 9, { flicker: 0.5 }),
    light('l_street_1', 18, 6, 17.2, 0xd6a45a, 3.5, 22),
    light('l_street_2', 46, 6, 29, 0xd6a45a, 3.2, 20, { flicker: 0.25 }),
    light('l_street_3', 86, 6, 17.2, 0xd6a45a, 3.0, 22, { optional: true }),
    light('l_pharm_sign', 39.9, 3.4, 29.3, 0x8fd0a8, 2.4, 10, { flicker: 0.15 }),
    light('l_bus_beacon', 61, 3.9, 34, 0xe0782a, 5.0, 26, { rotating: true }),
    light('l_pharm_in', 40, 3.2, 38, 0xcfd6c4, 1.3, 12, { flicker: 0.2 }),
    light('l_backroom', 47.5, 2.3, 42.5, 0xe6c07a, 1.4, 7 ),
    light('l_parking', 81, 3.0, 41, 0xbfd3d8, 1.6, 14, { flicker: 0.7 }),
    light('l_route4_s', 55, 6, 44, 0xd6a45a, 2.4, 18, { optional: true }),
    light('l_underpass', 61, 3.2, 60, 0xe09a4a, 1.8, 10, { flicker: 0.6 }),
    light('l_gate', 61, 6.5, 77.5, 0xd0dcf0, 7.0, 34),
    light('l_plaza', 46, 3.5, 72, 0xd6a45a, 1.6, 12, { optional: true }),
  ],
  doors: [
    door('door_stairwell', 11.2, 15.5, 1.6, WALL, 2.3, 'Stairwell door', 0, 'wood'),
    door('door_pharmacy', 39.9, 30.5, 1.8, WALL, 2.4, 'Pharmacy door', 0, 'glass'),
    door('door_pharmacy_back', 47.2, 39.3, 1.6, 0.6, 2.2, 'Back room door', 0, 'wood'),
    door('door_pharmacy_alley', 46.8, 45.5, 1.6, WALL, 2.3, 'Alley door', 0, 'metal'),
    door('door_parking_gate', 74, 30.5, 4, WALL, 3, 'Parking gate', 0, 'metal'),
    door('door_parking_exit', 68.5, 48, 4, WALL, 2.6, 'Parking exit', Math.PI / 2, 'metal'),
  ],
  // Authored heights are probe starts: every pickup is dropped onto the surface below it.
  pickups: [
    { id: 'pk_flashlight', x: 9.4, z: 12.8, y: 0.6, item: 'flashlight', amount: 1, label: 'Flashlight' }, // on the bag
    { id: 'pk_ammo_car', x: 31.6, z: 21.2, y: 0.5, item: 'rounds', amount: 4, label: 'Loose rounds' }, // spilled beside the car
    { id: 'pk_medkit_pharmacy', x: 35, z: 35.6, y: 2.0, item: 'medkit', amount: 1, label: 'First-aid kit' }, // on the shelf
    { id: 'pk_ammo_pharmacy', x: 42.6, z: 40.7, y: 1.2, item: 'rounds', amount: 6, label: 'Box of rounds' }, // on the counter
    { id: 'pk_ammo_parking', x: 72.3, z: 34.6, y: 0.5, item: 'rounds', amount: 4, label: 'Loose rounds' }, // deck by the post
    { id: 'pk_medkit_plaza', x: 47.2, z: 72.6, y: 0.5, item: 'medkit', amount: 1, label: 'First-aid kit' }, // outside the tent
    { id: 'pk_dressing_shelf', x: 35, z: 40.6, y: 2.0, item: 'dressing', amount: 1, label: 'Field dressing' }, // second shelf
    { id: 'pk_antiseptic_shelf', x: 41.2, z: 40.9, y: 1.2, item: 'antiseptic', amount: 1, label: 'Antiseptic' }, // on the counter
    { id: 'pk_dressing_tent', x: 48.6, z: 74.2, y: 1.0, item: 'dressing', amount: 1, label: 'Field dressing' }, // inside the tent
  ],
  documents: DOCUMENTS,
  interactables: [
    { id: 'it_blocked', x: 61, z: 31.6, y: 1.2, kind: 'blocked', label: 'Wreckage', message: 'The bus is wedged against the barriers. There is no way through here.' },
    { id: 'it_radio', x: 47.8, z: 42.0, y: 1.0, kind: 'radio', label: 'Radio', message: 'The radio still has power. A good place to stop and take stock.' }, // on the desk
    { id: 'it_gate', x: 61, z: 77.4, y: 1.3, kind: 'gate', label: 'Crossing gate' },
  ],
  zones: [
    zone('z_leave', 9, 16.2, 13.4, 18.5, 'objective', { objectiveId: 'leave' }),
    zone('z_cp_street', 8, 18, 16, 23, 'checkpoint', { checkpointId: 'street' }),
    zone('z_blocked', 56, 28.5, 66, 33, 'objective', { objectiveId: 'route4', flag: 'sawBlockage' }),
    zone('z_route4_south', 56, 38, 68, 54, 'objective', { objectiveId: 'alternate' }),
    zone('z_cp_route4_south', 56, 42, 68, 54, 'checkpoint', { checkpointId: 'route4_south' }),
    zone('z_underpass_out', 56, 66.5, 66, 70, 'objective', { objectiveId: 'underpass' }),
    zone('z_cp_plaza', 56, 66.5, 66, 70, 'checkpoint', { checkpointId: 'plaza' }),
    zone('z_int_stairwell', 8, 8, 14, 16, 'interior', { ceiling: 3.1 }),
    zone('z_int_pharmacy', 30, 30, 50, 46, 'interior', { ceiling: 3.3 }),
    zone('z_int_parking', 68, 30, 94, 52, 'interior', { ceiling: 3.0 }),
    zone('z_int_underpass', 58, 52, 64, 66, 'interior', { ceiling: 3.3 }),
    zone('z_msg_pharmacy', 31, 31, 49, 45, 'message', { message: 'The pharmacy has been picked over. Not completely.', flag: 'enteredPharmacy' }),
    zone('z_msg_parking', 69, 31, 93, 51, 'message', { message: 'The parking structure runs through to Route 4 on the far side.', flag: 'enteredParking' }),
  ],
  threats: [
    { id: 'th_street', x: 58, z: 23, yaw: Math.PI / 2, wander: true },
    { id: 'th_pharmacy_a', x: 34, z: 43, yaw: Math.PI, wander: false },
    { id: 'th_pharmacy_b', x: 41, z: 34, yaw: -Math.PI / 2, wander: true },
    { id: 'th_parking', x: 84, z: 44, yaw: 0, wander: true },
    { id: 'th_underpass', x: 61, z: 61, yaw: Math.PI, wander: false },
    { id: 'th_plaza', x: 74, z: 72, yaw: -Math.PI / 2, wander: true },
  ],
  objectives: [
    { id: 'leave', label: 'Leave the stairwell', detail: 'Take what you can carry and get to the street.', marker: { x: 11.2, z: 17 } },
    { id: 'route4', label: `Reach ${CANON.crossingLabel} by Route 4`, detail: 'Follow Ferry Street east to Route 4, then head south.', marker: { x: 61, z: 30 } },
    { id: 'alternate', label: 'Route 4 is blocked — find another way south', detail: 'The pharmacy and the parking structure both back onto the far side of the wreck.', marker: { x: 61, z: 46 } },
    { id: 'underpass', label: 'Get through the underpass', detail: 'The only way under the rail line.', marker: { x: 61, z: 60 } },
    { id: 'crossing', label: 'Reach the crossing gate', detail: 'The gate is lit. It is still open.', marker: { x: 61, z: 77 } },
  ],
  decals: [
    { id: 'dc_notice', x: 8.55, y: 1.5, z: 9.6, yaw: Math.PI / 2, w: 0.6, h: 0.8, style: 'notice' },
    { id: 'dc_door_note', x: 13.6, y: 1.4, z: 16.02, yaw: 0, w: 0.3, h: 0.4, style: 'poster' },
    { id: 'dc_pharm_sign', x: 39.9, y: 3.0, z: 29.95, yaw: 0, w: 4, h: 0.7, style: 'sign', text: 'PHARMACY' },
    { id: 'dc_graffiti', x: 57.95, y: 1.6, z: 58, yaw: Math.PI / 2, w: 3.5, h: 0.9, style: 'graffiti', text: 'GATE STILL OPEN →' },
    { id: 'dc_shelter', x: 27.95, y: 2.2, z: 24, yaw: Math.PI / 2, w: 1.2, h: 1.6, style: 'notice' },
    { id: 'dc_route4', x: 55.95, y: 4, z: 40, yaw: Math.PI / 2, w: 2.2, h: 0.8, style: 'sign', text: 'ROUTE 4 →' },
  ],
  models: [],
  mapLabels: [
    { x: 11, z: 12, text: 'Apartments' },
    { x: 26, z: 23, text: 'Ferry Street' },
    { x: 40, z: 38, text: 'Pharmacy' },
    { x: 81, z: 41, text: 'Parking' },
    { x: 61, z: 46, text: 'Route 4' },
    { x: 61, z: 60, text: 'Underpass' },
    { x: 61, z: 74, text: 'Crossing' },
  ],
};

const grounded = groundLevel({ ...RAW_LEVEL, models: dressingModels(RAW_LEVEL.blocks) });
/** The playable district with every prop, pickup, loose document and the radio grounded. */
export const DISTRICT_LEVEL: LevelData = grounded.level;
export const DISTRICT_GROUNDING = grounded.report;
