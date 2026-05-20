import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.resolve('tests/audit-runs/r11-hero-foreman');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

// Mobile hero
const mob = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const mp = await mob.newPage();
await mp.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await mp.waitForTimeout(2000);
await mp.screenshot({ path: path.join(OUT, '01_mobile_hero.png') });

// Scroll to hero card
await mp.evaluate(() => document.querySelector('.ln-hero-card')?.scrollIntoView({ block: 'center' }));
await mp.waitForTimeout(700);
await mp.screenshot({ path: path.join(OUT, '02_mobile_hero-card.png') });

// Scroll to Foreman
await mp.evaluate(() => document.querySelector('.ln-foreman')?.scrollIntoView({ block: 'start' }));
await mp.waitForTimeout(700);
await mp.screenshot({ path: path.join(OUT, '03_mobile_foreman.png'), fullPage: false });
await mob.close();

// Desktop hero card term centering
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const dp = await desk.newPage();
await dp.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await dp.waitForTimeout(2000);
await dp.screenshot({ path: path.join(OUT, '04_desktop_hero.png') });
await desk.close();

await browser.close();
console.log('Done →', OUT);
