import type { World } from '@/game/sim/World';

const COLORS = {
  paper: '#111213',
  block: '#2c2e30',
  road: '#1b1c1e',
  interior: '#1f2422',
  label: '#7d7a72',
  player: '#e6dcc3',
  objective: '#c99a3a',
  blocked: '#8a3a2c',
  fog: 'rgba(10,11,12,0.55)',
};

/** Draws the district plan from level data (no external assets), scaled to fit the canvas. */
export function drawDistrictMap(canvas: HTMLCanvasElement, world: World, width: number, height: number): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { bounds } = world.level;
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  const scale = Math.min(width / spanX, height / spanZ);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanZ * scale) / 2;
  const toX = (x: number) => offsetX + (x - bounds.minX) * scale;
  const toY = (z: number) => offsetY + (z - bounds.minZ) * scale;
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, width, height);
  for (const patch of world.level.surfaces) {
    if (patch.kind === 'water') continue;
    ctx.fillStyle = patch.kind === 'asphalt' ? COLORS.road : patch.kind === 'tile' ? COLORS.interior : COLORS.paper;
    ctx.fillRect(toX(patch.x - patch.w / 2), toY(patch.z - patch.d / 2), patch.w * scale, patch.d * scale);
  }
  ctx.fillStyle = COLORS.block;
  for (const block of world.level.blocks) {
    if (block.noCollide || block.h < 2.5) continue;
    ctx.save();
    ctx.translate(toX(block.x), toY(block.z));
    ctx.rotate(-(block.rot ?? 0));
    ctx.fillRect((-block.w / 2) * scale, (-block.d / 2) * scale, block.w * scale, block.d * scale);
    ctx.restore();
  }
  if (world.flags['sawBlockage']) {
    ctx.strokeStyle = COLORS.blocked;
    ctx.lineWidth = 2;
    const x = toX(61);
    const y = toY(35);
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 6);
    ctx.lineTo(x + 6, y + 6);
    ctx.moveTo(x + 6, y - 6);
    ctx.lineTo(x - 6, y + 6);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.label;
  ctx.font = `${Math.max(9, 11 * Math.min(1.4, scale / 4))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  for (const label of world.level.mapLabels) ctx.fillText(label.text.toUpperCase(), toX(label.x), toY(label.z));
  const objective = world.currentObjective();
  if (objective?.marker) {
    ctx.strokeStyle = COLORS.objective;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(toX(objective.marker.x), toY(objective.marker.z), 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  const p = world.player;
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(toX(p.x), toY(p.z), 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(toX(p.x), toY(p.z));
  ctx.lineTo(toX(p.x + Math.sin(world.look.yaw) * 3), toY(p.z + Math.cos(world.look.yaw) * 3));
  ctx.stroke();
}
