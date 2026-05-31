// ═══════════════════════════════════════════════════════════════
// PUNCHLIST — Customer-perspective walkthrough
// Mocks /api/public-quote and /api/public-invoice with realistic
// payloads so we can render the actual customer-facing flows the
// contractor's sent-quote link drops them into — without a real
// Supabase. Captures screenshots at desktop + mobile.
//
//   node tests/customer-walkthrough.mjs
// ═══════════════════════════════════════════════════════════════
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:4173';
const OUT = path.resolve('tests/audit-runs/customer-walkthrough');
fs.mkdirSync(OUT, { recursive: true });

// ── Realistic customer-facing quote payload ──────────────────
const MOCK_QUOTE = {
  id: 'q-mock-1',
  title: 'Furnace + AC Replacement — Full System',
  scope_summary: 'Replace existing 96k BTU furnace and 3.5-ton AC with new 96% AFUE Lennox furnace and 16 SEER condenser. Includes new lineset, flue liner, Ecobee SmartThermostat, and city permit. Old equipment removed and recycled.',
  assumptions: 'Quote assumes existing gas line and 240V service in place. Indoor coil access via attic. Concrete pad in serviceable condition.',
  exclusions: 'Excludes electrical service upgrades, duct modifications beyond plenum, and decorative trim work.',
  status: 'sent',
  subtotal: 10830,
  tax: 542,
  total: 11372,
  discount: 0,
  deposit_required: true,
  deposit_amount: 1137,
  deposit_status: 'pending',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  revision_summary: null,
  revision_number: 1,
  share_token: 'mock-share-token',
  trade: 'HVAC',
  province: 'AB',
  country: 'CA',
  created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  schedule_window: 'Available start next Monday',
  line_items: [
    { id: 'li1', name: 'Remove & dispose of existing furnace + AC',
      description: 'Disconnect, drain, haul to recycling depot',
      quantity: 1, unit_price: 475, included: true, item_type: 'standard' },
    { id: 'li2', name: 'Supply & install gas furnace — 96% AFUE, 80k BTU',
      description: 'Lennox EL296 with variable-speed blower',
      quantity: 1, unit_price: 4180, included: true, item_type: 'standard' },
    { id: 'li3', name: 'Supply & install central AC — 3.5 ton, 16 SEER',
      description: 'Outdoor condenser pad + lineset + start-up',
      quantity: 1, unit_price: 4625, included: true, item_type: 'standard' },
    { id: 'li4', name: 'Lineset, flue liner, electrical & Ecobee thermostat',
      description: 'Includes city permit and inspection',
      quantity: 1, unit_price: 1550, included: true, item_type: 'standard' },
    { id: 'li5', name: 'Add humidifier — whole-home Aprilaire 600',
      description: 'Mounted on supply plenum with bypass damper',
      quantity: 1, unit_price: 685, included: false, item_type: 'optional' },
  ],
  customer: {
    name: 'Jen Smith', email: 'jen@example.com', phone: '+14035551234',
    address: '1245 9th Ave SW, Calgary, AB T2P 0J1',
  },
  customer_name: 'Jen Smith',
  customer_email: 'jen@example.com',
  customer_phone: '+14035551234',
  customer_address: '1245 9th Ave SW, Calgary, AB T2P 0J1',
  contractor_name: 'Mike Sullivan',
  contractor_company: 'Comfort Air HVAC Ltd.',
  contractor_phone: '+14035550101',
  contractor_email: 'mike@comfortair.example',
  contractor_logo: null,
  payment_methods: ['stripe', 'etransfer'],
  payment_instructions: 'Deposit due to lock the installation date.',
  etransfer_email: 'mike@comfortair.example',
  venmo_zelle_handle: '',
  square_payment_link: '',
  paypal_link: '',
  contractor_stripe_link: '',
  stripe_connect_enabled: true,
  signature_data: null,
  signed_at: null,
  signer_name: null,
  view_count: 1,
  terms_conditions: '50% deposit due to schedule. Balance due on completion. Warranty: 1 year on labour, manufacturer warranty on equipment.',
  conversation: [],
  linked_invoice: null,
};

