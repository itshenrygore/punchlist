/**
 * PDF Export — Serverless Puppeteer
 * GET /api/export-pdf?token=<share_token>          → Quote PDF
 * GET /api/export-pdf?invoice_token=<share_token>  → Invoice PDF  (6A)
 *
 * Dependencies are in api/package.json (isolated from Vite build):
 *   @sparticuz/chromium ^133.0.0
 *   puppeteer-core      ^24.0.0
 *
 * Vercel config (vercel.json): maxDuration: 30, memory: 1024
 *
 * Phase 6A — Invoice PDF support
 * Phase 6B — System font stack (replaces unreliable Google Fonts @import);
 *             document.fonts.ready guard before pdf() call
 * Phase 6C — Approved amendments reflected in quote PDF
 */

import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function fmtCurrency(n, country = 'CA') {
  const num = Number(n || 0);
  if (country === 'US') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  }
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(num);
}

function fmtDate(iso, country = 'CA') {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(country === 'US' ? 'en-US' : 'en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────
// 6B: Removed Google Fonts @import. System font stack is guaranteed available
//     in any Puppeteer environment — no network dependency, no fallback risk.
const SHARED_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  color: #18181b;
  font-size: 11px;
  line-height: 1.5;
  padding: 36px 44px;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 20px;
  border-bottom: 1px solid #e4e4e7;
  margin-bottom: 24px;
}

.brand { display: flex; flex-direction: column; gap: 2px; }
.logo { max-height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 8px; }
.company { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: #18181b; }
.contractor-name { font-size: 12px; color: #71717a; margin-top: 2px; }
.contact { font-size: 11px; color: #71717a; margin-top: 4px; }
.contact a { color: #ea580c; text-decoration: none; }

.doc-meta { text-align: right; }
.doc-type { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #ea580c; margin-bottom: 4px; }
.doc-date { font-size: 11px; color: #71717a; }
.doc-number { font-size: 11px; color: #71717a; margin-top: 2px; }

.hero {
  padding: 20px 0;
  border-bottom: 1px solid #e4e4e7;
  margin-bottom: 20px;
}

.title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #18181b;
  margin-bottom: 8px;
}

.customer { font-size: 13px; color: #3f3f46; }
.customer strong { color: #18181b; font-weight: 600; }
.address { font-size: 12px; color: #71717a; margin-top: 4px; }

.meta-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f4f4f5;
}

.meta-item {}
.meta-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; margin-bottom: 3px; }
.meta-value { font-size: 12px; font-weight: 600; color: #18181b; }

.revision {
  background: #fff7ed;
  border: 1px solid rgba(234, 88, 12, 0.15);
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 20px;
  font-size: 11px;
  color: #ea580c;
}
.revision strong { font-weight: 700; }

.section {
  padding: 16px 0;
  border-bottom: 1px solid #e4e4e7;
}
.section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #71717a;
  margin-bottom: 10px;
}
.section-body {
  font-size: 12px;
  line-height: 1.65;
  color: #3f3f46;
}

.items { padding: 16px 0; }

.group-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #71717a;
  padding: 12px 0 6px;
  border-top: 1px solid #f4f4f5;
  margin-top: 8px;
}
.group-label:first-child { border-top: none; margin-top: 0; padding-top: 0; }
.group-label.optional { color: #ea580c; }

.item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid #f4f4f5;
}
.item:last-child { border-bottom: none; }
.item.optional { opacity: 0.75; }
.item.optional .item-name { font-style: italic; }

.item-left { flex: 1; min-width: 0; }
.item-name { font-size: 12px; font-weight: 600; color: #18181b; line-height: 1.35; }
.item-note { font-size: 10px; color: #71717a; margin-top: 2px; line-height: 1.4; }
.item-qty { font-size: 10px; color: #71717a; margin-top: 2px; }
.item-price { font-size: 12px; font-weight: 700; color: #18181b; white-space: nowrap; }

.totals {
  padding: 20px;
  background: #f4f4f5;
  border-radius: 8px;
  margin: 20px 0;
}

.totals-inner { max-width: 280px; margin-left: auto; }

.total-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 12px;
  color: #3f3f46;
}
.total-row span:first-child { color: #71717a; }
.total-row strong { font-weight: 600; color: #18181b; }

.total-row.discount { color: #16a34a; }
.total-row.discount span:first-child { color: #16a34a; }

.total-row.grand {
  font-size: 16px;
  font-weight: 800;
  padding-top: 12px;
  margin-top: 8px;
  border-top: 2px solid #ea580c;
  color: #18181b;
}
.total-row.grand span:first-child { color: #18181b; }
.total-row.grand strong { color: #ea580c; letter-spacing: -0.02em; }

.total-row.deposit {
  font-size: 11px;
  padding-top: 10px;
  margin-top: 8px;
  border-top: 1px dashed #e4e4e7;
  color: #ea580c;
}
.total-row.deposit span:first-child { color: #ea580c; }

.total-row.balance-due {
  font-size: 14px;
  font-weight: 800;
  padding-top: 12px;
  margin-top: 8px;
  border-top: 2px solid #ea580c;
  color: #18181b;
}
.total-row.balance-due span:first-child { color: #18181b; }
.total-row.balance-due strong { color: #ea580c; letter-spacing: -0.02em; }

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 20px 0;
}

.info-block {
  background: #f4f4f5;
  border-radius: 6px;
  padding: 12px 14px;
}
.info-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #71717a;
  margin-bottom: 6px;
}
.info-body {
  font-size: 11px;
  line-height: 1.55;
  color: #3f3f46;
}

.payment-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.payment-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  background: #fff;
  border: 1px solid #e4e4e7;
  color: #3f3f46;
}

.signature {
  display: flex;
  gap: 32px;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid #e4e4e7;
}
.sig-box { flex: 1; }
.sig-line { border-bottom: 1px solid #18181b; height: 36px; margin-bottom: 4px; }
.sig-label { font-size: 9px; color: #71717a; }

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 28px;
  padding-top: 14px;
  border-top: 1px solid #e4e4e7;
  font-size: 9px;
  color: #a1a1aa;
}

.punchlist-brand {
  display: flex;
  align-items: center;
  gap: 6px;
}
.brand-bar { width: 4px; height: 16px; background: #ea580c; border-radius: 2px; }
.brand-text { font-weight: 700; color: #18181b; letter-spacing: -0.5px; }

/* ─── Paid stamp (6A) ─── */
.paid-stamp {
  display: inline-block;
  border: 3px solid #16a34a;
  border-radius: 6px;
  padding: 6px 18px;
  color: #16a34a;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.85;
  margin: 20px 0 4px;
  transform: rotate(-2deg);
}
.paid-stamp-date {
  font-size: 11px;
  color: #16a34a;
  margin-top: 4px;
  font-weight: 600;
}

/* ─── Amendment note (6C) ─── */
.amendment-note {
  font-size: 10px;
  color: #71717a;
  font-style: italic;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px dashed #e4e4e7;
}
.subtotal-row {
  font-size: 11px;
  color: #667085;
  text-align: right;
  padding: 4px 0;
}
`;

// ─── Quote PDF HTML builder ───────────────────────────────────────────────────
// 6C: Added `amendments` second parameter
function buildHTML(q, amendments = []) {
  const country = q.country || 'CA';
  const currency = (n) => fmtCurrency(n, country);

  const included = (q.line_items || [])
    .filter(i => i.included !== false)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const optional = (q.line_items || [])
    .filter(i => i.included === false);

  const grouped = included.reduce((acc, item) => {
    const key = item.category || 'Scope';
    (acc[key] ||= []).push(item);
    return acc;
  }, {});

  const groupOrder = ['Labour', 'Materials', 'Services'];
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    const ai = groupOrder.indexOf(a);
    const bi = groupOrder.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
  const showGroupHeaders = sortedGroups.length > 1;

  const discount = Number(q.discount || 0);
  const hasDiscount = discount > 0;

  const itemRows = sortedGroups.map(([group, items]) => `
    ${showGroupHeaders ? `<div class="group-label">${group}</div>` : ''}
    ${items.map(i => `
      <div class="item">
        <div class="item-left">
          <div class="item-name">${i.name}</div>
          ${i.notes ? `<div class="item-note">${i.notes}</div>` : ''}
          ${Number(i.quantity) > 1 ? `<div class="item-qty">${i.quantity} × ${currency(i.unit_price)}</div>` : ''}
        </div>
        <div class="item-price">${currency(Number(i.quantity || 1) * Number(i.unit_price || 0))}</div>
      </div>`).join('')}
  `).join('');

  const optRows = optional.length ? `
    <div class="group-label optional">Optional Add-ons</div>
    ${optional.map(i => `
      <div class="item optional">
        <div class="item-left">
          <div class="item-name">${i.name}</div>
          ${i.notes ? `<div class="item-note">${i.notes}</div>` : ''}
        </div>
        <div class="item-price">${currency(i.unit_price)}</div>
      </div>`).join('')}
  ` : '';

  // 6C: Render approved amendments after base line items
  const approvedAmendments = amendments.filter(
    a => a.status === 'approved' && Array.isArray(a.items) && a.items.length > 0
  );

  const amendmentRows = approvedAmendments.map(amendment => `
    <div class="group-label" style="color:#2563eb;margin-top:16px;">Amendment: ${amendment.title}</div>
    ${amendment.items.map(i => `
      <div class="item">
        <div class="item-left">
          <div class="item-name">${i.name}</div>
          ${i.notes ? `<div class="item-note">${i.notes}</div>` : ''}
          ${Number(i.quantity) > 1 ? `<div class="item-qty">${i.quantity} × ${currency(i.unit_price)}</div>` : ''}
        </div>
        <div class="item-price">${currency(Number(i.quantity || 1) * Number(i.unit_price || 0))}</div>
      </div>
    `).join('')}
    <div class="subtotal-row">Amendment subtotal: ${currency(amendment.total)}</div>
  `).join('');

  const amendmentNote = approvedAmendments.length > 0
    ? `<div class="amendment-note">Includes ${approvedAmendments.length} approved amendment${approvedAmendments.length > 1 ? 's' : ''}.</div>`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<style>${SHARED_CSS}</style></head><body>

<div class="header">
  <div class="brand">
    ${q.contractor_logo ? `<img src="${q.contractor_logo}" alt="" class="logo">` : ''}
    <div class="company">${q.contractor_company || q.contractor_name || 'Your Contractor'}</div>
    ${q.contractor_name && q.contractor_name !== q.contractor_company ? `<div class="contractor-name">${q.contractor_name}</div>` : ''}
    <div class="contact">
      ${q.contractor_phone ? `<span>${q.contractor_phone}</span>` : ''}
      ${q.contractor_email ? `${q.contractor_phone ? ' · ' : ''}<a href="mailto:${q.contractor_email}">${q.contractor_email}</a>` : ''}
    </div>
  </div>
  <div class="doc-meta">
    <div class="doc-type">Quote</div>
    <div class="doc-date">${fmtDate(q.created_at, country)}</div>
    ${(q.revision_number || 1) > 1 ? `<div class="doc-number">Revision ${q.revision_number}</div>` : ''}
  </div>
</div>

<div class="hero">
  <div class="title">${q.title || 'Work Quote'}</div>
  <div class="customer">Prepared for <strong>${q.customer_name || 'Customer'}</strong></div>
  ${q.customer_address ? `<div class="address">${q.customer_address}</div>` : ''}

  <div class="meta-grid">
    <div class="meta-item">
      <div class="meta-label">Quote Date</div>
      <div class="meta-value">${fmtDate(q.created_at, country)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Valid Until</div>
      <div class="meta-value">${q.expires_at ? fmtDate(q.expires_at, country) : 'No expiry'}</div>
    </div>
    ${q.trade ? `
    <div class="meta-item">
      <div class="meta-label">Trade</div>
      <div class="meta-value">${q.trade}</div>
    </div>` : ''}
  </div>
</div>

${q.revision_summary ? `<div class="revision"><strong>Updated:</strong> ${q.revision_summary}</div>` : ''}

${q.scope_summary ? `
<div class="section">
  <div class="section-title">Scope of Work</div>
  <div class="section-body">${q.scope_summary}</div>
</div>` : ''}

<div class="items">
  <div class="section-title">Work Breakdown</div>
  ${itemRows}
  ${amendmentRows}
  ${optRows}
  ${amendmentNote}
</div>

<div class="totals">
  <div class="totals-inner">
    <div class="total-row"><span>Subtotal</span><strong>${currency(q.subtotal || q.total)}</strong></div>
    ${hasDiscount ? `<div class="total-row discount"><span>Discount</span><strong>−${currency(discount)}</strong></div>` : ''}
    ${Number(q.tax) > 0 ? `<div class="total-row"><span>Tax</span><strong>${currency(q.tax)}</strong></div>` : ''}
    <div class="total-row grand"><span>Total</span><strong>${currency(q.total)}</strong></div>
    ${q.deposit_required && Number(q.deposit_amount) > 0 ? `<div class="total-row deposit"><span>Deposit to confirm</span><strong>${currency(q.deposit_amount)}</strong></div>` : ''}
  </div>
</div>

${(q.assumptions || q.exclusions || q.contractor_payment_methods?.length || q.contractor_payment_instructions) ? `
<div class="info-grid">
  ${q.assumptions ? `
  <div class="info-block">
    <div class="info-label">What this price assumes</div>
    <div class="info-body">${q.assumptions}</div>
  </div>` : ''}
  ${q.exclusions ? `
  <div class="info-block">
    <div class="info-label">Not included</div>
    <div class="info-body">${q.exclusions}</div>
  </div>` : ''}
  ${(q.contractor_payment_methods?.length || q.contractor_payment_instructions) ? `
  <div class="info-block">
    <div class="info-label">Payment</div>
    <div class="info-body">
      ${q.contractor_payment_instructions || ''}
      ${q.contractor_payment_methods?.length ? `
      <div class="payment-tags">
        ${q.contractor_payment_methods.map(m => `<span class="payment-tag">${m}</span>`).join('')}
      </div>` : ''}
      ${q.contractor_etransfer_email ? `<div style="margin-top:6px">E-Transfer: ${q.contractor_etransfer_email}</div>` : ''}
    </div>
  </div>` : ''}
</div>` : ''}

<div class="signature">
  <div class="sig-box">
    <div class="sig-line"></div>
    <div class="sig-label">Customer signature / date</div>
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <div class="sig-label">Contractor signature / date</div>
  </div>
</div>

<div class="footer">
  <div class="punchlist-brand">
    <div class="brand-bar"></div>
    <span class="brand-text">punchlist</span>
    <span style="margin-left:4px">· punchlist.ca</span>
  </div>
  <span>${q.title || 'Quote'} · ${fmtDate(new Date().toISOString(), country)}</span>
</div>

</body></html>`;
}

// ─── Invoice PDF HTML builder (6A) ───────────────────────────────────────────
function buildInvoiceHTML(inv, contractor, payments) {
  const country = contractor?.country || inv.country || 'CA';
  const currency = (n) => fmtCurrency(n, country);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const depositCredited = Number(inv.deposit_credited || 0);
  const balance = Math.max(0, Number(inv.total || 0) - depositCredited - totalPaid);
  const isPaid = inv.status === 'paid';

  const items = [...(inv.invoice_items || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const grouped = items.reduce((acc, item) => {
    const key = item.category || 'Work';
    (acc[key] ||= []).push(item);
    return acc;
  }, {});

  const sortedGroupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === 'Additional Work') return 1;
    if (b === 'Additional Work') return -1;
    return a.localeCompare(b);
  });
  const showGroupHeaders = sortedGroupKeys.length > 1;

  const itemRows = sortedGroupKeys.map(group => {
    const groupItems = grouped[group];
    return `
      ${showGroupHeaders ? `<div class="group-label">${group}</div>` : ''}
      ${groupItems.map(i => `
        <div class="item">
          <div class="item-left">
            <div class="item-name">${i.name}</div>
            ${i.notes ? `<div class="item-note">${i.notes}</div>` : ''}
            ${Number(i.quantity) > 1 ? `<div class="item-qty">${i.quantity} × ${currency(i.unit_price)}</div>` : ''}
          </div>
          <div class="item-price">${currency(Number(i.quantity || 1) * Number(i.unit_price || 0))}</div>
        </div>`).join('')}
    `;
  }).join('');

  const contractorName = contractor?.full_name || '';
  const contractorCompany = contractor?.company_name || '';
  const contractorPhone = contractor?.phone || '';
  const contractorEmail = contractor?.email || '';
  const contractorLogo = contractor?.logo_url || null;

  const paidStamp = isPaid ? `
    <div style="text-align:center;padding:16px 0;">
      <div class="paid-stamp">PAID</div>
      ${inv.paid_at ? `<div class="paid-stamp-date">${fmtDate(inv.paid_at, country)}</div>` : ''}
    </div>
  ` : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<style>${SHARED_CSS}</style></head><body>

<div class="header">
  <div class="brand">
    ${contractorLogo ? `<img src="${contractorLogo}" alt="" class="logo">` : ''}
    <div class="company">${contractorCompany || contractorName || 'Your Contractor'}</div>
    ${contractorName && contractorName !== contractorCompany ? `<div class="contractor-name">${contractorName}</div>` : ''}
    <div class="contact">
      ${contractorPhone ? `<span>${contractorPhone}</span>` : ''}
      ${contractorEmail ? `${contractorPhone ? ' · ' : ''}<a href="mailto:${contractorEmail}">${contractorEmail}</a>` : ''}
    </div>
  </div>
  <div class="doc-meta">
    <div class="doc-type">Invoice</div>
    ${inv.invoice_number ? `<div class="doc-number">${inv.invoice_number}</div>` : ''}
    <div class="doc-date">${fmtDate(inv.issued_at, country)}</div>
    ${inv.due_at ? `<div class="doc-number">Due: ${fmtDate(inv.due_at, country)}</div>` : ''}
  </div>
</div>

<div class="hero">
  <div class="title">${inv.title || inv.invoice_number || 'Invoice'}</div>
  <div class="customer">Bill to <strong>${inv.customer?.name || 'Customer'}</strong></div>
  ${inv.customer?.address ? `<div class="address">${inv.customer.address}</div>` : ''}

  <div class="meta-grid">
    <div class="meta-item">
      <div class="meta-label">Invoice Date</div>
      <div class="meta-value">${fmtDate(inv.issued_at, country)}</div>
    </div>
    ${inv.due_at ? `
    <div class="meta-item">
      <div class="meta-label">Due Date</div>
      <div class="meta-value">${fmtDate(inv.due_at, country)}</div>
    </div>` : ''}
    <div class="meta-item">
      <div class="meta-label">Status</div>
      <div class="meta-value" style="${isPaid ? 'color:#16a34a;' : ''}">${isPaid ? 'Paid' : 'Unpaid'}</div>
    </div>
  </div>
</div>

<div class="items">
  <div class="section-title">Invoice Items</div>
  ${itemRows}
</div>

<div class="totals">
  <div class="totals-inner">
    <div class="total-row"><span>Subtotal</span><strong>${currency(inv.subtotal || inv.total)}</strong></div>
    ${Number(inv.tax) > 0 ? `<div class="total-row"><span>Tax</span><strong>${currency(inv.tax)}</strong></div>` : ''}
    <div class="total-row grand"><span>Total</span><strong>${currency(inv.total)}</strong></div>
    ${depositCredited > 0 ? `<div class="total-row" style="color:#16a34a;"><span>Deposit credited</span><strong>−${currency(depositCredited)}</strong></div>` : ''}
    ${payments.map(p => `
      <div class="total-row" style="color:#16a34a;font-size:11px;">
        <span>${p.method ? `Payment (${p.method})` : 'Payment'} · ${fmtDate(p.paid_at || p.created_at, country)}</span>
        <strong>−${currency(p.amount)}</strong>
      </div>
    `).join('')}
    <div class="total-row balance-due">
      <span>Balance Due</span>
      <strong>${currency(balance)}</strong>
    </div>
  </div>
</div>

${paidStamp}

${inv.notes ? `
<div class="section">
  <div class="section-title">Notes</div>
  <div class="section-body">${inv.notes}</div>
</div>` : ''}

<div class="footer">
  <div class="punchlist-brand">
    <div class="brand-bar"></div>
    <span class="brand-text">punchlist</span>
    <span style="margin-left:4px">· punchlist.ca</span>
  </div>
  <span>Invoice ${inv.invoice_number || ''} · ${fmtDate(new Date().toISOString(), country)}</span>
</div>

</body></html>`;
}

// ─── Shared Puppeteer PDF renderer ───────────────────────────────────────────
async function renderPDF(html) {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
    import('@sparticuz/chromium'),
    import('puppeteer-core'),
  ]);

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // 6B: Ensure fonts are ready before capturing the PDF
    await page.evaluateHandle('document.fonts.ready');

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return pdf;
  } finally {
    await browser.close().catch(() => {});
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (blocked(res, `pdf:${getClientIp(req)}`, 15, 60_000)) return;

  const supabase = getSupabase();
  if (!supabase) {
    console.error('[export-pdf] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'Database not configured' });
  }

  // ── 6A: Invoice PDF branch ──────────────────────────────────────────────────
  const invoiceToken = req.query.invoice_token;
  if (invoiceToken) {
    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*, customer:customers(*), invoice_items(*)')
        .eq('share_token', invoiceToken)
        .maybeSingle();

      if (invoiceError || !invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      let contractor = null;
      if (invoice.user_id) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', invoice.user_id).maybeSingle();
        contractor = p;
      }

      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: true });

      const html = buildInvoiceHTML(invoice, contractor, payments || []);
      const pdf = await renderPDF(html);

      const filename = `invoice-${(invoice.invoice_number || invoice.id || 'invoice').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).send(pdf);

    } catch (err) {
      console.error('export-pdf invoice error:', err?.message);
      return res.status(500).json({ error: 'PDF generation failed', fallback: true });
    }
  }

  // ── Quote PDF branch ────────────────────────────────────────────────────────
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  try {
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*, customer:customers(*), line_items(*)')
      .eq('share_token', token)
      .maybeSingle();

    if (error || !quote) return res.status(404).json({ error: 'Quote not found' });

    let contractor = null;
    if (quote.user_id) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', quote.user_id).maybeSingle();
      contractor = p;
    }

    // 6C: Fetch approved amendments for this quote
    const { data: amendments } = await supabase
      .from('amendments')
      .select('*')
      .eq('quote_id', quote.id)
      .eq('status', 'approved');

    const enriched = {
      ...quote,
      customer_name: quote.customer?.name,
      customer_address: quote.customer?.address || '',
      contractor_name: contractor?.full_name,
      contractor_company: contractor?.company_name,
      contractor_phone: contractor?.phone,
      contractor_email: contractor?.email,
      contractor_logo: contractor?.logo_url || null,
      contractor_payment_methods: contractor?.payment_methods || [],
      contractor_payment_instructions: contractor?.payment_instructions || '',
      contractor_etransfer_email: contractor?.etransfer_email || '',
    };

    // 6C: Pass amendments into buildHTML
    const html = buildHTML(enriched, amendments || []);
    const pdf = await renderPDF(html);

    const filename = `${(quote.title || 'quote').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(pdf);

  } catch (err) {
    console.error('export-pdf error:', err?.message);
    return res.status(500).json({ error: 'PDF generation failed', fallback: true });
  }
}
