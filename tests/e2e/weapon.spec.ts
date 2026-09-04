import { expect, test, type Page } from '@playwright/test';
import { captureConsole, openGame, passWarning, startNewRun } from './helpers';
import { advance } from './input';

/** Evidence for the held weapon: low-ready carry, raised aim with the muzzle flash, reload motion, torch. */
test.setTimeout(180_000);

async function pose(page: Page, yaw: number, pitch: number): Promise<void> {
  await page.evaluate(
    ({ yaw, pitch }) => {
      const w = window.__tqc!.session!.world;
      w.player.x = 12;
      w.player.z = 20.5;
      w.player.prevX = w.player.x;
      w.player.prevZ = w.player.z;
      w.player.yaw = yaw;
      w.look.yaw = yaw;
      w.look.pitch = pitch;
      w.player.hasFlashlight = true;
      w.player.flashlightOn = true;
    },
    { yaw, pitch },
  );
  await advance(page, 0.3);
}

test('held weapon reads in third person: carry, aim, fire, reload', async ({ page }, testInfo) => {
  const capture = captureConsole(page);
  await openGame(page);
  await passWarning(page);
  await startNewRun(page);
  const dir = 'docs/audit/evidence';
  const tag = testInfo.project.name;
  await pose(page, Math.PI * 0.75, 0.05);
  await page.screenshot({ path: `${dir}/${tag}-30-weapon-carry.png` });
  // Aim by holding the semantic action through the touch source (works on every project).
  await page.evaluate(() => {
    const app = window.__tqc!;
    app.input.enableTouch(true);
    app.input.touch.hold('Aim');
  });
  await advance(page, 0.6);
  const raised = await page.evaluate(() => window.__tqc!.session!.world.player.weaponRaise);
  expect(raised).toBe(1);
  await page.screenshot({ path: `${dir}/${tag}-31-weapon-aim.png` });
  await page.evaluate(() => window.__tqc!.input.touch.pulse('Fire'));
  await advance(page, 0.02);
  await page.screenshot({ path: `${dir}/${tag}-32-weapon-fire.png` });
  expect(await page.evaluate(() => window.__tqc!.session!.world.player.ammoLoaded)).toBe(5);
  await page.evaluate(() => {
    const app = window.__tqc!;
    app.session!.world.player.ammoReserve = 6;
    app.input.touch.release('Aim');
    app.input.touch.pulse('Reload');
  });
  await advance(page, 0.7);
  expect(await page.evaluate(() => window.__tqc!.session!.world.player.reloadTimer)).toBeGreaterThan(0);
  await page.screenshot({ path: `${dir}/${tag}-33-weapon-reload.png` });
  expect(capture.errors).toEqual([]);
});
