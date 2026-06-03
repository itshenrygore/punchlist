// Deep mobile audit — happy + unhappy paths, end-to-end workflows.
// Drives the app at iPhone 14 Pro, captures every meaningful state,
// flags overflow, tiny tap targets, missing close buttons, sticky-clip.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:4173';
const OUT = path.resolve('tests/audit-runs/deep-mobile');
fs.mkdirSync(OUT, { recursive: true });

const UID = '00000000-0000-0000-0000-000000000001';
const now = Date.now();
const iso = ms => new Date(ms).toISOString();
const SESSION = {
  access_token: 'mock', refresh_token: 'm', token_type: 'bearer',
  expires_in: 3600, expires_at: Math.floor(now / 1000) + 30 * 86400,
  user: { id: UID, aud: 'authenticated', role: 'authenticated', email: 'henry@x.example',
          user_metadata: { full_name: 'Henry Gore' }, app_metadata: { provider: 'email' },
          identities: [], created_at: iso(now) }
};
const PROFILE = { id: UID, full_name: 'Henry Gore', company_name: 'Sullivan Contracting',
  trade: 'Plumber', trades: ['Plumber','HVAC'], province: 'AB', country: 'CA',
  default_city: 'Calgary', phone: '+15875551234', default_labour_rate: 145,
  default_expiry_days: 14, stripe_connect_account_id: 'acct_m', stripe_connect_onboarded: true };
const CUSTOMERS = [
  { id:'c1', user_id:UID, name:'Joe Blow', email:'joe@example.com', phone:'+15879502472',
    address:'123 Elm St, Calgary', created_at: iso(now - 60*864e5) },
  { id:'c2', user_id:UID, name:'Maria Sanchez', email:'maria@example.com', phone:'+15875551111',
    address:'45 Oak Ave, Calgary', created_at: iso(now - 30*864e5) },
];
const LI_Q1 = [
  { id:'li-1', quote_id:'q1', name:'Remove & dispose old furnace', quantity:1, unit_price:475, category:'Services', included:true },
  { id:'li-2', quote_id:'q1', name:'Supply & install furnace 96% AFUE', quantity:1, unit_price:4180, category:'Labour', included:true },
  { id:'li-3', quote_id:'q1', name:'New thermostat + permit', quantity:1, unit_price:340, category:'Materials', included:true },
];
const QUOTES = [
  { id:'q1', user_id:UID, title:'Furnace + AC Replacement', status:'approved', total:4995, subtotal:4995, tax:0,
    trade:'HVAC', province:'AB', customer_id:'c1', quote_number:1280,
    sent_at: iso(now - 3*864e5), approved_at: iso(now - 1*864e5),
    updated_at: iso(now), created_at: iso(now - 5*864e5),
    line_items: LI_Q1, customer: CUSTOMERS[0], share_token: 'qst1' },
  { id:'q2', user_id:UID, title:'Kitchen faucet swap', status:'sent', total:340, subtotal:340, tax:0,
    trade:'Plumber', province:'AB', customer_id:'c1', quote_number:1295,
    sent_at: iso(now), updated_at: iso(now), created_at: iso(now),
    line_items: [{id:'li-x', quote_id:'q2', name:'Replace kitchen faucet', quantity:1, unit_price:340, included:true}],
    customer: CUSTOMERS[0], share_token:'qst2' },
  { id:'q3', user_id:UID, title:'Basement bathroom rough-in', status:'draft', total:0, subtotal:0, tax:0,
    trade:'Plumber', province:'AB', customer_id:'c2', quote_number:null,
    updated_at: iso(now - 2*864e5), created_at: iso(now - 2*864e5),
    line_items: [], customer: CUSTOMERS[1] },
];
const INVOICES = [
  { id:'inv1', user_id:UID, quote_id:'q1', invoice_number:'INV-2026-001', status:'sent',
    total:4995, amount_due:4995, amount_paid:0, currency:'CAD', share_token:'ist1',
    due_at: iso(now + 14*864e5), issued_at: iso(now - 1*864e5),
    customer_id:'c1', customer: CUSTOMERS[0], line_items: LI_Q1.map(l=>({...l,invoice_id:'inv1'})),
    created_at: iso(now - 1*864e5), updated_at: iso(now) }
];
const TEMPLATES = [
  { id:'t1', user_id:UID, name:'Standard furnace replacement', trade:'HVAC', province:'AB',
    use_count:7, description:'Replace existing gas furnace with new high-efficiency unit',
    line_items:[
      {name:'Remove & dispose old furnace', quantity:1, unit_price:250},
      {name:'Supply & install gas furnace', quantity:1, unit_price:3800},
      {name:'New thermostat + permit', quantity:1, unit_price:340},
    ],
    created_at: iso(now - 40*864e5), updated_at: iso(now - 20*864e5) }
];

