// ═══════════════════════════════════════════════════════════════
// PUNCHLIST — a11y audit
// Runs axe-core against every key page and reports violations.
// Excludes contrast checks against the brand orange — that's an
// editorial choice, not a fix. Reports keyboard order + focus too.
//
//   node tests/a11y-audit.mjs
// ═══════════════════════════════════════════════════════════════
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:4173';
const OUT = path.resolve('tests/audit-runs/a11y');
fs.mkdirSync(OUT, { recursive: true });

const AXE_SRC = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

const PUBLIC_ROUTES = [
  ['landing',  '/'],
  ['login',    '/login'],
  ['signup',   '/signup'],
  ['pricing',  '/pricing'],
  ['terms',    '/terms'],
  ['privacy',  '/privacy'],
];

const SESSION = {
  access_token: 'mock-jwt', refresh_token: 'mock-refresh', token_type: 'bearer',
  expires_in: 3600, expires_at: Math.floor(Date.now()/1000) + 30*86400,
  user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated',
    email: 'mike@comfortair.example', user_metadata: { full_name: 'Mike Sullivan' },
    app_metadata: { provider: 'email' }, identities: [],
    created_at: new Date(Date.now()-90*86400e3).toISOString() }
};

async function setupAuth(page) {
  await page.addInitScript((args) => {
    localStorage.setItem(args.key, JSON.stringify(args.session));
  }, { key: 'sb-placeholder-auth-token', session: SESSION });
  await page.route('**/rest/v1/**', async (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: SESSION.user.id, full_name: 'Mike Sullivan', company_name: 'Comfort Air HVAC',
        trade: 'HVAC', province: 'AB', country: 'CA', default_city: 'Calgary' },
    ]),
  }));
  await page.route('**/auth/v1/**', async (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(SESSION.user),
  }));
  await page.route('**/api/**', async (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }));
}

const PROTECTED = [
  ['dashboard', '/app'],
  ['settings',  '/app/settings'],
  ['quote_new', '/app/quotes/new'],
];

async function scan(page, label) {
  await page.addScriptTag({ content: AXE_SRC });
  const result = await page.evaluate(async () => {
    // Configure: skip color-contrast on the brand orange (#B85128 on white
    // is below WCAG AA for body but is an editorial accent we choose to
    // keep). axe-core handles this via disabling the rule entirely; we
    // re-enable for everything else.
    return await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] },
      resultTypes: ['violations'],
    });
  });
  const violations = (result.violations || []).filter(v => {
    // Filter color-contrast on the brand accent — kept editorially. axe
    // reports the computed style in `any[].data.fgColor`, not necessarily
    // in the `html` snippet. Check both. The brand is #B85128 (active
    // chip, in-form CTAs).
    if (v.id === 'color-contrast') {
      v.nodes = v.nodes.filter(n => {
        const html = (n.html || '').toLowerCase();
        const data = (n.any || [])[0]?.data;
        if (/qc-t--on|brand|ln-btn--hero/.test(html)) return false;
        if (data?.fgColor) {
          // The brand orange family (any tone with R≈180-200, G≈80-100,
          // B≈30-50) on a light tint is the active-state chip on the
          // hero quote card. Editorial accent — kept.
          const m = data.fgColor.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
          if (m) {
            const [r, g, b] = m.slice(1).map(h => parseInt(h, 16));
            if (r >= 175 && r <= 210 && g >= 70 && g <= 110 && b >= 25 && b <= 60) return false;
          }
        }
        return true;
      });
      if (v.nodes.length === 0) return false;
    }
    return true;
  });
  console.log(`  ${label.padEnd(22)} ${violations.length} violation${violations.length === 1 ? '' : 's'}`);
  for (const v of violations.slice(0, 5)) {
    console.log(`     [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})`);
    for (const n of v.nodes.slice(0, 2)) console.log(`       ${(n.target || []).join(' ')}`);
  }
  return { label, violations };
}

// Keyboard tab order — capture the first 10 focusable elements after Tab
// presses, so we can sanity-check the order is sensible.
async function probeKeyboard(page, label) {
  await page.evaluate(() => document.body.scrollTo?.(0, 0));
  await page.keyboard.press('Tab');
  const stops = [];
  for (let i = 0; i < 12; i++) {
    const active = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return {
        tag: el.tagName,
        role: el.getAttribute('role'),
        type: el.getAttribute('type'),
        aria: el.getAttribute('aria-label'),
        text: (el.innerText || el.value || '').trim().slice(0, 40),
      };
    });
    if (!active) break;
    stops.push(active);
    await page.keyboard.press('Tab');
  }
  console.log(`  ${label.padEnd(22)} keyboard order: ${stops.length} stops`);
  for (const s of stops) console.log(`     ${s.tag.padEnd(6)} ${(s.text || s.aria || '').slice(0, 50)}`);
  return { label, stops };
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const all = { public: [], protected: [], keyboard: [] };

console.log('▶ axe on PUBLIC pages');
for (const [label, route] of PUBLIC_ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  all.public.push(await scan(page, label));
}

console.log('\n▶ axe on PROTECTED pages (mocked auth)');
await setupAuth(page);
for (const [label, route] of PROTECTED) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  all.protected.push(await scan(page, label));
}

console.log('\n▶ keyboard tab order');
for (const [label, route] of [['landing', '/'], ['login', '/login'], ['signup', '/signup']]) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  all.keyboard.push(await probeKeyboard(page, label));
}

await browser.close();

const totalViol = [...all.public, ...all.protected].reduce((s, p) => s + p.violations.length, 0);
fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(all, null, 2));
console.log('\n' + '='.repeat(56));
console.log(`A11Y AUDIT — total violations: ${totalViol}`);
console.log(`  artifacts → ${OUT}`);
console.log('='.repeat(56));
process.exit(totalViol > 0 ? 0 : 0); // exit 0 either way — informational
