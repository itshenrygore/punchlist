// ═══════════════════════════════════════════════════════════════════
// Punchlist — Mobile Demo Storyboard
//
// 30 frames at iPhone 14 Pro × 3x DPI (retina-sharp), telling the story:
//
//   Act 1 — A real job lands  →  Act 2 — AI builds the scope
//   Act 3 — Customer approves in one tap  →  Act 4 — Foreman coaches
//   Act 5 — Get paid
//
// Drop the frames into CapCut / Descript / iMovie at 1s/frame for a
// ~30s product reel. Stitching guide: STITCH.md (written separately).
// ═══════════════════════════════════════════════════════════════════
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:4173';
const OUT = path.resolve('tests/marketing-storyboard');
fs.mkdirSync(OUT, { recursive: true });

// Retina-quality capture (3x DPI = matches iPhone 14 Pro hardware px)
const VIEWPORT = { ...devices['iPhone 14 Pro'], deviceScaleFactor: 3 };

// ── Realistic demo data ────────────────────────────────────────────
const UID = '11111111-2222-3333-4444-555555555555';
const now = Date.now();
const iso = ms => new Date(ms).toISOString();
const SESSION = {
  access_token: 'demo', refresh_token: 'r', token_type: 'bearer',
  expires_in: 3600, expires_at: Math.floor(now / 1000) + 30 * 86400,
  user: { id: UID, aud: 'authenticated', role: 'authenticated', email: 'mike@sullivanplumbing.example',
          user_metadata: { full_name: 'Mike Sullivan' }, app_metadata: { provider: 'email' },
          identities: [], created_at: iso(now - 90 * 864e5) }
};
const PROFILE = {
  id: UID, full_name: 'Mike Sullivan', company_name: 'Sullivan Plumbing',
  trade: 'Plumber', trades: ['Plumber'], province: 'AB', country: 'CA',
  default_city: 'Calgary', phone: '+14035550101',
  default_labour_rate: 145, default_expiry_days: 14,
  plan: 'pro', is_pro: true, payment_methods: ['E-Transfer'],
  etransfer_email: 'billing@sullivanplumbing.example',
  sms_notifications_enabled: true, require_signature: false,
  stripe_connect_account_id: 'acct_demo', stripe_connect_onboarded: true,
};
const CUSTOMERS = [
  { id: 'c1', user_id: UID, name: 'Joe Smith', email: 'joe@example.com', phone: '+15879502472',
    address: '128 Maple Drive, Calgary', created_at: iso(now - 30 * 864e5) },
  { id: 'c2', user_id: UID, name: 'Maria Garcia', email: 'maria@example.com', phone: '+15875551111',
    address: '45 Oak Ave, Calgary', created_at: iso(now - 15 * 864e5) },
];

// "Old" finished work — so the dashboard isn't an empty-state ghost town
const HIST_QUOTES = [
  { id: 'old1', user_id: UID, title: 'Kitchen faucet install', status: 'paid', total: 480, subtotal: 480, tax: 0,
    trade: 'Plumber', province: 'AB', customer_id: 'c2', quote_number: 1042, sent_at: iso(now - 28 * 864e5),
    approved_at: iso(now - 27 * 864e5), updated_at: iso(now - 25 * 864e5), created_at: iso(now - 30 * 864e5),
    line_items: [], customer: CUSTOMERS[1], share_token: 'hst1' },
  { id: 'old2', user_id: UID, title: 'Bathroom rough-in', status: 'paid', total: 3200, subtotal: 3200, tax: 0,
    trade: 'Plumber', province: 'AB', customer_id: 'c1', quote_number: 1051, sent_at: iso(now - 14 * 864e5),
    approved_at: iso(now - 13 * 864e5), updated_at: iso(now - 10 * 864e5), created_at: iso(now - 14 * 864e5),
    line_items: [], customer: CUSTOMERS[0], share_token: 'hst2' },
];

