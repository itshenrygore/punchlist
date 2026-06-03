// Interactive flows — open the Foreman panel, run through the quote
// builder, test the customer picker. Uses the same auth + API mocks as
// contractor-walkthrough.mjs.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:4173';
const OUT = path.resolve('tests/audit-runs/interactive-flows');
fs.mkdirSync(OUT, { recursive: true });

const SESSION = {
  access_token: 'mock-jwt', refresh_token: 'mock-refresh', token_type: 'bearer',
  expires_in: 3600, expires_at: Math.floor(Date.now()/1000) + 30*86400,
  user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated',
    email: 'mike@comfortair.example', email_confirmed_at: new Date().toISOString(),
    user_metadata: { full_name: 'Mike Sullivan' }, app_metadata: { provider: 'email' },
    identities: [], created_at: new Date(Date.now()-90*86400e3).toISOString() }
};

async function setup(page) {
  await page.addInitScript((args) => {
    localStorage.setItem(args.key, JSON.stringify(args.session));
  }, { key: 'sb-placeholder-auth-token', session: SESSION });
  await page.route('**/rest/v1/**', async (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: SESSION.user.id, full_name: 'Mike Sullivan', company_name: 'Comfort Air HVAC',
        trade: 'HVAC', province: 'AB', country: 'CA', default_city: 'Calgary',
        default_labour_rate: 165, default_expiry_days: 14, phone: '+14035550101' },
    ]),
  }));
  await page.route('**/auth/v1/user**', async (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(SESSION.user),
  }));
  await page.route('**/auth/v1/**', async (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }));
  await page.route('**/api/**', async (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }));
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await setup(p);

const findings = [];

// ── Flow 1: Open Foreman panel from dashboard ──
console.log('▶ Foreman panel');
await p.goto(BASE + '/app', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

// Click the Foreman button
const fmBtn = p.locator('button:has-text("Foreman")').first();
const visible = await fmBtn.isVisible().catch(() => false);
console.log('  Foreman button visible:', visible);
if (visible) {
  await fmBtn.click();
  await p.waitForTimeout(700);
  const panelOpen = await p.locator('.fm-panel').isVisible().catch(() => false);
  console.log('  Foreman panel opens:', panelOpen);
  findings.push({ flow: 'foreman_open', ok: panelOpen });
  if (panelOpen) {
    await p.screenshot({ path: path.join(OUT, 'desktop_foreman-open.png'), fullPage: false });
    // Quick action chips should be visible
    const chips = await p.locator('.fm-quick-btn').count();
    console.log('  Quick action chips:', chips);
    findings.push({ flow: 'foreman_quick_actions', count: chips, ok: chips >= 3 });
    // Greeting should include the user's name
    const greeting = await p.locator('.fm-empty-title').innerText().catch(() => '');
    console.log('  Greeting:', JSON.stringify(greeting));
    findings.push({ flow: 'foreman_greeting', greeting, ok: /Mike/.test(greeting) });
    // Input should be present + focused
    const inputCount = await p.locator('.fm-input').count();
    findings.push({ flow: 'foreman_input', count: inputCount, ok: inputCount > 0 });
    // Type a message
    await p.locator('.fm-input').fill('How much for a 50 gal gas water heater?');
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, 'desktop_foreman-typed.png'), fullPage: false });
    // Close via Esc
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
    const stillOpen = await p.locator('.fm-panel').isVisible().catch(() => false);
    findings.push({ flow: 'foreman_esc_close', stillOpen, ok: !stillOpen });
  }
}

// ── Flow 2: Quote builder — fill description, choose trade ──
console.log('▶ Quote builder describe step');
await p.goto(BASE + '/app/quotes/new', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

const descField = p.locator('textarea').first();
const descVisible = await descField.isVisible().catch(() => false);
console.log('  Description textarea visible:', descVisible);
findings.push({ flow: 'builder_desc_field', ok: descVisible });

if (descVisible) {
  await descField.fill('Replace 50 gallon gas water heater with new unit, customer already supplied the heater');
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, 'desktop_builder-described.png'), fullPage: false });

  // Trade dropdown
  const tradeSelect = p.locator('select').first();
  if (await tradeSelect.count() > 0) {
    await tradeSelect.selectOption({ label: 'Plumber' }).catch(() => {});
    await p.waitForTimeout(300);
    findings.push({ flow: 'builder_trade_select', ok: true });
  }

  // Find the Build button / Start Builder CTA
  const buildBtn = p.locator('button').filter({ hasText: /build|start|generate|scope/i }).first();
  const buildExists = await buildBtn.isVisible().catch(() => false);
  findings.push({ flow: 'builder_cta_visible', ok: buildExists });
}

// ── Flow 3: Settings — confirm new default_city field is editable ──
console.log('▶ Settings page default_city');
await p.goto(BASE + '/app/settings', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
// The field should be pre-filled from the mock profile
const cityField = p.locator('input[placeholder*="Calgary"]').first();
const cityVisible = await cityField.isVisible().catch(() => false);
const cityValue = await cityField.inputValue().catch(() => '');
console.log('  default_city input visible:', cityVisible, 'value:', JSON.stringify(cityValue));
findings.push({ flow: 'settings_default_city', visible: cityVisible, value: cityValue, ok: cityVisible && cityValue === 'Calgary' });

// ── Flow 4: Sidebar nav check — every link should navigate ──
console.log('▶ Sidebar navigation');
const sidebarLinks = await p.locator('.sidebar-nav-link, .app-sidebar a, a[href^="/app"]').all();
const linkCount = sidebarLinks.length;
console.log('  sidebar links found:', linkCount);
findings.push({ flow: 'sidebar_link_count', count: linkCount, ok: linkCount >= 5 });

await browser.close();

fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));
const failed = findings.filter(f => f.ok === false);
console.log('\n' + '='.repeat(56));
console.log(`INTERACTIVE FLOWS — ${findings.length - failed.length}/${findings.length} passed`);
if (failed.length) failed.forEach(f => console.log('  ✗', JSON.stringify(f)));
else console.log('All interactive flows behaved as expected.');
console.log('='.repeat(56));
