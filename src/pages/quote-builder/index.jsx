import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../../components/app-shell';
import ConfirmModal from '../../components/confirm-modal';
import UpgradePrompt from '../../components/upgrade-prompt';
import QbCoachmarks from '../../components/qb-coachmarks';
import { Section } from '../../components/ui';
import { useCustomers } from '../../hooks/use-customers';
import { useAuth } from '../../hooks/use-auth';
import { useUnsavedChanges } from '../../hooks/use-unsaved-changes';
import { useToast } from '../../components/toast';
import useScrollLock from '../../hooks/use-scroll-lock';

import useQuoteDraft, { actions } from './use-quote-draft';
import { QuoteBuilderProvider } from './quote-builder-context';
import { generateTitle } from './builder-utils';
import { useBuilderEffects } from './use-builder-effects';
import { useBuilderHandlers } from './use-builder-handlers';

import DescribePhase from './describe-phase';
import BuildingPhase from './building-phase';
import ReviewPhase from './review-phase';
import SentPhase from './sent-phase';

import { calculateTotals, buildConfidence } from '../../lib/pricing';

/* ═══════════════════════════════════════════════════════════
   QuoteBuilderPage — Slim orchestrator (Phase 1).

   This file is ~180 lines. All rendering lives in phase
   components. All business logic lives in use-builder-effects
   and use-builder-handlers. This file only:

     1. Creates the reducer
     2. Computes derived state
     3. Provides context to children
     4. Renders the active phase
   ═══════════════════════════════════════════════════════════ */

