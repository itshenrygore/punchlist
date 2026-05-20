/* R23 verification — hit the preview deploy at 320px width and check
 * the pages that were flagged in the original sweep (billing, pricing,
 * marketing header, schedule, templates, analytics, settings). Pass if
 * none of these pages report viewport-overflow or page-h-scroll.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'https://punchlist-git-claude-audit-pu-2ff19f-henrygore95-6735s-projects.vercel.app';
const OUT = path.resolve('tests/audit-runs/r23-verify');
fs.mkdirSync(OUT, { recursive: true });

const OVERFLOW_PROBE = `(() => {
  const findings = [];
  const vp = window.innerWidth;
  const doc = document.documentElement;
  if (doc.scrollWidth > vp + 1) findings.push({ kind: 'page-h-scroll', selector: 'html', vp, sw: doc.scrollWidth });
  for (const el of document.querySelectorAll('body, body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 4 && r.right > vp + 2) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'sticky') continue;
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      // Skip legitimately scrollable horizontal containers
      let p = el.parentElement;
      let scrollableParent = false;
      while (p) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') { scrollableParent = true; break; }
        p = p.parentElement;
      }
      if (scrollableParent) continue;
      findings.push({
        kind: 'viewport-overflow',
        selector: el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).join('.').slice(0, 80) : el.tagName,
        right: Math.round(r.right),
        vp,
      });
    }
  }
  const seen = new Set();
  return findings.filter(f => { const k = f.kind + ':' + f.selector; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 20);
})()`;

const PAGES = {
  anon: [
    ['landing',  '/'],
    ['pricing',  '/pricing'],
    ['signup',   '/signup'],
    ['login',    '/login'],
  ],
  authed: [
    ['dashboard',     '/app'],
    ['billing',       '/app/billing'],
    ['schedule',      '/app/schedule'],
    ['analytics',     '/app/analytics'],
    ['templates',     '/app/templates'],
    ['settings',      '/app/settings'],
    ['quotes-list',   '/app/quotes'],
    ['invoices-list', '/app/invoices'],
  ],
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 320, height: 568 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1',
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

const findings = {};
let total = 0;

async function probe(label) {
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const f = await page.evaluate(OVERFLOW_PROBE);
  if (f.length > 0) {
    findings[label] = f;
    total += f.length;
    console.log(`  ⚠ ${label}: ${f.length} issue(s)`);
    for (const x of f.slice(0, 4)) console.log(`     - ${x.kind} ${x.selector} right=${x.right} vp=${x.vp}`);
  } else {
    console.log(`  ✓ ${label} clean`);
  }
  await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: true }).catch(() => {});
}

console.log(`\n========== Anonymous pages @ 320px ==========`);
for (const [label, p] of PAGES.anon) {
  try {
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 25_000 });
    await probe(label);
  } catch (e) { console.warn(`  ${label} failed:`, e.message?.slice(0, 80)); }
}

console.log(`\n========== Login + authed pages @ 320px ==========`);
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill('test@test.ca');
  await page.locator('input[type="password"]').first().fill('testing1');
  await Promise.all([
    page.waitForURL(/\/app(\/|$)/, { timeout: 20_000 }).catch(() => null),
    page.locator('button[type="submit"]').first().click(),
  ]);
  await page.waitForTimeout(3000);
} catch (e) { console.warn('  login failed:', e.message?.slice(0, 80)); }

for (const [label, p] of PAGES.authed) {
  try {
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 25_000 });
    await probe(label);
  } catch (e) { console.warn(`  ${label} failed:`, e.message?.slice(0, 80)); }
}

await browser.close();

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ total, findings }, null, 2));

console.log(`\n\n══════════ R23 VERIFY ══════════`);
console.log(`Total overflow findings @ 320px: ${total}`);
if (total === 0) console.log('✓ All previously-flagged pages clean');
else {
  console.log('Pages with remaining issues:');
  for (const [k, v] of Object.entries(findings)) console.log(`  ${k}: ${v.length}`);
}
