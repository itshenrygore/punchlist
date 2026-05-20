/* Click-through audit for https://punchlist.ca
 *
 * Logs in with provided creds, then visits every route, clicks notable
 * buttons/links, and records:
 *   - console errors/warnings
 *   - network failures (4xx/5xx, request errors)
 *   - unhandled page errors
 *   - per-route screenshot
 *
 * Outputs JSON report + screenshots to tests/audit-runs/<stamp>/.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PL_BASE_URL || 'https://punchlist.ca';
const EMAIL = process.env.PL_EMAIL || 'test@test.ca';
const PASSWORD = process.env.PL_PASSWORD || 'testing1';
const STAMP = process.env.STAMP || new Date().toISOString().replace(/[:.]/g, '-');
const OUT = path.resolve(`tests/audit-runs/${STAMP}`);
fs.mkdirSync(OUT, { recursive: true });

const report = {
  base: BASE,
  email: EMAIL,
  startedAt: new Date().toISOString(),
  routes: [],
  flows: [],
  globalConsoleNoise: [],
};

/** Attach listeners to a page; collect per-route bucket. */
function instrument(page) {
  const bucket = {
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
  };
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') bucket.consoleErrors.push(text);
    else if (type === 'warning') bucket.consoleWarnings.push(text);
  });
  page.on('pageerror', (err) => {
    bucket.pageErrors.push(String(err?.message || err));
  });
  page.on('requestfailed', (req) => {
    const f = req.failure();
    bucket.failedRequests.push({ url: req.url(), method: req.method(), reason: f?.errorText });
  });
  page.on('response', (res) => {
    const status = res.status();
    if (status >= 400) {
      bucket.badResponses.push({ url: res.url(), status, method: res.request().method() });
    }
  });
  return bucket;
}

