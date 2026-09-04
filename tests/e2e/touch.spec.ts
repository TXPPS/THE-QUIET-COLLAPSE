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

/** Dispatches a touch pointer event on an element at absolute page coordinates. */
async function pointer(page: Page, selector: string, type: string, pointerId: number, x: number, y: number): Promise<void> {
  await page.evaluate(
    ({ selector, type, pointerId, x, y }) => {
      const target = document.querySelector(selector) as HTMLElement;
      target.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: 'touch', clientX: x, clientY: y, isPrimary: pointerId === 1, bubbles: true }));
    },
    { selector, type, pointerId, x, y },
  );
}

test('phone: move and look at once, aim and fire while moving, pitch direction, nothing sticks after backgrounding', async ({ page }) => {
  const capture = captureConsole(page);
  await openGame(page);
  const cont = page.getByRole('button', { name: /^Continue$/ });
  if (await cont.isVisible().catch(() => false)) await cont.tap();
  await page.getByRole('button', { name: /New run/ }).tap();
  await page.getByRole('button', { name: /^Slot 1/ }).tap();
  const overwrite = page.getByRole('button', { name: /^Overwrite$/ });
  if (await overwrite.isVisible().catch(() => false)) await overwrite.tap();
  await expect(page.locator('.tqc-touch')).toBeVisible();
  await teleport(page, 12, 20.5, 0);
  await advance(page, 0.2);

  // Two fingers: id 1 pushes the stick forward, id 2 drags right and down in the look zone.
  const moveBox = (await page.locator('.tqc-touch__zone--move').boundingBox())!;
  const sx = moveBox.x + moveBox.width * 0.35;
  const sy = moveBox.y + moveBox.height * 0.75;
  const lx = 560;
  const ly = 120;
  await pointer(page, '.tqc-touch__zone--move', 'pointerdown', 1, sx, sy);
  await pointer(page, '.tqc-touch__zone--look', 'pointerdown', 2, lx, ly);
  const before = await page.evaluate(() => {
    const w = window.__tqc!.session!.world;
    return { z: w.player.z, yaw: w.look.yaw, pitch: w.look.pitch };
  });
  for (let i = 1; i <= 6; i += 1) {
    await pointer(page, '.tqc-touch__zone--move', 'pointermove', 1, sx, sy - 60);
    await pointer(page, '.tqc-touch__zone--look', 'pointermove', 2, lx + i * 12, ly + i * 6);
    await advance(page, 0.25);
    const owned = await page.evaluate(() => Array.from(window.__tqc!.touch.hud!.ownedPointers.entries()));
    expect(owned).toEqual([
      [1, 'joystick'],
      [2, 'look'],
    ]);
  }
  const during = await page.evaluate(() => {
    const app = window.__tqc!;
    const w = app.session!.world;
    return { z: w.player.z, yaw: w.look.yaw, pitch: w.look.pitch, moveY: app.input.touch.moveY, hintSeen: app.settings.get().meta.touchLookHintSeen };
  });
  expect(during.z).toBeGreaterThan(before.z + 0.5);
  expect(during.moveY).toBeGreaterThan(0.5);
  expect(during.yaw).toBeLessThan(before.yaw); // drag right turns right (yaw decreases)
  expect(during.pitch).toBeLessThan(before.pitch); // drag down looks down
  expect(during.hintSeen).toBe(true);

  // Lift the look finger: look stops, movement continues.
  await pointer(page, '.tqc-touch__zone--look', 'pointerup', 2, lx + 80, ly + 40);
  const afterLift = await page.evaluate(() => window.__tqc!.session!.world.look.pitch);
  await pointer(page, '.tqc-touch__zone--look', 'pointermove', 2, lx + 200, ly + 200);
  await advance(page, 0.3);
  const stillMoving = await page.evaluate(() => ({ pitch: window.__tqc!.session!.world.look.pitch, moveY: window.__tqc!.input.touch.moveY }));
  expect(stillMoving.pitch).toBeCloseTo(afterLift, 6);
  expect(stillMoving.moveY).toBeGreaterThan(0.5);

  // Aim (latched) and fire while the move finger is still down.
  await touchButton(page, 'aim');
  await advance(page, 0.4);
  const ammoBefore = await page.evaluate(() => window.__tqc!.session!.world.player.ammoLoaded);
  await touchButton(page, 'fire');
  await advance(page, 0.3);
  const shot = await page.evaluate(() => {
    const app = window.__tqc!;
    const p = app.session!.world.player;
    return { ammo: p.ammoLoaded, moveY: app.input.touch.moveY, aiming: p.aiming, speed: Math.hypot(p.velX, p.velZ) };
  });
  expect(shot.ammo).toBe(ammoBefore - 1);
  expect(shot.moveY).toBeGreaterThan(0.5);
  expect(shot.aiming).toBe(true);
  expect(shot.speed).toBeGreaterThan(0.2);

  // Background the tab with fingers down: every pointer releases and nothing sticks.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  const released = await page.evaluate(() => {
    const app = window.__tqc!;
    return { owned: app.touch.hud!.ownedPointers.size, moveX: app.input.touch.moveX, moveY: app.input.touch.moveY, aim: app.input.touch.isHeld('Aim'), fire: app.input.touch.isHeld('Fire') };
  });
  expect(released).toEqual({ owned: 0, moveX: 0, moveY: 0, aim: false, fire: false });
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: /^Resume/ }).tap();
  await expect(page.locator('.tqc-touch')).toBeVisible();
  await pointer(page, '.tqc-touch__zone--move', 'pointermove', 1, sx, sy - 60);
  await advance(page, 0.3);
  expect(await page.evaluate(() => window.__tqc!.input.touch.moveY)).toBe(0); // the old pointer is gone
  const speed = await page.evaluate(() => {
    const p = window.__tqc!.session!.world.player;
    return Math.hypot(p.velX, p.velZ);
  });
  expect(speed).toBeLessThan(0.05);
  expect(capture.errors).toEqual([]);
});
