/* Capture the mobile quote-detail page on each of the three tabs
 * so I can finally see what's causing the persistent whitespace gap.
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://punchlist.ca';
const OUT = path.resolve('tests/audit-runs/r6-qd-mobile-gap');
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

// Open the first quote
await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
// Try direct link click on a quote card in mobile layout
const firstRow = page.locator('.pl-ql-row-wrap a[href*="/app/quotes/"]').first();
const altRow = page.locator('a[href*="/app/quotes/"]').filter({ hasNotText: /new|quote/i }).first();
try {
  await firstRow.click({ timeout: 5000 });
} catch {
  // Try grabbing the href and navigating directly
  const href = await page.locator('a[href^="/app/quotes/"]').filter({ hasNotText: /new/i }).first().getAttribute('href').catch(() => null);
  if (href) await page.goto(BASE + href, { waitUntil: 'networkidle' });
}
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(OUT, '01_details-tab.png'), fullPage: true });

// Click Messages tab
await page.locator('.qd-mobile-tab').nth(1).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, '02_messages-tab.png'), fullPage: true });

// Click More tab
await page.locator('.qd-mobile-tab--more').first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, '03_more-tab.png'), fullPage: true });

// Dump the rendered DOM tree for the More tab to identify gap source
const treeInfo = await page.evaluate(() => {
  const grid = document.querySelector('.qd-grid, .qd-layout, main > div');
  const sidebar = document.querySelector('.qd-sidebar');
  const out = [];
  const walk = (el, depth) => {
    if (!el || depth > 4) return;
    const r = el.getBoundingClientRect();
    if (r.height === 0) return;
    out.push({
      depth,
      tag: el.tagName,
      cls: (el.className || '').toString().slice(0, 80),
      top: Math.round(r.top),
      h: Math.round(r.height),
      display: getComputedStyle(el).display,
    });
    for (const c of el.children) walk(c, depth + 1);
  };
  // Walk the section + aside container
  const root = document.querySelector('main') || document.body;
  for (const child of root.children) walk(child, 0);
  return out.filter(e => e.h > 30); // skip tiny / hidden
});
fs.writeFileSync(path.join(OUT, 'more-tab-layout.json'), JSON.stringify(treeInfo, null, 2));

await browser.close();
console.log('Done →', OUT);
