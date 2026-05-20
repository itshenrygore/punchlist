/* Sloppy-layout sweep — every surface × small mobile (375) + standard
 * mobile (393) + tablet (768). Each capture also runs a programmatic
 * overflow check (any element with scrollWidth > clientWidth or any
 * element bleeding past document.documentElement.scrollWidth gets
 * flagged with selector + dimensions).
 *
 * Output: tests/audit-runs/r23-layout-sweep/
 *   - <viewport>_<page>.png   per capture
 *   - report.json             machine-readable findings
 *   - SLOPPY-REPORT.md        human-readable summary
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://punchlist.ca';
const OUT = path.resolve('tests/audit-runs/r23-layout-sweep');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'mobile-se', width: 375, height: 667, opts: { ...devices['iPhone SE'] } },
  { name: 'mobile-14', width: 393, height: 852, opts: { ...devices['iPhone 14 Pro'] } },
  { name: 'tablet',    width: 768, height: 1024, opts: { ...devices['iPad (gen 7)'] } },
];

// Run inside the page: find any element whose contents exceed its
// bounding box, plus any root-level horizontal overflow.
const OVERFLOW_PROBE = `(() => {
  const findings = [];
  const vp = window.innerWidth;
  const doc = document.documentElement;
  if (doc.scrollWidth > vp + 1) {
    findings.push({ kind: 'page-h-scroll', selector: 'html', vp, sw: doc.scrollWidth });
  }
  // Walk every visible element. Skip the long tail (svg internals, etc).
  const all = document.querySelectorAll('body, body *');
  for (const el of all) {
    if (el.children.length > 0 && el.tagName !== 'BODY') {
      // Only leaf-ish elements for text-truncation checks; skip
      // containers because their scrollWidth can legitimately exceed
      // clientWidth when their *children* overflow (we want to catch
      // the child).
    } else if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 20) {
      // Text-only overflow check
      const cs = getComputedStyle(el);
      // Only flag if overflow is truly clipped (not 'visible' which
      // would just spill outside the box but be visible to the user)
      if (cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.textOverflow === 'ellipsis') {
        // Acceptable — ellipsis is intentional truncation
      } else if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') {
        // Acceptable — scrollable container
      } else {
        const text = (el.textContent || '').trim().slice(0, 50);
        findings.push({
          kind: 'text-overflow',
          selector: el.className ? '.' + el.className.split(' ').filter(Boolean).join('.').slice(0, 60) : el.tagName,
          sw: el.scrollWidth,
          cw: el.clientWidth,
          text,
        });
      }
    }
    // Also flag any element whose right edge exceeds the viewport
    const r = el.getBoundingClientRect();
    if (r.width > 4 && r.right > vp + 2) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'sticky') continue;
      // Skip if the element is invisible
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      findings.push({
        kind: 'viewport-overflow',
        selector: el.className ? '.' + el.className.split(' ').filter(Boolean).join('.').slice(0, 60) : el.tagName,
        right: Math.round(r.right),
        vp,
      });
    }
  }
  // Dedupe by selector+kind, keep first
  const seen = new Set();
  const unique = [];
  for (const f of findings) {
    const k = \`\${f.kind}:\${f.selector}\`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(f);
  }
  return unique.slice(0, 30); // cap
})()`;

const report = { byPage: {}, summary: { totalIssues: 0, byKind: {} } };

async function probePage(page, label) {
  try {
    const findings = await page.evaluate(OVERFLOW_PROBE);
    if (findings.length > 0) {
      report.byPage[label] = findings;
      report.summary.totalIssues += findings.length;
      for (const f of findings) {
        report.summary.byKind[f.kind] = (report.summary.byKind[f.kind] || 0) + 1;
      }
      console.log(`  ⚠ ${label}: ${findings.length} issue(s)`);
      for (const f of findings.slice(0, 5)) console.log(`     - ${f.kind} ${f.selector} ${f.right ? `right=${f.right} vp=${f.vp}` : `sw=${f.sw} cw=${f.cw}`}`);
    } else {
      console.log(`  ✓ ${label} clean`);
    }
  } catch (e) {
    console.warn(`  probe failed for ${label}:`, e.message?.slice(0, 80));
  }
}

async function settleAndScroll(page) {
  await page.waitForTimeout(1500);
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= h; y += 400) {
    await page.evaluate(yy => window.scrollTo(0, yy), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
}

const browser = await chromium.launch({ headless: true });

for (const vp of VIEWPORTS) {
  console.log(`\n========== ${vp.name} (${vp.width}×${vp.height}) ==========`);
  const ctx = await browser.newContext({ ...vp.opts, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  // ── Anonymous pages ──
  const ANON = [
    ['landing',   '/'],
    ['signup',    '/signup'],
    ['login',     '/login'],
    ['pricing',   '/pricing'],
    ['terms',     '/terms'],
    ['privacy',   '/privacy'],
    ['q-garbage', '/q/this-token-does-not-exist'],
    ['i-garbage', '/i/this-token-does-not-exist'],
    ['404',       '/this-does-not-exist'],
  ];
  for (const [label, p] of ANON) {
    try {
      await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 25_000 });
      await settleAndScroll(page);
      await page.screenshot({ path: path.join(OUT, `${vp.name}_${label}.png`), fullPage: true });
      await probePage(page, `${vp.name}/${label}`);
    } catch (e) {
      console.warn(`  ${label} failed:`, e.message?.slice(0, 80));
    }
  }

  // ── Login then walk authed ──
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill('test@test.ca');
  await page.locator('input[type="password"]').first().fill('testing1');
  await Promise.all([
    page.waitForURL(/\/app(\/|$)/, { timeout: 20_000 }).catch(() => null),
    page.locator('button[type="submit"]').first().click(),
  ]);
  await page.waitForTimeout(2500);

  const AUTHED = [
    ['dashboard',          '/app'],
    ['quotes-list',        '/app/quotes'],
    ['quote-builder-new',  '/app/quotes/new'],
    ['invoices-list',      '/app/invoices'],
    ['invoices-new',       '/app/invoices/new'],
    ['customers',          '/app/customers'],
    ['schedule',           '/app/schedule'],
    ['analytics',          '/app/analytics'],
    ['templates',          '/app/templates'],
    ['templates-msg',      '/app/templates?tab=messages'],
    ['settings',           '/app/settings'],
    ['billing',            '/app/billing'],
    ['payments-setup',     '/app/payments/setup'],
  ];
  for (const [label, p] of AUTHED) {
    try {
      await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 25_000 });
      await settleAndScroll(page);
      await page.screenshot({ path: path.join(OUT, `${vp.name}_${label}.png`), fullPage: true });
      await probePage(page, `${vp.name}/${label}`);
    } catch (e) {
      console.warn(`  ${label} failed:`, e.message?.slice(0, 80));
    }
  }

  // Open first quote detail
  try {
    await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const href = await page.locator('a[href^="/app/quotes/"]').filter({ hasNotText: /new/i }).first().getAttribute('href').catch(() => null);
    if (href) {
      await page.goto(BASE + href, { waitUntil: 'networkidle' });
      await settleAndScroll(page);
      await page.screenshot({ path: path.join(OUT, `${vp.name}_quote-detail.png`), fullPage: true });
      await probePage(page, `${vp.name}/quote-detail`);
      // More tab
      const more = page.locator('.qd-mobile-tab--more').first();
      if (await more.isVisible({ timeout: 1500 }).catch(() => false)) {
        await more.click();
        await settleAndScroll(page);
        await page.screenshot({ path: path.join(OUT, `${vp.name}_quote-detail-more.png`), fullPage: true });
        await probePage(page, `${vp.name}/quote-detail-more`);
      }
    }
  } catch (e) {
    console.warn('  quote-detail failed:', e.message?.slice(0, 80));
  }

  // Open first invoice detail
  try {
    await page.goto(BASE + '/app/invoices', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const href = await page.locator('a[href^="/app/invoices/"]').filter({ hasNotText: /new/i }).first().getAttribute('href').catch(() => null);
    if (href) {
      await page.goto(BASE + href, { waitUntil: 'networkidle' });
      await settleAndScroll(page);
      await page.screenshot({ path: path.join(OUT, `${vp.name}_invoice-detail.png`), fullPage: true });
      await probePage(page, `${vp.name}/invoice-detail`);
    }
  } catch (e) {
    console.warn('  invoice-detail failed:', e.message?.slice(0, 80));
  }

  // Foreman panel
  try {
    await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const fm = page.locator('.mobile-nav-foreman, .topbar-foreman-btn').first();
    if (await fm.isVisible({ timeout: 1500 }).catch(() => false)) {
      await fm.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, `${vp.name}_foreman-open.png`), fullPage: true });
      await probePage(page, `${vp.name}/foreman-open`);
    }
  } catch {}

  await ctx.close();
}

await browser.close();

// Write report
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

// Human-readable summary
const md = [
  '# Sloppy-Layout Sweep',
  '',
  `**Total issues**: ${report.summary.totalIssues}`,
  '',
  '## By kind',
  ...Object.entries(report.summary.byKind).map(([k, v]) => `- **${k}**: ${v}`),
  '',
  '## By page',
  '',
];
for (const [page, findings] of Object.entries(report.byPage)) {
  md.push(`### ${page} (${findings.length})`);
  for (const f of findings) {
    md.push(`- **${f.kind}** \`${f.selector}\` ${f.right ? `right=${f.right} vp=${f.vp}` : f.sw ? `sw=${f.sw} cw=${f.cw}` : ''} ${f.text ? `· "${f.text}"` : ''}`);
  }
  md.push('');
}
fs.writeFileSync(path.join(OUT, 'SLOPPY-REPORT.md'), md.join('\n'));

console.log('\n\n══════════ SUMMARY ══════════');
console.log(`Total issues across all pages × viewports: ${report.summary.totalIssues}`);
console.log('By kind:');
for (const [k, v] of Object.entries(report.summary.byKind)) console.log(`  ${k}: ${v}`);
console.log(`\nReport: ${OUT}/SLOPPY-REPORT.md`);
