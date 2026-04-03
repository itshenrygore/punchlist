/**
 * billing.js — Centralized billing config for Punchlist.
 *
 * Wraps all Stripe env vars and plan definitions in one place.
 * UI components read from here — never hardcode price IDs or plan limits.
 *
 * Env vars consumed (all existing, NOT renamed):
 *   Client: VITE_STRIPE_PUBLISHABLE_KEY, VITE_STRIPE_MONTHLY_PRICE_ID, VITE_STRIPE_YEARLY_PRICE_ID
 *   Server: STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 */

// ── Canonical pricing — single source of truth (must match Stripe) ──
export const PRICING = {
  monthly: 29,
  annual: 249,
  annualMonthly: 20.75,  // 249/12 rounded
  annualSavings: 99,     // (29*12) - 249
  currency: 'CAD',
  freeQuotes: 5,
};

// ── Plan definitions ──
export const PLANS = {
  free: {
    key: 'free',
    name: 'Free',
    price: 0,
    period: '',
    quotesPerMonth: 5,
    tagline: 'Try it out',
    features: [
      'Up to 5 quotes per month',
      'AI-powered scope builder',
      'Professional quote links',
      'Customer approval flow',
      'Works on phone, tablet, desktop',
    ],
    excluded: [
      'Unlimited quotes',
      'Quote activity tracking',
      'Follow-up reminders',
      'Deposit collection',
      'Scheduling & booking',
      'Invoicing & payments',
      'Additional work requests',
      'Analytics dashboard',
    ],
  },
  pro_monthly: {
    key: 'pro_monthly',
    name: 'Pro',
    price: 29,
    period: '/mo',
    priceKey: 'monthly',        // maps to create-checkout-session priceKey
    quotesPerMonth: Infinity,
    tagline: 'Most popular',
    badge: 'Most Popular',
    features: [
      'Unlimited quotes',
      'AI-powered scope builder',
      'Professional quote links',
      'Customer approval flow',
      'Quote activity tracking',
      'Follow-up reminders',
      'Deposit collection',
      'Scheduling & booking',
      'Invoicing & payments',
      'Additional work requests',
      'Analytics dashboard',
      'Works on phone, tablet, desktop',
    ],
    excluded: [],
  },
  pro_annual: {
    key: 'pro_annual',
    name: 'Annual',
    price: PRICING.annual,
    period: '/yr',
    monthlyEquiv: PRICING.annualMonthly,
    savingsAmount: PRICING.annualSavings,
    priceKey: 'yearly',         // maps to create-checkout-session priceKey
    quotesPerMonth: Infinity,
    tagline: 'Best value',
    badge: `Save $${PRICING.annualSavings}`,
    features: [
      'Everything in Pro',
      `Annual savings — $${PRICING.annualMonthly}/mo`,
      'Priority support',
      'Early access to new features',
    ],
    excluded: [],
  },
};

// Feature comparison for pricing page
export const FEATURE_COMPARISON = [
  { feature: 'Quotes per month',        free: '5',    pro: 'Unlimited' },
  { feature: 'AI scope builder',         free: true,   pro: true },
  { feature: 'Professional quote links', free: true,   pro: true },
  { feature: 'Customer approval',        free: true,   pro: true },
  { feature: 'Quote activity tracking',  free: false,  pro: true },
  { feature: 'Follow-up reminders',      free: false,  pro: true },
  { feature: 'Deposit collection',       free: false,  pro: true },
  { feature: 'Scheduling & booking',     free: false,  pro: true },
  { feature: 'Invoicing & payments',     free: false,  pro: true },
  { feature: 'Additional work requests', free: false,  pro: true },
  { feature: 'Analytics dashboard',      free: false,  pro: true },
];

// FAQ entries
export const FAQ = [
  {
    q: 'Do I need a credit card to start?',
    a: 'No. The free plan requires no credit card. You can create up to 5 quotes per month at no cost, no strings attached.',
  },
  {
    q: 'What happens when I hit the free limit?',
    a: 'You can still view and manage your existing quotes. To send new quotes, you can upgrade to Pro or wait for your limit to reset at the start of next month.',
  },
  {
    q: 'Can I switch from monthly to annual later?',
    a: 'Yes. You can switch to annual billing anytime from your billing page. You\'ll get credit for any unused time on your monthly plan.',
  },
  {
    q: 'Is this for one trade or can I use it for multiple?',
    a: 'Punchlist works for any trade — plumbing, electrical, HVAC, general contracting, landscaping, you name it. The AI scope builder has templates for 25+ job types.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your billing page anytime. You keep access through the end of your billing period.',
  },
];

// ── Free limit helpers ──
export const FREE_QUOTE_LIMIT = 5;

/**
 * Count quotes sent this calendar month.
 * Expects array of quote objects with status and updated_at/created_at.
 */
export function countSentThisMonth(quotes) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return (quotes || []).filter(q => {
    // Only count quotes that were actually sent (not just any non-draft status)
    if (q.status === 'draft') return false;
    // Prefer sent_at (the actual send timestamp) — fall back to created_at for old quotes
    // Never use updated_at as it changes on every edit/view
    const ts = q.sent_at || q.created_at;
    if (!ts) return false;
    return new Date(ts).getTime() >= monthStart;
  }).length;
}

/**
 * Is this user on a paid plan?
 * Reads from profile.subscription_plan — falls back to 'free'.
 */
export function isPro(profile) {
  const plan = profile?.subscription_plan || 'free';
  return plan === 'pro' || plan === 'pro_monthly' || plan === 'pro_annual' || plan === 'yearly' || plan === 'monthly';
}

/**
 * Can the user send another quote?
 */
export function canSendQuote(profile, sentThisMonth) {
  if (isPro(profile)) return true;
  return sentThisMonth < FREE_QUOTE_LIMIT;
}

/**
 * Get usage info for display.
 */
export function getUsageInfo(profile, sentThisMonth) {
  const pro = isPro(profile);
  return {
    isPro: pro,
    sent: sentThisMonth,
    limit: pro ? Infinity : FREE_QUOTE_LIMIT,
    remaining: pro ? Infinity : Math.max(0, FREE_QUOTE_LIMIT - sentThisMonth),
    atLimit: !pro && sentThisMonth >= FREE_QUOTE_LIMIT,
    nearLimit: !pro && sentThisMonth >= (FREE_QUOTE_LIMIT - 2) && sentThisMonth < FREE_QUOTE_LIMIT,
  };
}

// ── Pro-only feature gate ──
export const PRO_FEATURES = new Set([
  'deposits', 'scheduling', 'invoicing', 'additional_work',
  'analytics', 'follow_ups', 'activity_tracking',
]);

export function isProFeature(featureKey) {
  return PRO_FEATURES.has(featureKey);
}
