import { expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { PRESET_IDS, presetProfile } from '../../src/ui/touch/touchPresets';
import { VERIFICATION_VIEWPORTS } from '../../src/ui/touch/touchLayout';
import { captureConsole } from './helpers';

/**
 * Touch preset evidence (§8 touch QA): every preset at 19.5:9, 20:9, 4:3 and 16:10, plus the
 * right-stick variant of the default. Safe-area insets are emulated through the CSS variables the
 * HUD reads. Output: docs/audit/touch/after/<preset>-<aspect>[-stick].png
 */
test.skip(({ hasTouch }) => !hasTouch, 'touch project only');
test.setTimeout(1_500_000);

const OUT_DIR = 'docs/audit/touch/after';

async function startRun(page: Page, safe: { top: number; right: number; bottom: number; left: number }): Promise<void> {
  await page.goto('/?debug');
  await page.evaluate((s) => {
    const root = document.documentElement.style;
    root.setProperty('--tqc-safe-top', `${s.top}px`);
    root.setProperty('--tqc-safe-right', `${s.right}px`);
    root.setProperty('--tqc-safe-bottom', `${s.bottom}px`);
    root.setProperty('--tqc-safe-left', `${s.left}px`);
  }, safe);
  await expect(page.locator('.tqc-screen')).toBeVisible();
  const cont = page.getByRole('button', { name: /^Continue$/ });
  if (await cont.isVisible().catch(() => false)) await cont.tap();
  await page.getByRole('button', { name: /New run/ }).tap();
  await page.getByRole('button', { name: /^Slot 1/ }).tap();
  const overwrite = page.getByRole('button', { name: /^Overwrite$/ });
  if (await overwrite.isVisible().catch(() => false)) await overwrite.tap();
  await expect(page.locator('.tqc-touch')).toBeVisible();
  await page.evaluate(() => {
    const app = window.__tqc!;
    const w = app.session!.world;
    w.player.x = 14;
    w.player.z = 20.5;
    w.player.prevX = w.player.x;
    w.player.prevZ = w.player.z;
    w.look.yaw = Math.PI / 2;
    w.look.pitch = 0.05;
    app.settings.update({ meta: { touchLookHintSeen: false } });
    app.debugAdvance(0.5);
  });
}

async function capture(browser: Browser, aspect: string): Promise<void> {
  const viewport = VERIFICATION_VIEWPORTS[aspect]!;
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const consoleCapture = captureConsole(page);
  await startRun(page, viewport.safe);
  const slug = aspect.replace(':', 'x').replace('.', '_');
  for (const preset of PRESET_IDS) {
    for (const lookControl of preset === 'twoThumb' ? (['drag', 'stick'] as const) : (['drag'] as const)) {
      const profile = presetProfile(preset);
      profile.controls.lookStick.visible = lookControl === 'stick';
      await page.evaluate(
        ({ preset, profile, lookControl }) => {
          const app = window.__tqc!;
          app.touch.kindOverride = preset === 'tablet' ? 'tablet' : 'phone';
          app.settings.update({ controls: { touchLookControl: lookControl } });
          app.saveTouchProfile(preset === 'tablet' ? 'tablet' : 'phone', profile);
          app.touch.syncDevice();
          window.dispatchEvent(new Event('resize'));
          app.debugAdvance(0.1);
        },
        { preset, profile, lookControl },
      );
      await page.waitForTimeout(250);
      const reports = await page.evaluate(() => {
        const hud = window.__tqc!.touch.hud!;
        const visible = Array.from(document.querySelectorAll<HTMLElement>('.tqc-touch__btn')).filter((b) => !b.hidden).map((b) => b.dataset['touchControl']);
        return { visible, owned: hud.ownedPointers.size };
      });
      expect(reports.visible).toContain('fire');
      expect(reports.visible).toContain('pause');
      expect(reports.visible).not.toContain('interact'); // contextual: no prompt here
      await page.screenshot({ path: `${OUT_DIR}/${preset}-${slug}${lookControl === 'stick' ? '-stick' : ''}.png` });
    }
  }
  expect(consoleCapture.errors).toEqual([]);
  await context.close();
}

test('touch preset screenshots at every verification aspect', async ({ browser }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const aspect of Object.keys(VERIFICATION_VIEWPORTS)) await capture(browser, aspect);
});
