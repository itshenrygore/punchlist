/* ═══════════════════════════════════════════════════════════
   Punchlist — Financing presentation layer
   Pure display logic — no backend integration yet.

   IMPORTANT: These are ESTIMATES for display purposes only.
   Actual monthly payments are determined by Klarna/Affirm/PayBright
   at checkout based on credit approval, term length, and APR.
   All customer-facing copy must use "as low as" or "from"
   language — never guarantee a specific monthly rate.

   BNPL rates used here are based on typical Canadian/US
   consumer financing programs for home improvement:
   - Affirm: 0–36% APR (commonly 9.99–29.99% for home improvement)
   - Klarna: 0–29.99% APR
   - PayBright (CA): 9.99–29.99% APR
   We use 19.99% APR / 24-month as a realistic mid-range estimate.
   ═══════════════════════════════════════════════════════════ */

/** Minimum quote value to show financing options */
export const FINANCING_THRESHOLD = 500;

/** Default term in months */
export const DEFAULT_TERM_MONTHS = 24;

/**
 * Realistic representative APR for home improvement BNPL.
 * Based on typical Affirm/Klarna/PayBright approved rates.
 * We use 19.99% — common for mid-credit consumers in CA/US.
 */
export const REPRESENTATIVE_APR = 0.1999;

/**
 * Calculate estimated monthly payment using standard amortization.
 * Uses a representative APR to give a realistic (not 0%) estimate.
 * Always prefix with "as low as" since actual rate is set at checkout.
 *
 * @param {number} total - Quote total in dollars
 * @param {number} termMonths - Loan term in months (default 24)
 * @param {number} apr - Annual percentage rate as decimal (default 19.99%)
 */
export function estimateMonthly(total, termMonths = DEFAULT_TERM_MONTHS, apr = REPRESENTATIVE_APR) {
  if (!total || total < FINANCING_THRESHOLD) return null;
  if (apr === 0) return Math.ceil(total / termMonths);
  const r = apr / 12; // monthly rate
  const payment = total * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
  return Math.ceil(payment);
}

/**
 * Get monthly payment for a specific term + APR scenario.
 * Used to show multiple term options to the customer.
 */
export function getMonthlyOptions(total) {
  if (!total || total < FINANCING_THRESHOLD) return [];
  return [
    { term: 12, apr: 0.0999,  label: '12 mo', monthly: estimateMonthly(total, 12, 0.0999) },
    { term: 24, apr: 0.1999,  label: '24 mo', monthly: estimateMonthly(total, 24, 0.1999) },
    { term: 36, apr: 0.2499,  label: '36 mo', monthly: estimateMonthly(total, 36, 0.2499) },
  ].filter(o => o.monthly !== null);
}

/** Should we show financing presentation for this amount? */
export function showFinancing(total) {
  return total >= FINANCING_THRESHOLD;
}

/**
 * Get the financing messaging copy for different contexts.
 * RULE: Never promise a specific rate. Always use "as low as" / "from"
 * because the actual APR (0%–36%) is determined at checkout.
 */
export function getFinancingCopy(context = 'builder') {
  const copy = {
    builder: {
      label: 'as low as',
      hint: 'Shown to your customer · Final rate set at checkout',
      badge: 'Pay-over-time available',
      disclaimer: 'Est. 19.99% APR, 24 mo. Subject to approval.',
    },
    review: {
      label: 'as low as',
      hint: 'Customers choose monthly payments · Rate set by lender at checkout',
      badge: 'Monthly payment option shown',
      disclaimer: 'Est. 19.99% APR, 24 mo. Subject to approval.',
    },
    public: {
      label: 'from',
      hint: 'Subject to credit approval · Rate set at checkout',
      badge: 'Monthly payments available',
      cta: 'Flexible payment options available at checkout',
      disclaimer: 'Est. 19.99% APR, 24 mo. OAC. Rate determined at checkout.',
    },
    sticky: {
      label: 'from',
      suffix: '/mo',
      disclaimer: 'Est. 19.99% APR, 24 mo. OAC.',
    },
  };
  return copy[context] || copy.builder;
}
