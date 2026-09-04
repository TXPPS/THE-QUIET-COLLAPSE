import { expect, test, type Page } from '@playwright/test';
import { captureConsole, openGame, passWarning } from './helpers';

/**
 * Emulated standard-mapping controller (no real hardware in CI): a fake `navigator.getGamepads`
 * is installed before the page loads, buttons are toggled from the test, and the game's own polling,
 * classification, chooser, glyph switching and menu navigation run for real.
 */
const INIT = `
  (() => {
    const pad = {
      index: 0, id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b12)', mapping: 'standard', connected: true, timestamp: 0,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    window.__fakePad = pad;
    window.__padConnected = false;
    navigator.getGamepads = () => (window.__padConnected ? [pad] : []);
    window.__connectPad = () => { window.__padConnected = true; window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad })); };
    window.__disconnectPad = () => { window.__padConnected = false; window.dispatchEvent(Object.assign(new Event('gamepaddisconnected'), { gamepad: pad })); };
    window.__press = (index, down) => { pad.buttons[index] = { pressed: down, touched: down, value: down ? 1 : 0 }; pad.timestamp += 1; };
    window.__axis = (index, value) => { pad.axes[index] = value; pad.timestamp += 1; };
  })();
`;

/** Two rendered frames: menu edges are consumed per frame, and software rendering can take half a second per frame. */
async function frames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function tap(page: Page, button: number): Promise<void> {
  await page.evaluate((b) => (window as unknown as { __press: (i: number, d: boolean) => void }).__press(b, true), button);
  await frames(page);
  await page.evaluate((b) => (window as unknown as { __press: (i: number, d: boolean) => void }).__press(b, false), button);
  await frames(page);
}

test.describe('emulated controller', () => {
  test.setTimeout(240_000);
  test('connect → chooser → glyphs switch → menus by d-pad → run, fire and pause with the pad', async ({ page }) => {
    const capture = captureConsole(page);
    await page.addInitScript(INIT);
    await openGame(page);
    await passWarning(page);
    // Connecting a second viable source offers the chooser once.
    await page.evaluate(() => (window as unknown as { __connectPad: () => void }).__connectPad());
    await expect(page.getByRole('heading', { name: 'Choose primary controls' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Xbox Wireless Controller/ })).toBeVisible();
    // D-pad down twice → the controller row; A (south) selects and locks to it.
    await tap(page, 13);
    await tap(page, 13);
    await tap(page, 0);
    await expect(page.getByRole('heading', { name: 'THE QUIET COLLAPSE' })).toBeVisible();
    expect(await page.evaluate(() => window.__tqc!.settings.get().controls.policy)).toBe('locked');
    expect(await page.evaluate(() => window.__tqc!.input.registry.activeFamily)).toBe('xbox');
    // Footer prompts now show Xbox glyphs.
    await expect(page.locator('.tqc-footer .tqc-glyph').first()).toHaveClass(/tqc-glyph--family-xbox/);
    await expect(page.locator('.tqc-footer .tqc-glyph[data-text="A"]').first()).toBeVisible();

    // Start a run with the pad: Continue is disabled with no save, so New run is the first focusable row.
    await tap(page, 0);
    await expect(page.getByRole('heading', { name: 'Start a new run' })).toBeVisible();
    await tap(page, 13); // difficulty row → slot 1
    await tap(page, 0);
    const overwrite = page.getByRole('button', { name: /^Overwrite$/ });
    if (await overwrite.isVisible().catch(() => false)) await tap(page, 0);
    await expect(page.locator('.tqc-hud')).toBeVisible();

    // Left stick walks; the HUD interact chip shows the pad glyph.
    await page.evaluate(() => (window as unknown as { __axis: (i: number, v: number) => void }).__axis(1, -1));
    await page.evaluate(() => window.__tqc!.debugAdvance(1));
    await page.evaluate(() => (window as unknown as { __axis: (i: number, v: number) => void }).__axis(1, 0));
    const z = await page.evaluate(() => window.__tqc!.session!.world.player.z);
    expect(z).toBeGreaterThan(10.6);
    await expect(page.locator('.tqc-hud__prompt .tqc-glyph')).toHaveAttribute('data-text', 'A');

    // LT aims, RT fires: one round leaves the magazine.
    await page.evaluate(() => (window as unknown as { __press: (i: number, d: boolean) => void }).__press(6, true));
    await page.evaluate(() => window.__tqc!.debugAdvance(0.5));
    await page.evaluate(() => (window as unknown as { __press: (i: number, d: boolean) => void }).__press(7, true));
    await page.evaluate(() => window.__tqc!.debugAdvance(0.2));
    await page.evaluate(() => (window as unknown as { __press: (i: number, d: boolean) => void }).__press(7, false));
    await page.evaluate(() => (window as unknown as { __press: (i: number, d: boolean) => void }).__press(6, false));
    expect(await page.evaluate(() => window.__tqc!.session!.world.player.ammoLoaded)).toBe(5);

    // Menu button pauses; B resumes.
    await tap(page, 9);
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
    await tap(page, 1);
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeHidden();

    // Unplugging the locked controller pauses safely and re-opens the chooser.
    await page.evaluate(() => (window as unknown as { __disconnectPad: () => void }).__disconnectPad());
    await expect(page.getByRole('heading', { name: 'Choose primary controls' })).toBeVisible();
    await page.getByRole('button', { name: /^Auto/ }).click();
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
    expect(capture.errors).toEqual([]);
  });
});
