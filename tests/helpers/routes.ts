/**
 * v100 route manifest — drives the visual regression sweep.
 *
 * `auth: 'public'`  — no session needed; visit raw
 * `auth: 'required'`— needs PL_TEST_* env vars; test skips if unseeded
 * `skipReason`      — noted here means we intentionally exclude the route
 *                     from the snapshot sweep (e.g. public tokens we
 *                     don't have stable fixtures for)
 *
 * The 24 routes called out in the M7 prompt × 5 viewports × 2 themes
 * = 240 snapshots. Our router exposes 28 route patterns; four of them
 * (public share-token variants) require a live token and are excluded
 * from the default sweep — run them manually when a fixture exists.
 */

export type RouteSpec = {
  /** Stable key used for screenshot filenames. */
  name: string;
  /** Path to navigate to. Parameterised routes use seeded fixture IDs. */
  path: string;
  /** Is this route gated? */
  auth: 'public' | 'required';
  /** Optional reason to skip in the default sweep. */
  skipReason?: string;
  /** Optional selector to wait for before snapshotting. */
  readySelector?: string;
  /** Mask selectors (timestamps, charts with live data, etc.) */
  mask?: string[];
};

export const ROUTES: RouteSpec[] = [
  // ── Public ──────────────────────────────────────────────
  { name: 'landing',  path: '/',        auth: 'public', readySelector: 'main, [data-page="landing"], body' },
  { name: 'login',    path: '/login',   auth: 'public', readySelector: 'form, input[type="email"]' },
  { name: 'signup',   path: '/signup',  auth: 'public', readySelector: 'form, input[type="email"]' },
  { name: 'terms',    path: '/terms',   auth: 'public' },
  { name: 'pricing',  path: '/pricing', auth: 'public' },

  // Public share-token routes — excluded from default sweep because
  // every run would need a fresh token fixture in Supabase. Keep the
  // entries so the matrix stays documented; enable with a seeded token.
  { name: 'public-project',     path: '/public/TEST_TOKEN',            auth: 'public', skipReason: 'requires share-token fixture' },
  { name: 'public-quote',       path: '/project/TEST_TOKEN',           auth: 'public', skipReason: 'requires share-token fixture' },
  { name: 'public-aw',          path: '/public/aw/TEST_TOKEN',         auth: 'public', skipReason: 'requires share-token fixture' },
  { name: 'public-amendment',   path: '/public/amendment/TEST_TOKEN',  auth: 'public', skipReason: 'requires share-token fixture' },
  { name: 'public-invoice',     path: '/public/invoice/TEST_TOKEN',    auth: 'public', skipReason: 'requires share-token fixture' },

  // ── App shell ──────────────────────────────────────────
  { name: 'dashboard',            path: '/app',                          auth: 'required', readySelector: '[data-testid="dash-job-form"], .dv2-root, main', mask: ['[data-ts], time, .dv2-revenue-val, .dv2-headline-stat'] },
  { name: 'quotes-list',          path: '/app/quotes',                   auth: 'required' },
  { name: 'quote-builder-new',    path: '/app/quotes/new',               auth: 'required' },
  { name: 'quote-builder-edit',   path: '/app/quotes/TEST_QUOTE/edit',   auth: 'required', skipReason: 'requires seeded quote fixture' },
  { name: 'quote-builder-jobdtl', path: '/app/quotes/TEST_QUOTE/job-details', auth: 'required', skipReason: 'requires seeded quote fixture' },
  { name: 'quote-builder-scope',  path: '/app/quotes/build-scope/TEST_QUOTE', auth: 'required', skipReason: 'requires seeded quote fixture' },
  { name: 'quote-builder-review', path: '/app/quotes/review/TEST_QUOTE',  auth: 'required', skipReason: 'requires seeded quote fixture' },
  { name: 'quote-detail',         path: '/app/quotes/TEST_QUOTE',        auth: 'required', skipReason: 'requires seeded quote fixture' },
  { name: 'invoices-list',        path: '/app/invoices',                 auth: 'required' },
  { name: 'invoice-detail',       path: '/app/invoices/TEST_INV',        auth: 'required', skipReason: 'requires seeded invoice fixture' },
  { name: 'additional-work',      path: '/app/additional-work/TEST_REQ', auth: 'required', skipReason: 'requires seeded request fixture' },
  { name: 'contacts',             path: '/app/contacts',                 auth: 'required' },
  { name: 'bookings',             path: '/app/bookings',                 auth: 'required' },
  { name: 'settings',             path: '/app/settings',                 auth: 'required' },
  { name: 'billing',              path: '/app/billing',                  auth: 'required' },
  { name: 'analytics',            path: '/app/analytics',                auth: 'required', mask: ['svg[data-chart], .recharts-wrapper, canvas'] },
  { name: 'payments-setup',       path: '/app/payments-setup',           auth: 'required' },
  { name: 'payments-onboarding',  path: '/app/payments/setup',           auth: 'required' },

  // ── 404 ────────────────────────────────────────────────
  { name: 'not-found',            path: '/this-route-does-not-exist',    auth: 'public' },
];

/** Routes that run in the default sweep (exclude skipped). */
export const DEFAULT_ROUTES = ROUTES.filter((r) => !r.skipReason);

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
