import { chromium, devices } from 'playwright';
import path from 'node:path';
const OUT = path.resolve('tests/audit-runs/r9-landing-diversity');
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

// Desktop
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
// Marquee
await page.evaluate(() => document.querySelector('.marquee-section')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, 'desktop_marquee.png') });
// Workflow
await page.evaluate(() => document.querySelector('#how')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, 'desktop_workflow.png') });
await ctx.close();

// Mobile marquee
const mob = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const mp = await mob.newPage();
await mp.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await mp.waitForTimeout(2000);
await mp.evaluate(() => document.querySelector('.marquee-section')?.scrollIntoView({ block: 'center' }));
await mp.waitForTimeout(700);
await mp.screenshot({ path: path.join(OUT, 'mobile_marquee.png') });
await mob.close();

await browser.close();
console.log('Done →', OUT);
