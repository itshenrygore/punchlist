/* Capture quote-detail "More" tab on mobile to verify sticky-bar dedup. */
import { chromium, devices } from 'playwright';
import path from 'node:path';

const BASE = 'https://punchlist.ca';
const OUT = path.resolve('tests/audit-runs/ux-round3-postdeploy');

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

// Open a non-draft quote — the round-3 dedup only kicks in on sent/
// viewed/etc rows that previously rendered the sticky bar.
await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
// Find a viewed/sent quote (not a draft)
const rows = await page.locator('.pl-ql-row-wrap a[href*="/app/quotes/"]').all();
let opened = null;
for (const row of rows) {
  const text = await row.textContent();
  if (text && /viewed|sent/i.test(text) && !/draft/i.test(text)) { opened = row; break; }
}
if (!opened) opened = rows[0];
console.log('Opening row with text:', (await opened.textContent())?.slice(0, 80));
await opened.click();
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(OUT, 'mobile_07-quote-detail-details-tab.png'), fullPage: true });

// Tap More tab
const moreTab = page.locator('.qd-mobile-tab--more').first();
console.log('More tab visible:', await moreTab.isVisible({ timeout: 2000 }).catch(() => false));
if (await moreTab.isVisible({ timeout: 1000 }).catch(() => false)) {
  await moreTab.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'mobile_07-quote-detail-more-tab.png'), fullPage: true });
  console.log('Captured More tab');
}
await browser.close();
