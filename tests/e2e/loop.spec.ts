import { expect, test, type Page } from '@playwright/test';
import { captureConsole, openGame, passWarning, startNewRun } from './helpers';
import { advance, pressKey } from './input';

/**
 * Drives the §0.1 playable loop through the real UI and real keyboard input. Teleports (via the
 * debug hook) shorten the walk between beats; every interaction, threat hit, save, death and
 * screen transition is exercised for real.
 */

async function world<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(fn) as Promise<T>;
}

async function teleport(page: Page, x: number, z: number, yaw: number, pitch = 0.05): Promise<void> {
  await page.evaluate(
    ({ x, z, yaw, pitch }) => {
      const w = window.__tqc?.session?.world;
      if (!w) throw new Error('no session');
      w.player.x = x;
      w.player.z = z;
      w.player.prevX = x;
      w.player.prevZ = z;
      w.look.yaw = yaw;
      w.look.pitch = pitch;
    },
    { x, z, yaw, pitch },
  );
  await page.waitForTimeout(250);
}

async function interact(page: Page): Promise<void> {
  await advance(page, 0.1);
  await expect(page.locator('.tqc-hud__prompt')).toHaveClass(/is-visible/);
  await pressKey(page, 'KeyE');
  await advance(page, 0.2);
}

test.setTimeout(300_000);

test('new game → threat → checkpoint → death → reload → ending → menu, twice, with zero errors', async ({ page }) => {
  const capture = captureConsole(page);
  await openGame(page);
  await passWarning(page);
  for (let round = 0; round < 2; round += 1) {
    await startNewRun(page);
    await expect(page.locator('.tqc-hud__objective')).toContainText('Leave the stairwell');

    // Pick up the flashlight with a real interaction.
    await teleport(page, 9.9, 12.6, -Math.PI / 2);
    await interact(page);
    expect(await world<boolean>(page, 'window.__tqc.session.world.player.hasFlashlight')).toBe(true);

    // Open the stairwell door and step onto the street: objective advances and a checkpoint saves.
    await teleport(page, 11.2, 14.2, 0);
    await interact(page);
    expect(await world<boolean>(page, "window.__tqc.session.world.isDoorOpen('door_stairwell')")).toBe(true);
    await page.keyboard.down('KeyW');
    await expect.poll(() => page.evaluate(() => { const b = window.__tqc!.input.keyboardMouse.lastRawBinding; return b?.type === 'key' ? b.code : 'none'; })).toBe('KeyW');
    await advance(page, 3);
    await page.keyboard.up('KeyW');
    await expect(page.locator('.tqc-hud__objective')).toContainText('Route 4');
    // The street checkpoint autosaved into slot 1 (the toast itself is transient).
    await expect.poll(() => page.evaluate(() => window.__tqc!.saves.inspect(1).header?.checkpointId ?? 'none')).toBe('street');

    // Threat encounter: rebind Aim/Fire to keys through the real remap API (headless pointer lock makes
    // repeated mouse clicks unreliable), capture the mouse once, then shoot until the resident drops.
    await page.evaluate(() => {
      const b = window.__tqc!.input.bindings;
      b.rebindKbm('Aim', { type: 'key', code: 'KeyH' }, ['Aim']);
      b.rebindKbm('Fire', { type: 'key', code: 'KeyG' }, ['Fire']);
    });
    await page.mouse.move(960, 540);
    await page.locator('.tqc-canvas').click({ position: { x: 960, y: 540 } });
    await page.waitForTimeout(150);
    await teleport(page, 58, 21, 0, 0);
    await page.keyboard.down('KeyH');
    await expect.poll(() => page.evaluate(() => { const b = window.__tqc!.input.keyboardMouse.lastRawBinding; return b?.type === 'key' ? b.code : 'none'; })).toBe('KeyH');
    await advance(page, 0.6);
    let threatDown = false;
    for (let i = 0; i < 6 && !threatDown; i += 1) {
      // Place the resident on the aim line, fire through a DOM key event and step — all in one
      // synchronous call so the target cannot move between placement and the hitscan.
      threatDown = await page.evaluate(() => {
        const app = window.__tqc!;
        const w = app.session!.world;
        const t = w.threats.find((th) => th.id === 'th_street')!;
        const r = w.aimRay;
        const d = 4.5;
        t.x = r.ox + r.dx * d;
        t.z = r.oz + r.dz * d;
        t.prevX = t.x;
        t.prevZ = t.z;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyG', bubbles: true }));
        app.debugAdvance(0.6);
        return !t.alive;
      });
    }
    await page.keyboard.up('KeyH');
    await page.evaluate(() => window.__tqc!.input.bindings.resetAll());
    const ammoLeft = await world<number>(page, 'window.__tqc.session.world.player.ammoLoaded');
    expect(ammoLeft).toBeLessThan(6);
    expect(threatDown).toBe(true);

    // Death: drop health and let the pharmacy residents finish it.
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

    // Continue from the checkpoint: the door is still open, the flashlight still owned, ammo restored.
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expect(page.locator('.tqc-hud')).toBeVisible();
    expect(await world<boolean>(page, "window.__tqc.session.world.isDoorOpen('door_stairwell')")).toBe(true);
    expect(await world<number>(page, 'window.__tqc.session.world.player.health')).toBe(100);
    expect(await world<number>(page, 'window.__tqc.session.world.threats.length')).toBe(6);

    // Ending: cross the plaza and open the gate.
    await teleport(page, 61, 68, 0);
    await advance(page, 0.5);
    await expect(page.locator('.tqc-hud__objective')).toContainText('crossing gate');
    await teleport(page, 61, 76, 0);
    await advance(page, 0.2);
    await interact(page);
    await advance(page, 2);
    await expect(page.getByRole('heading', { name: 'THE CROSSING' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Return to menu/ }).click();
    await expect(page.getByRole('heading', { name: 'THE QUIET COLLAPSE' })).toBeVisible();
  }
  const stats = await page.evaluate(() => window.__tqc!.loop.getStats());
  await test.info().attach('frame-stats.json', { body: JSON.stringify({ note: 'headless SwiftShader software rendering; not representative of GPU performance', ...stats }, null, 2), contentType: 'application/json' });
  expect(capture.errors).toEqual([]);
});
