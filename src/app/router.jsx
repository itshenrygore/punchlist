/* ═══════════════════════════════════════════════════════════════
   Punchlist 2.0 Router
   ═══════════════════════════════════════════════════════════════ */
import { lazy, Suspense } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import ProtectedRoute from './protected-route';
import ErrorBoundary from '../components/error-boundary';
import {
  DashboardSkeleton,
  QuotesListSkeleton,
  QuoteBuilderSkeleton,
  QuoteDetailSkeleton,
  InvoicesListSkeleton,
  InvoiceDetailSkeleton,
  SettingsSkeleton,
  BillingSkeleton,
  PaymentsOnboardingSkeleton,
} from '../components/skeletons';
import PublicLoadingState from '../components/public-loading-state';

// Eagerly loaded (first paint)
import LandingPage from '../pages/landing-page';
import LoginPage from '../pages/login-page';
import SignupPage from '../pages/signup-page';
import TermsPage from '../pages/terms-page';
import PrivacyPage from '../pages/privacy-page';
import PricingPage from '../pages/pricing-page';

// Lazy loaded — core screens only
const DashboardPage = lazy(() => import('../pages/dashboard-page'));
const PublicQuotePage = lazy(() => import('../pages/public-quote-page'));
const PublicInvoicePage = lazy(() => import('../pages/public-invoice-page'));
const QuotesListPage = lazy(() => import('../pages/quotes-list-page'));
const QuoteBuilderPage = lazy(() => import('../pages/quote-builder-page'));
const QuoteDetailPage = lazy(() => import('../pages/quote-detail-page'));
const InvoicesListPage = lazy(() => import('../pages/invoices-list-page'));
const NewInvoicePage = lazy(() => import('../pages/new-invoice-page'));
const InvoiceDetailPage = lazy(() => import('../pages/invoice-detail-page'));
const SettingsPage = lazy(() => import('../pages/settings-page'));
const BillingPage = lazy(() => import('../pages/billing-page'));
const PaymentsOnboardingPage = lazy(() => import('../pages/payments-onboarding-page'));
const CustomersPage = lazy(() => import('../pages/customers-page'));
const SchedulePage = lazy(() => import('../pages/schedule-page'));
const AnalyticsPage = lazy(() => import('../pages/analytics-page'));
const TemplatesPage = lazy(() => import('../pages/templates-page'));

function S({ fallback, children }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

function NotFound() {
  return (
    <div className="not-found-shell">
      <div className="not-found-icon" aria-hidden="true" role="presentation" />
      <h1 className="not-found-heading">Page not found</h1>
      <p className="not-found-body">This page doesn't exist or has moved.</p>
      <Link className="btn btn-primary" to="/app">Back to home</Link>
    </div>
  );
}

export default function AppRouter() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* ── Public (no auth) ── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/pricing" element={<PricingPage />} />

        {/* ── Public customer-facing ── */}
        <Route path="/q/:shareToken" element={<S fallback={<PublicLoadingState label="Loading your quote…" />}><PublicQuotePage /></S>} />
        <Route path="/i/:shareToken" element={<S fallback={<PublicLoadingState label="Loading your invoice…" />}><PublicInvoicePage /></S>} />
        {/* Legacy URLs still work */}
        <Route path="/public/:shareToken" element={<S fallback={<PublicLoadingState label="Loading…" />}><PublicQuotePage /></S>} />
        <Route path="/project/:shareToken" element={<S fallback={<PublicLoadingState label="Loading…" />}><PublicQuotePage /></S>} />
        <Route path="/public/invoice/:shareToken" element={<S fallback={<PublicLoadingState label="Loading…" />}><PublicInvoicePage /></S>} />

        {/* ── Legacy cut-feature URLs → redirect ── */}
        <Route path="/app/bookings/*" element={<Navigate to="/app" replace />} />
        <Route path="/app/contacts" element={<Navigate to="/app/customers" replace />} />
        <Route path="/app/additional-work/*" element={<Navigate to="/app" replace />} />
        <Route path="/public/aw/*" element={<Navigate to="/" replace />} />
        <Route path="/public/amendment/*" element={<Navigate to="/" replace />} />

        {/* ── Authenticated app ── */}
        <Route path="/app" element={<ProtectedRoute><S fallback={<DashboardSkeleton />}><DashboardPage /></S></ProtectedRoute>} />
        <Route path="/app/quotes" element={<ProtectedRoute><S fallback={<QuotesListSkeleton />}><QuotesListPage /></S></ProtectedRoute>} />
        <Route path="/app/quotes/new" element={<ProtectedRoute><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></ProtectedRoute>} />
        <Route path="/app/quotes/:quoteId/edit" element={<ProtectedRoute><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></ProtectedRoute>} />
        <Route path="/app/quotes/:quoteId" element={<ProtectedRoute><S fallback={<QuoteDetailSkeleton />}><QuoteDetailPage /></S></ProtectedRoute>} />
        <Route path="/app/schedule" element={<ProtectedRoute><S fallback={<QuotesListSkeleton />}><SchedulePage /></S></ProtectedRoute>} />
        <Route path="/app/invoices" element={<ProtectedRoute><S fallback={<InvoicesListSkeleton />}><InvoicesListPage /></S></ProtectedRoute>} />
        <Route path="/app/invoices/new" element={<ProtectedRoute><S fallback={<InvoiceDetailSkeleton />}><NewInvoicePage /></S></ProtectedRoute>} />
        <Route path="/app/invoices/:invoiceId" element={<ProtectedRoute><S fallback={<InvoiceDetailSkeleton />}><InvoiceDetailPage /></S></ProtectedRoute>} />
        <Route path="/app/settings" element={<ProtectedRoute><S fallback={<SettingsSkeleton />}><SettingsPage /></S></ProtectedRoute>} />
        <Route path="/app/billing" element={<ProtectedRoute><S fallback={<BillingSkeleton />}><BillingPage /></S></ProtectedRoute>} />
        <Route path="/app/payments/setup" element={<ProtectedRoute><S fallback={<PaymentsOnboardingSkeleton />}><PaymentsOnboardingPage /></S></ProtectedRoute>} />
        <Route path="/app/customers" element={<ProtectedRoute><S fallback={<QuotesListSkeleton />}><CustomersPage /></S></ProtectedRoute>} />
        <Route path="/app/analytics" element={<ProtectedRoute><S fallback={<QuotesListSkeleton />}><AnalyticsPage /></S></ProtectedRoute>} />
        <Route path="/app/templates" element={<ProtectedRoute><S fallback={<SettingsSkeleton />}><TemplatesPage /></S></ProtectedRoute>} />

        {/* Legacy builder URLs → unified builder */}
        <Route path="/app/quotes/:quoteId/job-details" element={<ProtectedRoute><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></ProtectedRoute>} />
        <Route path="/app/quotes/build-scope/:quoteId" element={<ProtectedRoute><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></ProtectedRoute>} />
        <Route path="/app/quotes/review/:quoteId" element={<ProtectedRoute><S fallback={<QuoteBuilderSkeleton />}><QuoteBuilderPage /></S></ProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}
