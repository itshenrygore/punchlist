// ═══════════════════════════════════════════════════════════════
// PUNCHLIST — Contractor-perspective walkthrough
// Injects a fake Supabase session + intercepts PostgREST so the
// contractor-side app pages actually render with realistic mock
// data. Captures screenshots for every protected route at desktop
// + mobile, looking for sloppy empty states / broken UI.
//
//   node tests/contractor-walkthrough.mjs
// ═══════════════════════════════════════════════════════════════
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:4173';
const OUT = path.resolve('tests/audit-runs/contractor-walkthrough');
fs.mkdirSync(OUT, { recursive: true });

// ── Fake session — Supabase reads this from localStorage before
// going to the network. Far-future expiry so token refresh isn't
// triggered. Project ref must match the URL ('placeholder').
const SESSION = {
  access_token: 'mock-jwt-' + Math.random().toString(36).slice(2),
  refresh_token: 'mock-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 24 * 3600 * 30,
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'mike@comfortair.example',
    email_confirmed_at: new Date().toISOString(),
    user_metadata: { full_name: 'Mike Sullivan' },
    app_metadata: { provider: 'email' },
    identities: [],
    created_at: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
  },
};
const STORAGE_KEY = 'sb-placeholder-auth-token';

// ── Mock contractor profile / quotes / customers ──────────────
const PROFILE = {
  id: SESSION.user.id,
  full_name: 'Mike Sullivan',
  company_name: 'Comfort Air HVAC Ltd.',
  trade: 'HVAC',
  trades: ['HVAC', 'Plumber'],
  province: 'AB',
  country: 'CA',
  default_city: 'Calgary',
  phone: '+14035550101',
  email: 'mike@comfortair.example',
  default_labour_rate: 165,
  default_expiry_days: 14,
  sms_notifications_enabled: true,
  auto_followup_enabled: false,
  stripe_connect_account_id: 'acct_mock',
  stripe_connect_onboarded: true,
};

const CUSTOMERS = [
  { id: 'c1', user_id: SESSION.user.id, name: 'Jen Smith',    email: 'jen@example.com',    phone: '+14035551234', address: '1245 9th Ave SW, Calgary, AB' },
  { id: 'c2', user_id: SESSION.user.id, name: 'Kevin Martin', email: 'kevin@example.com',  phone: '+14035555678', address: '8800 Macleod Tr S, Calgary, AB' },
  { id: 'c3', user_id: SESSION.user.id, name: 'Sandra Lee',   email: 'sandra@example.com', phone: '+14035550001', address: '210 8 Ave SW, Calgary, AB' },
  { id: 'c4', user_id: SESSION.user.id, name: 'Bob Stevens',  email: 'bob@example.com',    phone: '+14035552222', address: '430 17 Ave SW, Calgary, AB' },
];

const QUOTES = [
  { id: 'q1', user_id: SESSION.user.id, title: 'Furnace + AC Replacement — Full System',
    status: 'sent', total: 11372, view_count: 4, trade: 'HVAC', province: 'AB',
    customer_id: 'c1', share_token: 'st-1',
    sent_at: new Date(Date.now() - 3 * 24 * 3600e3).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 3600e3).toISOString(),
    created_at: new Date(Date.now() - 4 * 24 * 3600e3).toISOString() },
  { id: 'q2', user_id: SESSION.user.id, title: 'Kevin — 50 gal gas water heater swap',
    status: 'viewed', total: 1290, view_count: 6, trade: 'Plumber', province: 'AB',
    customer_id: 'c2', share_token: 'st-2',
    sent_at: new Date(Date.now() - 5 * 24 * 3600e3).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 3600e3).toISOString(),
    created_at: new Date(Date.now() - 6 * 24 * 3600e3).toISOString() },
  { id: 'q3', user_id: SESSION.user.id, title: 'Sandra — 200A panel upgrade',
    status: 'approved', total: 4800, view_count: 12, trade: 'Electrician', province: 'AB',
    customer_id: 'c3', share_token: 'st-3',
    sent_at: new Date(Date.now() - 11 * 24 * 3600e3).toISOString(),
    approved_at: new Date(Date.now() - 9 * 24 * 3600e3).toISOString(),
    updated_at: new Date(Date.now() - 9 * 24 * 3600e3).toISOString(),
    created_at: new Date(Date.now() - 12 * 24 * 3600e3).toISOString() },
  { id: 'q4', user_id: SESSION.user.id, title: 'Bob — bathroom fan + duct',
    status: 'draft', total: 690, view_count: 0, trade: 'Electrician', province: 'AB',
    customer_id: 'c4', share_token: 'st-4',
    updated_at: new Date(Date.now() - 1 * 24 * 3600e3).toISOString(),
    created_at: new Date(Date.now() - 1 * 24 * 3600e3).toISOString() },
];

