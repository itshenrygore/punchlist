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

// ═══════════════════════════════════════════
// 2.0 STUBS — Dead functions that existing pages still reference.
// Return empty data so the app doesn't crash during transition.
// These will be cleaned up as each page is refactored.
// ═══════════════════════════════════════════
export async function listBookings() { return []; }
export async function listInvoices() { return []; }
export async function listAdditionalWork() { return []; }
export async function listAmendments() { return []; }
export async function createInvoiceFromQuoteWithAdditionalWork() { return null; }
export async function exportInvoicesQuickBooks() { return null; }
export async function exportInvoicesXero() { return null; }
export async function createAdditionalWork() { return null; }
export async function createAmendment() { return null; }
export async function listQuotePhotos() { return []; }
export async function deleteQuotePhoto() { return null; }
export async function uploadQuotePhoto() { return null; }
export async function replyToCustomer() { return null; }
export async function sendInvoiceEmail() { return null; }
export async function markFollowedUp() { return null; }
