import { expect, test, type Page } from '@playwright/test';
import { captureConsole, openGame } from './helpers';

/**
 * Phone-viewport gate (§9 wave 6): the §0.1 loop driven by touch alone. Pointer events are
 * dispatched with pointerType "touch" on the real touch HUD elements; menus are tapped.
 */
test.skip(({ hasTouch }) => !hasTouch, 'touch project only');
test.setTimeout(300_000);

async function advance(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => window.__tqc!.debugAdvance(s), seconds);
  await page.waitForTimeout(50);
}

async function teleport(page: Page, x: number, z: number, yaw: number): Promise<void> {
  await page.evaluate(
    ({ x, z, yaw }) => {
      const w = window.__tqc!.session!.world;
      w.player.x = x;
      w.player.z = z;
      w.player.prevX = x;
      w.player.prevZ = z;
      w.look.yaw = yaw;
      w.look.pitch = 0;
    },
    { x, z, yaw },
  );
  await page.waitForTimeout(200);
}

async function touchButton(page: Page, control: string, holdSeconds = 0): Promise<void> {
  const button = page.locator(`[data-touch-control="${control}"]`);
  await expect(button).toBeVisible();
  const box = (await button.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await button.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true, bubbles: true });
  if (holdSeconds > 0) await advance(page, holdSeconds);
  await button.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true, bubbles: true });
}

async function joystick(page: Page, dx: number, dy: number, seconds: number): Promise<void> {
  const zone = page.locator('.tqc-touch__zone--move');
  const box = (await zone.boundingBox())!;
  const x = box.x + box.width * 0.4;
  const y = box.y + box.height * 0.7;
  await zone.dispatchEvent('pointerdown', { pointerId: 3, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true, bubbles: true });
  await zone.dispatchEvent('pointermove', { pointerId: 3, pointerType: 'touch', clientX: x + dx, clientY: y + dy, bubbles: true });
  await advance(page, seconds);
  await zone.dispatchEvent('pointerup', { pointerId: 3, pointerType: 'touch', clientX: x + dx, clientY: y + dy, bubbles: true });
}

test('phone: menu, run, joystick, use, fire, checkpoint, death, continue, ending by touch alone', async ({ page }) => {
  const capture = captureConsole(page);
  await openGame(page);
  await page.getByRole('button', { name: /^Continue$/ }).tap();
  await page.getByRole('button', { name: /New run/ }).tap();
  await page.getByRole('button', { name: /^Slot 1/ }).tap();
  const overwrite = page.getByRole('button', { name: /^Overwrite$/ });
  if (await overwrite.isVisible().catch(() => false)) await overwrite.tap();
  await expect(page.locator('.tqc-touch')).toBeVisible();
  expect(await page.evaluate(() => window.__tqc!.input.registry.activeFamily)).toBe('touch');

  // Use button on the flashlight.
  await teleport(page, 9.9, 12.6, -Math.PI / 2);
  await advance(page, 0.2);
  await touchButton(page, 'interact');
  await advance(page, 0.2);
  expect(await page.evaluate(() => window.__tqc!.session!.world.player.hasFlashlight)).toBe(true);

  // Open the door with Use, walk out with the joystick: objective + checkpoint.
  await teleport(page, 11.2, 14.2, 0);
  await advance(page, 0.2);
  await touchButton(page, 'interact');
  await advance(page, 0.2);
  await joystick(page, 0, -40, 3.5);
  await expect(page.locator('.tqc-hud__objective')).toContainText('Route 4');
  expect(await page.evaluate(() => window.__tqc!.session!.world.player.z)).toBeGreaterThan(18);
  // Nothing sticks after release.
  await advance(page, 0.5);
  expect(await page.evaluate(() => window.__tqc!.input.touch.moveX + window.__tqc!.input.touch.moveY)).toBe(0);

  // Aim (latching) + fire until the street resident drops.
  await teleport(page, 58, 21, 0);
  await page.evaluate(() => {
    const w = window.__tqc!.session!.world;
    const t = w.threats.find((th) => th.id === 'th_street')!;
    t.x = 58.2;
    t.z = 26;
    t.prevX = t.x;
    t.prevZ = t.z;
  });
  await advance(page, 0.2);
  await touchButton(page, 'aim');
  await advance(page, 0.5);
  let down = false;
  for (let i = 0; i < 6 && !down; i += 1) {
    down = await page.evaluate(() => {
      const app = window.__tqc!;
      const w = app.session!.world;
      const t = w.threats.find((th) => th.id === 'th_street')!;
      const r = w.aimRay;
      t.x = r.ox + r.dx * 4.5;
      t.z = r.oz + r.dz * 4.5;
      t.prevX = t.x;
      t.prevZ = t.z;
      const fire = document.querySelector('[data-touch-control="fire"]') as HTMLElement;
      const rect = fire.getBoundingClientRect();
      const init = { pointerId: 7, pointerType: 'touch', clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2, isPrimary: true, bubbles: true };
      fire.dispatchEvent(new PointerEvent('pointerdown', init));
      fire.dispatchEvent(new PointerEvent('pointerup', init));
      app.debugAdvance(0.6);
      return !t.alive;
    });
  }
  expect(down).toBe(true);
  await touchButton(page, 'aim');

  // Death and continue.
  await teleport(page, 36, 40, Math.PI);
  await page.evaluate(() => {
    const w = window.__tqc!.session!.world;
    w.player.health = 10;
    w.setDoor('door_pharmacy', true);
    for (const t of w.threats) {
      if (t.id.startsWith('th_pharmacy')) {
        t.awareness = 1;
        t.lastSeenPlayer = { x: w.player.x, z: w.player.z };
        t.timeSinceSeen = 0;
        t.state = 'chase';
      }
    }
  });
  await advance(page, 25);
  await expect(page.getByRole('heading', { name: /DIDN.T MAKE IT/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /^Continue/ }).tap();
  await expect(page.locator('.tqc-touch')).toBeVisible();

  // Pause through the touch pause button and resume by tapping.
  await touchButton(page, 'pause');
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.getByRole('button', { name: /^Resume/ }).tap();
  await expect(page.locator('.tqc-touch')).toBeVisible();

  // Ending.
  await teleport(page, 61, 68, 0);
  await advance(page, 0.5);
  await teleport(page, 61, 76, 0);
  await advance(page, 0.2);
  await touchButton(page, 'interact');
  await advance(page, 2);
  await expect(page.getByRole('heading', { name: 'THE CROSSING' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /Return to menu/ }).tap();
  await expect(page.getByRole('heading', { name: 'THE QUIET COLLAPSE' })).toBeVisible();
  expect(capture.errors).toEqual([]);
});
