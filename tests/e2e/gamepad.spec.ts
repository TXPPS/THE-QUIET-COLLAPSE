import { expect, test, type Page } from '@playwright/test';
import { captureConsole, openGame, passWarning } from './helpers';

/**
 * Emulated standard-mapping controller (no real hardware in CI): a fake `navigator.getGamepads`
 * is installed before the page loads, buttons are toggled from the test, and the game's own polling,
 * classification, chooser, glyph switching and menu navigation run for real. Every screen is
 * driven end to end with the pad: chooser, slot select, pause, options (LB/RB tabs), inventory and
 * map (View, then LB/RB), plus the gameplay actions (stick, analog triggers, jump on A).
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
    window.__analog = (index, value) => { pad.buttons[index] = { pressed: value > 0.5, touched: value > 0, value }; pad.timestamp += 1; };
    window.__axis = (index, value) => { pad.axes[index] = value; pad.timestamp += 1; };
  })();
`;

type PadWindow = Window & {
  __press: (i: number, d: boolean) => void;
  __analog: (i: number, v: number) => void;
  __axis: (i: number, v: number) => void;
  __connectPad: () => void;
  __disconnectPad: () => void;
};

const SOUTH = 0;
const EAST = 1;
const LB = 4;
const RB = 5;
const LT = 6;
const RT = 7;
const VIEW = 8;
const MENU = 9;
const DPAD_UP = 12;
const DPAD_DOWN = 13;

/** Two rendered frames: menu edges are consumed per frame, and software rendering can take half a second per frame. */
async function frames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function tap(page: Page, button: number): Promise<void> {
  await page.evaluate((b) => (window as unknown as PadWindow).__press(b, true), button);
  await frames(page);
  await page.evaluate((b) => (window as unknown as PadWindow).__press(b, false), button);
  await frames(page);
}

async function analog(page: Page, button: number, value: number): Promise<void> {
  await page.evaluate(({ b, v }) => (window as unknown as PadWindow).__analog(b, v), { b: button, v: value });
}

async function advance(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => window.__tqc!.debugAdvance(s), seconds);
}

