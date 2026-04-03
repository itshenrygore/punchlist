import { lazy, Suspense } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import ProtectedRoute from './protected-route';

// Eagerly loaded (first paint)
import LandingPage from '../pages/landing-page';
import LoginPage from '../pages/login-page';
import SignupPage from '../pages/signup-page';
import PricingPage from '../pages/pricing-page';

// Lazy loaded
const PublicQuotePage = lazy(() => import('../pages/public-quote-page'));
const PublicAdditionalWorkPage = lazy(() => import('../pages/public-additional-work-page'));
const PublicAmendmentPage = lazy(() => import('../pages/public-amendment-page'));
const PublicInvoicePage = lazy(() => import('../pages/public-invoice-page'));
const QuotesListPage = lazy(() => import('../pages/quotes-list-page'));
const DashboardPage = lazy(() => import('../pages/dashboard-page'));
const JobDetailsPage = lazy(() => import('../pages/job-details-page'));
const BuildScopePage = lazy(() => import('../pages/build-scope-page'));
const ReviewQuotePage = lazy(() => import('../pages/review-quote-page'));
const QuoteDetailPage = lazy(() => import('../pages/quote-detail-page'));
const InvoiceDetailPage = lazy(() => import('../pages/invoice-detail-page'));
const AdditionalWorkDetailPage = lazy(() => import('../pages/additional-work-detail-page'));
const ContactsPage = lazy(() => import('../pages/contacts-page'));
const BookingsPage = lazy(() => import('../pages/bookings-page'));
const SettingsPage = lazy(() => import('../pages/settings-page'));
const BillingPage = lazy(() => import('../pages/billing-page'));
const AnalyticsPage = lazy(() => import('../pages/analytics-page'));

function LoadingFallback() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, animation: 'route-fade-in .2s ease-out' }}>
      <div className="loading-spinner" />
      <span style={{ color: 'var(--muted)', fontSize: 14, fontWeight: 600 }}>Loading…</span>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: 24 }}>
      <div style={{ fontSize: '3rem' }}>🔨</div>
      <h1 style={{ fontSize: 'clamp(1.5rem,4vw,3rem)', letterSpacing: '-.04em', margin: 0 }}>Page not found</h1>
      <p style={{ color: 'var(--muted)' }}>This page doesn't exist or has moved.</p>
      <Link className="btn btn-primary" to="/app">Back to dashboard</Link>
    </div>
  );
}

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/public/:shareToken" element={<PublicQuotePage />} />
        <Route path="/public/aw/:shareToken" element={<PublicAdditionalWorkPage />} />
        <Route path="/public/amendment/:shareToken" element={<PublicAmendmentPage />} />
        <Route path="/public/invoice/:shareToken" element={<PublicInvoicePage />} />
        <Route path="/app" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/app/quotes" element={<ProtectedRoute><QuotesListPage /></ProtectedRoute>} />
        <Route path="/app/quotes/new" element={<ProtectedRoute><JobDetailsPage /></ProtectedRoute>} />
        <Route path="/app/quotes/:quoteId/job-details" element={<ProtectedRoute><JobDetailsPage /></ProtectedRoute>} />
        <Route path="/app/quotes/build-scope/:quoteId" element={<ProtectedRoute><BuildScopePage /></ProtectedRoute>} />
        <Route path="/app/quotes/review/:quoteId" element={<ProtectedRoute><ReviewQuotePage /></ProtectedRoute>} />
        <Route path="/app/quotes/:quoteId" element={<ProtectedRoute><QuoteDetailPage /></ProtectedRoute>} />
        <Route path="/app/quotes/:quoteId/edit" element={<ProtectedRoute><ReviewQuotePage /></ProtectedRoute>} />
        <Route path="/app/invoices/:invoiceId" element={<ProtectedRoute><InvoiceDetailPage /></ProtectedRoute>} />
        <Route path="/app/additional-work/:requestId" element={<ProtectedRoute><AdditionalWorkDetailPage /></ProtectedRoute>} />
        <Route path="/app/contacts" element={<ProtectedRoute><ContactsPage /></ProtectedRoute>} />
        <Route path="/app/bookings" element={<ProtectedRoute><BookingsPage /></ProtectedRoute>} />
        <Route path="/app/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/app/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
        <Route path="/app/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