// The hero quote — this is the one we'll build, send, approve, invoice, mark paid
const HERO_ITEMS = [
  { id: 'li-1', quote_id: 'hero', name: 'Remove & dispose old 50 gal water heater', quantity: 1, unit_price: 245, included: true, category: 'Services' },
  { id: 'li-2', quote_id: 'hero', name: 'Supply & install 50 gal gas water heater', quantity: 1, unit_price: 1485, included: true, category: 'Labour' },
  { id: 'li-3', quote_id: 'hero', name: 'New expansion tank + isolation valves', quantity: 1, unit_price: 285, included: true, category: 'Materials' },
  { id: 'li-4', quote_id: 'hero', name: 'Permit & 1-year warranty', quantity: 1, unit_price: 195, included: true, category: 'Services' },
];
let HERO = {
  id: 'hero', user_id: UID, title: 'Replace 50 gallon hot water tank',
  description: 'Replace 50 gallon gas water heater with new high-efficiency unit, expansion tank, and shutoff valves. Customer\'s old unit is leaking.',
  status: 'draft', total: 2210, subtotal: 2210, tax: 0,
  trade: 'Plumber', province: 'AB', country: 'CA',
  customer_id: 'c1', quote_number: 1052,
  schedule_window: null, completed_at: null,
  updated_at: iso(now), created_at: iso(now),
  line_items: HERO_ITEMS, customer: CUSTOMERS[0], share_token: 'hero-token',
};
// The matching invoice for Act 5
let HERO_INV = {
  id: 'invhero', user_id: UID, quote_id: 'hero', invoice_number: 'INV-2026-052',
  status: 'sent', total: 2210, amount_due: 2210, amount_paid: 0, currency: 'CAD',
  share_token: 'inv-token', due_at: iso(now + 14 * 864e5), issued_at: iso(now),
  customer_id: 'c1', customer: CUSTOMERS[0],
  invoice_items: HERO_ITEMS.map(l => ({ ...l, invoice_id: 'invhero' })),
  created_at: iso(now), updated_at: iso(now),
};

function tableFor(t) {
  if (t === 'profiles') return [PROFILE];
  if (t === 'quotes') return [HERO, ...HIST_QUOTES];
  if (t === 'customers') return CUSTOMERS;
  if (t === 'invoices') return [HERO_INV];
  if (t === 'line_items') return HERO_ITEMS;
  return [];
}

