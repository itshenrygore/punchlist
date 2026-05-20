/* Local screenshot of the revised landing page at desktop + mobile.
 * No auth required, runs against the local preview at :4173.
 */
import { chromium, devices } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const OUT = path.resolve('tests/audit-runs/r4-local-landing');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

// Desktop
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const dp = await desk.newPage();
await dp.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await dp.waitForTimeout(2500);
// Scroll all the way down to trigger reveal animations
const h = await dp.evaluate(() => document.body.scrollHeight);
for (let y = 0; y <= h; y += 700) { await dp.evaluate(yy => window.scrollTo(0, yy), y); await dp.waitForTimeout(150); }
await dp.evaluate(() => window.scrollTo(0, 0));
await dp.waitForTimeout(600);
await dp.screenshot({ path: path.join(OUT, 'desktop_landing-full.png'), fullPage: true });
// Targeted: scroll to Foreman section
await dp.evaluate(() => document.querySelector('.ln-foreman')?.scrollIntoView({ block: 'center' }));
await dp.waitForTimeout(600);
await dp.screenshot({ path: path.join(OUT, 'desktop_foreman-section.png'), fullPage: false });
await desk.close();

// Mobile
const mob = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const mp = await mob.newPage();
await mp.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await mp.waitForTimeout(2500);
const mh = await mp.evaluate(() => document.body.scrollHeight);
for (let y = 0; y <= mh; y += 700) { await mp.evaluate(yy => window.scrollTo(0, yy), y); await mp.waitForTimeout(180); }
await mp.evaluate(() => window.scrollTo(0, 0));
await mp.waitForTimeout(600);
await mp.screenshot({ path: path.join(OUT, 'mobile_landing-full.png'), fullPage: true });
await mp.evaluate(() => document.querySelector('.ln-foreman')?.scrollIntoView({ block: 'center' }));
await mp.waitForTimeout(600);
await mp.screenshot({ path: path.join(OUT, 'mobile_foreman-section.png'), fullPage: false });
await mob.close();

await browser.close();
console.log('Done →', OUT);