const INVOICES = [
  { id: 'inv1', user_id: SESSION.user.id, number: 'INV-2026-001',
    status: 'paid', total: 4800, amount_due: 0, amount_paid: 4800,
    issued_at: new Date(Date.now() - 8 * 24 * 3600e3).toISOString(),
    paid_at: new Date(Date.now() - 6 * 24 * 3600e3).toISOString(),
    due_at: new Date(Date.now() + 6 * 24 * 3600e3).toISOString(),
    customer_id: 'c3', quote_id: 'q3', share_token: 'inv-st-1', currency: 'CAD' },
  { id: 'inv2', user_id: SESSION.user.id, number: 'INV-2026-002',
    status: 'sent', total: 11372, amount_due: 11372, amount_paid: 0,
    issued_at: new Date(Date.now() - 1 * 24 * 3600e3).toISOString(),
    due_at: new Date(Date.now() + 13 * 24 * 3600e3).toISOString(),
    customer_id: 'c1', quote_id: 'q1', share_token: 'inv-st-2', currency: 'CAD' },
];

const TEMPLATES = [
  { id: 't1', user_id: SESSION.user.id, name: 'Standard furnace replacement',
    trade: 'HVAC', province: 'AB', use_count: 7,
    description: 'Replace existing gas furnace with new high-efficiency unit',
    line_items: [
      { name: 'Remove & dispose old furnace', quantity: 1, unit_price: 250 },
      { name: 'Supply & install gas furnace', quantity: 1, unit_price: 3800 },
    ],
    created_at: new Date(Date.now() - 40 * 24 * 3600e3).toISOString(),
    updated_at: new Date(Date.now() - 20 * 24 * 3600e3).toISOString() },
];

// ── Mock router for Supabase PostgREST + auth ─────────────────
async function mockSupabase(page) {
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const tableMatch = url.pathname.match(/\/rest\/v1\/([^?\/]+)/);
    const table = tableMatch ? tableMatch[1] : null;
    const method = route.request().method();

    const body = method === 'POST' || method === 'PATCH' || method === 'PUT'
      ? safeParseJson(route.request().postData())
      : null;

    let data = [];
    if (table === 'profiles') data = [PROFILE];
    else if (table === 'quotes') data = QUOTES;
    else if (table === 'customers') data = CUSTOMERS;
    else if (table === 'invoices') data = INVOICES;
    else if (table === 'job_templates') data = TEMPLATES;
    else if (table === 'line_items') data = [];

    // Honor select=*,customer:customers(...) by leaving the inner relation
    // empty; the UI is forgiving. Real Supabase would join, but we'd need
    // a much bigger mock for full fidelity.

    // Filter by simple eq= params Supabase's PostgREST style.
    for (const [key, val] of url.searchParams) {
      if (key === 'select' || key === 'order' || key === 'limit') continue;
      // Supabase format: ?id=eq.q1
      if (val.startsWith('eq.')) {
        const want = val.slice(3);
        data = data.filter(r => String(r[key]) === want);
      }
    }

    // Single-row endpoints (?...&limit=1 with .maybeSingle/.single) still
    // return an array — supabase-js handles the unwrap client-side.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
  await page.route('**/auth/v1/**', async (route) => {
    // Return the same session shape on /auth/v1/user so getUser succeeds.
    const url = route.request().url();
    if (/\/auth\/v1\/user/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SESSION.user),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }
  });
  // Stub the analytics / followup / push endpoints so we don't error.
  await page.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
  await page.addInitScript((args) => {
    localStorage.setItem(args.key, JSON.stringify(args.session));
  }, { key: STORAGE_KEY, session: SESSION });
}
function safeParseJson(s) { try { return JSON.parse(s); } catch { return null; } }

const ROUTES = [
  ['dashboard',     '/app'],
  ['quotes_list',   '/app/quotes'],
  ['quote_new',     '/app/quotes/new'],
  ['quote_detail',  '/app/quotes/q1'],
  ['quote_edit',    '/app/quotes/q4/edit'],   // q4 is draft so the edit page renders
  ['schedule',      '/app/schedule'],
  ['invoices',      '/app/invoices'],
  ['invoice_new',   '/app/invoices/new'],
  ['invoice_detail','/app/invoices/inv1'],
  ['customers',     '/app/customers'],
  ['settings',      '/app/settings'],
  ['billing',       '/app/billing'],
  ['payments',      '/app/payments/setup'],
  ['analytics',     '/app/analytics'],
  ['templates',     '/app/templates'],
];

