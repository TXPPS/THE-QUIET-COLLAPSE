import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openGame, passWarning, startNewRun } from './helpers';

/**
 * Frame-time floor per quality tier. Runs the dressed street for a fixed wall-clock window and
 * records median/worst frame times from the game loop. The phone project is CPU-throttled 4×
 * through the DevTools protocol. Headless Chromium renders with SwiftShader (software), so the
 * numbers are a CPU/sim/DOM floor, not GPU truth; see docs/audit/perf/.
 */
const WINDOW_MS = 8000;
const CPU_THROTTLE = 4;
const OUT_DIR = 'docs/audit/perf';

test.describe('frame-time floor', () => {
  test.setTimeout(240_000);
  for (const tier of ['low', 'balanced', 'high'] as const) {
    test(`records median and worst frame at quality=${tier}`, async ({ page }, testInfo) => {
      const phone = testInfo.project.name === 'phone-landscape';
      if (phone && tier !== 'low') test.skip(true, 'phones are measured at the Low tier only');
      await openGame(page);
      await page.evaluate((quality) => window.__tqc!.settings.update({ video: { quality } }), tier);
      await passWarning(page);
      await startNewRun(page);
      // Stand on Ferry Street facing the wreck: most of the dressed geometry and lights in view.
      await page.evaluate(() => {
        const w = window.__tqc!.session!.world;
        w.player.x = 20;
        w.player.z = 23;
        w.player.prevX = 20;
        w.player.prevZ = 23;
        w.look.yaw = Math.PI / 2;
        w.look.pitch = 0.05;
        w.player.hasFlashlight = true;
        w.player.flashlightOn = true;
      });
      const cdp = await page.context().newCDPSession(page);
      if (phone) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
      await page.evaluate(() => window.__tqc!.loop.resetStats());
      await page.waitForTimeout(WINDOW_MS);
      const stats = await page.evaluate(() => window.__tqc!.loop.getStats());
      const drawCalls = await page.evaluate(() => window.__tqc!.renderer?.drawCalls ?? -1);
      if (phone) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const record = { project: testInfo.project.name, tier, cpuThrottle: phone ? CPU_THROTTLE : 1, windowMs: WINDOW_MS, drawCalls, renderer: 'headless Chromium + SwiftShader (software GL)', ...stats, at: new Date().toISOString() };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(`${OUT_DIR}/${testInfo.project.name}-${tier}.json`, `${JSON.stringify(record, null, 2)}\n`);
      await testInfo.attach('frame-stats.json', { body: JSON.stringify(record, null, 2), contentType: 'application/json' });
      console.info(`[perf] ${testInfo.project.name} ${tier}: median ${stats.medianMs.toFixed(1)} ms, worst ${stats.worstMs.toFixed(1)} ms, ${drawCalls} draw calls`);
      expect(stats.samples).toBeGreaterThan(2);
    });
  }
});
