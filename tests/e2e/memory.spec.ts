import { expect, test } from '@playwright/test';
import { captureConsole, openGame, passWarning, startNewRun } from './helpers';
import { advance } from './input';

/**
 * Three full session cycles (new run → play → quit to menu) with the JS heap sampled after each.
 * Skinned characters, crowd agents, sample buffers and kit instances must all be released on quit:
 * the third cycle may not sit measurably above the second.
 */
const CYCLES = 3;
const GROWTH_LIMIT = 0.25;

test('three session cycles do not grow the heap', async ({ page }) => {
  test.setTimeout(300_000);
  const capture = captureConsole(page);
  await openGame(page);
  await passWarning(page);
  const heaps: number[] = [];
  for (let cycle = 0; cycle < CYCLES; cycle += 1) {
    await startNewRun(page);
    await advance(page, 4);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Quit to menu/ }).click();
    const confirm = page.getByRole('button', { name: /^Quit$/ });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await expect(page.getByRole('button', { name: /New run/ })).toBeVisible();
    // Let disposal and GC settle before sampling.
    await page.waitForTimeout(1500);
    const heap = await page.evaluate(() => {
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      return memory ? memory.usedJSHeapSize : -1;
    });
    heaps.push(heap);
    console.info(`[memory] cycle ${cycle + 1}: ${(heap / 1024 / 1024).toFixed(1)} MB, sessions started ${await page.evaluate(() => window.__tqc!.sessionsStarted)}`);
  }
  await test.info().attach('heaps.json', { body: JSON.stringify(heaps), contentType: 'application/json' });
  const second = heaps[1] as number;
  const third = heaps[2] as number;
  if (second > 0 && third > 0) expect(third).toBeLessThan(second * (1 + GROWTH_LIMIT));
  expect(capture.errors).toEqual([]);
});