export default function QuoteBuilderPage() {
  const { user } = useAuth();
  const { quoteId: existingQuoteId } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const { show: toast, showUndo } = useToast();

  // ── Reducer ──
  const [state, dispatch, ud] = useQuoteDraft({
    existingQuoteId,
    prefill: location.state?.prefill || '',
  });

  const { phase, lineItems, draft, province, country, showSend, smsConfirmPending, addMode, showUpgradeModal, isDirty, zeroItemConfirm } = state;

  // ── Scroll locks ──
  useScrollLock(showSend);
  useScrollLock(!!smsConfirmPending);
  useScrollLock(addMode === 'catalog');

  // ── Unsaved changes guard ──
  useUnsavedChanges(isDirty && (lineItems.length > 0 || phase === 'building'));

  // ── Customers ──
  const { customers, loading: customersLoading } = useCustomers(user?.id);
  const [localCustomers, setLocalCustomers] = useState([]);
  const allCustomers = useMemo(() => {
    if (!localCustomers.length) return customers;
    const ids = new Set(customers.map(c => c.id));
    return [...customers, ...localCustomers.filter(c => !ids.has(c.id))];
  }, [customers, localCustomers]);
  // Stable ref so handlers can push optimistic additions
  const localCustomersRef = useRef({ set: setLocalCustomers });
  localCustomersRef.current.set = setLocalCustomers;

  // ── Derived state ──
  const totals = useMemo(
    () => calculateTotals(lineItems, province, country),
    [lineItems, province, country]
  );
  const grandTotal = Math.max(0, totals.subtotal - (draft.discount || 0)) * (1 + totals.rate);
  const itemCount = lineItems.filter(i => i.name?.trim()).length;
  const selCustomer = allCustomers.find(c => c.id === draft.customer_id);
  const confidence = useMemo(
    () => buildConfidence(lineItems, [], {
      hasCustomer: !!draft.customer_id,
      hasScope: !!draft.scope_summary,
      hasDeposit: !draft.deposit_required || draft.deposit_status === 'paid',
      revisionSummary: draft.revision_summary,
    }),
    [lineItems, draft]
  );

  // ── Shared refs ──
  const refs = useRef({
    dirty: false,
    saving: false,
    initialLoadComplete: false,
    saveMutex: null,
    titleSuggested: false,
    lastAutoTitle: '',
    descCommitted: false,
    sent: false,
    deliveryMethod: 'text',
    preAiLineItems: null,
    undoCancel: null,
    aiPreWarm: { promise: null, controller: null, forDescription: '' },
  });

  // Keep ref mirrors in sync
  useEffect(() => { refs.current.dirty = isDirty; }, [isDirty]);
  useEffect(() => { refs.current.deliveryMethod = state.deliveryMethod; }, [state.deliveryMethod]);

  // ── Auto-generate title ──
  const titleDebounceRef = useRef(null);
  useEffect(() => {
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    if (state.description.trim().length >= 10) {
      const shouldUpdate = !state.title.trim() || !refs.current.titleSuggested || (refs.current.lastAutoTitle && state.title === refs.current.lastAutoTitle);
      if (shouldUpdate) {
        titleDebounceRef.current = setTimeout(() => {
          const g = generateTitle(state.description);
          if (g && g.length > 2) {
            dispatch(actions.setTitle(g));
            refs.current.lastAutoTitle = g;
            refs.current.titleSuggested = true;
          }
        }, 800);
      }
    }
    return () => { if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current); };
  }, [state.description]);

  // ── Handlers (buildScope, send, save, etc.) ──
  const handlers = useBuilderHandlers({ state, dispatch, ud, refs, user, nav, toast, showUndo, allCustomers, localCustomersRef, totals, grandTotal, selCustomer, itemCount });

  // ── saveRef: stable reference to save() for effects to call ──
  const saveRef = useRef(null);
  useEffect(() => { saveRef.current = handlers.save; }, [handlers.save]);

  // ── Effects (load profile, autosave, keyboard shortcuts, etc.) ──
  useBuilderEffects({ state, dispatch, ud, refs, user, existingQuoteId, location, nav, toast, showUndo, allCustomers, localCustomersRef, totals, grandTotal, saveRef });

  // ── ⌘Enter keyboard shortcut (needs handlers reference) ──
  useEffect(() => {
    if (!window.matchMedia('(pointer:fine)').matches) return;
    function onMetaEnter(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'describe' && state.description.trim()) handlers.handleBuildScope();
        else if (phase === 'review') handlers.handleSend();
      }
    }
    document.addEventListener('keydown', onMetaEnter);
    return () => document.removeEventListener('keydown', onMetaEnter);
  }, [phase, state.description, handlers.handleBuildScope, handlers.handleSend]);

  // ── Context value ──
  const ctxValue = useMemo(() => ({
    state,
    dispatch,
    ud,
    refs,
    handlers,
    derived: {
      totals,
      grandTotal,
      itemCount,
      selCustomer,
      confidence,
      allCustomers,
      customersLoading,
      user,
      nav,
    },
  }), [state, totals, grandTotal, itemCount, selCustomer, confidence, allCustomers, customersLoading]);

  // ── Render ──
  const subtitle = phase === 'building' ? 'Building scope…'
    : phase === 'sent' ? 'Sent'
    : (state.companyName || null);

  return (
    <QuoteBuilderProvider value={ctxValue}>
      <AppShell
        title={phase === 'describe' ? 'New Quote' : state.title || draft.title || 'Quote'}
        subtitle={subtitle}
      >
        {showUpgradeModal && (
          <UpgradePrompt
            trigger="quote_limit"
            context={{ count: state.sentThisMonth }}
            onDismiss={() => dispatch(actions.setShowUpgradeModal(false))}
          />
        )}

        <Section spacing="tight" bleed={true}>
          <div className="rq-page">
            {/* Progress stepper */}
            {phase !== 'sent' && (
              <div className="qb-stepper">
                {[
                  { key: 'describe', label: 'Describe' },
                  { key: 'building', label: 'Build' },
                  { key: 'review', label: 'Review' },
                ].map((s, i) => {
                  const phases = ['describe', 'building', 'review'];
                  const current = phases.indexOf(phase);
                  const stepIdx = phases.indexOf(s.key);
                  const done = stepIdx < current;
                  const active = stepIdx === current;
                  return (
                    <div key={s.key} className={`qb-step ${done ? 'done' : active ? 'active' : ''}`}>
                      <div className="qb-step-dot">{done ? '✓' : i + 1}</div>
                      <span className="qb-step-label">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {phase === 'describe' && <DescribePhase />}
            {phase === 'building' && <BuildingPhase />}
            {phase === 'review' && <ReviewPhase />}
            {phase === 'sent' && <SentPhase />}
          </div>
        </Section>

        <ConfirmModal
          open={zeroItemConfirm !== null}
          onConfirm={handlers.proceedToSend}
          onCancel={() => dispatch(actions.setZeroItemConfirm(null))}
          title="Items with $0 pricing"
          message={`${zeroItemConfirm || 0} item${(zeroItemConfirm || 0) > 1 ? 's have' : ' has'} $0 pricing. Send anyway?`}
          confirmLabel="Send Anyway"
          cancelLabel="Cancel"
        />

        {phase === 'review' && <QbCoachmarks />}

        {/* Keyboard shortcut help overlay */}
        {state.showKbdHelp && (
          <div className="qb-kbd-overlay-bg" onClick={() => dispatch(actions.setShowKbdHelp(false))}>
            <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="qb-kbd-overlay" onClick={e => e.stopPropagation()}>
              <div className="qb-kbd-overlay-head">
                <span className="qb-kbd-overlay-title">Keyboard shortcuts</span>
                <button type="button" className="qb-kbd-overlay-close" onClick={() => dispatch(actions.setShowKbdHelp(false))} aria-label="Close">×</button>
              </div>
              <table className="qb-kbd-table">
                <tbody>
                  <tr><td>⌘K / Ctrl+K</td><td>Focus customer search</td></tr>
                  <tr><td>⌘↵ / Ctrl+Enter</td><td>Build quote (describe) or Send (review)</td></tr>
                  <tr><td>?</td><td>Toggle this help overlay</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AppShell>
    </QuoteBuilderProvider>
  );
}
