// ═══════════════════════════════════════════════════════════════
// PUNCHLIST — Full app walkthrough
// Visits every route at desktop + mobile, captures screenshots,
// records console errors, validates auth gates and form behavior.
// Outputs a findings JSON the contractor-perspective doc consumes.
//
//   node tests/full-walkthrough.mjs
// ═══════════════════════════════════════════════════════════════
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PUNCHLIST_URL || 'http://localhost:4173';
const OUT = path.resolve('tests/audit-runs/walkthrough');
fs.mkdirSync(OUT, { recursive: true });

const PUBLIC_ROUTES = [
  ['landing',          '/'],
  ['login',            '/login'],
  ['signup',           '/signup'],
  ['pricing',          '/pricing'],
  ['terms',            '/terms'],
  ['privacy',          '/privacy'],
];

const SHARE_ROUTES = [
  ['public_quote_404',   '/q/nonexistent-share-token'],
  ['public_invoice_404', '/i/nonexistent-share-token'],
];

const PROTECTED_ROUTES = [
  ['app_dashboard',     '/app'],
  ['app_quotes_list',   '/app/quotes'],
  ['app_quotes_new',    '/app/quotes/new'],
  ['app_quote_detail',  '/app/quotes/fake-id'],
  ['app_quote_edit',    '/app/quotes/fake-id/edit'],
  ['app_schedule',      '/app/schedule'],
  ['app_invoices',      '/app/invoices'],
  ['app_invoices_new',  '/app/invoices/new'],
  ['app_invoice',       '/app/invoices/fake-id'],
  ['app_settings',      '/app/settings'],
  ['app_billing',       '/app/billing'],
  ['app_payments',      '/app/payments/setup'],
  ['app_customers',     '/app/customers'],
  ['app_analytics',     '/app/analytics'],
  ['app_templates',     '/app/templates'],
];

const findings = {
  desktop: { byRoute: {}, issues: [] },
  mobile:  { byRoute: {}, issues: [] },
};

function logIssue(viewport, route, severity, msg) {
  findings[viewport].issues.push({ route, severity, msg });
  console.log(`  [${severity}] ${viewport} ${route}: ${msg}`);
}

