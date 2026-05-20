import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.resolve('tests/audit-runs/r13-postdeploy');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'], ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await page.goto('https://punchlist.ca/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
// Scroll to trigger reveals
const h = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y <= h; y += 400) { await page.evaluate(yy => window.scrollTo(0, yy), y); await page.waitForTimeout(180); }
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, '01_hero.png') });
// Specific sections
for (const [name, sel] of [['features', '.ln-dark'], ['foreman-cta', '.ln-foreman'], ['testi', '.testi-grid'], ['faq', '.catch-grid'], ['pricing', '#pricing']]) {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await el.screenshot({ path: path.join(OUT, `${name}.png`) });
}
await browser.close();
console.log('done');
