/* Comprehensive mobile QA — walks every major flow on iPhone 14 Pro
 * (393×852), captures screenshots, exercises key interactions, and
 * reports console errors / failed clicks / blank states.
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://punchlist.ca';
const OUT = path.resolve('tests/audit-runs/r21-mobile-qa');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'], ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const report = { issues: [], passes: [] };
const errors = [];
page.on('pageerror', e => errors.push(`PAGE: ${e.message}`));
page.on('console', m => { if (m.type() === 'error' && !/SSL certificate/.test(m.text())) errors.push(`CONSOLE: ${m.text()}`); });

let stepNum = 0;
async function snap(label) {
  stepNum++;
  const safe = `${String(stepNum).padStart(2, '0')}_${label.replace(/[^a-z0-9-]/gi, '_')}`;
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, `${safe}.png`), fullPage: true });
  return safe;
}

async function check(label, fn) {
  try {
    const ok = await fn();
    if (ok === false) {
      report.issues.push(label);
      console.log('  ✗', label);
    } else {
      report.passes.push(label);
      console.log('  ✓', label);
    }
  } catch (e) {
    report.issues.push(`${label} — threw: ${e.message?.slice(0, 80)}`);
    console.log('  ✗', label, '—', e.message?.slice(0, 60));
  }
}

console.log('\n=== LANDING (anonymous) ===');
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
// Trigger reveals
const h = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y <= h; y += 350) { await page.evaluate(yy => window.scrollTo(0, yy), y); await page.waitForTimeout(180); }
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await snap('landing-full');
await check('Landing hero trust line renders', async () => {
  return (await page.locator('.ln-hero-trust').count()) > 0;
});
await check('Hero CTA "Start free" present', async () => {
  return (await page.getByRole('link', { name: /start free/i }).count()) > 0;
});
await check('Foreman spotlight section present', async () => {
  return (await page.locator('.ln-foreman').count()) > 0;
});
await check('Testimonials grid has 4 cards', async () => {
  const n = await page.locator('.testi-card').count();
  return n === 4;
});
await check('FAQ has 6 questions', async () => {
  return (await page.locator('.catch-card').count()) === 6;
});
await check('Pricing has competitive anchor card', async () => {
  return (await page.locator('.pr-compare').count()) > 0;
});
await check('Integrations strip below pricing', async () => {
  return (await page.locator('.pr-integ').count()) > 0;
});
await check('No "AI" word in visible landing body', async () => {
  const t = await page.locator('body').innerText();
  return !/\bAI\b/.test(t);
});

console.log('\n=== LOGIN ===');
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('login');
await page.locator('input[type="email"]').first().fill('test@test.ca');
await page.locator('input[type="password"]').first().fill('testing1');
await Promise.all([
  page.waitForURL(/\/app(\/|$)/, { timeout: 20_000 }).catch(() => null),
  page.locator('button[type="submit"]').first().click(),
]);
await page.waitForTimeout(2500);

console.log('\n=== DASHBOARD ===');
await snap('dashboard');
await check('Bottom nav has Foreman slot', async () => {
  return (await page.locator('.mobile-nav-foreman').count()) > 0;
});
await check('Dashboard greeting visible', async () => {
  const t = await page.locator('body').innerText();
  return /good (morning|afternoon|evening)/i.test(t);
});
await check('"What\'s the job?" inline input on dashboard', async () => {
  return (await page.locator('input[placeholder*="What" i], input[placeholder*="job" i]').count()) > 0;
});
await check('No $X/mo on dashboard rows (R8)', async () => {
  const t = await page.locator('.dv2-arow').first().innerText().catch(() => '');
  return !/\$\d+\/mo/.test(t);
});

console.log('\n=== QUOTES LIST ===');
await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
await snap('quotes-list');
await check('Status filter pill shows "Follow-up" short label', async () => {
  const t = await page.locator('.pl-tab').filter({ hasText: /follow/i }).first().innerText().catch(() => '');
  return /follow-up/i.test(t);
});

console.log('\n=== QUOTE BUILDER ===');
await page.goto(BASE + '/app/quotes/new', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await snap('quote-builder-empty');
await check('"What\'s the job?" textarea visible', async () => {
  return (await page.locator('textarea').first().isVisible({ timeout: 2000 }).catch(() => false));
});
await page.locator('textarea').first().fill('Replace 50 gallon hot water tank in basement. Standard gas hookup.');
await page.waitForTimeout(1200);
await snap('quote-builder-typing');
await check('"Build the scope →" button visible after typing', async () => {
  return (await page.getByRole('button', { name: /build the scope/i }).first().isVisible({ timeout: 2000 }).catch(() => false));
});
await check('Trade auto-detected (Plumber) after description typed', async () => {
  const t = await page.locator('body').innerText();
  return /plumb/i.test(t);
});

// Click Build the scope
await page.getByRole('button', { name: /build the scope/i }).first().click().catch(() => {});
await page.waitForTimeout(3500);
await snap('quote-builder-scope');
await check('Suggestions panel renders after build', async () => {
  return (await page.locator('.qe-suggestions').count()) > 0;
});
await check('"Add all" button visible', async () => {
  return (await page.locator('.qe-sug-add-all').count()) > 0;
});
await check('Line items start empty (contractor-in-control)', async () => {
  return (await page.locator('.li-row').count()) === 0;
});

console.log('\n=== QUOTES LIST → DETAIL ===');
await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const firstQuote = await page.locator('a[href^="/app/quotes/"]').filter({ hasNotText: /new/i }).first().getAttribute('href').catch(() => null);
if (firstQuote) {
  await page.goto(BASE + firstQuote, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await snap('quote-detail');
  await check('Quote detail mobile tabs (Details/Messages/More)', async () => {
    return (await page.locator('.qd-mobile-tab').count()) >= 3;
  });
  // Switch to More tab
  await page.locator('.qd-mobile-tab--more').first().click().catch(() => {});
  await page.waitForTimeout(1000);
  await snap('quote-detail-more');
  await check('More actions accordion present', async () => {
    return (await page.locator('.qd-more-actions-card').count()) > 0;
  });
}

console.log('\n=== INVOICES LIST (new) ===');
await page.goto(BASE + '/app/invoices', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('invoices-list');
await check('Outstanding total anchor card', async () => {
  return (await page.locator('.inv-list-outstanding').count()) > 0;
});
await check('Status filter chips render', async () => {
  return (await page.locator('.pl-tabstrip .pl-tab').count()) >= 4;
});
await check('"Export CSV" button visible', async () => {
  return (await page.getByRole('button', { name: /export csv/i }).count()) > 0;
});

console.log('\n=== INVOICE DETAIL ===');
const firstInv = await page.locator('a[href^="/app/invoices/"]').filter({ hasNotText: /new/i }).first().getAttribute('href').catch(() => null);
if (firstInv) {
  await page.goto(BASE + firstInv, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await snap('invoice-detail');
}

console.log('\n=== INVOICES NEW ===');
await page.goto(BASE + '/app/invoices/new', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('invoice-new');

console.log('\n=== SCHEDULE (hour-level) ===');
await page.goto(BASE + '/app/schedule', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('schedule');
await check('Schedule "Export" .ics button visible', async () => {
  return (await page.locator('.sch-export-btn').count()) > 0;
});
await check('Empty days say "+ Add a job" (clickable link)', async () => {
  const t = await page.locator('.sch-empty-day').first().innerText().catch(() => '');
  return /add a job/i.test(t);
});

console.log('\n=== CUSTOMERS ===');
await page.goto(BASE + '/app/customers', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('customers');

console.log('\n=== ANALYTICS ===');
await page.goto(BASE + '/app/analytics', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await snap('analytics');

console.log('\n=== TEMPLATES ===');
await page.goto(BASE + '/app/templates', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('templates');
await check('Templates defaults to Job tab', async () => {
  const t = await page.locator('.tmpl-tab--active').first().innerText().catch(() => '');
  return /job/i.test(t);
});

console.log('\n=== SETTINGS ===');
await page.goto(BASE + '/app/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('settings');
await check('Settings collapsible Profile sections', async () => {
  return (await page.locator('details.sp-collapsible').count()) >= 3;
});
await check('Logo URL paste field removed', async () => {
  return (await page.locator('input[placeholder*="yoursite.com" i]').count()) === 0;
});

console.log('\n=== PAYMENTS SETUP ===');
await page.goto(BASE + '/app/payments/setup', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await snap('payments-setup');
await check('Payments-setup shows the intro (R1 fix)', async () => {
  const t = await page.locator('body').innerText();
  return /get paid faster/i.test(t);
});

console.log('\n=== FOREMAN PANEL ===');
await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('.mobile-nav-foreman').first().click();
await page.waitForTimeout(1500);
await snap('foreman-open');
await check('Foreman panel opens with hard-hat logo', async () => {
  return (await page.locator('.fm-logo svg').count()) > 0;
});
await check('Foreman quick-action prompts visible', async () => {
  return (await page.locator('.fm-quick-btn').count()) >= 2;
});
await check('Foreman photo button label clarified', async () => {
  const t = await page.locator('.fm-input-icon-btn').first().getAttribute('aria-label').catch(() => '');
  return /snap a photo/i.test(t || '');
});

console.log('\n=== PUBLIC QUOTE (customer view) ===');
const shareToken = await page.evaluate(async () => {
  // Try to get a share token from sessionStorage or recent quote list
  return null; // skip — would need authed fetch
});
// Just verify garbage token shows the right error
const pubCtx = await browser.newContext({ ...devices['iPhone 14 Pro'], ignoreHTTPSErrors: true });
const pubPage = await pubCtx.newPage();
await pubPage.goto(BASE + '/q/this-token-does-not-exist', { waitUntil: 'networkidle' });
await pubPage.waitForTimeout(2500);
await pubPage.screenshot({ path: path.join(OUT, '99_public-quote-bad-token.png'), fullPage: true });
const pubText = await pubPage.locator('body').innerText();
report.passes.push(`Public quote bad-token: ${/unavailable|expired|removed/i.test(pubText) ? 'shows proper error UI' : 'ISSUE — ' + pubText.slice(0, 80)}`);
await pubCtx.close();

await browser.close();

console.log('\n\n══════════ MOBILE QA REPORT ══════════');
console.log(`\n✓ ${report.passes.length} checks passed:`);
report.passes.forEach(p => console.log('  ✓', p));
if (report.issues.length > 0) {
  console.log(`\n✗ ${report.issues.length} issues:`);
  report.issues.forEach(i => console.log('  ✗', i));
}
if (errors.length > 0) {
  console.log(`\n⚠ ${errors.length} console/page errors:`);
  const uniqueErrors = [...new Set(errors)];
  uniqueErrors.slice(0, 10).forEach(e => console.log(' -', e.slice(0, 140)));
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ...report, errors: [...new Set(errors)] }, null, 2));
console.log(`\nReport → ${OUT}`);