async function inspectRoute(page, viewport, name, route, opts = {}) {
  const consoleErrors = [];
  const networkErrors = [];
  const onConsole = m => { if (m.type() === 'error') consoleErrors.push(m.text()); };
  const onPageError = e => consoleErrors.push(`PAGE ERROR: ${e.message}`);
  const onRequestFailed = r => {
    const url = r.url();
    // Ignore expected supabase failures — sandbox has placeholder URL
    if (/placeholder\.supabase\.co|supabase\.co|\/auth\/|\/rest\//.test(url)) return;
    networkErrors.push(`${r.method()} ${url} → ${r.failure()?.errorText || 'failed'}`);
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);

  let navOk = true, finalUrl = '', timing = 0;
  const t0 = Date.now();
  try {
    const resp = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 15_000 });
    timing = Date.now() - t0;
    if (!resp || resp.status() >= 500) {
      logIssue(viewport, route, 'CRIT', `HTTP ${resp?.status() ?? 'no-response'}`);
      navOk = false;
    }
  } catch (e) {
    logIssue(viewport, route, 'CRIT', `nav failed: ${e.message.slice(0, 120)}`);
    navOk = false;
    timing = Date.now() - t0;
  }

  if (navOk) {
    await page.waitForTimeout(700);
    finalUrl = page.url();
    // Trigger reveals etc — scroll the page so anything below the fold renders.
    try {
      const h = await page.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y <= h; y += 700) {
        await page.evaluate(yy => window.scrollTo(0, yy), y);
        await page.waitForTimeout(120);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
    } catch { /* ignore */ }

    // Detect empty / blank-white page (catastrophic visual failure).
    const measure = await page.evaluate(() => {
      const body = document.body;
      const visText = body.innerText.trim();
      const visible = visText.length;
      const childCount = body.querySelectorAll('*').length;
      // Quick blank-canvas detection: ~all-white pixel sample of viewport corners
      // would need a real screenshot; we infer from DOM size + text.
      return {
        textLen: visible,
        domCount: childCount,
        title: document.title,
        height: body.scrollHeight,
      };
    });
    if (measure.textLen < 30) logIssue(viewport, route, 'CRIT', `near-blank page (${measure.textLen} chars text)`);
    if (measure.domCount < 25) logIssue(viewport, route, 'WARN', `tiny DOM (${measure.domCount} nodes)`);
    if (measure.height < 400) logIssue(viewport, route, 'WARN', `short page (${measure.height}px)`);

    // Look for visible error chrome — a 404 / "Something went wrong" shouldn't
    // appear unless we're testing the error path explicitly.
    const errChrome = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return {
        hasNotFound: /not found|404|page not found/.test(text),
        hasErrorBoundary: /something went wrong|whoops|crash/.test(text),
        hasInfiniteLoading: !!document.querySelector('.loading-spinner, [aria-busy="true"]'),
      };
    });
    if (errChrome.hasErrorBoundary && !opts.expectError) {
      logIssue(viewport, route, 'CRIT', 'error boundary tripped');
    }

    // Save screenshot. fullPage only on desktop to keep mobile snaps short.
    const file = path.join(OUT, `${viewport}_${name}.png`);
    try {
      await page.screenshot({ path: file, fullPage: viewport === 'desktop' });
    } catch (e) {
      logIssue(viewport, route, 'WARN', `screenshot failed: ${e.message.slice(0, 80)}`);
    }

    // Console errors filter — drop noise we expect from a sandbox with no API key.
    const filtered = consoleErrors.filter(e => {
      const t = e.toLowerCase();
      if (/placeholder\.supabase\.co/.test(t)) return false;
      if (/network.*supabase/.test(t)) return false;
      if (/fetch.*failed.*supabase/.test(t)) return false;
      if (/foreman.*api key|anthropic_api_key/.test(t)) return false;
      if (/^auth session check failed/.test(t)) return false;
      // React warnings, accessibility warnings, etc. — keep these.
      return true;
    });
    if (filtered.length > 0) {
      for (const err of filtered.slice(0, 3)) {
        logIssue(viewport, route, 'WARN', `console: ${err.slice(0, 160)}`);
      }
    }

    findings[viewport].byRoute[name] = {
      route, finalUrl, timing, ...measure, ...errChrome,
      consoleErrorCount: filtered.length,
      networkErrors: networkErrors.slice(0, 3),
    };
  } else {
    findings[viewport].byRoute[name] = { route, error: 'nav_failed' };
  }

  page.removeListener('console', onConsole);
  page.removeListener('pageerror', onPageError);
  page.removeListener('requestfailed', onRequestFailed);
}

// ── Auth-gate verification: protected routes should redirect to /login ──
async function verifyAuthGate(page, viewport, name, route) {
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(800);
  const final = page.url();
  const redirected = /\/login/.test(final);
  if (!redirected) {
    logIssue(viewport, route, 'CRIT', `protected route did NOT redirect — landed at ${final}`);
  } else {
    findings[viewport].byRoute[name] = { route, redirected_to: final, auth_gate_ok: true };
  }
  // Screenshot so we can visually confirm the login page rendered cleanly.
  try {
    await page.screenshot({ path: path.join(OUT, `${viewport}_${name}.png`), fullPage: false });
  } catch { /* ignore */ }
}

