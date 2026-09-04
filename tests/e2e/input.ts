import { expect, type Page } from '@playwright/test';

/**
 * Input helpers that wait until the game's input layer has actually observed the event before
 * advancing simulated time. Under software rendering the renderer's main thread can process a
 * synthetic key or mouse event after a subsequent `page.evaluate`, so ordering must be explicit.
 */
export async function clearRaw(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__tqc!.input.keyboardMouse.lastRawBinding = null;
  });
}

export async function pressKey(page: Page, code: string): Promise<void> {
  await clearRaw(page);
  await page.keyboard.press(code);
  await expect
    .poll(() => page.evaluate(() => JSON.stringify(window.__tqc!.input.keyboardMouse.lastRawBinding)), { timeout: 10_000 })
    .toBe(JSON.stringify({ type: 'key', code }));
}

export async function clickMouse(page: Page, button: 'left' | 'right' | 'middle'): Promise<void> {
  await clearRaw(page);
  await page.mouse.down({ button });
  await page.mouse.up({ button });
  const index = button === 'left' ? 0 : button === 'middle' ? 1 : 2;
  await expect
    .poll(() => page.evaluate(() => JSON.stringify(window.__tqc!.input.keyboardMouse.lastRawBinding)), { timeout: 10_000 })
    .toBe(JSON.stringify({ type: 'mouse', button: index }));
}

/** Advances simulated time deterministically through the debug hook. */
export async function advance(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => window.__tqc!.debugAdvance(s), seconds);
}