// ── Mocks that mutate state so the story actually flows ─────────────
async function mockApp(page, opts = {}) {
  await page.addInitScript(o => {
    localStorage.setItem(o.k, JSON.stringify(o.v));
    localStorage.setItem('pl_onboarded', '1');
    localStorage.setItem('pl_has_built_quote', '1'); // skip first-build hero
  }, { k: 'sb-placeholder-auth-token', v: SESSION });

  await page.route('**/auth/v1/**', async r => {
    const u = r.request().url();
    if (/\/user/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION.user) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url());
    const m = url.pathname.match(/\/rest\/v1\/([^?\/]+)/);
    const t = m ? m[1] : '';
    const method = route.request().method();
    // Whether the client wants a single object (.single/.maybeSingle)
    const wantsObject = (route.request().headers()['accept'] || '').includes('application/vnd.pgrst.object+json');

    if ((method === 'POST' || method === 'PATCH') && t === 'quotes') {
      try {
        const body = JSON.parse(route.request().postData() || '{}');
        const patch = Array.isArray(body) ? body[0] : body;

        // Figure out WHICH quote this PATCH is for. The client filters by
        // `?id=eq.{id}` for single-row updates, OR `?status=eq.draft` for
        // bulk operations like expireStaleDrafts. Without this check, the
        // bulk "expire drafts" call would clobber HERO every time.
        const idFilter = (url.searchParams.get('id') || '').replace(/^eq\./, '');
        const statusFilter = (url.searchParams.get('status') || '').replace(/^eq\./, '');
        const targetsHero = !idFilter ? false : (idFilter === HERO.id);
        const isBulkOp = !idFilter && statusFilter && statusFilter !== HERO.status;

        if (isBulkOp) {
          // Bulk op targeting a status we're not in → do nothing to HERO.
          return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        if (!targetsHero && !idFilter) {
          // No id filter and no clean status filter — be conservative.
          return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        if (!targetsHero) {
          // Patching some other quote (history, etc.) — don't touch HERO.
          return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }

        // It's for HERO. Still guard against backwards status moves.
        const advanced = ['approved','approved_pending_deposit','deposit_paid','converted_to_invoice','paid'].includes(HERO.status);
        if (advanced && ['draft','sent','viewed','expired'].includes(patch.status)) {
          delete patch.status;
        }
        HERO = { ...HERO, ...patch };
        const out = wantsObject ? HERO : [HERO];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
      } catch { /* fall through */ }
    }
    if ((method === 'POST' || method === 'PATCH') && t === 'invoices') {
      try {
        const body = JSON.parse(route.request().postData() || '{}');
        const patch = Array.isArray(body) ? body[0] : body;
        HERO_INV = { ...HERO_INV, ...patch };
        const out = wantsObject ? HERO_INV : [HERO_INV];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
      } catch { /* fall through */ }
    }

    // Apply URL `?col=eq.value` filters so .maybeSingle() actually gets one row
    let data = tableFor(t);
    for (const [k, v] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
      if (typeof v === 'string' && v.startsWith('eq.')) data = data.filter(r => String(r[k]) === v.slice(3));
    }
    const out = wantsObject ? (data[0] || null) : data;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });

  await page.route('**/api/**', async r => {
    const u = r.request().url();
    // Foreman: realistic, on-brand response for "What to bring"
    if (/ai-assist|foreman|claude/i.test(u)) {
      // Foreman reads `data.content` (non-streaming branch).
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        content: opts.foremanReply || `For this water heater swap, bring:\n\n• Pipe wrench (24") and basin wrench\n• Teflon tape + pipe dope\n• New 18" flex connectors (gas + water)\n• Expansion tank pre-charged to 50 psi\n• Drip pan (city code may require it)\n• Combustion analyzer for the final check\n\nBefore you go: confirm venting type (B-vent vs. PVC) and that the customer's shutoff actually works — old gate valves love to seize.`,
      }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function mockPublicQuote(page, overrides = {}) {
  // Hard-code totals — the builder may PATCH HERO.total to 0 mid-flow
  // when computing payloads with no items, which would show "$0" on the
  // customer view. The public quote shouldn't reflect that draft churn.
  const q = {
    id: 'hero', title: 'Replace 50 gallon hot water tank', status: overrides.status || 'sent',
    total: 2210, subtotal: 2210, tax: 0,
    share_token: 'hero-token', country: 'CA', trade: 'Plumber', province: 'AB',
    deposit_required: false, deposit_amount: 0, deposit_status: 'not_required',
    expires_at: iso(now + 14 * 864e5), created_at: iso(now),
    require_signature: false,
    line_items: HERO_ITEMS,
    customer: CUSTOMERS[0], customer_name: 'Joe Smith',
    customer_email: 'joe@example.com', customer_phone: '+15879502472',
    contractor_name: 'Mike Sullivan', contractor_company: 'Sullivan Plumbing',
    contractor_phone: '+14035550101', contractor_email: 'mike@sullivanplumbing.example',
    payment_methods: ['E-Transfer'], etransfer_email: 'billing@sullivanplumbing.example',
    stripe_connect_enabled: true,
    ...overrides,
  };
  await page.route('**/api/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/public-quote*', async r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quote: q }) }));
  await page.route('**/api/public-quote-action*', async r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'approved', deposit_status: 'not_required' }) }));
}

