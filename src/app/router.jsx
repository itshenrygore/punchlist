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
const DashboardPage = lazy(() => import('../pages/dashboard-page'));
const QuoteBuilderPage = lazy(() => import('../pages/quote-builder'));
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
        <Route path="/public/:shareToken" element={<S fallback={<ProjectPortalSkeleton />}><ProjectPortalPage /></S>} />
        <Route path="/project/:shareToken" element={<S fallback={<ProjectPortalSkeleton />}><ProjectPortalPage /></S>} />
        {/* Legacy public pages — still accessible for old bookmarked amendment/aw/invoice links */}
        <Route path="/public/aw/:shareToken" element={<S fallback={<PublicLoadingState label="Loading additional work…" />}><PublicAdditionalWorkPage /></S>} />
        <Route path="/public/amendment/:shareToken" element={<S fallback={<PublicLoadingState label="Loading amendment…" />}><PublicAmendmentPage /></S>} />
        <Route path="/public/invoice/:shareToken" element={<S fallback={<PublicLoadingState label="Loading your invoice…" />}><PublicInvoicePage /></S>} />

        {/* ── Authenticated app routes ── */}
        <Route path="/app" element={<ProtectedRoute><S fallback={<DashboardSkeleton />}><DashboardPage /></S></ProtectedRoute>} />
        <Route path="/app/quotes" element={<ProtectedRoute><S fallback={<QuotesListSkeleton />}><QuotesListPage /></S></ProtectedRoute>} />
        <Route path="/app/quotes/new" element={<ProtectedRoute><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></ProtectedRoute>} />
        <Route path="/app/quotes/:quoteId/edit" element={<ProtectedRoute><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></ProtectedRoute>} />
        {/* Redirects: old multi-page routes → unified builder */}
        <Route path="/app/quotes/:quoteId/job-details" element={<ProtectedRoute><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></ProtectedRoute>} />
        <Route path="/app/quotes/build-scope/:quoteId" element={<ProtectedRoute><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></ProtectedRoute>} />
        <Route path="/app/quotes/review/:quoteId" element={<ProtectedRoute><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></ProtectedRoute>} />
        <Route path="/app/quotes/:quoteId" element={<ProtectedRoute><S fallback={<QuoteDetailSkeleton />}><QuoteDetailPage /></S></ProtectedRoute>} />
        <Route path="/app/invoices" element={<ProtectedRoute><S fallback={<InvoicesListSkeleton />}><InvoicesListPage /></S></ProtectedRoute>} />
        <Route path="/app/invoices/:invoiceId" element={<ProtectedRoute><S fallback={<InvoiceDetailSkeleton />}><InvoiceDetailPage /></S></ProtectedRoute>} />
        <Route path="/app/additional-work/:requestId" element={<ProtectedRoute><S fallback={<AdditionalWorkDetailSkeleton />}><AdditionalWorkDetailPage /></S></ProtectedRoute>} />
        <Route path="/app/contacts" element={<ProtectedRoute><S fallback={<ContactsSkeleton />}><ContactsPage /></S></ProtectedRoute>} />
        <Route path="/app/bookings" element={<ProtectedRoute><S fallback={<BookingsSkeleton />}><BookingsPage /></S></ProtectedRoute>} />
        <Route path="/app/settings" element={<ProtectedRoute><S fallback={<SettingsSkeleton />}><SettingsPage /></S></ProtectedRoute>} />
        <Route path="/app/billing" element={<ProtectedRoute><S fallback={<BillingSkeleton />}><BillingPage /></S></ProtectedRoute>} />
        <Route path="/app/analytics" element={<ProtectedRoute><S fallback={<AnalyticsSkeleton />}><AnalyticsPage /></S></ProtectedRoute>} />
        <Route path="/app/payments-setup" element={<ProtectedRoute><S fallback={<SlimFallback />}><PaymentsSetupPage /></S></ProtectedRoute>} />
        <Route path="/app/payments/setup" element={<ProtectedRoute><S fallback={<PaymentsOnboardingSkeleton />}><PaymentsOnboardingPage /></S></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}
