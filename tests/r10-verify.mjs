/* R10 verification — catalog-first scope build, no AI loading screen */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://punchlist.ca';
const OUT = path.resolve('tests/audit-runs/r10-postdeploy');
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

// New quote → describe → build the scope
await page.goto(BASE + '/app/quotes/new', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const ta = page.locator('textarea').first();
await ta.fill('Replace 50 gallon hot water tank in basement utility room. Standard gas hookup.');
await page.waitForTimeout(1000);

const t0 = Date.now();
const buildBtn = page.getByRole('button', { name: /build the scope/i }).first();
await buildBtn.click();

// Wait for the suggestions panel to appear (catalog should populate instantly)
await page.waitForSelector('.qe-suggestions, .qe-empty', { timeout: 10_000 });
const t1 = Date.now();
const elapsed = t1 - t0;

// Wait extra for React to flush setTrade
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, '01_after-build.png'), fullPage: true });

// Read trade badge from DOM
const tradeBadge = await page.locator('text=/LANDSCAPING|PLUMBER|ELECTRICIAN|HVAC|CARPENTER|ROOFER|PAINTER|GENERAL/i').first().textContent().catch(() => '');
console.log(`Trade badge text: "${tradeBadge?.trim()}"`);

const sugPanelCount = await page.locator('.qe-suggestions').count();
const sugItemCount = await page.locator('.qe-sug-item').count();
const addAllText = await page.locator('.qe-sug-add-all').first().textContent().catch(() => '');
const lineItemCount = await page.locator('.li-row').count();
const errorVisible = await page.locator('.qe-empty--error').count();
const bodyText = await page.locator('body').innerText();
const hasAIWord = /\bAI\b/.test(bodyText);

console.log('\n=== R10 verification ===');
console.log(`Time to suggestions: ${elapsed}ms (target: < 5000ms)`);
console.log(`Suggestions panel visible: ${sugPanelCount > 0}`);
console.log(`Suggested items: ${sugItemCount}`);
console.log(`Add all button text: "${addAllText?.trim()}"`);
console.log(`Line items (should be 0): ${lineItemCount}`);
console.log(`AI error empty state: ${errorVisible > 0 ? 'VISIBLE' : 'hidden'}`);
console.log(`"AI" word on page: ${hasAIWord ? 'YES — check copy' : 'no'}`);

// Wait a bit more to let AI fire in background
await page.waitForTimeout(15_000);
await page.screenshot({ path: path.join(OUT, '02_after-15s-ai-window.png'), fullPage: true });
const sugItemCountAfter = await page.locator('.qe-sug-item').count();
console.log(`\nAfter 15s background window:`);
console.log(`  Suggested items: ${sugItemCountAfter} (delta: ${sugItemCountAfter - sugItemCount})`);

await browser.close();
console.log(`\nDone → ${OUT}`);
