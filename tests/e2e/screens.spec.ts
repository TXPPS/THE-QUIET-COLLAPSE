import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { captureConsole, openGame, passWarning, startNewRun } from './helpers';

const EVIDENCE = 'docs/audit/evidence';

async function teleport(page: Page, x: number, z: number, yaw: number, pitch = 0.1): Promise<void> {
  await page.evaluate(
    ({ x, z, yaw, pitch }) => {
      const app = window.__tqc;
      const world = app?.session?.world;
      if (!world) throw new Error('no session');
      world.player.x = x;
      world.player.z = z;
      world.player.prevX = x;
      world.player.prevZ = z;
      world.look.yaw = yaw;
      world.look.pitch = pitch;
    },
    { x, z, yaw, pitch },
  );
  await page.waitForTimeout(350);
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${EVIDENCE}/${test.info().project.name}-${name}.png` });
}

test.describe('screen evidence', () => {
  test.setTimeout(300_000);
  test('captures the main screens and several gameplay views', async ({ page }) => {
    mkdirSync(EVIDENCE, { recursive: true });
    const capture = captureConsole(page);
    await openGame(page);
    await shot(page, '01-warning');
    await passWarning(page);
    await shot(page, '02-main-menu');
    await page.getByRole('button', { name: /^Options$/ }).click();
    await shot(page, '03-options-video');
    await page.keyboard.press('Escape');
    await startNewRun(page);
    await page.waitForTimeout(500);
    await shot(page, '10-gameplay-stairwell');
    await teleport(page, 12, 20, Math.PI / 2);
    await shot(page, '11-gameplay-ferry-street');
    await teleport(page, 58, 26, 0.3);
    await shot(page, '12-gameplay-wreck');
    await teleport(page, 40, 36, 0);
    await shot(page, '13-gameplay-pharmacy');
    await teleport(page, 61, 56, 0);
    await shot(page, '14-gameplay-underpass');
    await teleport(page, 61, 70, 0);
    await shot(page, '15-gameplay-plaza');
    await page.keyboard.press('Escape');
    await shot(page, '20-pause');
    await page.getByRole('button', { name: /^Items/ }).click();
    await shot(page, '21-inventory');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Objective/ }).click();
    await shot(page, '22-map');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.locator('.tqc-hud')).toBeVisible();
    expect(capture.errors).toEqual([]);
  });
});
