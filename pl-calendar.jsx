// Phase 2 (UX-007): per-route Suspense fallbacks replace the single generic LoadingFallback.
// Each lazy route now declares its own skeleton so the user always sees a
// structured destination-specific placeholder, never a centred spinner.
import { lazy, Suspense } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import ProtectedRoute from './protected-route';
import ErrorBoundary from '../components/error-boundary';
import {
  DashboardSkeleton,
  QuotesListSkeleton,
  QuoteBuilderSkeleton,
  QuoteDetailSkeleton,
  InvoicesListSkeleton,
  InvoiceDetailSkeleton,
  AdditionalWorkDetailSkeleton,
  ContactsSkeleton,
  BookingsSkeleton,
  SettingsSkeleton,
  BillingSkeleton,
  AnalyticsSkeleton,
  PaymentsOnboardingSkeleton,
  ProjectPortalSkeleton,
} from '../components/skeletons';
import PublicLoadingState from '../components/public-loading-state';

// Eagerly loaded (first paint)
import LandingPage from '../pages/landing-page';
import LoginPage from '../pages/login-page';
import SignupPage from '../pages/signup-page';
import TermsPage from '../pages/terms-page';
import PricingPage from '../pages/pricing-page';

// Lazy loaded
const ProjectPortalPage = lazy(() => import('../pages/project-portal-page'));
const PublicQuotePage = lazy(() => import('../pages/public-quote-page'));
const PublicAdditionalWorkPage = lazy(() => import('../pages/public-additional-work-page'));
const PublicAmendmentPage = lazy(() => import('../pages/public-amendment-page'));
const PublicInvoicePage = lazy(() => import('../pages/public-invoice-page'));
const QuotesListPage = lazy(() => import('../pages/quotes-list-page'));
// v100 M4: feature-flag dashboard version. v2 is default (§9.4).
// pl_dash_version localStorage key set by app-shell Classic view toggle.
const DashboardPage = lazy(() => {
  let ver = 'v2';
  try { ver = localStorage.getItem('pl_dash_version') || 'v2'; } catch { /* no-op */ }
  return ver === 'v1'
    ? import('../pages/dashboard-page-v1')
    : import('../pages/dashboard-page');
});
const QuoteBuilderPage = lazy(() => import('../pages/quote-builder-page'));
const QuoteDetailPage = lazy(() => import('../pages/quote-detail-page'));
const InvoiceDetailPage = lazy(() => import('../pages/invoice-detail-page'));
const AdditionalWorkDetailPage = lazy(() => import('../pages/additional-work-detail-page'));
const ContactsPage = lazy(() => import('../pages/contacts-page'));
const BookingsPage = lazy(() => import('../pages/bookings-page'));
const SettingsPage = lazy(() => import('../pages/settings-page'));
const BillingPage = lazy(() => import('../pages/billing-page'));
const AnalyticsPage = lazy(() => import('../pages/analytics-page'));
const PaymentsSetupPage = lazy(() => import('../pages/payments-setup-page'));
const PaymentsOnboardingPage = lazy(() => import('../pages/payments-onboarding-page'));
const InvoicesListPage = lazy(() => import('../pages/invoices-list-page'));

/**
 * SlimFallback — for static/non-data pages (payments-setup) where a full
 * skeleton would be misleading. Token-based class; no inline styles.
 */
function SlimFallback() {
  return <div className="route-loading-slim" aria-busy="true" aria-label="Loading…" />;
}

/**
 * S() — thin Suspense wrapper. Each route declares its own fallback so the
 * user sees a structured placeholder matching the destination, not a spinner.
 */
function S({ fallback, children }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

/**
 * RE() — per-route ErrorBoundary wrapper. Isolates crashes to individual
 * routes so a single page error (e.g. notification-center, quote builder)
 * never kills the entire app. Previously a single top-level ErrorBoundary
 * caused every route to show the error screen on any crash anywhere.
 */
function RE({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function NotFound() {
  return (
    <div className="not-found-shell">
      <div className="not-found-icon" aria-hidden="true" role="presentation" />
      <h1 className="not-found-heading">Page not found</h1>
      <p className="not-found-body">This page doesn't exist or has moved.</p>
      <Link className="btn btn-primary" to="/app">Back to dashboard</Link>
    </div>
  );
}

export default function AppRouter() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* ── Eagerly loaded — no Suspense needed ── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/pricing" element={<PricingPage />} />

        {/* ── Public customer-facing pages ── */}
        <Route path="/public/:shareToken" element={<RE><S fallback={<ProjectPortalSkeleton />}><ProjectPortalPage /></S></RE>} />
        <Route path="/project/:shareToken" element={<RE><S fallback={<ProjectPortalSkeleton />}><ProjectPortalPage /></S></RE>} />
        {/* Legacy public pages — still accessible for old bookmarked amendment/aw/invoice links */}
        <Route path="/public/aw/:shareToken" element={<RE><S fallback={<PublicLoadingState label="Loading additional work…" />}><PublicAdditionalWorkPage /></S></RE>} />
        <Route path="/public/amendment/:shareToken" element={<RE><S fallback={<PublicLoadingState label="Loading amendment…" />}><PublicAmendmentPage /></S></RE>} />
        <Route path="/public/invoice/:shareToken" element={<RE><S fallback={<PublicLoadingState label="Loading your invoice…" />}><PublicInvoicePage /></S></RE>} />

        {/* ── Authenticated app routes — each wrapped in its own ErrorBoundary ── */}
        <Route path="/app" element={<ProtectedRoute><RE><S fallback={<DashboardSkeleton />}><DashboardPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/quotes" element={<ProtectedRoute><RE><S fallback={<QuotesListSkeleton />}><QuotesListPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/quotes/new" element={<ProtectedRoute><RE><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/quotes/:quoteId/edit" element={<ProtectedRoute><RE><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></RE></ProtectedRoute>} />
        {/* Redirects: old multi-page routes → unified builder */}
        <Route path="/app/quotes/:quoteId/job-details" element={<ProtectedRoute><RE><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/quotes/build-scope/:quoteId" element={<ProtectedRoute><RE><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/quotes/review/:quoteId" element={<ProtectedRoute><RE><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/quotes/:quoteId" element={<ProtectedRoute><RE><S fallback={<QuoteDetailSkeleton />}><QuoteDetailPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/invoices" element={<ProtectedRoute><RE><S fallback={<InvoicesListSkeleton />}><InvoicesListPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/invoices/:invoiceId" element={<ProtectedRoute><RE><S fallback={<InvoiceDetailSkeleton />}><InvoiceDetailPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/additional-work/:requestId" element={<ProtectedRoute><RE><S fallback={<AdditionalWorkDetailSkeleton />}><AdditionalWorkDetailPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/contacts" element={<ProtectedRoute><RE><S fallback={<ContactsSkeleton />}><ContactsPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/bookings" element={<ProtectedRoute><RE><S fallback={<BookingsSkeleton />}><BookingsPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/settings" element={<ProtectedRoute><RE><S fallback={<SettingsSkeleton />}><SettingsPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/billing" element={<ProtectedRoute><RE><S fallback={<BillingSkeleton />}><BillingPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/analytics" element={<ProtectedRoute><RE><S fallback={<AnalyticsSkeleton />}><AnalyticsPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/payments-setup" element={<ProtectedRoute><RE><S fallback={<SlimFallback />}><PaymentsSetupPage /></S></RE></ProtectedRoute>} />
        <Route path="/app/payments/setup" element={<ProtectedRoute><RE><S fallback={<PaymentsOnboardingSkeleton />}><PaymentsOnboardingPage /></S></RE></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}
