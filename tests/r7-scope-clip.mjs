/* Mock the scope step on mobile with a real quote to reproduce
 * the text-clipping the user saw.
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://punchlist.ca';
const OUT = path.resolve('tests/audit-runs/r7-scope-clip');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
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

// Open the first quote in EDIT mode
await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const href = await page.locator('a[href^="/app/quotes/"]').filter({ hasNotText: /new/i }).first().getAttribute('href').catch(() => null);
if (href) await page.goto(BASE + href + '/edit', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.screenshot({ path: path.join(OUT, '01_scope-edit-full.png'), fullPage: true });

// Capture .li-summary widths
const info = await page.evaluate(() => {
  const widths = [];
  document.querySelectorAll('.li-row').forEach((row, i) => {
    const r = row.getBoundingClientRect();
    const sum = row.querySelector('.li-summary');
    const name = row.querySelector('.li-summary-name');
    const total = row.querySelector('.li-summary-total');
    widths.push({
      i, rowW: Math.round(r.width), rowL: Math.round(r.left), rowR: Math.round(r.right),
      sumW: sum ? Math.round(sum.getBoundingClientRect().width) : null,
      nameW: name ? Math.round(name.getBoundingClientRect().width) : null,
      nameOverflow: name ? name.scrollWidth - name.clientWidth : null,
      totalW: total ? Math.round(total.getBoundingClientRect().width) : null,
      text: row.textContent?.trim().slice(0, 60),
    });
  });
  // Walk up from .qe-root to find which parent is too wide
  const chain = [];
  let el = document.querySelector('.qe-root');
  while (el && el !== document.body) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    chain.push({
      tag: el.tagName,
      cls: (el.className || '').toString().slice(0, 60),
      width: Math.round(r.width),
      left: Math.round(r.left),
      right: Math.round(r.right),
      display: cs.display,
      flexDirection: cs.flexDirection,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
      maxWidth: cs.maxWidth,
      width_css: cs.width,
      overflow_x: cs.overflowX,
    });
    el = el.parentElement;
  }
  return {
    viewport: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
    chain,
    widths,
  };
});
fs.writeFileSync(path.join(OUT, 'widths.json'), JSON.stringify(info, null, 2));
console.log('viewport:', info.viewport, 'body:', info.bodyWidth);
console.log('Parent chain from .qe-root upward:');
for (const c of info.chain) console.log(`  ${c.tag} .${c.cls} w=${c.width} L=${c.left} R=${c.right} disp=${c.display} pad=${c.paddingLeft}/${c.paddingRight} maxW=${c.maxWidth} ovX=${c.overflow_x}`);

await browser.close();
console.log('Done →', OUT);
