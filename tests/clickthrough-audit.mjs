/* Click-through audit for https://punchlist.ca — multi-persona.
 *
 * Personas:
 *   1. Anonymous visitor   — public pages, blocked deep-links, bad share tokens
 *   2. Login error states  — empty form, wrong password
 *   3. Signup error states — empty, invalid email, weak password, existing email
 *   4. Authenticated owner — every authed route + interaction flows
 *   5. Customer / recipient — public quote + public invoice with garbage tokens
 *
 * For every page we record console errors/warnings, page errors,
 * network failures, ≥400 responses, body length, final URL, and a
 * full-page screenshot. Each step also gets its own console / network
 * bucket so issues are pinned to the action that caused them.
 *
 * Outputs: tests/audit-runs/<stamp>/report.json plus per-step pngs.
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
  personas: [],
};

let stepCounter = 0;
function nextStepIndex() {
  stepCounter += 1;
  return String(stepCounter).padStart(3, '0');
}

/** Wrap a page with per-step bucketing. Returns a controller. */
function controllerFor(page) {
  let active = freshBucket();
  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error') active.consoleErrors.push(msg.text());
    else if (t === 'warning') active.consoleWarnings.push(msg.text());
  });
  page.on('pageerror', (e) => active.pageErrors.push(String(e?.message || e)));
  page.on('requestfailed', (req) => {
    const f = req.failure();
    active.failedRequests.push({ url: req.url(), method: req.method(), reason: f?.errorText });
  });
  page.on('response', (res) => {
    const s = res.status();
    if (s >= 400) active.badResponses.push({ url: res.url(), status: s, method: res.request().method() });
  });
  return {
    reset() { active = freshBucket(); return active; },
    snapshot() { return active; },
  };
}
function freshBucket() {
  return { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], badResponses: [] };
}

