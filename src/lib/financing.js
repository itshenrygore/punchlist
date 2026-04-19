/* ═══════════════════════════════════════════════════════════
   Punchlist — Financing presentation layer
   Pure display logic — no backend integration yet.
   
   IMPORTANT: These are ESTIMATES for display purposes only.
   Actual monthly payments are determined by Klarna/Affirm at
   checkout based on credit approval, term length, and APR.
   All customer-facing copy must use "as low as" or "from"
   language — never guarantee a specific monthly rate.
   ═══════════════════════════════════════════════════════════ */

/** Minimum quote value to show financing options */
export const FINANCING_THRESHOLD = 500;

/** Estimated term in months — 12mo is the most common Affirm/Klarna max */
export const DEFAULT_TERM_MONTHS = 12;

/**
 * Calculate estimated monthly payment for display purposes.
 * Uses simple division (0% APR floor) — actual rate is set by
 * Klarna/Affirm at checkout. This gives the lowest possible
 * monthly figure, which is why we always prefix with "as low as."
 */
export function estimateMonthly(total, termMonths = DEFAULT_TERM_MONTHS) {
  if (!total || total < FINANCING_THRESHOLD) return null;
  return Math.ceil(total / termMonths);
}

/** Should we show financing presentation for this amount? */
export function showFinancing(total) {
  return total >= FINANCING_THRESHOLD;
}

/**
 * Get the financing messaging copy for different contexts.
 * Centralised here so copy stays consistent across all surfaces.
 * 
 * RULE: Never promise a specific rate. Always use "as low as" / "from"
 * because the actual APR (0%–36%) is determined at checkout.
 */
export function getFinancingCopy(context = 'builder') {
  const copy = {
    // Contractor sees this in the quote builder sidebar
    builder: {
      label: 'as low as',
      hint: 'Shown to your customer · Final rate set at checkout',
      badge: 'Pay-over-time available',
    },
    // Contractor sees this in the review/edit view
    review: {
      label: 'as low as',
      hint: 'Customers choose monthly payments · Rate set by Klarna/Affirm',
      badge: 'Monthly payment option shown',
    },
    // Customer sees this on the public quote page
    public: {
      label: 'or as low as',
      hint: 'Subject to approval · Rate determined at checkout',
      badge: 'Monthly payments',
      cta: 'Flexible payment options available at checkout',
    },
    // Sticky bar on public quote (mobile)
    sticky: {
      label: 'from',
      suffix: '/mo',
    },
  };
  return copy[context] || copy.builder;
}