const MOCK_INVOICE = {
  id: 'inv-mock-1',
  number: 'INV-2026-001',
  status: 'sent',
  total: 11372,
  amount_due: 11372,
  amount_paid: 0,
  currency: 'CAD',
  country: 'CA',
  due_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  issued_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  paid_at: null,
  share_token: 'mock-invoice-token',
  notes: 'Thanks for your business — payment due in 14 days.',
  customer: { name: 'Jen Smith', email: 'jen@example.com', phone: '+14035551234' },
  customer_name: 'Jen Smith',
  customer_email: 'jen@example.com',
  contractor_name: 'Mike Sullivan',
  contractor_company: 'Comfort Air HVAC Ltd.',
  contractor_phone: '+14035550101',
  contractor_email: 'mike@comfortair.example',
  contractor_logo: null,
  line_items: MOCK_QUOTE.line_items.filter(i => i.included).map(i => ({
    id: i.id, name: i.name, description: i.description,
    quantity: i.quantity, unit_price: i.unit_price,
  })),
  subtotal: 10830, tax: 542,
  stripe_connect_enabled: true,
  payment_methods: ['stripe', 'etransfer'],
  etransfer_email: 'mike@comfortair.example',
};

async function mockApi(page) {
  await page.route('**/api/public-quote*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ quote: MOCK_QUOTE }),
    });
  });
  await page.route('**/api/public-invoice*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ invoice: MOCK_INVOICE }),
    });
  });
  // Block any tracking POST to public-quote-action so we don't error.
  await page.route('**/api/public-quote-action*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

const browser = await chromium.launch({ headless: true });
const findings = { desktop: [], mobile: [], crit: [], warn: [] };

async function audit(p, label, route, viewport) {
  await p.goto(BASE + route, { waitUntil: 'networkidle', timeout: 15_000 });
  await p.waitForTimeout(1200);
  // Scroll to bottom + back to trigger reveals
  const h = await p.evaluate(() => document.body.scrollHeight).catch(() => 1000);
  for (let y = 0; y <= h; y += 700) {
    await p.evaluate(yy => scrollTo(0, yy), y);
    await p.waitForTimeout(120);
  }
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(500);

  const measure = await p.evaluate(() => ({
    title: document.title,
    textLen: document.body.innerText.length,
    domCount: document.body.querySelectorAll('*').length,
    height: document.body.scrollHeight,
    hasError: /something went wrong|unavailable|invalid/i.test(document.body.innerText.toLowerCase().slice(0, 800)),
  }));

  const file = path.join(OUT, `${viewport}_${label}.png`);
  await p.screenshot({ path: file, fullPage: viewport === 'desktop' });

  console.log(`  ${viewport.padEnd(7)} ${label.padEnd(28)} ${measure.textLen}ch · ${measure.height}px${measure.hasError ? ' ⚠ error chrome' : ''}`);

  findings[viewport].push({ label, route, ...measure, file });

  if (measure.textLen < 100) findings.crit.push(`${viewport} ${label}: near-blank (${measure.textLen} chars)`);
  if (measure.hasError) findings.warn.push(`${viewport} ${label}: error-state copy detected (might be wrong)`);
}

// ── DESKTOP ──
console.log('\n▶ DESKTOP 1280×900');
const dCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const dPage = await dCtx.newPage();
await mockApi(dPage);
await audit(dPage, 'public_quote',                  '/q/mock-share-token',  'desktop');
await audit(dPage, 'public_invoice',                '/i/mock-invoice-token','desktop');
// Approved + signed quote variant — show what the customer sees after signing
await dPage.route('**/api/public-quote*', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      quote: { ...MOCK_QUOTE,
        status: 'approved',
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAlCAYAAAA5L46tAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAhSURBVHhe7cExAQAAAMKg9U9tCU+gAAAAAAAAAAAAAACAdwMl4AABV6h1lAAAAABJRU5ErkJggg==',
        signed_at: new Date().toISOString(),
        signer_name: 'Jen Smith',
        deposit_status: 'pending',
      },
    }),
  });
});
await audit(dPage, 'public_quote_signed',           '/q/mock-share-token?v=signed','desktop');
await dCtx.close();

// ── MOBILE ──
console.log('\n▶ MOBILE iPhone 14 Pro');
const mCtx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const mPage = await mCtx.newPage();
await mockApi(mPage);
await audit(mPage, 'public_quote',   '/q/mock-share-token',   'mobile');
await audit(mPage, 'public_invoice', '/i/mock-invoice-token', 'mobile');
await mCtx.close();

await browser.close();

fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));
console.log('\n' + '═'.repeat(60));
console.log(`CUSTOMER WALKTHROUGH`);
console.log(`  crit: ${findings.crit.length}   warn: ${findings.warn.length}`);
if (findings.crit.length) findings.crit.forEach(c => console.log('  CRIT ' + c));
if (findings.warn.length) findings.warn.forEach(w => console.log('  WARN ' + w));
console.log(`  artifacts → ${OUT}`);
console.log('═'.repeat(60));
