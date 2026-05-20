import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.resolve('tests/audit-runs/r22-features-foreman');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
// Scroll to features
await page.evaluate(() => document.querySelector('.ln-dark')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, '01_features.png') });
// Scroll to Foreman
await page.evaluate(() => document.querySelector('.ln-foreman-card')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, '02_foreman.png') });
await browser.close();
console.log('done');
