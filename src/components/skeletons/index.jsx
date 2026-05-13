/**
 * skeletons/index.jsx — Phase 2 (UX-007 + UX-020)
 *
 * Per-route skeleton components. Each matches the real page's primary layout
 * zone-by-zone so there is zero Cumulative Layout Shift when real content
 * loads.
 *
 * Design rules:
 *  - Uses .dv2-skeleton / .dv2-skeleton-shimmer (dashboard-v2.css)
 *  - prefers-reduced-motion: shimmer off, static placeholder visible
 *  - Heights match real content heights to prevent CLS
 *  - Wrapped in AppShell so nav/sidebar render immediately
 *  - aria-busy="true" + aria-label for screen readers
 */

import AppShell from '../app-shell';
import { SkelBlock, SkelRow, SkelCard, SkelListRows, SkelStatGrid, SkelPage } from './skel-base';

/* ─── DASHBOARD ─────────────────────────────────────────────── */
export function DashboardSkeleton() {
  return (
    <AppShell title="Dashboard" hideTitle>
      <SkelPage>
        {/* Row 1: greeting + headline stat */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <SkelBlock h={18} w="38%" />
            <SkelBlock h={13} w="24%" />
          </div>
          <SkelBlock h={52} w={80} r="var(--r)" />
        </div>

        {/* Row 2: action list */}
        <SkelBlock h={14} w="28%" />
        <SkelListRows count={4} h={52} />

        {/* Row 3: pipeline bar */}
        <SkelBlock h={52} w="100%" r="var(--r)" />

        {/* Row 4: schedule + revenue */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <SkelCard>
            <SkelBlock h={12} w="50%" />
            <SkelBlock h={44} w="100%" style={{ marginTop: 8 }} />
            <SkelBlock h={44} w="100%" style={{ marginTop: 6 }} />
          </SkelCard>
          <SkelCard>
            <SkelBlock h={12} w="50%" />
            <SkelBlock h={32} w="65%" style={{ marginTop: 8 }} />
            <SkelBlock h={12} w="80%" style={{ marginTop: 8 }} />
          </SkelCard>
        </div>
      </SkelPage>
    </AppShell>
  );
}

/* ─── QUOTES LIST ────────────────────────────────────────────── */
export function QuotesListSkeleton() {
  return (
    <AppShell title="Quotes">
      <SkelPage>
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[80, 60, 72, 68].map((w, i) => (
            <SkelBlock key={i} h={32} w={w} r="var(--r-lg)" />
          ))}
        </div>
        <SkelListRows count={6} h={56} />
      </SkelPage>
    </AppShell>
  );
}

/* ─── QUOTE BUILDER ──────────────────────────────────────────── */
export function QuoteBuilderSkeleton() {
  return (
    <AppShell title="New Quote">
      <SkelPage>
        {/* Progress bar */}
        <SkelBlock h={6} w="100%" r="99px" />
        {/* Describe step layout */}
        <SkelCard>
          <SkelBlock h={14} w="40%" />
          <SkelBlock h={80} w="100%" r="var(--r)" style={{ marginTop: 10 }} />
        </SkelCard>
        <SkelCard>
          <SkelBlock h={14} w="35%" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <SkelBlock h={44} r="var(--r)" />
            <SkelBlock h={44} r="var(--r)" />
          </div>
        </SkelCard>
        <SkelBlock h={48} w="100%" r="var(--r)" />
      </SkelPage>
    </AppShell>
  );
}

/* ─── QUOTE DETAIL ───────────────────────────────────────────── */
export function QuoteDetailSkeleton() {
  return (
    <AppShell title="Quote">
      <SkelPage>
        {/* Lifecycle strip */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <SkelBlock key={i} h={24} w={60} r="var(--r-lg)" />
          ))}
        </div>
        {/* Main card */}
        <SkelCard>
          <SkelRow leftW="55%" rightW="22%" h={16} />
          <SkelBlock h={12} w="40%" style={{ marginTop: 6 }} />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <SkelRow key={i} leftW="65%" rightW="15%" h={13} />)}
          </div>
          <SkelBlock h={1} w="100%" style={{ marginTop: 16, background: 'var(--line)' }} />
          <SkelRow leftW="30%" rightW="25%" h={20} style={{ marginTop: 12 }} />
        </SkelCard>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <SkelBlock h={40} w="50%" r="var(--r)" />
          <SkelBlock h={40} w="50%" r="var(--r)" />
        </div>
      </SkelPage>
    </AppShell>
  );
}

/* ─── INVOICES LIST ──────────────────────────────────────────── */
export function InvoicesListSkeleton() {
  return (
    <AppShell title="Invoices">
      <SkelPage>
        <div style={{ display: 'flex', gap: 8 }}>
          {[80, 72, 68].map((w, i) => (
            <SkelBlock key={i} h={32} w={w} r="var(--r-lg)" />
          ))}
        </div>
        <SkelListRows count={6} h={56} />
      </SkelPage>
    </AppShell>
  );
}

