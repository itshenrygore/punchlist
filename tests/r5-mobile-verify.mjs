import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://punchlist.ca';
const OUT = path.resolve('tests/audit-runs/r5-postdeploy');
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

// 1. Dashboard — new bottom-nav layout with Foreman
await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, '01_dashboard.png') });

// Scroll to bottom so the nav is in the viewport, then screenshot.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(600);
await page.locator('.mobile-bottom-nav').screenshot({ path: path.join(OUT, '02_bottom-nav.png') });

// 2. Tap Foreman — see new prompts on dashboard context
await page.locator('.mobile-nav-foreman').first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, '03_foreman-dashboard-prompts.png') });
await page.locator('.fm-overlay').click().catch(() => {});
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(800);

// 3. Customers list — full VALUE column visible
await page.goto(BASE + '/app/customers', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, '04_customers-list.png'), fullPage: true });

// 4. Foreman on customers — different prompts
await page.locator('.mobile-nav-foreman').first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, '05_foreman-customers-prompts.png') });

await browser.close();
console.log('Done →', OUT);
