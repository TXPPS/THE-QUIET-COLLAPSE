import { describe, expect, it } from 'vitest';
import { DISTRICT_LEVEL } from '@/game/level/districtLevel';
import { validateRunState } from '@/game/sim/runState';
import { World } from '@/game/sim/World';
import { Simulation } from '@/game/sim/Simulation';
import { createHeadless, faceTowards, stepFor, stepOnce, walkAndInteract, walkTo } from '../../helpers/headless';

const level = DISTRICT_LEVEL;
const byId = <T extends { id: string }>(list: T[], id: string): T => {
  const found = list.find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

describe('headless playable loop', () => {
  it('walks the full route from the stairwell to the crossing gate', () => {
    const h = createHeadless(undefined, { killThreats: true });
    const { world, events } = h;

    expect(walkAndInteract(h, byId(level.pickups, 'pk_flashlight'))).toBe(true);
    expect(world.player.hasFlashlight).toBe(true);

    expect(walkAndInteract(h, byId(level.documents, 'doc_notice'))).toBe(true);
    expect(world.documentsRead.has('doc_notice')).toBe(true);

    const stairDoor = byId(level.doors, 'door_stairwell');
    expect(walkAndInteract(h, { x: stairDoor.x, z: stairDoor.z - 1.2 })).toBe(true);
    expect(world.isDoorOpen('door_stairwell')).toBe(true);

    expect(walkTo(h, { x: 12, z: 20.5 })).toBe(true);
    expect(world.currentObjective()?.id).toBe('route4');
    expect(events).toContain('checkpoint:street');

    expect(walkAndInteract(h, byId(level.pickups, 'pk_ammo_car'))).toBe(true);
    expect(world.player.ammoReserve).toBe(4);

    expect(walkTo(h, { x: 61, z: 30.5 })).toBe(true);
    expect(world.currentObjective()?.id).toBe('alternate');
    expect(world.flags['sawBlockage']).toBe(true);

    // Direct route south is sealed by the wreck (no path while the side doors are closed).
    expect(world.nav.findPath({ x: 61, z: 30 }, { x: 61, z: 45 })).toBeNull();
    expect(walkTo(h, { x: 61, z: 42 }, 15)).toBe(false);

    const pharmDoor = byId(level.doors, 'door_pharmacy');
    expect(walkAndInteract(h, { x: pharmDoor.x, z: pharmDoor.z - 1.2 })).toBe(true);
    expect(world.isDoorOpen('door_pharmacy')).toBe(true);
    expect(walkAndInteract(h, byId(level.pickups, 'pk_medkit_pharmacy'))).toBe(true);
    expect(world.player.medkits).toBe(2);
    expect(walkAndInteract(h, byId(level.pickups, 'pk_ammo_pharmacy'))).toBe(true);
    expect(world.player.ammoReserve).toBe(10);

    const backDoor = byId(level.doors, 'door_pharmacy_back');
    expect(walkAndInteract(h, { x: backDoor.x, z: backDoor.z - 1.1 })).toBe(true);
    expect(world.isDoorOpen('door_pharmacy_back')).toBe(true);
    expect(walkAndInteract(h, byId(level.interactables, 'it_radio'))).toBe(true);
    expect(events).toContain('saveRequest:it_radio');

    const alleyDoor = byId(level.doors, 'door_pharmacy_alley');
    expect(walkAndInteract(h, { x: alleyDoor.x, z: alleyDoor.z - 1.1 })).toBe(true);
    expect(walkTo(h, { x: 61, z: 48 })).toBe(true);
    expect(world.currentObjective()?.id).toBe('underpass');
    expect(events).toContain('checkpoint:route4_south');

    expect(walkTo(h, { x: 61, z: 68 })).toBe(true);
    expect(world.currentObjective()?.id).toBe('crossing');
    expect(events).toContain('checkpoint:plaza');

    expect(walkAndInteract(h, byId(level.interactables, 'it_gate'))).toBe(true);
    expect(events).toContain('ending:');
    expect(world.completed).toBe(true);
  });

  it('reaches the crossing through the parking structure as well', () => {
    const h = createHeadless(undefined, { killThreats: true });
    const { world } = h;
    const stairDoor = byId(level.doors, 'door_stairwell');
    expect(walkAndInteract(h, { x: stairDoor.x, z: stairDoor.z - 1.2 })).toBe(true);
    const gate = byId(level.doors, 'door_parking_gate');
    expect(walkAndInteract(h, { x: gate.x, z: gate.z - 1.4 })).toBe(true);
    expect(world.isDoorOpen('door_parking_gate')).toBe(true);
    expect(walkAndInteract(h, byId(level.pickups, 'pk_ammo_parking'))).toBe(true);
    const exit = byId(level.doors, 'door_parking_exit');
    expect(walkAndInteract(h, { x: exit.x + 1.4, z: exit.z })).toBe(true);
    expect(world.isDoorOpen('door_parking_exit')).toBe(true);
    expect(walkTo(h, { x: 61, z: 48 })).toBe(true);
    expect(world.currentObjective()?.id).toBe('underpass');
  });

  it('threats notice, chase, attack and can kill the player; the run state survives a round trip', () => {
    const h = createHeadless();
    const { world, events } = h;
    const threat = byId(world.threats, 'th_street');
    world.player.x = threat.x + 6;
    world.player.z = threat.z;
    threat.yaw = Math.PI / 2;
    faceTowards(h, threat);
    stepFor(h, 6);
    expect(['chase', 'attack']).toContain(threat.state);
    stepFor(h, 20);
    expect(events.some((e) => e.startsWith('playerHurt'))).toBe(true);
    expect(world.player.dead).toBe(true);
    expect(events).toContain('playerDied:');
    stepFor(h, 2);
    expect(h.sim.gameOverReady).toBe(true);

    const snapshot = world.toRunState();
    expect(validateRunState(snapshot)).toBe(true);
    const restored = new World(level, snapshot);
    expect(restored.threats.length).toBe(level.threats.length);
    expect(restored.toRunState()).toEqual(snapshot);
    new Simulation(restored).dispose();
  });

  it('half stick deflection walks at half speed, not a quarter', () => {
    const h = createHeadless(undefined, { killThreats: true });
    h.world.player.x = 12;
    h.world.player.z = 22;
    h.world.look.yaw = Math.PI / 2;
    h.input.move = { x: 0, y: 0.5 };
    stepFor(h, 2);
    const walked = h.world.player.x - 12;
    expect(walked).toBeGreaterThan(2.0);
    expect(walked).toBeLessThan(2.8);
  });

  it('shooting damages and kills a threat and consumes scarce ammo', () => {
    const h = createHeadless();
    const { world, input, events } = h;
    const threat = byId(world.threats, 'th_street');
    world.player.x = threat.x;
    world.player.z = threat.z - 6;
    world.aimRay.ox = world.player.x;
    world.aimRay.oy = 1.5;
    world.aimRay.oz = world.player.z - 1;
    world.aimRay.dx = 0;
    world.aimRay.dy = -0.02;
    world.aimRay.dz = 1;
    input.hold('Aim', true);
    stepFor(h, 0.5);
    for (let shots = 0; shots < 3; shots += 1) {
      input.press('Fire');
      stepFor(h, 0.5);
    }
    expect(events.filter((e) => e.startsWith('threatHit')).length).toBe(3);
    expect(threat.alive).toBe(false);
    expect(world.player.ammoLoaded).toBe(3);
    for (let shots = 0; shots < 4; shots += 1) {
      input.press('Fire');
      stepFor(h, 0.5);
    }
    expect(world.player.ammoLoaded).toBe(0);
    input.press('Fire');
    stepOnce(h);
    expect(world.player.ammoLoaded).toBe(0);
  });
});
