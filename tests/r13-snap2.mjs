import { chromium, devices } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
const OUT = path.resolve('tests/audit-runs/r13-batch1');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
// Trigger reveal animations
const h = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y <= h; y += 500) { await page.evaluate(yy => window.scrollTo(0, yy), y); await page.waitForTimeout(120); }
await page.waitForTimeout(800);

await page.evaluate(() => document.querySelector('.pr-compare')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, 'desktop_pr-compare.png') });

await page.evaluate(() => document.querySelector('.ln-foreman ~ .ln-section-cta, .ln-foreman + * .ln-section-cta')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(500);

// Try a different selector — find all section CTAs
const ctas = await page.locator('.ln-section-cta').all();
for (let i = 0; i < ctas.length; i++) {
  await ctas[i].scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await ctas[i].screenshot({ path: path.join(OUT, `desktop_section-cta-${i}.png`) });
}
await browser.close();
console.log('Done, found', ctas.length, 'section CTAs');
