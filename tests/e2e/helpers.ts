import { expect, type ConsoleMessage, type Page } from '@playwright/test';

export interface ConsoleCapture {
  errors: string[];
  warnings: string[];
}

/** Collects console errors, page errors and failed requests so every test can assert zero. */
export function captureConsole(page: Page): ConsoleCapture {
  const capture: ConsoleCapture = { errors: [], warnings: [] };
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') capture.errors.push(message.text());
    if (message.type() === 'warning') capture.warnings.push(message.text());
  });
  page.on('pageerror', (error) => capture.errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => capture.errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`));
  return capture;
}

/** Boots the game and waits until asset preload is done (warning or main menu showing). */
export async function openGame(page: Page): Promise<void> {
  await page.goto('/?debug');
  await expect(page.locator('.tqc-screen')).toBeVisible();
  await page.waitForFunction(
    () => {
      const id = window.__tqc?.screens.top?.id;
      return id === 'warning' || id === 'mainMenu' || id === 'error';
    },
    undefined,
    { timeout: 60_000 },
  );
}

/** Waits for boot to finish, then clicks through the first-launch warning if it is showing. */
export async function passWarning(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const id = window.__tqc?.screens.top?.id;
      return id === 'warning' || id === 'mainMenu';
    },
    undefined,
    { timeout: 60_000 },
  );
  const cont = page.getByRole('button', { name: /^Continue$/ });
  if (await cont.isVisible().catch(() => false)) await cont.click();
  await expect(page.getByRole('button', { name: /New run/ })).toBeVisible();
}

export async function startNewRun(page: Page): Promise<void> {
  await page.getByRole('button', { name: /New run/ }).click();
  await page.getByRole('button', { name: /^Slot 1/ }).click();
  const overwrite = page.getByRole('button', { name: /^Overwrite$/ });
  if (await overwrite.isVisible().catch(() => false)) await overwrite.click();
  await expect(page.locator('.tqc-hud')).toBeVisible();
}

/** Test hook access; only exists with ?debug. */
export async function evalApp<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(fn) as Promise<T>;
}
