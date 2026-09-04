/**
 * District navmesh (Recast tile cache) generated from the level's static colliders. The level is
 * TypeScript, so it is loaded through Vite's SSR module runner; the mesh carries the level's
 * signature so the runtime can refuse a stale one.
 */
import { createServer } from 'vite';
import { init, exportTileCache } from 'recast-navigation';
import { generateTileCache } from '@recast-navigation/generators';
import { mb } from './lib/io.mjs';

export async function buildNavmesh(manifest) {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { DISTRICT_LEVEL } = await server.ssrLoadModule('/src/game/level/districtLevel.ts');
    const { buildNavGeometry, NAV_BUILD } = await server.ssrLoadModule('/src/game/nav/navGeometry.ts');
    const { levelSignature } = await server.ssrLoadModule('/src/game/nav/signature.ts');
    await init();
    const geometry = buildNavGeometry(DISTRICT_LEVEL);
    const result = generateTileCache(geometry.positions, geometry.indices, {
      cs: NAV_BUILD.cs,
      ch: NAV_BUILD.ch,
      walkableSlopeAngle: NAV_BUILD.walkableSlopeAngle,
      walkableRadius: NAV_BUILD.walkableRadius,
      walkableHeight: NAV_BUILD.walkableHeight,
      walkableClimb: NAV_BUILD.walkableClimb,
      tileSize: NAV_BUILD.tileSize,
      expectedLayersPerTile: NAV_BUILD.expectedLayersPerTile,
      maxObstacles: NAV_BUILD.maxObstacles,
    });
    if (!result.success) throw new Error(`navmesh generation failed: ${result.error}`);
    const bytes = Buffer.from(exportTileCache(result.navMesh, result.tileCache));
    const signature = levelSignature(DISTRICT_LEVEL);
    const path = manifest.emit('nav.district', { dir: 'nav', name: 'district', ext: 'bin', bytes, sources: ['original'], kind: 'bin', meta: { signature, triangles: geometry.indices.length / 3 } });
    console.log(`  navmesh: ${geometry.indices.length / 3} input triangles → ${path} (${mb(bytes.length)}, level ${signature})`);
    result.navMesh.destroy();
    result.tileCache.destroy();
  } finally {
    await server.close();
  }
}
