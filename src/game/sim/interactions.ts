import { DIFFICULTY, INTERACTION } from '@/config/gameplay';
import { length2 } from '@/core/math';
import type { DocumentDef, DoorDef, InteractableDef, PickupDef } from '@/game/level/types';
import type { World } from './World';

export type InteractionTarget =
  | { kind: 'door'; def: DoorDef; verb: string }
  | { kind: 'pickup'; def: PickupDef; verb: string }
  | { kind: 'document'; def: DocumentDef; verb: string }
  | { kind: 'interactable'; def: InteractableDef; verb: string };

export interface InteractionPrompt {
  target: InteractionTarget;
  label: string;
}

function inFront(world: World, x: number, z: number): boolean {
  const p = world.player;
  const dx = x - p.x;
  const dz = z - p.z;
  const len = length2(dx, dz);
  if (len < 0.6) return true;
  const fx = Math.sin(world.look.yaw);
  const fz = Math.cos(world.look.yaw);
  return (dx * fx + dz * fz) / len > INTERACTION.facingCos;
}

/** Finds the nearest usable thing within reach and roughly in front of the camera. */
export function findInteraction(world: World): InteractionPrompt | null {
  const p = world.player;
  let best: InteractionPrompt | null = null;
  let bestDistance = INTERACTION.reach;
  const consider = (x: number, z: number, target: InteractionTarget, label: string, reachBonus = 0) => {
    const distance = length2(x - p.x, z - p.z);
    if (distance > bestDistance + reachBonus || !inFront(world, x, z)) return;
    bestDistance = distance - reachBonus;
    best = { target, label };
  };
  for (const door of world.level.doors) {
    const open = world.isDoorOpen(door.id);
    consider(door.x, door.z, { kind: 'door', def: door, verb: open ? 'Close' : 'Open' }, door.label, 0.4);
  }
  for (const pickup of world.level.pickups) {
    if (world.pickupsTaken[pickup.id]) continue;
    consider(pickup.x, pickup.z, { kind: 'pickup', def: pickup, verb: 'Take' }, pickup.label);
  }
  for (const doc of world.level.documents) {
    consider(doc.x, doc.z, { kind: 'document', def: doc, verb: 'Read' }, doc.title);
  }
  for (const item of world.level.interactables) {
    if (item.kind === 'gate' && (world.objectiveIndex < world.level.objectives.length - 1 || world.endingReached)) continue;
    const verb = item.kind === 'radio' ? 'Use' : item.kind === 'gate' ? 'Open' : 'Examine';
    consider(item.x, item.z, { kind: 'interactable', def: item, verb }, item.label, 0.5);
  }
  return best;
}

/** Performs the interaction. Returns true when something happened. */
export function performInteraction(world: World, prompt: InteractionPrompt): boolean {
  const { target } = prompt;
  switch (target.kind) {
    case 'door': {
      const open = !world.isDoorOpen(target.def.id);
      world.setDoor(target.def.id, open);
      world.events.emit('door', { id: target.def.id, open, label: target.def.label });
      world.events.emit('noise', { x: target.def.x, z: target.def.z, radius: 6, kind: 'door' });
      return true;
    }
    case 'pickup':
      return takePickup(world, target.def);
    case 'document':
      world.documentsRead.add(target.def.id);
      world.events.emit('document', { document: target.def });
      return true;
    case 'interactable':
      return useInteractable(world, target.def);
    default:
      return false;
  }
}

function takePickup(world: World, def: PickupDef): boolean {
  const p = world.player;
  if (world.pickupsTaken[def.id]) return false;
  world.pickupsTaken[def.id] = true;
  if (def.kind === 'ammo') p.ammoReserve += Math.max(1, Math.round(def.amount * DIFFICULTY[world.difficulty].ammoFound));
  else if (def.kind === 'medkit') p.medkits += def.amount;
  else if (def.kind === 'flashlight') {
    p.hasFlashlight = true;
    p.flashlightOn = true;
    world.events.emit('flashlight', { on: true });
  }
  world.events.emit('pickup', { id: def.id, kind: def.kind, label: def.label, amount: def.amount });
  return true;
}

function useInteractable(world: World, def: InteractableDef): boolean {
  if (def.kind === 'radio') {
    world.events.emit('saveRequest', { id: def.id });
    return true;
  }
  if (def.kind === 'gate') {
    if (world.endingReached) return false;
    world.endingReached = true;
    world.completed = true;
    world.events.emit('ending', undefined);
    return true;
  }
  world.flags[`examined:${def.id}`] = true;
  world.events.emit('message', { text: def.message ?? def.label });
  return true;
}
