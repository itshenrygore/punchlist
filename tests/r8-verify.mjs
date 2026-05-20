/* R8 verification — contractor-in-control, financing honesty, monthly hidden */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://punchlist.ca';
const OUT = path.resolve('tests/audit-runs/r8-postdeploy');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { ok: [], warn: [] };

// ── A. Landing — hero card terms + Foreman section ──
{
  const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'], ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  // Scroll to hero card
  await page.evaluate(() => document.querySelector('.ln-hero-card')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '01_mobile_hero-card.png') });
  // Inspect terms
  const termText = await page.locator('.ln-hero-card').first().textContent();
  const has3mo = /3\s*mo/i.test(termText || '');
  const has24mo = /24\s*mo/i.test(termText || '');
  if (has3mo && !has24mo) report.ok.push('Landing hero terms = 3/6/12 (no 24mo)');
  else report.warn.push(`Landing hero terms unexpected: ${termText?.slice(0, 100)}`);
  // Foreman section
  await page.evaluate(() => document.querySelector('.ln-foreman')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, '02_mobile_foreman.png') });
  const fmText = await page.locator('.ln-foreman').first().textContent();
  if (/SNAPPED AT THE CUSTOMER/i.test(fmText || '')) report.ok.push('Foreman section uses photo example');
  else report.warn.push('Foreman section missing photo example');
  await ctx.close();
}

// ── B. Auth: dashboard + quotes-list have NO /mo ──
{
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
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, '03_dashboard.png'), fullPage: true });
  const dashText = await page.locator('body').innerText();
  const monthlyOnDash = /\$\d+\/mo/.test(dashText);
  if (!monthlyOnDash) report.ok.push('Dashboard contains no $X/mo');
  else report.warn.push('Dashboard still contains $X/mo');

  await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, '04_quotes-list.png'), fullPage: true });
  const qlText = await page.locator('body').innerText();
  const monthlyOnQl = /\$\d+\/mo/.test(qlText);
  if (!monthlyOnQl) report.ok.push('Quotes list contains no $X/mo');
  else report.warn.push('Quotes list still contains $X/mo');

  // ── C. New quote → confirm scope is empty after AI build ──
  await page.goto(BASE + '/app/quotes/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const ta = page.locator('textarea').first();
  await ta.fill('Replace bathroom sink and install new shutoff valves');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '05_quote-describe.png') });
  // Click Build the scope
  const buildBtn = page.getByRole('button', { name: /build the scope/i }).first();
  if (await buildBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await buildBtn.click();
    // Wait for scope to come back (up to 25s)
    await page.waitForTimeout(15000);
    await page.screenshot({ path: path.join(OUT, '06_quote-scope-result.png'), fullPage: true });
    // Check suggestions panel exists
    const sugPanel = await page.locator('.qe-suggestions').count();
    const addAllBtn = await page.locator('.qe-sug-add-all').count();
    const itemRows = await page.locator('.li-row').count();
    if (sugPanel > 0 && addAllBtn > 0) report.ok.push(`Suggestions panel shown with Add all button (panel=${sugPanel}, btn=${addAllBtn})`);
    else report.warn.push(`Suggestions panel missing — panel=${sugPanel}, addAll=${addAllBtn}, items=${itemRows}`);
    if (itemRows === 0 && sugPanel > 0) report.ok.push('Line items empty until contractor accepts suggestions');
    else if (itemRows > 0) report.warn.push(`Line items already populated (${itemRows}) — auto-add still happening`);
  } else {
    report.warn.push('"Build the scope" button not visible');
  }
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log('\nOK:');
for (const s of report.ok) console.log('  ✓', s);
console.log('WARN:');
for (const s of report.warn) console.log('  ⚠', s);
console.log('\nDone →', OUT);