// ── Form interaction tests ──
async function testSignupForm(page) {
  await page.goto(BASE + '/signup', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const hasEmail = await page.locator('input[type="email"]').count();
  const hasPwd = await page.locator('input[type="password"]').count();
  const findings_signup = {
    hasEmailField: hasEmail > 0,
    hasPasswordField: hasPwd > 0,
  };
  // Try submitting empty form — should show validation
  const submitBtn = page.locator('button[type="submit"]').first();
  if (await submitBtn.count() > 0) {
    await submitBtn.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
    const validationVisible = await page.evaluate(() => {
      // HTML5 :invalid OR a visible error message
      const invalid = document.querySelectorAll('input:invalid').length;
      const errMsg = /required|please|enter|invalid/i.test(document.body.innerText);
      return { invalid, errMsg };
    });
    findings_signup.emptySubmitBlocked = validationVisible.invalid > 0 || validationVisible.errMsg;
  }
  await page.screenshot({ path: path.join(OUT, `desktop_signup-form.png`), fullPage: true }).catch(() => {});
  return findings_signup;
}

async function testLoginForm(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const result = {
    hasEmailField: (await page.locator('input[type="email"]').count()) > 0,
    hasPasswordField: (await page.locator('input[type="password"]').count()) > 0,
    hasForgotPassword: /forgot|reset/i.test(await page.locator('body').innerText()),
  };
  await page.screenshot({ path: path.join(OUT, `desktop_login-form.png`), fullPage: true }).catch(() => {});
  return result;
}

// ── Drive the walkthrough ──
const browser = await chromium.launch({ headless: true });

// === DESKTOP ===
console.log('\n▶ DESKTOP — 1280×800');
const dCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const dPage = await dCtx.newPage();

for (const [name, route] of PUBLIC_ROUTES) {
  console.log(`• /public ${name}`);
  await inspectRoute(dPage, 'desktop', name, route);
}
for (const [name, route] of SHARE_ROUTES) {
  console.log(`• /share ${name}`);
  await inspectRoute(dPage, 'desktop', name, route, { expectError: true });
}
console.log(`▶ protected → expect login redirect`);
for (const [name, route] of PROTECTED_ROUTES) {
  await verifyAuthGate(dPage, 'desktop', name, route);
}

console.log('\n▶ form interactions');
const formFindings = {
  signup: await testSignupForm(dPage),
  login:  await testLoginForm(dPage),
};

await dCtx.close();

// === MOBILE ===
console.log('\n▶ MOBILE — iPhone 14 Pro');
const mCtx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const mPage = await mCtx.newPage();

for (const [name, route] of PUBLIC_ROUTES) {
  console.log(`• /public ${name}`);
  await inspectRoute(mPage, 'mobile', name, route);
}
for (const [name, route] of SHARE_ROUTES) {
  await inspectRoute(mPage, 'mobile', name, route, { expectError: true });
}
// Mobile — just verify auth gate fires for one route; redundant otherwise.
await verifyAuthGate(mPage, 'mobile', 'app_dashboard', '/app');

await mCtx.close();
await browser.close();

// ── Report ────────────────────────────────────────────────────
const summary = {
  desktop: {
    total_routes: Object.keys(findings.desktop.byRoute).length,
    critical: findings.desktop.issues.filter(i => i.severity === 'CRIT').length,
    warnings: findings.desktop.issues.filter(i => i.severity === 'WARN').length,
  },
  mobile: {
    total_routes: Object.keys(findings.mobile.byRoute).length,
    critical: findings.mobile.issues.filter(i => i.severity === 'CRIT').length,
    warnings: findings.mobile.issues.filter(i => i.severity === 'WARN').length,
  },
  forms: formFindings,
};

fs.writeFileSync(
  path.join(OUT, 'findings.json'),
  JSON.stringify({ summary, findings }, null, 2),
);

console.log('\n' + '═'.repeat(64));
console.log(`WALKTHROUGH COMPLETE`);
console.log(`  desktop: ${summary.desktop.total_routes} routes, ${summary.desktop.critical} crit, ${summary.desktop.warnings} warn`);
console.log(`  mobile:  ${summary.mobile.total_routes} routes, ${summary.mobile.critical} crit, ${summary.mobile.warnings} warn`);
console.log(`  forms: signup=${JSON.stringify(formFindings.signup)} login=${JSON.stringify(formFindings.login)}`);
console.log(`  artifacts → ${OUT}`);
console.log('═'.repeat(64));
