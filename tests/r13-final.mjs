import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.resolve('tests/audit-runs/r13-batch1');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Scroll incrementally so reveal observers fire for each section
const h = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y <= h; y += 300) {
  await page.evaluate(yy => window.scrollTo(0, yy), y);
  await page.waitForTimeout(200);
}
await page.waitForTimeout(800);

for (const [name, sel] of [
  ['features-new', '.ln-dark'],
  ['testimonials-grid', '.testi-grid'],
  ['catch-faq', '.catch-grid'],
  ['pricing-full', '#pricing'],
  ['hero-trust', '.ln-hero-trust'],
]) {
  try {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await el.screenshot({ path: path.join(OUT, `final_${name}.png`) });
  } catch (e) { console.warn(name, e.message); }
}
await browser.close();
console.log('done');
