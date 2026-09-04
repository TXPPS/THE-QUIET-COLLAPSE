import { expect, test } from '@playwright/test';
import { captureConsole, openGame, passWarning, startNewRun } from './helpers';
import { advance } from './input';

test('recast crowd steers threats along the navmesh and respects closed doors', async ({ page }) => {
  test.setTimeout(240_000);
  const capture = captureConsole(page);
  await openGame(page);
  await passWarning(page);
  await startNewRun(page);
  const before = await page.evaluate(() => {
    const w = window.__tqc!.session!.world;
    const t = w.threats.find((th) => th.id === 'th_street')!;
    // Put the player on the street in front of the resident and make it chase.
    w.player.x = 30;
    w.player.z = 22;
    w.player.prevX = 30;
    w.player.prevZ = 22;
    t.x = 50;
    t.z = 22;
    t.prevX = 50;
    t.prevZ = 22;
    w.navigation?.teleport(t.id, t.x, t.z);
    t.awareness = 1;
    t.lastSeenPlayer = { x: w.player.x, z: w.player.z };
    t.timeSinceSeen = 0;
    t.state = 'chase';
    return { nav: w.navigation ? w.navigation.agentCount : -1, x: t.x, z: t.z };
  });
  console.info('[probe] before', JSON.stringify(before));
  await advance(page, 3);
  const after = await page.evaluate(() => {
    const w = window.__tqc!.session!.world;
    const t = w.threats.find((th) => th.id === 'th_street')!;
    return { x: t.x, z: t.z, state: t.state, moving: t.moving, vel: Math.hypot(t.velX, t.velZ), agent: w.navigation?.agentPosition(t.id) };
  });
  console.info('[probe] after', JSON.stringify(after));
  // Door obstacle: pharmacy is closed; a threat inside must not path outside through the wall.
  const doorProbe = await page.evaluate(() => {
    const w = window.__tqc!.session!.world;
    const t = w.threats.find((th) => th.id === 'th_pharmacy_b')!;
    w.player.x = 40;
    w.player.z = 24;
    w.player.prevX = 40;
    w.player.prevZ = 24;
    t.awareness = 1;
    t.lastSeenPlayer = { x: 40, z: 24 };
    t.timeSinceSeen = 0;
    t.state = 'chase';
    return { x: t.x, z: t.z };
  });
  await advance(page, 4);
  const doorAfter = await page.evaluate(() => {
    const w = window.__tqc!.session!.world;
    const t = w.threats.find((th) => th.id === 'th_pharmacy_b')!;
    return { x: t.x, z: t.z, insidePharmacy: t.z > 30.5, doorOpen: w.isDoorOpen('door_pharmacy') };
  });
  console.info('[probe] door', JSON.stringify(doorProbe), '→', JSON.stringify(doorAfter));
  expect(before.nav).toBeGreaterThan(0);
  expect(after.x).toBeLessThan(before.x - 3);
  expect(doorAfter.insidePharmacy).toBe(true);
  expect(capture.errors).toEqual([]);
});
