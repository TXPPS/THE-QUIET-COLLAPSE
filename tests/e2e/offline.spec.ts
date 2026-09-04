import { expect, test } from '@playwright/test';
import { captureConsole, passWarning, startNewRun } from './helpers';
import { advance, pressKey } from './input';

/**
 * Offline gate: load once online (service worker installs and precaches), go offline, reload, then
 * play menu → new game → first interaction → checkpoint save → reload again while still offline.
 * Set E2E_BASE_URL to run it against a deployed origin; the default is the local production preview.
 */
test.describe('offline play after first load', () => {
  test.setTimeout(420_000);
  test.skip(({ browserName }) => browserName !== 'chromium', 'service worker assertions use Chromium');

  test('installs the worker, then completes the first beats fully offline', async ({ page, context, baseURL }) => {
    const capture = captureConsole(page);
    const origin = process.env['E2E_BASE_URL'] ?? baseURL ?? 'http://127.0.0.1:4173';
    await page.goto(`${origin}/?debug`);
    await expect(page.locator('.tqc-screen')).toBeVisible();
    // Wait until the worker controls the page and the precache is populated.
    await expect
      .poll(async () => page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg?.active || !navigator.serviceWorker.controller) return 'waiting';
        const keys = await caches.keys();
        return keys.length > 0 ? 'ready' : 'no-cache';
      }), { timeout: process.env['E2E_BASE_URL'] ? 240_000 : 90_000 })
      .toBe('ready');
    const precached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const cache = await caches.open(keys[0]!);
      return (await cache.keys()).length;
    });
    expect(precached).toBeGreaterThan(5);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.tqc-screen')).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    await passWarning(page);
    await startNewRun(page);
    // First interaction: the flashlight, through a real keypress.
    await page.evaluate(() => {
      const w = window.__tqc!.session!.world;
      w.player.x = 9.9;
      w.player.z = 12.6;
      w.player.prevX = 9.9;
      w.player.prevZ = 12.6;
      w.look.yaw = -Math.PI / 2;
    });
    await advance(page, 0.1);
    await expect(page.locator('.tqc-hud__prompt')).toHaveClass(/is-visible/);
    await pressKey(page, 'KeyE');
    await advance(page, 0.2);
    expect(await page.evaluate(() => window.__tqc!.session!.world.player.hasFlashlight)).toBe(true);
    // Save: walk out to the street checkpoint.
    await page.evaluate(() => {
      const w = window.__tqc!.session!.world;
      w.setDoor('door_stairwell', true);
      w.player.x = 11.2;
      w.player.z = 20;
      w.player.prevX = 11.2;
      w.player.prevZ = 20;
    });
    await advance(page, 0.5);
    await expect.poll(() => page.evaluate(() => window.__tqc!.saves.inspect(1).header?.checkpointId ?? 'none')).toBe('street');
    // Reload while still offline and continue from the save.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'THE QUIET COLLAPSE' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expect(page.locator('.tqc-hud')).toBeVisible();
    expect(await page.evaluate(() => window.__tqc!.session!.world.player.hasFlashlight)).toBe(true);
    await context.setOffline(false);
    const errors = capture.errors.filter((e) => !e.startsWith('requestfailed'));
    expect(errors).toEqual([]);
  });
});
