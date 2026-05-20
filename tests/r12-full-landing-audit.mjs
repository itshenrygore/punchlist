/* Full landing audit — capture every section so I can review with eyes,
 * not just memory. Two viewports.
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://punchlist.ca';
const OUT = path.resolve('tests/audit-runs/r12-full-landing-audit');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

const SECTIONS = [
  ['hero', '.ln-hero'],
  ['marquee', '.marquee-section'],
  ['workflow', '#how'],
  ['features', '.ln-dark'],
  ['foreman', '.ln-foreman'],
  ['proof', '.testi-feature'],
  ['questions', '.qs-grid, .qs-grid-3'],
  ['pricing', '.pr-grid, .pr-section'],
  ['final-cta', '.ln-final'],
  ['footer', '.ln-footer'],
];

for (const [label, ctxOpts] of [
  ['desktop', { viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true }],
  ['mobile', { ...devices['iPhone 14 Pro'], ignoreHTTPSErrors: true }],
]) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  // Trigger all reveal animations by scrolling through the page once
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= h; y += 600) {
    await page.evaluate(yy => window.scrollTo(0, yy), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  // Full-page screenshot
  await page.screenshot({ path: path.join(OUT, `${label}_full.png`), fullPage: true });
  // Per-section
  for (const [name, sel] of SECTIONS) {
    try {
      const el = await page.locator(sel).first();
      if (await el.count() === 0) continue;
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await el.screenshot({ path: path.join(OUT, `${label}_${name}.png`) });
    } catch {
      // section missing or selector mismatch
    }
  }
  await ctx.close();
}
await browser.close();
console.log('Done →', OUT);
