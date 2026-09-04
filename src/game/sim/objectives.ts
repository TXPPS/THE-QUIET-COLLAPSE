import type { World } from './World';

/** Advances objectives, fires checkpoints and one-shot messages from trigger zones. */
export function updateObjectives(world: World): void {
  const p = world.player;
  if (p.dead) return;
  for (const zone of world.zonesAt(p.x, p.z)) {
    if (zone.kind === 'objective' && zone.objectiveId) completeObjective(world, zone.objectiveId, zone.flag);
    else if (zone.kind === 'checkpoint' && zone.checkpointId) reachCheckpoint(world, zone.checkpointId);
    else if (zone.kind === 'message' && zone.message && zone.flag && !world.flags[zone.flag]) {
      world.flags[zone.flag] = true;
      world.events.emit('message', { text: zone.message });
    }
  }
}

/**
 * Objectives are linear. Reaching a later objective's zone completes every earlier step too, so
 * an alternate route (parking structure instead of the wreck) never leaves the log stale.
 */
function completeObjective(world: World, objectiveId: string, flag?: string): void {
  const current = world.currentObjective();
  if (flag && !world.flags[flag]) world.flags[flag] = true;
  const index = world.level.objectives.findIndex((objective) => objective.id === objectiveId);
  if (!current || index < 0 || index < world.objectiveIndex) return;
  world.objectiveIndex = Math.min(index + 1, world.level.objectives.length - 1);
  const next = world.currentObjective();
  if (next && next.id !== current.id) {
    world.events.emit('objective', { id: next.id, label: next.label, detail: next.detail, index: world.objectiveIndex });
  }
}

function reachCheckpoint(world: World, checkpointId: string): void {
  const flag = `checkpoint:${checkpointId}`;
  if (world.flags[flag]) return;
  world.flags[flag] = true;
  world.checkpointId = checkpointId;
  world.events.emit('checkpoint', { id: checkpointId });
}
