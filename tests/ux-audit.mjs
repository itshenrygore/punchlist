/* UX audit — capture every key screen at mobile (iPhone 14: 393x852)
 * and desktop (1280x800) widths while logged in as the test owner.
 * Output: tests/audit-runs/<stamp>/desktop_*.png + mobile_*.png
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PL_BASE_URL || 'https://punchlist.ca';
const EMAIL = process.env.PL_EMAIL || 'test@test.ca';
const PASSWORD = process.env.PL_PASSWORD || 'testing1';
const STAMP = process.env.STAMP || `ux-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const OUT = path.resolve(`tests/audit-runs/${STAMP}`);
fs.mkdirSync(OUT, { recursive: true });

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 25_000 });
  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/\/app(\/|$)/, { timeout: 20_000 }).catch(() => null),
    page.locator('button[type="submit"]').first().click(),
  ]);
  await page.waitForTimeout(2000);
}

const SCREENS = [
  ['dashboard',         '/app'],
  ['quotes-list',       '/app/quotes'],
  ['quote-builder-new', '/app/quotes/new'],
  ['invoices-list',     '/app/invoices'],
  ['invoices-new',      '/app/invoices/new'],
  ['customers',         '/app/customers'],
  ['schedule',          '/app/schedule'],
  ['analytics',         '/app/analytics'],
  ['templates',         '/app/templates'],
  ['settings',          '/app/settings'],
  ['billing',           '/app/billing'],
  ['payments-setup',    '/app/payments/setup'],
];

async function runProfile(browser, label, contextOpts, viewport) {
  console.log(`\n=== ${label} ===`);
  const ctx = await browser.newContext({ ...contextOpts, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  if (viewport) await page.setViewportSize(viewport);
  await login(page);
  for (const [name, p] of SCREENS) {
    try {
      await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 25_000 });
      await page.waitForTimeout(1800);
      const file = path.join(OUT, `${label}_${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  ${label}_${name}.png`);
    } catch (e) {
      console.warn(`  ${name} FAILED:`, e?.message?.slice(0, 100));
    }
  }
  // Open a quote detail to capture that screen too
  try {
    await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const row = page.locator('a[href*="/app/quotes/"]').filter({ hasNotText: /new/i }).first();
    if (await row.isVisible({ timeout: 2500 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(OUT, `${label}_quote-detail.png`), fullPage: true });
      console.log(`  ${label}_quote-detail.png`);
    }
  } catch {}
  try {
    await page.goto(BASE + '/app/invoices', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const row = page.locator('a[href*="/app/invoices/"]').filter({ hasNotText: /new/i }).first();
    if (await row.isVisible({ timeout: 2500 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(OUT, `${label}_invoice-detail.png`), fullPage: true });
      console.log(`  ${label}_invoice-detail.png`);
    }
  } catch {}
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  await runProfile(browser, 'desktop', { viewport: { width: 1280, height: 800 } });
  await runProfile(browser, 'mobile', { ...devices['iPhone 14 Pro'], viewport: { width: 393, height: 852 } });
  await browser.close();
  console.log(`\nDONE → ${OUT}`);
})();