/* ─── INVOICE DETAIL ─────────────────────────────────────────── */
export function InvoiceDetailSkeleton() {
  return (
    <AppShell title="Invoice">
      <SkelPage>
        {/* Header: customer + amount */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkelBlock h={20} w={180} />
            <SkelBlock h={13} w={120} />
          </div>
          <SkelBlock h={36} w={100} r="var(--r-lg)" />
        </div>
        {/* Line items */}
        <SkelCard>
          {[1, 2, 3].map(i => <SkelRow key={i} leftW="60%" rightW="18%" h={14} />)}
          <SkelBlock h={1} w="100%" style={{ margin: '12px 0', background: 'var(--line)' }} />
          <SkelRow leftW="25%" rightW="22%" h={20} />
        </SkelCard>
        {/* Payment section */}
        <SkelCard>
          <SkelBlock h={13} w="35%" />
          <SkelBlock h={44} w="100%" r="var(--r)" style={{ marginTop: 10 }} />
        </SkelCard>
      </SkelPage>
    </AppShell>
  );
}

/* ─── ADDITIONAL WORK DETAIL ─────────────────────────────────── */
export function AdditionalWorkDetailSkeleton() {
  return (
    <AppShell title="Additional Work">
      <SkelPage>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkelBlock h={20} w={200} />
          <SkelBlock h={32} w={90} r="var(--r-lg)" />
        </div>
        <SkelCard>
          {[1, 2].map(i => <SkelRow key={i} leftW="60%" rightW="15%" h={14} />)}
          <SkelBlock h={1} w="100%" style={{ margin: '12px 0', background: 'var(--line)' }} />
          <SkelRow leftW="25%" rightW="20%" h={18} />
        </SkelCard>
        <div style={{ display: 'flex', gap: 8 }}>
          <SkelBlock h={40} w="50%" r="var(--r)" />
          <SkelBlock h={40} w="50%" r="var(--r)" />
        </div>
      </SkelPage>
    </AppShell>
  );
}

/* ─── CONTACTS ───────────────────────────────────────────────── */
export function ContactsSkeleton() {
  return (
    <AppShell title="Contacts">
      <SkelPage>
        <SkelBlock h={40} w="100%" r="var(--r)" />
        <SkelListRows count={7} h={52} />
      </SkelPage>
    </AppShell>
  );
}

/* ─── BOOKINGS ───────────────────────────────────────────────── */
export function BookingsSkeleton() {
  return (
    <AppShell title="Schedule">
      <SkelPage>
        {/* Week strip */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <SkelBlock key={i} h={52} w="calc(14% - 4px)" r="var(--r)" />
          ))}
        </div>
        {/* Cards */}
        {[1, 2, 3].map(i => (
          <SkelCard key={i}>
            <SkelRow leftW="50%" rightW="20%" h={14} />
            <SkelBlock h={12} w="35%" style={{ marginTop: 6 }} />
          </SkelCard>
        ))}
      </SkelPage>
    </AppShell>
  );
}

/* ─── SETTINGS ───────────────────────────────────────────────── */
export function SettingsSkeleton() {
  return (
    <AppShell title="Settings">
      <SkelPage>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
          {[64, 52, 68, 60, 72, 56].map((w, i) => (
            <SkelBlock key={i} h={28} w={w} r="var(--r-lg)" />
          ))}
        </div>
        {/* Panel placeholders */}
        {[1, 2, 3].map(i => (
          <SkelCard key={i}>
            <SkelBlock h={12} w="30%" />
            <SkelBlock h={40} w="100%" r="var(--r)" style={{ marginTop: 10 }} />
          </SkelCard>
        ))}
      </SkelPage>
    </AppShell>
  );
}

/* ─── BILLING ────────────────────────────────────────────────── */
export function BillingSkeleton() {
  return (
    <AppShell title="Billing">
      <SkelPage>
        <SkelCard>
          <SkelBlock h={14} w="35%" />
          <SkelBlock h={32} w="55%" style={{ marginTop: 8 }} />
          <SkelBlock h={12} w="45%" style={{ marginTop: 6 }} />
        </SkelCard>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <SkelCard><SkelBlock h={120} w="100%" /></SkelCard>
          <SkelCard><SkelBlock h={120} w="100%" /></SkelCard>
        </div>
      </SkelPage>
    </AppShell>
  );
}

/* ─── ANALYTICS ──────────────────────────────────────────────── */
export function AnalyticsSkeleton() {
  return (
    <AppShell title="Analytics">
      <SkelPage>
        <SkelStatGrid cols={3} />
        <SkelCard>
          <SkelBlock h={14} w="30%" />
          <SkelBlock h={180} w="100%" r="var(--r)" style={{ marginTop: 12 }} />
        </SkelCard>
        <SkelStatGrid cols={2} />
      </SkelPage>
    </AppShell>
  );
}

/* ─── PAYMENTS SETUP ─────────────────────────────────────────── */
// Static FAQ page — no data loading; no skeleton needed.
// The Suspense fallback for this route uses the generic slim bar (see router).

/* ─── PAYMENTS ONBOARDING ────────────────────────────────────── */
export function PaymentsOnboardingSkeleton() {
  return (
    <AppShell title="Set up Payments">
      <SkelPage>
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {[1, 2, 3, 4].map(i => (
            <SkelBlock key={i} h={8} w={8} r="50%" />
          ))}
        </div>
        <SkelCard>
          <SkelBlock h={20} w="60%" />
          <SkelBlock h={14} w="80%" style={{ marginTop: 8 }} />
          <SkelBlock h={44} w="100%" r="var(--r)" style={{ marginTop: 20 }} />
        </SkelCard>
      </SkelPage>
    </AppShell>
  );
}

/* ─── PROJECT PORTAL (public) ────────────────────────────────── */
// Project portal has its own PublicLoadingState from Phase 1.
// The Suspense fallback renders the same component so the transition
// is seamless.
import PublicLoadingState from '../public-loading-state';
export function ProjectPortalSkeleton() {
  return <PublicLoadingState label="Loading your project…" />;
}
