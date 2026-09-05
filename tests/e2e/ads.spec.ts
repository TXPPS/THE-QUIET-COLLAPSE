import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { captureConsole, openGame, passWarning, startNewRun } from './helpers';

/**
 * Aim-down-sights evidence clip: the camera pulls in, the field of view narrows, the crosshair
 * appears and the arms raise together, then everything returns. Recorded in real time (not through
 * the debug step) so the video shows the blend as the player sees it. The clip name is taken from
 * ADS_CLIP (default "after") so the pre-fix recording can be kept next to the post-fix one.
 */
const EVIDENCE = 'docs/audit/evidence';
const CLIP = process.env['ADS_CLIP'] ?? 'after';

test.use({ video: { mode: 'on', size: { width: 960, height: 540 } } });
test.setTimeout(240_000);

test('records an aim in / aim out clip', async ({ page }, testInfo) => {
  mkdirSync(EVIDENCE, { recursive: true });
  const capture = captureConsole(page);
  await openGame(page);
  await passWarning(page);
  await startNewRun(page);
  await page.evaluate(() => {
    const w = window.__tqc!.session!.world;
    w.player.x = 12;
    w.player.z = 20.5;
    w.player.prevX = w.player.x;
    w.player.prevZ = w.player.z;
    w.player.yaw = Math.PI * 0.75;
    w.look.yaw = Math.PI * 0.75;
    w.look.pitch = 0.05;
    const app = window.__tqc!;
    app.input.enableTouch(true);
  });
  await page.waitForTimeout(1500);
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.evaluate(() => window.__tqc!.input.touch.hold('Aim'));
    await page.waitForTimeout(1800);
    await expect.poll(() => page.evaluate(() => window.__tqc!.session!.world.player.weaponRaise), { timeout: 20_000 }).toBe(1);
    await page.evaluate(() => window.__tqc!.input.touch.release('Aim'));
    await page.waitForTimeout(1800);
  }
  await expect.poll(() => page.evaluate(() => window.__tqc!.session!.world.player.weaponRaise), { timeout: 20_000 }).toBe(0);
  expect(capture.errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(`${EVIDENCE}/${testInfo.project.name}-ads-${CLIP}.webm`);
});
