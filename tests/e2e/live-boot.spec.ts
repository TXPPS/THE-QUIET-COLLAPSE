import { expect, test } from '@playwright/test';
import { captureConsole } from './helpers';

/** Boot check against a deployed origin (E2E_BASE_URL). Skipped when the variable is absent. */
test('deployed origin boots with no console errors and installs the service worker', async ({ page }) => {
  const origin = process.env['E2E_BASE_URL'];
  test.skip(!origin, 'E2E_BASE_URL not set');
  const capture = captureConsole(page);
  test.setTimeout(300_000);
  await page.goto(`${origin}/?debug`);
  await expect(page.locator('.tqc-screen')).toBeVisible();
  // A deployed origin downloads the ~10 MB precache set before the menu appears.
  await page.waitForFunction(
    () => {
      const id = window.__tqc?.screens.top?.id;
      return id === 'warning' || id === 'mainMenu';
    },
    undefined,
    { timeout: 180_000 },
  );
  const cont = page.getByRole('button', { name: /^Continue$/ });
  if (await cont.isVisible().catch(() => false)) await cont.click();
  await expect(page.getByRole('button', { name: /New run/ })).toBeVisible();
  await expect.poll(async () => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state ?? 'none'), { timeout: 180_000 }).toBe('activated');
  const stamp = await page.evaluate(() => document.querySelector('.tqc-footer__meta')?.textContent ?? '');
  console.log('BUILD-STAMP', stamp);
  expect(capture.errors).toEqual([]);
});