const browser = await chromium.launch({ headless: true });
const findings = { desktop: [], mobile: [], crit: [], warn: [] };

async function visit(p, name, route, viewport) {
  const consoleErrs = [];
  const pageErrs = [];
  const onCe = m => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 200)); };
  const onPe = e => pageErrs.push(e.message.slice(0, 200));
  p.on('console', onCe);
  p.on('pageerror', onPe);

  let navOk = true;
  try {
    await p.goto(BASE + route, { waitUntil: 'networkidle', timeout: 15_000 });
  } catch (e) {
    navOk = false;
    findings.crit.push(`${viewport} ${name}: nav failed (${e.message.slice(0, 80)})`);
  }
  if (navOk) {
    await p.waitForTimeout(1500);
    // If we end up on /login, the auth stub isn't being trusted by this page
    if (/\/login/.test(p.url())) {
      findings.warn.push(`${viewport} ${name}: bounced to /login despite stubbed session — check loader`);
    }
    // Scroll bottom + back so reveals fire
    try {
      const h = await p.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y <= h; y += 700) {
        await p.evaluate(yy => scrollTo(0, yy), y);
        await p.waitForTimeout(120);
      }
      await p.evaluate(() => scrollTo(0, 0));
      await p.waitForTimeout(400);
    } catch { /* ignore */ }

    const m = await p.evaluate(() => ({
      title: document.title,
      url: location.pathname,
      textLen: document.body.innerText.length,
      domCount: document.body.querySelectorAll('*').length,
      height: document.body.scrollHeight,
      hasErrBoundary: /something went wrong|whoops|something broke/i.test(document.body.innerText),
      hasInfiniteLoad: !!document.querySelector('.loading-spinner, [aria-busy="true"]'),
    }));
    const file = path.join(OUT, `${viewport}_${name}.png`);
    try { await p.screenshot({ path: file, fullPage: viewport === 'desktop' }); } catch { /* ignore */ }

    const realErrs = consoleErrs.filter(e =>
      !/placeholder\.supabase\.co/.test(e) &&
      !/network.*supabase/.test(e) &&
      !/auth session check/.test(e) &&
      !/Failed to load resource/.test(e)
    );

    console.log(`  ${viewport.padEnd(7)} ${name.padEnd(16)} ${m.url.padEnd(35)} ${String(m.textLen).padStart(5)}ch ${String(m.height).padStart(5)}px${pageErrs.length ? ' ⚠ pageerr' : ''}${realErrs.length ? ' ⚠ console' : ''}`);
    findings[viewport].push({ name, route, ...m, file, pageErrs, realErrs: realErrs.slice(0, 3) });
    if (m.textLen < 80) findings.crit.push(`${viewport} ${name}: near-blank (${m.textLen} chars)`);
    if (m.hasErrBoundary) findings.crit.push(`${viewport} ${name}: error boundary tripped`);
    if (pageErrs.length) findings.warn.push(`${viewport} ${name}: page exception "${pageErrs[0]}"`);
  }

  p.removeListener('console', onCe);
  p.removeListener('pageerror', onPe);
}

// ── DESKTOP ──
console.log('\n▶ DESKTOP 1280×900 (mocked auth)');
const dCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const dPage = await dCtx.newPage();
await mockSupabase(dPage);
for (const [name, route] of ROUTES) {
  await visit(dPage, name, route, 'desktop');
}
await dCtx.close();

// ── MOBILE ──
console.log('\n▶ MOBILE iPhone 14 Pro (mocked auth)');
const mCtx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const mPage = await mCtx.newPage();
await mockSupabase(mPage);
for (const [name, route] of ROUTES.slice(0, 8)) {   // limit on mobile
  await visit(mPage, name, route, 'mobile');
}
await mCtx.close();

await browser.close();

fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));
console.log('\n' + '═'.repeat(60));
console.log(`CONTRACTOR WALKTHROUGH`);
console.log(`  crit: ${findings.crit.length}   warn: ${findings.warn.length}`);
findings.crit.forEach(c => console.log('  CRIT ' + c));
findings.warn.forEach(w => console.log('  WARN ' + w));
console.log(`  artifacts → ${OUT}`);
console.log('═'.repeat(60));