/** Snapshot a route: nav + settle + screenshot + bucket. */
async function visit(page, label, urlPath, opts = {}) {
  const url = urlPath.startsWith('http') ? urlPath : BASE + urlPath;
  console.log(`→ ${label}: ${url}`);
  const bucket = instrument(page);
  const entry = { label, url, path: urlPath };
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 25_000 });
    entry.httpStatus = resp ? resp.status() : null;
    entry.finalUrl = page.url();
    // Let lazy chunks / app shell render
    await page.waitForTimeout(opts.settle || 1500);
    // Sanity: is there visible content?
    entry.bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 500);
    const screenshotPath = path.join(OUT, `${label.replace(/[^a-z0-9-]/gi, '_')}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch((e) => { entry.screenshotError = String(e.message); });
    entry.screenshot = path.basename(screenshotPath);
  } catch (e) {
    entry.navError = String(e?.message || e);
  }
  entry.findings = bucket;
  report.routes.push(entry);
  return entry;
}

async function login(page) {
  console.log('Logging in…');
  const bucket = instrument(page);
  const flow = { name: 'login', steps: [] };
  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 25_000 });
    flow.steps.push({ ok: true, step: 'load /login' });
    // Try common selectors
    const emailInput = page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]').first();
    const passInput = page.locator('input[type="password"], input[name="password"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 8000 });
    await emailInput.fill(EMAIL);
    await passInput.fill(PASSWORD);
    flow.steps.push({ ok: true, step: 'fill credentials' });
    // Submit
    const submit = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Login")').first();
    await Promise.all([
      page.waitForURL(/\/app(\/|$)/, { timeout: 20_000 }).catch(() => null),
      submit.click(),
    ]);
    await page.waitForTimeout(1500);
    flow.finalUrl = page.url();
    flow.loggedIn = /\/app/.test(page.url());
    flow.steps.push({ ok: flow.loggedIn, step: 'reach /app' });
    // Screenshot post-login
    const sp = path.join(OUT, '00_post-login.png');
    await page.screenshot({ path: sp, fullPage: true }).catch(() => {});
    flow.screenshot = path.basename(sp);
  } catch (e) {
    flow.error = String(e?.message || e);
  }
  flow.findings = bucket;
  report.flows.push(flow);
  return flow.loggedIn;
}

/** Click first matching element if it exists; returns whether it clicked. */
async function tryClick(page, locator, label) {
  try {
    const el = locator.first();
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.click({ timeout: 4000 });
      await page.waitForTimeout(800);
      return { clicked: true, label };
    }
  } catch (e) {
    return { clicked: false, label, error: String(e?.message || e) };
  }
  return { clicked: false, label, reason: 'not visible' };
}

async function exerciseDashboard(page) {
  const flow = { name: 'dashboard interactions', steps: [] };
  const bucket = instrument(page);
  try {
    await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    // Try clicking visible CTAs
    const candidates = [
      ['New quote', page.getByRole('link', { name: /new quote/i })],
      ['New quote button', page.getByRole('button', { name: /new quote/i })],
      ['Create quote', page.getByRole('link', { name: /create quote/i })],
      ['New invoice', page.getByRole('link', { name: /new invoice/i })],
      ['Customers nav', page.getByRole('link', { name: /^customers$/i })],
      ['Quotes nav', page.getByRole('link', { name: /^quotes$/i })],
      ['Invoices nav', page.getByRole('link', { name: /^invoices$/i })],
      ['Schedule nav', page.getByRole('link', { name: /^schedule$/i })],
      ['Settings nav', page.getByRole('link', { name: /^settings$/i })],
    ];
    for (const [label, loc] of candidates) {
      flow.steps.push(await tryClick(page, loc, label));
      await page.goto(BASE + '/app', { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(500);
    }
  } catch (e) {
    flow.error = String(e?.message || e);
  }
  flow.findings = bucket;
  report.flows.push(flow);
}

async function exerciseQuoteBuilder(page) {
  const flow = { name: 'quote builder new', steps: [] };
  const bucket = instrument(page);
  try {
    await page.goto(BASE + '/app/quotes/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    flow.steps.push({ step: 'loaded builder', url: page.url() });
    // Fill obvious inputs if present
    const textInputs = await page.locator('input[type="text"], input:not([type])').all();
    flow.steps.push({ step: 'text input count', count: textInputs.length });
    // Try clicking "Add line item" / scope buttons
    for (const name of [/add line item/i, /add scope/i, /next/i, /continue/i, /save/i]) {
      const btn = page.getByRole('button', { name }).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        flow.steps.push(await tryClick(page, page.getByRole('button', { name }), `click ${name}`));
      }
    }
    const sp = path.join(OUT, 'flow_quote-builder.png');
    await page.screenshot({ path: sp, fullPage: true }).catch(() => {});
    flow.screenshot = path.basename(sp);
  } catch (e) {
    flow.error = String(e?.message || e);
  }
  flow.findings = bucket;
  report.flows.push(flow);
}

async function exerciseSettings(page) {
  const flow = { name: 'settings tabs', steps: [] };
  const bucket = instrument(page);
  try {
    await page.goto(BASE + '/app/settings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    // Tabs / sections
    const tabNames = [/profile/i, /business/i, /branding/i, /tax/i, /payments?/i, /notifications/i, /team/i, /integrations/i];
    for (const name of tabNames) {
      const tab = page.getByRole('tab', { name }).or(page.getByRole('button', { name })).or(page.getByRole('link', { name })).first();
      if (await tab.isVisible({ timeout: 500 }).catch(() => false)) {
        flow.steps.push(await tryClick(page, tab, `settings tab ${name}`));
        await page.waitForTimeout(400);
      }
    }
    const sp = path.join(OUT, 'flow_settings.png');
    await page.screenshot({ path: sp, fullPage: true }).catch(() => {});
    flow.screenshot = path.basename(sp);
  } catch (e) {
    flow.error = String(e?.message || e);
  }
  flow.findings = bucket;
  report.flows.push(flow);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  // ── PUBLIC ROUTES ───────────────────────────────────
  await visit(page, '01_landing', '/');
  await visit(page, '02_login', '/login');
  await visit(page, '03_signup', '/signup');
  await visit(page, '04_pricing', '/pricing');
  await visit(page, '05_terms', '/terms');
  await visit(page, '06_privacy', '/privacy');
  await visit(page, '07_unknown-route', '/this-page-does-not-exist');

  // ── LOGIN ───────────────────────────────────────────
  const loggedIn = await login(page);
  if (!loggedIn) {
    console.error('LOGIN FAILED — aborting authenticated checks');
    report.loginFailed = true;
  } else {
    // ── AUTHENTICATED ROUTES ──────────────────────────
    await visit(page, '10_app-dashboard', '/app');
    await visit(page, '11_quotes-list', '/app/quotes');
    await visit(page, '12_quotes-new', '/app/quotes/new');
    await visit(page, '13_invoices-list', '/app/invoices');
    await visit(page, '14_invoices-new', '/app/invoices/new');
    await visit(page, '15_customers', '/app/customers');
    await visit(page, '16_schedule', '/app/schedule');
    await visit(page, '17_analytics', '/app/analytics');
    await visit(page, '18_templates', '/app/templates');
    await visit(page, '19_settings', '/app/settings');
    await visit(page, '20_billing', '/app/billing');
    await visit(page, '21_payments-setup', '/app/payments/setup');
    // Legacy redirects
    await visit(page, '22_legacy-contacts', '/app/contacts');
    await visit(page, '23_legacy-bookings', '/app/bookings');
    // 404 in-app
    await visit(page, '24_app-not-found', '/app/no-such');

    // ── INTERACTION FLOWS ─────────────────────────────
    await exerciseDashboard(page);
    await exerciseQuoteBuilder(page);
    await exerciseSettings(page);
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\nDONE. Report: ${path.join(OUT, 'report.json')}`);
  await browser.close();
})().catch((e) => {
  console.error('AUDIT CRASH:', e);
  fs.writeFileSync(path.join(OUT, 'crash.txt'), String(e?.stack || e));
  process.exit(1);
});
