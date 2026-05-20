import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.resolve('tests/audit-runs/r13-postdeploy');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'], ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await page.goto('https://punchlist.ca/', { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
await page.screenshot({ path: path.join(OUT, 'mobile_hero.png') });
const h = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y <= h; y += 350) { await page.evaluate(yy => window.scrollTo(0, yy), y); await page.waitForTimeout(220); }
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'mobile_full.png'), fullPage: true });
await browser.close();
console.log('done');
