/* Round 4 verification — landing, Foreman icon, Settings SMS toggle,
 * trade auto-detect badge, SMS deep-link param parsing.
 *
 * Drives against prod, logs in, exercises each surface, and dumps
 * screenshots + a JSON report.
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://punchlist.ca';
const EMAIL = 'test@test.ca';
const PASSWORD = 'testing1';
const OUT = path.resolve('tests/audit-runs/r4-postdeploy');
fs.mkdirSync(OUT, { recursive: true });

const report = { ok: [], warn: [], started: new Date().toISOString() };

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/\/app(\/|$)/, { timeout: 20_000 }).catch(() => null),
    page.locator('button[type="submit"]').first().click(),
  ]);
  await page.waitForTimeout(2500);
}

const browser = await chromium.launch({ headless: true });

// ── 1. Landing (anonymous) — desktop + mobile ──────────────────
for (const [label, opts] of [
  ['desktop', { viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true }],
  ['mobile',  { ...devices['iPhone 14 Pro'], ignoreHTTPSErrors: true }],
]) {
  console.log(`\n=== landing ${label} ===`);
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  // Scroll all to trigger reveal animations
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= h; y += 700) { await page.evaluate(yy => window.scrollTo(0, yy), y); await page.waitForTimeout(120); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${label}_landing-full.png`), fullPage: true });
  await page.evaluate(() => document.querySelector('.ln-foreman')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${label}_foreman.png`) });
  // Check AI word count in visible landing copy
  const visibleText = await page.evaluate(() => document.body.innerText);
  const aiHits = (visibleText.match(/\bAI\b/g) || []).length;
  if (aiHits === 0) report.ok.push(`landing ${label}: zero "AI" mentions`);
  else report.warn.push(`landing ${label}: ${aiHits} "AI" mention(s) — check copy`);
  // Check Foreman mentions
  const foremanHits = (visibleText.match(/Foreman/g) || []).length;
  report.ok.push(`landing ${label}: ${foremanHits} Foreman mention(s)`);
  await ctx.close();
}

// ── 2. Authenticated — Foreman icon + settings toggle + trade ──
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await login(page);

// 2a. Topbar Foreman trigger button — verify it has the hard-hat svg
await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, 'desktop_app-dashboard.png'), fullPage: true });
const triggerHat = await page.locator('.topbar-foreman-btn .topbar-foreman-icon').count();
if (triggerHat > 0) report.ok.push(`topbar Foreman button renders hard-hat icon (${triggerHat})`);
else report.warn.push('topbar Foreman button: hard-hat icon NOT found');

// 2b. Open Foreman panel
await page.locator('.topbar-foreman-btn').first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, 'desktop_foreman-open.png') });
const headerSvg = await page.locator('.fm-logo svg').count();
const emptySvg  = await page.locator('.fm-empty-logo svg').count();
report.ok.push(`Foreman panel: header svg=${headerSvg}, empty-state svg=${emptySvg}`);

// 2c. Close foreman and visit settings
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(500);
await page.goto(BASE + '/app/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
// Click Notifications tab
await page.getByRole('button', { name: /^notifications$/i }).first().click().catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'desktop_settings-notifications.png'), fullPage: true });
const textPanelText = await page.locator('text=Text messages').count();
const smsToggle = await page.locator('input[type="checkbox"]').count();
report.ok.push(`Settings → Notifications: "Text messages" heading=${textPanelText}, checkboxes=${smsToggle}`);

// 2d. Quote builder — trade auto-detect badge
await page.goto(BASE + '/app/quotes/new', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, 'desktop_quote-builder-blank.png') });
const ta = page.locator('textarea').first();
await ta.fill('Replace bathroom sink and install new shutoff valves');
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, 'desktop_quote-builder-after-type.png') });
const suggestBadge = await page.locator('.jd-trade-suggest').count();
const suggestText = suggestBadge > 0 ? await page.locator('.jd-trade-suggest').first().textContent() : '';
report.ok.push(`trade auto-detect badge visible: ${suggestBadge > 0 ? 'YES — ' + suggestText?.trim() : 'no'}`);

// 2e. SMS deep-link param parsing — visit a quote with ?tab=messages
await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const firstQuoteHref = await page.locator('a[href*="/app/quotes/"]').filter({ hasNotText: /new/i }).first().getAttribute('href');
if (firstQuoteHref) {
  // Switch to mobile viewport — the tab bar is mobile-only
  await ctx.close();
  const mob = await browser.newContext({ ...devices['iPhone 14 Pro'], ignoreHTTPSErrors: true });
  const mp = await mob.newPage();
  await login(mp);
  await mp.goto(BASE + firstQuoteHref + '?tab=messages', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(2500);
  await mp.screenshot({ path: path.join(OUT, 'mobile_quote-detail-tab-messages.png') });
  // Check which tab is active
  const activeTab = await mp.locator('.qd-mobile-tab--active').first().textContent().catch(() => '');
  if (/messages/i.test(activeTab || '')) report.ok.push('?tab=messages deep link → Messages tab active');
  else report.warn.push(`?tab=messages did not activate Messages tab (active="${activeTab?.trim()}")`);
  await mob.close();
} else {
  report.warn.push('no quote rows to test deep-link');
  await ctx.close();
}

await browser.close();

report.finished = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

console.log('\n=== SUMMARY ===');
console.log('OK:');   report.ok.forEach(s => console.log('  ✓', s));
console.log('WARN:'); report.warn.forEach(s => console.log('  ⚠', s));
console.log('\nReport →', OUT);
