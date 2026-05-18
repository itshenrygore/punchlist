// ═══════════════════════════════════════════
// PUNCHLIST — API Module Index
// Re-exports everything for backwards compatibility.
// All existing `import { ... } from '../lib/api'` paths continue working.
// ═══════════════════════════════════════════
export * from './shared.js';
export * from './profile.js';
export * from './quotes.js';
export * from './customers.js';
export * from './notifications.js';
export * from './checkout.js';
export * from './templates.js';
export * from './invoices.js';

// ── Removed-feature stubs (booking/amendment system cut in 2.0) ──
export async function listBookings() { return []; }
export async function listAdditionalWork() { return []; }
export async function listAmendments() { return []; }
export async function createAdditionalWork() { return null; }
export async function createAmendment() { return null; }
export async function exportInvoicesQuickBooks() { return null; }
export async function exportInvoicesXero() { return null; }
export async function exportAllData() { return null; }
export async function deleteAccount() { return null; }

// ── createInvoiceFromQuoteWithAdditionalWork: legacy name, routes to real impl ──
export { createInvoiceFromQuote as createInvoiceFromQuoteWithAdditionalWork } from './quotes.js';