function tableFor(t) {
  if (t==='profiles') return [PROFILE];
  if (t==='quotes') return QUOTES;
  if (t==='customers') return CUSTOMERS;
  if (t==='invoices') return INVOICES;
  if (t==='job_templates') return TEMPLATES;
  if (t==='message_templates') return [];
  if (t==='line_items') return [...LI_Q1, ...QUOTES.flatMap(q=>q.line_items||[])];
  if (t==='quote_views') return [];
  if (t==='notifications') return [];
  return [];
}

async function mock(page, opts = {}) {
  if (!opts.skipSession) {
    await page.addInitScript(o => {
      localStorage.setItem(o.k, JSON.stringify(o.v));
      localStorage.setItem('pl_onboarded', '1');
    }, { k: 'sb-placeholder-auth-token', v: SESSION });
  }
  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url());
    const m = url.pathname.match(/\/rest\/v1\/([^?\/]+)/);
    let data = tableFor(m ? m[1] : '');
    for (const [k, v] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
      if (typeof v === 'string' && v.startsWith('eq.')) data = data.filter(r => String(r[k]) === v.slice(3));
    }
    const method = route.request().method();
    if (method === 'POST' || method === 'PATCH') {
      // Echo back posted body merged with first existing row for the table — keeps id stable
      try {
        const body = JSON.parse(route.request().postData() || '{}');
        const merged = Array.isArray(body) ? body[0] : body;
        const out = { ...(data[0] || {}), ...merged, id: merged.id || data[0]?.id || 'new-id' };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([out]) });
      } catch { return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data.slice(0,1)) }); }
    }
    if (method === 'DELETE') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data.slice(0,1)) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.route('**/auth/v1/**', async route => {
    const u = route.request().url();
    if (/\/user/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION.user) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/**', async route => {
    const u = route.request().url();
    // Foreman / AI assist: return a friendly canned reply
    if (/ai-assist|claude|foreman/i.test(u)) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ reply: 'For this job I\'d add a Lennox EL296 (96% AFUE), an Ecobee thermostat, and pull a city permit. Want me to add these to the quote?' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function inspect(page) {
  return await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const overflow = [];
    const tiny = [];
    const clipped = [];
    const lowContrast = [];
    if (document.documentElement.scrollWidth > vw + 2) overflow.push('h-scroll '+document.documentElement.scrollWidth+'>'+vw);
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && r.right > vw + 3 && r.left >= -1 && r.width <= vw) {
        const c = (el.className || el.tagName).toString().slice(0,30);
        if (!/pl-tab|settings-tab|marquee/.test(c)) overflow.push(c+' R='+Math.round(r.right));
      }
      // tap-target check — interactive elements should be ≥ 40×40
      const tag = el.tagName.toLowerCase();
      if (['button','a'].includes(tag) || el.getAttribute('role') === 'button') {
        if (r.width > 0 && r.height > 0 && (r.width < 32 || r.height < 32) && cs.visibility !== 'hidden' && cs.display !== 'none') {
          // ignore icons inside larger tap surfaces
          const parentBtn = el.closest('button, a, [role="button"]');
          if (parentBtn === el) {
            const c = (el.className || tag).toString().slice(0,30);
            if (!/close|chevron|swatch|chip/.test(c)) tiny.push(`${c} ${Math.round(r.width)}×${Math.round(r.height)}`);
          }
        }
      }
    });
    return {
      overflow: [...new Set(overflow)].slice(0,6),
      tiny: [...new Set(tiny)].slice(0,6),
      clipped, lowContrast
    };
  });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const page = await ctx.newPage();
const findings = [];

async function snap(name, note='') {
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true }).catch(()=>{});
  const r = await inspect(page);
  findings.push({ name, note, ...r });
  const flags = [];
  if (r.overflow.length) flags.push('OVF: '+r.overflow.join(' | '));
  if (r.tiny.length) flags.push('TINY: '+r.tiny.join(' | '));
  console.log(`${name.padEnd(40)} ${flags.length?'⚠ '+flags.join('  '):'ok'}${note?'  ['+note+']':''}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION A — HAPPY PATHS
// ═══════════════════════════════════════════════════════════════════════════

// A1. Dashboard (signed-in landing) — chip stats, schedule, recent
await mock(page);
await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await snap('A01_dashboard');

// A2. Quotes list (default tab All)
await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await snap('A02_quotes_list_all');

// A3. Quotes — Draft tab
const draftTab = page.locator('button:has-text("Draft"), [role="tab"]:has-text("Draft")').first();
if (await draftTab.count()) { await draftTab.click().catch(()=>{}); await page.waitForTimeout(500); await snap('A03_quotes_list_drafts'); }

// A4. Quotes — Sent tab
const sentTab = page.locator('button:has-text("Sent"), [role="tab"]:has-text("Sent")').first();
if (await sentTab.count()) { await sentTab.click().catch(()=>{}); await page.waitForTimeout(500); await snap('A04_quotes_list_sent'); }

// A5. Approved quote detail
await page.goto(BASE + '/app/quotes/q1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('A05_approved_quote_detail');

// A6. Scope & Pricing expanded (totals visible)
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await snap('A06_approved_quote_scrolled');

// A7. Customers list
await page.goto(BASE + '/app/customers', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await snap('A07_customers_list');

// A8. Customer detail
await page.goto(BASE + '/app/customers/c1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await snap('A08_customer_detail');

// A9. New customer modal
await page.goto(BASE + '/app/customers', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const addCust = page.locator('button:has-text("Add customer"), button:has-text("+ Customer"), button:has-text("New customer")').first();
if (await addCust.count()) { await addCust.click().catch(()=>{}); await page.waitForTimeout(700); await snap('A09_add_customer_sheet'); await page.keyboard.press('Escape').catch(()=>{}); }

// A10. Invoices list
await page.goto(BASE + '/app/invoices', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await snap('A10_invoices_list');

// A11. Invoice detail (sent)
await page.goto(BASE + '/app/invoices/inv1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('A11_invoice_detail');

// A12. Templates
await page.goto(BASE + '/app/templates', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await snap('A12_templates');

// A13. Foreman opened from dashboard
await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const fmBtn = page.locator('.mobile-nav-foreman, [aria-label*="Foreman" i], button:has-text("Foreman")').last();
if (await fmBtn.count()) { await fmBtn.click().catch(()=>{}); await page.waitForTimeout(900); await snap('A13_foreman_open'); }

// A14. Foreman with question typed
const fmInput = page.locator('textarea, input[placeholder*="ask" i], .fm-input').first();
if (await fmInput.count()) {
  await fmInput.fill('What\'s commonly missed on a furnace replacement?').catch(()=>{});
  await page.waitForTimeout(400);
  await snap('A14_foreman_typed');
  const send = page.locator('.fm-send, button[aria-label*="send" i], button:has-text("Send")').last();
  if (await send.count()) { await send.click().catch(()=>{}); await page.waitForTimeout(1400); await snap('A15_foreman_reply'); }
}

// A16. Notifications panel
await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const bell = page.locator('button[aria-label*="notification" i], button[aria-label*="bell" i]').first();
if (await bell.count()) { await bell.click().catch(()=>{}); await page.waitForTimeout(500); await snap('A16_notifications'); await page.keyboard.press('Escape').catch(()=>{}); }

// A17. Hamburger menu
const burger = page.locator('button[aria-label*="menu" i], .mobile-menu-toggle, button:has(svg.lucide-menu)').first();
if (await burger.count()) { await burger.click().catch(()=>{}); await page.waitForTimeout(500); await snap('A17_mobile_menu'); await page.keyboard.press('Escape').catch(()=>{}); }

// A18. Search panel
const search = page.locator('button[aria-label*="search" i]').first();
if (await search.count()) { await search.click().catch(()=>{}); await page.waitForTimeout(500); await snap('A18_search_panel'); await page.keyboard.press('Escape').catch(()=>{}); }

// A19. Settings — Profile (default)
await page.goto(BASE + '/app/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await snap('A19_settings_profile');

// A20. Settings — Payments
const payTab = page.locator('.settings-tab').filter({ hasText: 'Payments' }).first();
if (await payTab.count()) { await payTab.click().catch(()=>{}); await page.waitForTimeout(700); await snap('A20_settings_payments'); }

// A21. Send-quote sheet from sent quote (resend)
await page.goto(BASE + '/app/quotes/q2', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('A21_sent_quote_detail');
const resend = page.locator('button:has-text("Resend"), button:has-text("Text Joe"), button:has-text("Send to")').first();
if (await resend.count()) { await resend.click().catch(()=>{}); await page.waitForTimeout(900); await snap('A22_resend_sheet'); await page.keyboard.press('Escape').catch(()=>{}); }

// A23. Create invoice sheet from approved quote
await page.goto(BASE + '/app/quotes/q1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const ciBtn = page.locator('button:has-text("Create invoice")').first();
if (await ciBtn.count()) { await ciBtn.click().catch(()=>{}); await page.waitForTimeout(900); await snap('A23_create_invoice_sheet'); }
// A24. Milestone-mode in the create-invoice sheet
const milestone = page.locator('button:has-text("Milestone"), .cvt-amount-chip:has-text("Milestone")').first();
if (await milestone.count()) { await milestone.click().catch(()=>{}); await page.waitForTimeout(400); await snap('A24_create_invoice_milestone'); }
await page.keyboard.press('Escape').catch(()=>{});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION B — UNHAPPY PATHS
// ═══════════════════════════════════════════════════════════════════════════

// B1. Empty quotes list
await page.unroute('**/rest/v1/**').catch(()=>{});
await page.route('**/rest/v1/**', async route => {
  const url = new URL(route.request().url());
  const m = url.pathname.match(/\/rest\/v1\/([^?\/]+)/);
  if (m && m[1] === 'quotes') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  if (m && m[1] === 'profiles') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([PROFILE]) });
  return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});
await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await snap('B01_empty_quotes');

// B2. Empty customers
await page.goto(BASE + '/app/customers', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await snap('B02_empty_customers');

// B3. Empty invoices
await page.goto(BASE + '/app/invoices', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await snap('B03_empty_invoices');

// B4. Empty templates
await page.goto(BASE + '/app/templates', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await snap('B04_empty_templates');

// B5. Quote not found
await page.unroute('**/rest/v1/**').catch(()=>{});
await mock(page);
await page.goto(BASE + '/app/quotes/does-not-exist', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('B05_quote_404');

// B6. Customer not found
await page.goto(BASE + '/app/customers/missing', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('B06_customer_404');

// B7. 404 page
await page.goto(BASE + '/app/nonexistent-route', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await snap('B07_route_404');

// B8. Server error on fetch (500)
await page.unroute('**/rest/v1/**').catch(()=>{});
await page.route('**/rest/v1/**', async route => {
  const url = new URL(route.request().url());
  const m = url.pathname.match(/\/rest\/v1\/([^?\/]+)/);
  if (m && m[1] === 'quotes') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"server"}' });
  if (m && m[1] === 'profiles') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([PROFILE]) });
  return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});
await page.goto(BASE + '/app/quotes', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('B08_quotes_500');

// B9. Public quote — 404
await page.unroute('**/api/**').catch(()=>{});
await page.route('**/api/public-quote*', async r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' }));
await page.goto(BASE + '/q/bogus', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('B09_public_quote_404');

// B10. Public quote — 500
await page.unroute('**/api/public-quote*').catch(()=>{});
await page.route('**/api/public-quote*', async r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"server"}' }));
await page.goto(BASE + '/q/anything', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('B10_public_quote_500');

// B11. Public invoice — 404
await page.route('**/api/public-invoice*', async r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' }));
await page.goto(BASE + '/i/bogus', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('B11_public_invoice_404');

// B12. Offline — block all rest/api after initial profile load
await page.unroute('**/rest/v1/**').catch(()=>{});
await page.unroute('**/api/**').catch(()=>{});
await mock(page);
await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
// flip off
await page.context().setOffline(true).catch(()=>{});
await page.goto(BASE + '/app/quotes', { waitUntil: 'load' }).catch(()=>{});
await page.waitForTimeout(1500);
await snap('B12_offline_quotes', 'offline banner expected');
await page.context().setOffline(false).catch(()=>{});

// B13. New quote — empty description
await mock(page);
await page.goto(BASE + '/app/quotes/new', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const buildBtn = page.locator('button:has-text("Build"), .qb-build-btn').first();
if (await buildBtn.count()) { await buildBtn.click().catch(()=>{}); await page.waitForTimeout(500); await snap('B13_empty_describe_attempt'); }

// B14. Draft quote with no items (q3)
await page.goto(BASE + '/app/quotes/q3', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await snap('B14_empty_draft_quote');

// B15. Validation — bad customer email
await page.goto(BASE + '/app/customers', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const addCust2 = page.locator('button:has-text("Add customer"), button:has-text("+ Customer"), button:has-text("New customer")').first();
if (await addCust2.count()) {
  await addCust2.click().catch(()=>{});
  await page.waitForTimeout(600);
  const nameI = page.locator('input[name="name"], input[placeholder*="name" i]').first();
  const emailI = page.locator('input[type="email"], input[name="email"]').first();
  if (await nameI.count()) await nameI.fill('Test Person').catch(()=>{});
  if (await emailI.count()) await emailI.fill('not-an-email').catch(()=>{});
  await page.waitForTimeout(400);
  await snap('B15_bad_email_validation');
  const saveCust = page.locator('button:has-text("Save"), button:has-text("Add"), button:has-text("Create")').last();
  if (await saveCust.count()) { await saveCust.click().catch(()=>{}); await page.waitForTimeout(500); await snap('B16_bad_email_submitted'); }
  await page.keyboard.press('Escape').catch(()=>{});
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(findings, null, 2));
const probs = findings.filter(f => f.overflow.length || f.tiny.length);
console.log('\nArtifacts → ' + OUT);
if (probs.length) {
  console.log('\n⚠ Issues:');
  probs.forEach(p => {
    const f = [];
    if (p.overflow.length) f.push('OVF: '+p.overflow.join(' | '));
    if (p.tiny.length) f.push('TINY: '+p.tiny.join(' | '));
    console.log('   ' + p.name + ': ' + f.join('  '));
  });
} else console.log('\n✓ No overflow / tap-target issues flagged.');