// ── Frame helper ──
async function frame(page, n, name) {
  const file = path.join(OUT, `${String(n).padStart(2, '0')}_${name}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  console.log(`  ${String(n).padStart(2, '0')}  ${name}`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext(VIEWPORT);
const page = await ctx.newPage();
await mockApp(page);

let n = 0;

// ════════════════════════════════════════════════════════
// ACT 1 — A real job lands  (frames 1–4)
// ════════════════════════════════════════════════════════
console.log('\nACT 1 — a real job lands');

await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await frame(page, ++n, 'dashboard_morning'); // 01

// Tap "+ New quote" — go to the builder via the dashboard's quick CTA
await page.goto(BASE + '/app/quotes/new', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await frame(page, ++n, 'new_quote_empty'); // 02

// Type the job — frame the typing in 2 beats so it reads on video
const desc = page.locator('textarea').first();
await desc.fill('Replace 50 gallon hot');
await page.waitForTimeout(400);
await frame(page, ++n, 'typing_start'); // 03

await desc.fill('Replace 50 gallon gas water heater. Customer\'s old tank is leaking. Add expansion tank and isolation valves.');
await page.waitForTimeout(500);
await frame(page, ++n, 'typing_done'); // 04

// ════════════════════════════════════════════════════════
// ACT 2 — AI builds the scope  (frames 5–10)
// ════════════════════════════════════════════════════════
console.log('\nACT 2 — AI builds the scope');

// Seed the hero quote in the DB so when the builder navigates, items appear
// (real flow calls /api/ai-scope; we shortcut to the post-build review state)
HERO.status = 'draft';
HERO.line_items = HERO_ITEMS;
HERO.scope_summary = 'Replace existing 50 gal gas water heater. Includes haul-away, expansion tank, shutoff valves, permit, and 1-year warranty.';

// Tap "Build the scope →"
const buildBtn = page.locator('button:has-text("Build"), .qb-build-btn').first();
if (await buildBtn.count()) {
  await buildBtn.click().catch(() => {});
}
await page.waitForTimeout(1500);
await frame(page, ++n, 'ai_building'); // 05 — captures whatever transitional state shows

// Go straight to the edit view with the items already there
await page.goto(BASE + `/app/quotes/hero/edit`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await frame(page, ++n, 'scope_filled'); // 06

await page.evaluate(() => window.scrollTo({ top: 240, behavior: 'instant' }));
await page.waitForTimeout(400);
await frame(page, ++n, 'scope_pricing'); // 07

// Tap something that previews the customer's view — open the read-only detail
await page.goto(BASE + '/app/quotes/hero', { waitUntil: 'networkidle' });
await page.waitForTimeout(1300);
await frame(page, ++n, 'review_ready_to_send'); // 08

// Tap "Text Joe" — capture the resend/text bar
const txt = page.locator('button:has-text("Text Joe"), button:has-text("Text"), button:has-text("Send")').first();
if (await txt.count()) {
  await txt.click().catch(() => {});
}
await page.waitForTimeout(900);
await frame(page, ++n, 'send_sheet'); // 09

// Mark it "sent" and navigate to the "?sent=1" confirmation banner
HERO.status = 'sent';
HERO.sent_at = iso(Date.now());
await page.goto(BASE + '/app/quotes/hero?sent=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await frame(page, ++n, 'sent_to_joe'); // 10

// ════════════════════════════════════════════════════════
// ACT 3 — Customer approves in ONE tap  (frames 11–17)
// ════════════════════════════════════════════════════════
console.log('\nACT 3 — customer approves in one tap');

await page.unroute('**/api/**').catch(() => {});
await mockPublicQuote(page, { status: 'sent' });

await page.goto(BASE + '/q/hero-token', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await frame(page, ++n, 'cust_quote_hero'); // 11

// Scroll to show line items + price
await page.evaluate(() => window.scrollTo({ top: 280, behavior: 'instant' }));
await page.waitForTimeout(500);
await frame(page, ++n, 'cust_quote_items'); // 12

await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(400);

// Tap "Approve quote"
const approveBtn = page.locator('button:has-text("Approve quote"), button:has-text("Approve")').first();
if (await approveBtn.count()) {
  await approveBtn.click().catch(() => {});
}
await page.waitForTimeout(700);
await frame(page, ++n, 'cust_approve_confirm'); // 13 — the one-tap confirm sheet

// Hit Approve in the confirm
const confirmBtn = page.locator('.pq-approve-confirm, button:has-text("Approve quote ✓")').first();
if (await confirmBtn.count()) {
  await confirmBtn.click().catch(() => {});
}
await page.waitForTimeout(1300);
await frame(page, ++n, 'cust_approved'); // 14

// Re-render the public page as APPROVED to show the green confirmation
await page.unroute('**/api/public-quote*').catch(() => {});
await mockPublicQuote(page, { status: 'approved', signed_at: iso(Date.now()), signer_name: 'Joe Smith' });
await page.goto(BASE + '/q/hero-token', { waitUntil: 'networkidle' });
await page.waitForTimeout(1300);
await frame(page, ++n, 'cust_approved_state'); // 15

// ════════════════════════════════════════════════════════
// ACT 4 — Foreman coaches  (frames 16–22)
// ════════════════════════════════════════════════════════
console.log('\nACT 4 — Foreman coaches');

// Back to contractor — quote is now approved, dashboard reflects it.
// Unroute EVERY pattern from prior acts so the new mockApp's handlers win.
await page.unroute('**/api/**').catch(() => {});
await page.unroute('**/api/public-quote*').catch(() => {});
await page.unroute('**/api/public-quote-action*').catch(() => {});
await page.unroute('**/rest/v1/**').catch(() => {});
await page.unroute('**/auth/v1/**').catch(() => {});
// Clear any client-side cached state (IndexedDB) so the page re-fetches fresh
await page.evaluate(() => {
  try { indexedDB.deleteDatabase('punchlist-offline'); } catch (e) {}
  try { sessionStorage.removeItem('pl_quotes_filter'); } catch (e) {}
});
// Reset HERO to a clean approved state — the builder PATCH-churn during
// Act 2 may have clobbered line_items / total / customer back to defaults.
HERO = {
  id: 'hero', user_id: UID, title: 'Replace 50 gallon hot water tank',
  description: HERO.description,
  scope_summary: 'Replace existing 50 gal gas water heater. Includes haul-away, expansion tank, shutoff valves, permit, and 1-year warranty.',
  status: 'approved', total: 2210, subtotal: 2210, tax: 0,
  trade: 'Plumber', province: 'AB', country: 'CA',
  customer_id: 'c1', quote_number: 1052,
  schedule_window: null, completed_at: null,
  // Explicit deposit fields — without these the page can flip status to
  // 'approved_pending_deposit' which has no phase banner, looking empty.
  deposit_required: false, deposit_status: 'not_required', deposit_amount: 0,
  sent_at: iso(now - 60 * 60 * 1000),
  approved_at: iso(Date.now()),
  signed_at: iso(Date.now()),
  signer_name: 'Joe Smith',
  view_count: 1,
  updated_at: iso(Date.now()), created_at: iso(now),
  line_items: HERO_ITEMS, customer: CUSTOMERS[0], share_token: 'hero-token',
};
await mockApp(page);

await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(1300);
await frame(page, ++n, 'dashboard_approved_in'); // 16

// Open the approved quote
await page.goto(BASE + '/app/quotes/hero', { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await frame(page, ++n, 'contractor_approved_view'); // 17

// Scroll to the Foreman chip strip
const strip = page.locator('.qd-foreman-strip').first();
if (await strip.count()) {
  await strip.scrollIntoViewIfNeeded().catch(() => {});
}
await page.waitForTimeout(500);
await frame(page, ++n, 'foreman_chip_strip'); // 18

// Tap "What to bring"
const wtb = page.locator('.qd-foreman-chip:has-text("What to bring")').first();
if (await wtb.count()) {
  await wtb.click().catch(() => {});
}
await page.waitForTimeout(1300);
await frame(page, ++n, 'foreman_opens_with_prefill'); // 19

// Send the prefilled message (autoSend doesn't always fire on the panel,
// so click the send button explicitly).
const fmSendBtn = page.locator('.fm-send-btn, button[aria-label*="Send" i], .fm-input-row button').last();
if (await fmSendBtn.count()) {
  await fmSendBtn.click().catch(() => {});
}
await page.waitForTimeout(1800);
await frame(page, ++n, 'foreman_responds'); // 20

// Scroll the conversation so the bottom of the answer is visible
await page.evaluate(() => {
  const el = document.querySelector('.fm-conversation, .fm-messages, .fm-thread, .fm-panel');
  if (el) el.scrollTop = el.scrollHeight;
});
await page.waitForTimeout(500);
await frame(page, ++n, 'foreman_full_answer'); // 21

// Close Foreman, back to the quote
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(500);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(300);
await frame(page, ++n, 'back_to_quote_after_foreman'); // 22

// ════════════════════════════════════════════════════════
// ACT 5 — Get paid  (frames 23–30)
// ════════════════════════════════════════════════════════
console.log('\nACT 5 — get paid');

// Tap "Create invoice"
const ciBtn = page.locator('button:has-text("Create invoice")').first();
if (await ciBtn.count()) {
  await ciBtn.click().catch(() => {});
}
await page.waitForTimeout(1200);
await frame(page, ++n, 'create_invoice_sheet'); // 23

// Tap "Create & text Joe"
const sendInvBtn = page.locator('button:has-text("Create & text Joe"), button:has-text("Create & text")').first();
if (await sendInvBtn.count()) {
  await sendInvBtn.click().catch(() => {});
}
await page.waitForTimeout(1500);
HERO.status = 'converted_to_invoice';

// Navigate to the new invoice
await page.goto(BASE + '/app/invoices/invhero', { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await frame(page, ++n, 'invoice_sent'); // 24

// Scroll to expose the Log Payment / Mark Paid action
await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
await page.waitForTimeout(400);
await frame(page, ++n, 'invoice_actions'); // 25

// Tap Log payment / Mark paid
const logBtn = page.locator('button:has-text("Log payment"), button:has-text("Mark paid")').first();
if (await logBtn.count()) {
  await logBtn.click().catch(() => {});
}
await page.waitForTimeout(900);
await frame(page, ++n, 'log_payment_form'); // 26

// Confirm full balance
const confirmFull = page.locator('button:has-text("Mark paid"), button:has-text("Full balance")').last();
if (await confirmFull.count()) {
  await confirmFull.click().catch(() => {});
}
await page.waitForTimeout(900);
HERO_INV.status = 'paid';
HERO_INV.amount_paid = HERO_INV.total;
HERO_INV.amount_due = 0;
HERO_INV.paid_at = iso(Date.now());

await page.goto(BASE + '/app/invoices/invhero', { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await frame(page, ++n, 'invoice_paid'); // 27

// Bounce back to the dashboard — money chip + caught-up state = the money shot
await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await frame(page, ++n, 'dashboard_after_paid'); // 28

// Analytics — close-rate + revenue tracked
await page.goto(BASE + '/app/analytics', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await frame(page, ++n, 'analytics_revenue'); // 29

// Closing kicker — back to quotes list showing the closed deal
await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
await page.waitForTimeout(1300);
await frame(page, ++n, 'quotes_list_kicker'); // 30

await browser.close();
console.log(`\n✓ ${n} frames captured -> ${OUT}`);
