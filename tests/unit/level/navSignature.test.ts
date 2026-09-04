import { describe, expect, it } from 'vitest';
import { assetFile, hasAsset } from '@/assets/manifest';
import { DISTRICT_LEVEL } from '@/game/level/districtLevel';
import { buildNavGeometry } from '@/game/nav/navGeometry';
import { levelSignature } from '@/game/nav/signature';

describe('baked navmesh', () => {
  it('matches the current level colliders (run `pnpm assets:build` after editing the level)', () => {
    expect(hasAsset('nav.district')).toBe(true);
    const baked = assetFile('nav.district') as { signature?: string };
    expect(baked.signature).toBe(levelSignature(DISTRICT_LEVEL));
  });

  it('feeds every collider block and the ground slab to the builder', () => {
    const geometry = buildNavGeometry(DISTRICT_LEVEL);
    const colliders = DISTRICT_LEVEL.blocks.filter((block) => !block.noCollide).length;
    // 12 triangles per box plus 2 for the ground slab.
    expect(geometry.indices.length / 3).toBe(colliders * 12 + 2);
    expect(levelSignature(DISTRICT_LEVEL)).toMatch(/^[0-9a-f]{8}$/);
  });
});
