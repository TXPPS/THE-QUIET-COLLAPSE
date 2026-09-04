// Renders the SVG icon to PNG variants for the PWA manifest using the local Playwright Chromium.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(size, maskable) {
  await page.setViewportSize({ width: size, height: size });
  const scale = maskable ? 0.8 : 1;
  const offset = ((1 - scale) * size) / 2;
  await page.setContent(
    `<html><body style="margin:0;background:#0b0c0d;width:${size}px;height:${size}px;overflow:hidden">` +
      `<div style="position:absolute;left:${offset}px;top:${offset}px;width:${size * scale}px;height:${size * scale}px">${svg.replace('width="512" height="512"', `width="${size * scale}" height="${size * scale}"`)}</div></body></html>`,
  );
  return page.screenshot({ clip: { x: 0, y: 0, width: size, height: size }, omitBackground: false });
}
writeFileSync(new URL('../public/icons/icon-192.png', import.meta.url), await render(192, false));
writeFileSync(new URL('../public/icons/icon-512.png', import.meta.url), await render(512, false));
writeFileSync(new URL('../public/icons/icon-maskable-512.png', import.meta.url), await render(512, true));
await browser.close();
console.log('icons written');