async function screenshot(page, label) {
  const idx = nextStepIndex();
  const safe = label.replace(/[^a-z0-9-]/gi, '_').slice(0, 80);
  const file = `${idx}_${safe}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true }).catch(() => {});
  return file;
}

/** A single recorded step in a persona's journey. */
async function step(persona, ctrl, page, label, body) {
  ctrl.reset();
  const t0 = Date.now();
  const step = { label, startedAt: new Date().toISOString() };
  try {
    await body();
    step.ok = true;
  } catch (e) {
    step.ok = false;
    step.error = String(e?.message || e).slice(0, 400);
  }
  step.url = page.url();
  step.bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 400);
  step.screenshot = await screenshot(page, label);
  step.findings = ctrl.snapshot();
  step.ms = Date.now() - t0;
  persona.steps.push(step);
  console.log(`  [${persona.name}] ${label} ${step.ok ? '✓' : '✗'} ${step.ms}ms`);
  return step;
}

async function gotoSettle(page, url, ms = 1500) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 25_000 });
  await page.waitForTimeout(ms);
}

// ────────────────────────────────────────────────────────────
// PERSONA 1: Anonymous visitor
// ────────────────────────────────────────────────────────────
async function personaAnonymous(browser) {
  const persona = { name: 'anonymous', steps: [] };
  report.personas.push(persona);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const ctrl = controllerFor(page);

  await step(persona, ctrl, page, 'landing /',           () => gotoSettle(page, BASE + '/', 2000));
  await step(persona, ctrl, page, 'login page',          () => gotoSettle(page, BASE + '/login'));
  await step(persona, ctrl, page, 'signup page',         () => gotoSettle(page, BASE + '/signup'));
  await step(persona, ctrl, page, 'pricing page',        () => gotoSettle(page, BASE + '/pricing'));
  await step(persona, ctrl, page, 'terms page',          () => gotoSettle(page, BASE + '/terms'));
  await step(persona, ctrl, page, 'privacy page',        () => gotoSettle(page, BASE + '/privacy'));
  await step(persona, ctrl, page, 'unknown public route', () => gotoSettle(page, BASE + '/this-page-does-not-exist'));
  // Deep-link to protected route while logged out
  await step(persona, ctrl, page, 'deep-link /app while logged out', async () => {
    await gotoSettle(page, BASE + '/app');
  });
  await step(persona, ctrl, page, 'deep-link /app/quotes/new while logged out', async () => {
    await gotoSettle(page, BASE + '/app/quotes/new');
  });
  // Click landing → pricing
  await step(persona, ctrl, page, 'landing → click pricing nav link', async () => {
    await gotoSettle(page, BASE + '/', 1500);
    const link = page.getByRole('link', { name: /^pricing$/i }).first();
    if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
      await link.click();
      await page.waitForTimeout(1500);
    }
  });
  // Click landing → Start free CTA
  await step(persona, ctrl, page, 'landing → click Start free CTA', async () => {
    await gotoSettle(page, BASE + '/', 1500);
    const cta = page.getByRole('link', { name: /start free/i }).first();
    if (await cta.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cta.click();
      await page.waitForTimeout(1500);
    }
  });

  await ctx.close();
}

// ────────────────────────────────────────────────────────────
// PERSONA 2: Login error states
// ────────────────────────────────────────────────────────────
async function personaLoginErrors(browser) {
  const persona = { name: 'login-errors', steps: [] };
  report.personas.push(persona);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const ctrl = controllerFor(page);

  // Empty submit
  await step(persona, ctrl, page, 'login submit empty form', async () => {
    await gotoSettle(page, BASE + '/login');
    const submit = page.locator('button[type="submit"]').first();
    if (await submit.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submit.click().catch(() => {});
      await page.waitForTimeout(1200);
    }
  });
  // Wrong password
  await step(persona, ctrl, page, 'login wrong password', async () => {
    await gotoSettle(page, BASE + '/login');
    await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
    await page.locator('input[type="password"], input[name="password"]').first().fill('definitely-not-the-real-password');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2500);
  });
  // Bad email format
  await step(persona, ctrl, page, 'login bad email format', async () => {
    await gotoSettle(page, BASE + '/login');
    await page.locator('input[type="email"], input[name="email"]').first().fill('not-an-email');
    await page.locator('input[type="password"], input[name="password"]').first().fill('whatever123');
    await page.locator('button[type="submit"]').first().click().catch(() => {});
    await page.waitForTimeout(1500);
  });

  await ctx.close();
}

// ────────────────────────────────────────────────────────────
// PERSONA 3: Signup error states (no real account created)
// ────────────────────────────────────────────────────────────
async function personaSignupErrors(browser) {
  const persona = { name: 'signup-errors', steps: [] };
  report.personas.push(persona);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const ctrl = controllerFor(page);

  await step(persona, ctrl, page, 'signup empty submit', async () => {
    await gotoSettle(page, BASE + '/signup');
    const submit = page.locator('button[type="submit"]').first();
    if (await submit.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submit.click().catch(() => {});
      await page.waitForTimeout(1200);
    }
  });
  await step(persona, ctrl, page, 'signup invalid email', async () => {
    await gotoSettle(page, BASE + '/signup');
    const emailIn = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailIn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailIn.fill('garbage');
      const pwIn = page.locator('input[type="password"], input[name="password"]').first();
      if (await pwIn.isVisible({ timeout: 500 }).catch(() => false)) await pwIn.fill('short');
      await page.locator('button[type="submit"]').first().click().catch(() => {});
      await page.waitForTimeout(1500);
    }
  });
  await step(persona, ctrl, page, 'signup existing email (uses owner email)', async () => {
    await gotoSettle(page, BASE + '/signup');
    const emailIn = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailIn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailIn.fill(EMAIL);
      const pwIn = page.locator('input[type="password"], input[name="password"]').first();
      if (await pwIn.isVisible({ timeout: 500 }).catch(() => false)) await pwIn.fill('AnythingStrong!1');
      await page.locator('button[type="submit"]').first().click().catch(() => {});
      await page.waitForTimeout(2500);
    }
  });

  await ctx.close();
}

// ────────────────────────────────────────────────────────────
// PERSONA 4: Authenticated owner — full walkthrough
// ────────────────────────────────────────────────────────────
async function personaOwner(browser) {
  const persona = { name: 'owner', steps: [] };
  report.personas.push(persona);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const ctrl = controllerFor(page);

  // ── Login ──
  await step(persona, ctrl, page, 'login: navigate', () => gotoSettle(page, BASE + '/login'));
  const login = await step(persona, ctrl, page, 'login: submit valid creds', async () => {
    await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
    await page.locator('input[type="password"], input[name="password"]').first().fill(PASSWORD);
    await Promise.all([
      page.waitForURL(/\/app(\/|$)/, { timeout: 20_000 }).catch(() => null),
      page.locator('button[type="submit"]').first().click(),
    ]);
    await page.waitForTimeout(2000);
  });
  if (!/\/app/.test(login.url)) {
    persona.aborted = 'login did not reach /app';
    await ctx.close();
    return;
  }

  // ── Visit /login while already authed (should bounce) ──
  await step(persona, ctrl, page, 'visit /login while authed', async () => {
    await gotoSettle(page, BASE + '/login', 1500);
  });
  await step(persona, ctrl, page, 'visit /signup while authed', async () => {
    await gotoSettle(page, BASE + '/signup', 1500);
  });

  // ── All authed routes ──
  const authedRoutes = [
    ['/app', 'dashboard'],
    ['/app/quotes', 'quotes-list'],
    ['/app/quotes/new', 'quote-builder-new'],
    ['/app/quotes/00000000-0000-0000-0000-000000000000', 'quote-detail bad id'],
    ['/app/quotes/00000000-0000-0000-0000-000000000000/edit', 'quote-edit bad id'],
    ['/app/invoices', 'invoices-list'],
    ['/app/invoices/new', 'invoices-new'],
    ['/app/invoices/00000000-0000-0000-0000-000000000000', 'invoice-detail bad id'],
    ['/app/customers', 'customers'],
    ['/app/schedule', 'schedule'],
    ['/app/analytics', 'analytics'],
    ['/app/templates', 'templates'],
    ['/app/settings', 'settings'],
    ['/app/billing', 'billing'],
    ['/app/payments/setup', 'payments-setup'],
    // Legacy redirects
    ['/app/contacts', 'legacy contacts'],
    ['/app/bookings', 'legacy bookings'],
    ['/app/additional-work/anything', 'legacy additional-work'],
    // In-app 404
    ['/app/no-such', 'in-app 404'],
  ];
  for (const [p, name] of authedRoutes) {
    await step(persona, ctrl, page, `owner: visit ${name}`, () => gotoSettle(page, BASE + p, 1800));
  }

  // ── Dashboard interactions ──
  await step(persona, ctrl, page, 'dashboard: click header "New quote"', async () => {
    await gotoSettle(page, BASE + '/app', 1500);
    const btn = page.getByRole('link', { name: /new quote/i }).first()
      .or(page.getByRole('button', { name: /new quote/i }).first());
    await btn.click({ timeout: 4000 });
    await page.waitForTimeout(1500);
  });
  await step(persona, ctrl, page, 'dashboard: click sidebar Customers link', async () => {
    await gotoSettle(page, BASE + '/app', 1500);
    const link = page.getByRole('link', { name: /^customers$/i }).first();
    await link.click({ timeout: 4000 });
    await page.waitForTimeout(1500);
  });

  // ── Quote builder: fill what's-the-job, change trade ──
  await step(persona, ctrl, page, 'quote builder: fill description', async () => {
    await gotoSettle(page, BASE + '/app/quotes/new', 1800);
    const ta = page.locator('textarea').first();
    if (await ta.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ta.fill('Replace kitchen sink and dishwasher hookups');
      await page.waitForTimeout(600);
    }
    // Trade select
    const trade = page.locator('select').first();
    if (await trade.isVisible({ timeout: 1000 }).catch(() => false)) {
      await trade.selectOption({ index: 2 }).catch(() => {});
    }
  });
  await step(persona, ctrl, page, 'quote builder: click "start from blank"', async () => {
    await gotoSettle(page, BASE + '/app/quotes/new', 1800);
    const blank = page.getByText(/start from blank/i).first();
    if (await blank.isVisible({ timeout: 2000 }).catch(() => false)) {
      await blank.click().catch(() => {});
      await page.waitForTimeout(1500);
    }
  });

  // ── Customers: open Add modal, then close ──
  await step(persona, ctrl, page, 'customers: open Add modal', async () => {
    await gotoSettle(page, BASE + '/app/customers', 1500);
    const add = page.getByRole('button', { name: /\+\s*add|add customer|add your first customer/i }).first();
    if (await add.isVisible({ timeout: 2500 }).catch(() => false)) {
      await add.click();
      await page.waitForTimeout(800);
    }
  });
  await step(persona, ctrl, page, 'customers: close Add modal (Esc)', async () => {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(600);
  });

  // ── Invoices new: fill basic fields, then cancel ──
  await step(persona, ctrl, page, 'invoices new: fill title + cancel', async () => {
    await gotoSettle(page, BASE + '/app/invoices/new', 1800);
    const title = page.locator('input').filter({ hasNot: page.locator('[type=hidden]') }).nth(1);
    if (await title.isVisible({ timeout: 2000 }).catch(() => false)) {
      await title.fill('Audit-only — do not save').catch(() => {});
    }
    const cancel = page.getByRole('button', { name: /^cancel$/i }).first()
      .or(page.getByRole('link', { name: /^cancel$/i }).first());
    if (await cancel.isVisible({ timeout: 1500 }).catch(() => false)) {
      await cancel.click().catch(() => {});
      await page.waitForTimeout(800);
    }
  });

  // ── Settings: cycle every tab ──
  const settingsTabs = [/profile/i, /payments?/i, /messages/i, /notifications/i, /account/i, /branding/i, /tax/i, /team/i];
  for (const name of settingsTabs) {
    await step(persona, ctrl, page, `settings tab: ${name.source}`, async () => {
      await gotoSettle(page, BASE + '/app/settings', 1500);
      const tab = page.getByRole('tab', { name })
        .or(page.getByRole('button', { name }))
        .or(page.getByText(name).first());
      const visible = await tab.first().isVisible({ timeout: 1500 }).catch(() => false);
      if (visible) {
        await tab.first().click().catch(() => {});
        await page.waitForTimeout(800);
      } else {
        throw new Error('tab not visible');
      }
    }).catch(() => {});
  }

  // ── Analytics: cycle time-range chips ──
  await step(persona, ctrl, page, 'analytics: click 6 months', async () => {
    await gotoSettle(page, BASE + '/app/analytics', 1500);
    const btn = page.getByRole('button', { name: /6\s*months/i }).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(800);
    }
  });
  await step(persona, ctrl, page, 'analytics: click All time', async () => {
    const btn = page.getByRole('button', { name: /all time/i }).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(800);
    }
  });

  // ── Open existing quote (if any) ──
  await step(persona, ctrl, page, 'quotes list: click first row', async () => {
    await gotoSettle(page, BASE + '/app/quotes', 1500);
    const firstRow = page.locator('a[href*="/app/quotes/"]').filter({ hasNotText: /new/i }).first();
    if (await firstRow.isVisible({ timeout: 2500 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(2000);
    } else {
      throw new Error('no quote rows');
    }
  }).catch(() => {});
  await step(persona, ctrl, page, 'invoices list: click first row', async () => {
    await gotoSettle(page, BASE + '/app/invoices', 1500);
    const firstRow = page.locator('a[href*="/app/invoices/"]').filter({ hasNotText: /new/i }).first();
    if (await firstRow.isVisible({ timeout: 2500 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(2000);
    } else {
      throw new Error('no invoice rows');
    }
  }).catch(() => {});

  // ── Logout ──
  await step(persona, ctrl, page, 'logout', async () => {
    await gotoSettle(page, BASE + '/app', 1200);
    const out = page.getByRole('button', { name: /sign out|log out|logout/i }).first()
      .or(page.getByRole('link', { name: /sign out|log out|logout/i }).first());
    if (await out.isVisible({ timeout: 2500 }).catch(() => false)) {
      await out.click();
      await page.waitForTimeout(2500);
    } else {
      throw new Error('sign-out control not found');
    }
  });
  await step(persona, ctrl, page, 'after logout: /app should redirect', async () => {
    await gotoSettle(page, BASE + '/app', 1500);
  });

  await ctx.close();
}

// ────────────────────────────────────────────────────────────
// PERSONA 5: Customer / share-token recipient (bad tokens)
// ────────────────────────────────────────────────────────────
async function personaRecipient(browser) {
  const persona = { name: 'recipient', steps: [] };
  report.personas.push(persona);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const ctrl = controllerFor(page);

  await step(persona, ctrl, page, 'public quote /q/garbage', () => gotoSettle(page, BASE + '/q/this-token-does-not-exist', 2500));
  await step(persona, ctrl, page, 'public invoice /i/garbage', () => gotoSettle(page, BASE + '/i/this-token-does-not-exist', 2500));
  await step(persona, ctrl, page, 'legacy /public/garbage', () => gotoSettle(page, BASE + '/public/this-token-does-not-exist', 2500));
  await step(persona, ctrl, page, 'legacy /project/garbage', () => gotoSettle(page, BASE + '/project/this-token-does-not-exist', 2500));
  await step(persona, ctrl, page, 'legacy /public/invoice/garbage', () => gotoSettle(page, BASE + '/public/invoice/this-token-does-not-exist', 2500));
  await step(persona, ctrl, page, 'mobile viewport: /q/garbage', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await gotoSettle(page, BASE + '/q/another-bad-token', 2500);
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await ctx.close();
}

// ────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true });
  console.log(`\n=== Click-through audit against ${BASE} ===\n`);
  await personaAnonymous(browser);
  await personaLoginErrors(browser);
  await personaSignupErrors(browser);
  await personaOwner(browser);
  await personaRecipient(browser);

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\nDONE. Report: ${path.join(OUT, 'report.json')}`);
  await browser.close();
})().catch((e) => {
  console.error('AUDIT CRASH:', e);
  fs.writeFileSync(path.join(OUT, 'crash.txt'), String(e?.stack || e));
  process.exit(1);
});
