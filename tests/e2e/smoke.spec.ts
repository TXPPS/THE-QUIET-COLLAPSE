import { expect, test } from '@playwright/test';
import { captureConsole, openGame, passWarning, startNewRun } from './helpers';

test.describe('boot and menus', () => {
  test('boots to the warning, reaches the main menu, starts and pauses a run with no console errors', async ({ page }) => {
    const capture = captureConsole(page);
    await openGame(page);
    await passWarning(page);
    await expect(page.getByRole('heading', { name: 'THE QUIET COLLAPSE' })).toBeVisible();
    await page.screenshot({ path: 'test-results/main-menu.png' });
    await startNewRun(page);
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/gameplay.png' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
    await page.screenshot({ path: 'test-results/pause.png' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeHidden();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Quit to menu/ }).click();
    await page.getByRole('button', { name: /^Quit$/ }).click();
    await expect(page.getByRole('heading', { name: 'THE QUIET COLLAPSE' })).toBeVisible();
    expect(capture.errors).toEqual([]);
  });
});