test.describe('emulated controller', () => {
  test.setTimeout(300_000);
  test('connect → chooser → glyphs switch → every screen by pad → run, triggers, jump, pause', async ({ page }) => {
    const capture = captureConsole(page);
    await page.addInitScript(INIT);
    await openGame(page);
    await passWarning(page);
    // Connecting a second viable source offers the chooser once.
    await page.evaluate(() => (window as unknown as PadWindow).__connectPad());
    await expect(page.getByRole('heading', { name: 'Choose primary controls' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Xbox Wireless Controller/ })).toBeVisible();
    // D-pad down twice → the controller row; A (south) selects and locks to it.
    await tap(page, DPAD_DOWN);
    await tap(page, DPAD_DOWN);
    await tap(page, SOUTH);
    await expect(page.getByRole('heading', { name: 'THE QUIET COLLAPSE' })).toBeVisible();
    expect(await page.evaluate(() => window.__tqc!.settings.get().controls.policy)).toBe('locked');
    expect(await page.evaluate(() => window.__tqc!.input.registry.activeFamily)).toBe('xbox');
    // Footer prompts now show Xbox glyphs.
    await expect(page.locator('.tqc-footer .tqc-glyph').first()).toHaveClass(/tqc-glyph--family-xbox/);
    await expect(page.locator('.tqc-footer .tqc-glyph[data-text="A"]').first()).toBeVisible();

    // Options from the main menu: LB/RB move between tabs, B backs out.
    await tap(page, DPAD_DOWN); // Continue is disabled, so the first row is New run; one down → Load, then Options
    await tap(page, DPAD_DOWN);
    await tap(page, SOUTH);
    await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();
    await expect(page.locator('.tqc-tab[aria-selected="true"]')).toHaveAttribute('data-tab', 'video');
    await tap(page, RB);
    await expect(page.locator('.tqc-tab[aria-selected="true"]')).toHaveAttribute('data-tab', 'audio');
    await tap(page, LB);
    await tap(page, LB);
    await expect(page.locator('.tqc-tab[aria-selected="true"]')).toHaveAttribute('data-tab', 'game');
    await expect(page.getByText('Difficulty')).toBeVisible();
    await tap(page, EAST);
    await expect(page.getByRole('heading', { name: 'THE QUIET COLLAPSE' })).toBeVisible();

    // Back on the menu focus returns to Options; two up lands on New run (Continue is disabled with no save).
    await tap(page, DPAD_UP);
    await tap(page, DPAD_UP);
    await tap(page, SOUTH);
    await expect(page.getByRole('heading', { name: 'Start a new run' })).toBeVisible();
    await tap(page, DPAD_DOWN); // difficulty row → slot 1
    await tap(page, SOUTH);
    const overwrite = page.getByRole('button', { name: /^Overwrite$/ });
    if (await overwrite.isVisible().catch(() => false)) await tap(page, SOUTH);
    await expect(page.locator('.tqc-hud')).toBeVisible();
    // The on-screen touch controls never show while a pad is the locked source.
    expect(await page.evaluate(() => document.documentElement.dataset['touchHud'] ?? 'false')).toBe('false');

    // Left stick walks; the HUD interact chip shows the pad glyph.
    await page.evaluate(() => (window as unknown as PadWindow).__axis(1, -1));
    await advance(page, 1);
    await page.evaluate(() => (window as unknown as PadWindow).__axis(1, 0));
    const z = await page.evaluate(() => window.__tqc!.session!.world.player.z);
    expect(z).toBeGreaterThan(10.6);
    await expect(page.locator('.tqc-hud__prompt .tqc-glyph')).toHaveAttribute('data-text', 'A');

    // Analog triggers: a light pull does nothing, past the press point LT aims and RT fires one round.
    await analog(page, LT, 0.2);
    await advance(page, 0.3);
    expect(await page.evaluate(() => window.__tqc!.session!.world.player.aiming)).toBe(false);
    await analog(page, LT, 0.6);
    await advance(page, 0.5);
    expect(await page.evaluate(() => window.__tqc!.session!.world.player.aiming)).toBe(true);
    expect(await page.evaluate(() => window.__tqc!.session!.world.player.weaponRaise)).toBe(1);
    await analog(page, RT, 0.45);
    await advance(page, 0.2);
    await analog(page, RT, 0);
    // Easing LT into the hysteresis band keeps the aim; releasing fully drops it.
    await analog(page, LT, 0.3);
    await advance(page, 0.2);
    expect(await page.evaluate(() => window.__tqc!.session!.world.player.aiming)).toBe(true);
    await analog(page, LT, 0);
    await advance(page, 0.4);
    expect(await page.evaluate(() => window.__tqc!.session!.world.player.ammoLoaded)).toBe(5);
    expect(await page.evaluate(() => window.__tqc!.session!.world.player.aiming)).toBe(false);

    // A jumps when no prompt is showing (the player faces open floor here).
    await page.evaluate(() => {
      const w = window.__tqc!.session!.world;
      w.player.x = 12;
      w.player.z = 20.5;
      w.player.prevX = 12;
      w.player.prevZ = 20.5;
      w.look.yaw = 0;
    });
    await advance(page, 0.3);
    expect(await page.evaluate(() => window.__tqc!.session!.sim.prompt)).toBeNull();
    await page.evaluate(() => (window as unknown as PadWindow).__press(0, true));
    await advance(page, 0.1);
    await page.evaluate(() => (window as unknown as PadWindow).__press(0, false));
    expect(await page.evaluate(() => window.__tqc!.session!.world.player.jumpState)).toBe('air');
    await advance(page, 1);
    expect(await page.evaluate(() => window.__tqc!.session!.world.player.jumpState)).toBe('grounded');

    // View opens the inventory; LB flips to the map tab, RB back; B returns to the game.
    await tap(page, VIEW);
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible();
    await tap(page, LB);
    await expect(page.getByRole('heading', { name: /Ferry|District|Map/ })).toBeVisible();
    await expect(page.locator('canvas.tqc-map')).toBeVisible();
    await tap(page, RB);
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible();
    await tap(page, EAST);
    await expect(page.getByRole('heading', { name: 'Items' })).toBeHidden();

    // Menu button pauses; B resumes.
    await tap(page, MENU);
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
    await tap(page, EAST);
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeHidden();

    // Unplugging the locked controller pauses safely and re-opens the chooser.
    await page.evaluate(() => (window as unknown as PadWindow).__disconnectPad());
    await expect(page.getByRole('heading', { name: 'Choose primary controls' })).toBeVisible();
    await page.getByRole('button', { name: /^Auto/ }).click();
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
    expect(capture.errors).toEqual([]);
  });
});
