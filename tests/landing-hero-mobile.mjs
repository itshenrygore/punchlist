/* Mobile-only — capture just the hero section so I can verify the
 * line items render. */
import { chromium, devices } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'tests/audit-runs/r4-local-landing/mobile_hero.png', clip: { x: 0, y: 0, width: 393, height: 900 } });
console.log('done');
await browser.close();
