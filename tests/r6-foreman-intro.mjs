import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://punchlist.ca';
const OUT = path.resolve('tests/audit-runs/r6-qd-mobile-gap');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
// Fresh context = no localStorage = intro shows
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'], ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').first().fill('test@test.ca');
await page.locator('input[type="password"]').first().fill('testing1');
await Promise.all([
  page.waitForURL(/\/app(\/|$)/, { timeout: 20_000 }).catch(() => null),
  page.locator('button[type="submit"]').first().click(),
]);
await page.waitForTimeout(2500);

await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
// Tap Foreman in bottom nav
await page.locator('.mobile-nav-foreman').click();
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, '04_foreman-first-open.png') });

await browser.close();
console.log('Done');
