import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.resolve('tests/audit-runs/r13-batch1');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });

for (const [label, opts] of [
  ['desktop', { viewport: { width: 1280, height: 900 } }],
  ['mobile', { ...devices['iPhone 14 Pro'] }],
]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  // Trigger reveal
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= h; y += 700) { await page.evaluate(yy => window.scrollTo(0, yy), y); await page.waitForTimeout(100); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${label}_full.png`), fullPage: true });
  // Section captures
  for (const [sec, sel] of [['hero', '.ln-hero'], ['workflow', '#how'], ['foreman', '.ln-foreman'], ['cta-foreman', '.ln-foreman + * .ln-section-cta, .ln-foreman ~ * .ln-section-cta, .ln-section-cta'], ['testimonials', '.testi-feature'], ['testi-cards', '.testi-grid'], ['catch', '.catch-grid'], ['pricing', '#pricing']]) {
    try {
      const el = page.locator(sel).first();
      if (await el.count() === 0) continue;
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await el.screenshot({ path: path.join(OUT, `${label}_${sec}.png`) });
    } catch {}
  }
  await ctx.close();
}
await browser.close();
console.log('Done →', OUT);
