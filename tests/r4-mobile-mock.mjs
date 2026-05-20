/* Mock mobile screenshots — capture the actual issues the user
 * mentioned: customers click-bleed, and the hard-hat icon in the
 * mobile topbar.
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://punchlist.ca';
const OUT = path.resolve('tests/audit-runs/r4-mobile-mock');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
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

// 1. Dashboard — capture the topbar
await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, '01_dashboard.png') });
// Crop just the topbar
const topbarHeight = await page.evaluate(() => document.querySelector('header, .topbar, .app-topbar')?.getBoundingClientRect()?.height || 64);
await page.screenshot({ path: path.join(OUT, '02_topbar.png'), clip: { x: 0, y: 0, width: 393, height: Math.max(80, Math.round(topbarHeight) + 8) } });

// 2. Customers page
await page.goto(BASE + '/app/customers', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, '03_customers.png'), fullPage: true });

// 3. Tap a value column on a customer row and see what happens
const valueEls = await page.locator('.cust-stats').all();
console.log(`Found ${valueEls.length} customer rows with .cust-stats`);
if (valueEls.length > 0) {
  // Tap on the value column directly
  await valueEls[0].tap();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '04_after-tap-value.png') });
  console.log('Final URL:', page.url());
}

await browser.close();
console.log('Done →', OUT);
