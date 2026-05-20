/* Comprehensive flow audit — walks every major surface and captures
 * screenshots so the rating below is grounded in actual current state.
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://punchlist.ca';
const OUT = path.resolve('tests/audit-runs/r17-full-audit');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'], ignoreHTTPSErrors: true });
const page = await ctx.newPage();

async function snap(name) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log('snapped', name);
}

// ── PUBLIC / ANONYMOUS ──
await page.goto(BASE + '/signup');
await snap('01_signup-empty');
await page.locator('input[type="email"]').first().fill('flowaudit-test@example.com').catch(() => {});
await snap('02_signup-typing');

await page.goto(BASE + '/login');
await snap('03_login');
await page.locator('input[type="email"]').first().fill('test@test.ca');
await page.locator('input[type="password"]').first().fill('testing1');
await Promise.all([
  page.waitForURL(/\/app(\/|$)/, { timeout: 20_000 }).catch(() => null),
  page.locator('button[type="submit"]').first().click(),
]);
await page.waitForTimeout(2500);

// ── AUTHENTICATED — DASHBOARD ──
await snap('10_dashboard');

// ── QUOTES LIST ──
await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
await snap('20_quotes-list');

// ── QUOTE BUILDER — new ──
await page.goto(BASE + '/app/quotes/new', { waitUntil: 'networkidle' });
await snap('21_quote-builder-new-empty');
await page.locator('textarea').first().fill('Replace 50 gallon hot water tank in basement utility room with new energy efficient model. Standard gas hookup.');
await page.waitForTimeout(800);
await snap('22_quote-builder-described');

// Click "Build the scope"
const buildBtn = page.getByRole('button', { name: /build the scope/i }).first();
if (await buildBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  await buildBtn.click();
  await page.waitForTimeout(4000);
  await snap('23_quote-builder-suggestions');
  // Try "Add all"
  const addAll = page.locator('.qe-sug-add-all').first();
  if (await addAll.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addAll.click();
    await page.waitForTimeout(1200);
    await snap('24_quote-builder-after-add-all');
  }
}

// ── QUOTE DETAIL ──
await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const firstQuote = page.locator('a[href*="/app/quotes/"]').filter({ hasNotText: /new/i }).first();
if (await firstQuote.isVisible({ timeout: 2000 }).catch(() => false)) {
  await firstQuote.click();
  await page.waitForTimeout(3000);
  await snap('30_quote-detail');
  // Try messages tab
  const msgTab = page.locator('.qd-mobile-tab').nth(1);
  if (await msgTab.isVisible({ timeout: 1500 }).catch(() => false)) {
    await msgTab.click();
    await page.waitForTimeout(1000);
    await snap('31_quote-detail-messages');
  }
  // More tab
  const moreTab = page.locator('.qd-mobile-tab--more').first();
  if (await moreTab.isVisible({ timeout: 1500 }).catch(() => false)) {
    await moreTab.click();
    await page.waitForTimeout(1000);
    await snap('32_quote-detail-more');
  }
}

// ── INVOICES ──
await page.goto(BASE + '/app/invoices', { waitUntil: 'networkidle' });
await snap('40_invoices-list');
await page.goto(BASE + '/app/invoices/new', { waitUntil: 'networkidle' });
await snap('41_invoices-new');

// ── CUSTOMERS ──
await page.goto(BASE + '/app/customers', { waitUntil: 'networkidle' });
await snap('50_customers');

// ── SCHEDULE ──
await page.goto(BASE + '/app/schedule', { waitUntil: 'networkidle' });
await snap('60_schedule');

// ── ANALYTICS ──
await page.goto(BASE + '/app/analytics', { waitUntil: 'networkidle' });
await snap('70_analytics');

// ── TEMPLATES ──
await page.goto(BASE + '/app/templates', { waitUntil: 'networkidle' });
await snap('80_templates');

// ── SETTINGS ──
await page.goto(BASE + '/app/settings', { waitUntil: 'networkidle' });
await snap('90_settings');

// ── PAYMENTS SETUP ──
await page.goto(BASE + '/app/payments/setup', { waitUntil: 'networkidle' });
await snap('91_payments-setup');

// ── FOREMAN PANEL ──
await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const foremanBtn = page.locator('.mobile-nav-foreman').first();
if (await foremanBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
  await foremanBtn.click();
  await page.waitForTimeout(1200);
  await snap('99_foreman-open');
}

// ── PUBLIC QUOTE (customer view) ──
// Get the share token from the first quote
await page.locator('.fm-overlay').click({ timeout: 1500 }).catch(() => {});
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(500);
await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const qLink = await page.locator('a[href*="/app/quotes/"]').filter({ hasNotText: /new/i }).first().getAttribute('href').catch(() => null);
if (qLink) {
  await page.goto(BASE + qLink, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  // The share URL is on the page somewhere — try to grab it from the qd-cust-link or share button context
  const shareToken = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/q/"], a[href*="/public/"]')).map(a => a.getAttribute('href'));
    const match = links.find(h => h && /\/q\/[\w-]+/.test(h));
    if (match) return match.match(/\/q\/([\w-]+)/)?.[1];
    return null;
  });
  if (shareToken) {
    // Open public view in a NEW context (no auth) so we see what the customer sees
    const pubCtx = await browser.newContext({ ...devices['iPhone 14 Pro'], ignoreHTTPSErrors: true });
    const pub = await pubCtx.newPage();
    await pub.goto(`${BASE}/q/${shareToken}`, { waitUntil: 'networkidle' });
    await pub.waitForTimeout(3000);
    await pub.screenshot({ path: path.join(OUT, 'A0_public-quote-customer.png'), fullPage: true });
    console.log('snapped public quote');
    await pubCtx.close();
  }
}

await browser.close();
console.log('Done →', OUT);
