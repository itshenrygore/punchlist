// ═══════════════════════════════════════════
// Phase 3.5 Part B — Customer picker plumbing
// Module-level cache + lightweight fuzzy matcher so the customer
// section of the quote builder can render instantly on re-entry
// and search without a network round-trip per keystroke.
//
// Cache is module-scoped so it survives navigating away from and
// back to the builder — the whole point. Call `invalidate()` after
// createCustomer / updateCustomer / mergeCustomers so the next
// mount re-fetches.
// ═══════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import { listCustomers } from '../lib/api/customers.js';

const TTL_MS = 5 * 60 * 1000;
const CACHE = { data: null, fetchedAt: 0, inflight: null };

export function invalidateCustomers() {
  CACHE.data = null;
  CACHE.fetchedAt = 0;
  CACHE.inflight = null;
}

export function useCustomers(userId) {
  const fresh = CACHE.data && Date.now() - CACHE.fetchedAt < TTL_MS;
  const [customers, setCustomers] = useState(fresh ? CACHE.data : []);
  const [loading, setLoading] = useState(!fresh);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Coalesce concurrent mounts (e.g. React StrictMode double-mount)
      if (!CACHE.inflight) {
        CACHE.inflight = listCustomers(userId);
      }
      const data = await CACHE.inflight;
      CACHE.data = data || [];
      CACHE.fetchedAt = Date.now();
      CACHE.inflight = null;
      setCustomers(CACHE.data);
    } catch (err) {
      CACHE.inflight = null;
      setError(err);
      // Leave stale cache in place if we had one — better than empty.
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (fresh) return;
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { customers, loading, error, refetch, invalidate: invalidateCustomers };
}

// ── Fuzzy matcher — no new dependency ──
// Scoring:
//   contains match  → high score, earlier position scores higher
//   subsequence     → lower score based on how many chars matched
//   no match        → 0
// Callers should sort descending and filter score > 0.
export function fuzzyScore(query, candidate) {
  if (!query) return 0;
  const q = String(query).trim().toLowerCase();
  const c = String(candidate || '').toLowerCase();
  if (!q || !c) return 0;

  const idx = c.indexOf(q);
  if (idx !== -1) {
    // Contains match: 1000 base, penalize later positions, bonus for exact match
    return 1000 - idx + (c === q ? 500 : 0);
  }

  // In-order subsequence match (handles typos like "smih" → "Smith" partially —
  // all letters of "smih" appear in "smith" in order)
  let qi = 0, ci = 0, matched = 0;
  while (qi < q.length && ci < c.length) {
    if (q[qi] === c[ci]) { matched++; qi++; }
    ci++;
  }
  return qi === q.length ? matched : 0;
}

// Convenience: rank customers by fuzzy score across name + email + phone.
// Returns up to `limit` customers sorted by best match.
export function searchCustomers(customers, query, limit = 8) {
  if (!query || !query.trim()) return customers.slice(0, limit);
  const scored = [];
  for (const c of customers || []) {
    const name = fuzzyScore(query, c.name);
    const email = fuzzyScore(query, c.email);
    const phone = fuzzyScore(query, (c.phone || '').replace(/\D/g, ''));
    const best = Math.max(name, email, phone);
    if (best > 0) scored.push({ c, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.c);
}
