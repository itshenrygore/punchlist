// ═══════════════════════════════════════════
// PUNCHLIST — Shared API utilities
// _badCols defensive system, error handling, CSV parsing
// ═══════════════════════════════════════════
import Papa from 'papaparse';
import { supabase } from '../supabase';

// ── Friendly error messages — never show raw Supabase errors to users ──
export function friendly(err) {
  const msg = err?.message || String(err || '');
  if (msg.includes('coerce') || msg.includes('single')) return 'Couldn\u2019t find that record — it may have been deleted.';
  if (msg.includes('duplicate key')) return 'That record already exists.';
  if (msg.includes('violates foreign key')) return 'A linked record is missing. Refresh and try again.';
  if (msg.includes('permission denied') || msg.includes('RLS')) return 'You don\u2019t have permission for this action.';
  if (msg.includes('JWT') || msg.includes('token')) return 'Your session expired — sign in again.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Couldn\u2019t reach the server. Check your connection and try again.';
  if (msg.includes('timeout') || msg.includes('abort')) return 'Request timed out. Try again.';
  if (msg.includes('rate limit') || msg.includes('429')) return 'Too many requests in a row. Wait a moment and try again.';
  if (msg.includes('column') && msg.includes('does not exist')) return 'Database update needed. Email hello@punchlist.ca.';
  if (/[_]|SELECT|INSERT|UPDATE|DELETE|FROM|WHERE/i.test(msg)) return 'Something broke on our end. Try again in a moment.';
  if (msg.length < 120 && !/^\{/.test(msg)) return msg;
  return 'Something broke on our end. Try again in a moment.';
}

// ── _badCols defensive system ──
// Tracks columns that Supabase rejects so we can auto-strip them on retry
export const _badCols = new Set();

export function stripBadCols(payload) {
  const clean = { ...payload };
  const PROTECTED = new Set([
    'user_id', 'customer_id', 'title', 'description', 'status', 'total',
    'subtotal', 'tax', 'trade', 'province', 'country', 'expires_at',
    'share_token', 'deposit_required', 'deposit_amount', 'deposit_status',
    'discount', 'updated_at', 'sent_at', 'approved_at',
    'signature_data', 'signed_at', 'signer_name', 'signer_ip', 'archived_at',
    'quote_number', 'photo_url', 'revision_number',
  ]);
  for (const col of _badCols) {
    if (PROTECTED.has(col)) {
      console.warn(`[Punchlist] CRITICAL: "${col}" is being stripped — run lifecycle_migration.sql on your Supabase DB`);
      continue;
    }
    delete clean[col];
  }
  return clean;
}

// Line items bad columns tracking
export let _lineItemsBadCols = new Set();

// Parse Supabase "column not found" errors and learn which columns to skip
export function learnBadColumns(err) {
  if (!err?.message) return false;
  const m = err.message.match(/Could not find the '(\w+)' column of '(\w+)'/);
  if (m) {
    if (m[2] === 'line_items') _lineItemsBadCols.add(m[1]);
    else _badCols.add(m[1]);
    return true;
  }
  const m2 = err.message.match(/column "(\w+)" of relation "(\w+)"/);
  if (m2) {
    if (m2[2] === 'line_items') _lineItemsBadCols.add(m2[1]);
    else _badCols.add(m2[1]);
    return true;
  }
  const m3 = err.message.match(/Could not find the '(\w+)' column/);
  if (m3) { _badCols.add(m3[1]); return true; }
  return false;
}

export function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => resolve(r.data),
      error: reject,
    });
  });
}

export function extractContactName(text) {
  if (!text) return null;
  for (const p of [
    /for\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
    /customer\s*:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/,
    /(?:mrs\.?|mr\.?|ms\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
  ]) {
    const m = String(text).match(p);
    if (m) return m[1].trim();
  }
  return null;
}

// Re-export supabase for convenience in other modules
export { supabase };
