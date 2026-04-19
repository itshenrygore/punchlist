import { useEffect } from 'react';
import { actions } from './use-quote-draft';
import { getProfile, getQuotingDefaults, listQuotes, getQuote, updateQuote, listTemplates, requestAiScope } from '../../lib/api';
import { isPro, countSentThisMonth } from '../../lib/billing';
import { isQuoteLocked } from '../../lib/workflow';
import { saveOfflineDraft, getOfflineDraft, deleteOfflineDraft, isNetworkError } from '../../lib/offline';
import { makeId } from '../../lib/utils';
import { friendly } from '../../lib/format';
import { trackQuoteFlowStarted, restoreFlowSession, hasActiveFlowSession, trackQuoteFlowAbandoned, endQuoteFlowSession } from '../../lib/analytics';
import { DESC_PLACEHOLDERS } from './builder-utils';

/* ═══════════════════════════════════════════════════════════
   useBuilderEffects — Side effects for the quote builder.

   Extracted from the monolith. Each effect is a standalone
   useEffect so React can clean them up independently.
   ═══════════════════════════════════════════════════════════ */

export function useBuilderEffects({
  state, dispatch, ud, refs,
  user, existingQuoteId, location, nav, toast, showUndo,
  allCustomers, localCustomersRef, totals, grandTotal,
  saveRef,
}) {
  const { quoteId, isDirty, isLocked, lineItems, offlineDraft, phase, description, trade, province, country, draft, title, showKbdHelp } = state;

  // ── Load profile + customers + existing quote ──
  useEffect(() => {
    if (!user) return;
    const profileP = getProfile(user.id);
    const defaultsP = getQuotingDefaults(user.id).catch(() => null);

    profileP.then(p => {
      dispatch(actions.setUserProfile(p));
      if (p?.province) dispatch(actions.setProvince(p.province));
      if (p?.country) dispatch(actions.setCountry(p.country));
      if (p?.trade) dispatch(actions.setTrade(p.trade));
      if (p?.company_name) dispatch(actions.setCompanyName(p.company_name));
      if (!isPro(p)) {
        listQuotes(user.id)
          .then(q => dispatch(actions.setSentThisMonth(countSentThisMonth(q || []))))
          .catch(e => console.warn('[PL]', e));
      }
    }).catch(e => console.warn('[PL]', e));

    // Load SMS template
    listTemplates(user.id).then(rows => {
      const row = rows.find(r => r.template_key === 'initial_sms');
      dispatch(actions.setInitialSmsTemplate(row?.body || null));
    }).catch(() => dispatch(actions.setInitialSmsTemplate(null)));

    // Smart defaults for new quotes
    if (!existingQuoteId) {
      Promise.all([profileP.catch(() => null), defaultsP]).then(([p, defaults]) => {
        if (refs.current.dirty) return;
        dispatch(actions.setDraft(prev => {
          const next = { ...prev };
          if (p?.default_expiry_days) next.expiry_days = Number(p.default_expiry_days);
          if (p?.default_deposit_mode && p.default_deposit_mode !== 'none') {
            next.deposit_required = true;
            if (p.default_deposit_mode === 'percent') next.deposit_percent = Number(p.default_deposit_value || 20);
            else next.deposit_amount = Number(p.default_deposit_value || 0);
          }
          if (defaults) {
            next.expiry_days = defaults.expiryDays;
            next.deposit_required = defaults.depositRequired;
            if (defaults.depositRequired) next.deposit_percent = defaults.depositPercent;
          }
          return next;
        }));
      });
    }

    // Edit mode: load existing quote
    if (existingQuoteId) {
      Promise.all([getQuote(existingQuoteId), profileP.catch(() => null), defaultsP]).then(([q, p, defaults]) => {
        if (isQuoteLocked(q)) {
          toast('This quote is locked', 'error');
          nav(`/app/quotes/${existingQuoteId}`, { replace: true });
          return;
        }
        dispatch(actions.setTitle(q.title || ''));
        dispatch(actions.setDescription(q.description || ''));
        if (q.trade) dispatch(actions.setTrade(q.trade));
        if (q.province) dispatch(actions.setProvince(q.province));
        if (q.country) dispatch(actions.setCountry(q.country));
        refs.current.titleSuggested = true;

        const draftData = {
          title: q.title || '', description: q.description || '',
          scope_summary: q.scope_summary || '', assumptions: q.assumptions || '',
          exclusions: q.exclusions || '', customer_id: q.customer_id || '',
          status: q.status || 'draft', expiry_days: q.expiry_days || 14,
          deposit_required: q.deposit_required || false,
          deposit_percent: Number(q.deposit_percent || 20),
          deposit_amount: Number(q.deposit_amount || 0),
          deposit_status: q.deposit_status || 'not_required',
          internal_notes: q.internal_notes || '',
          revision_summary: q.revision_summary || '',
          discount: Number(q.discount || 0),
        };

        if (q.status === 'draft' && !q.deposit_required && !q.internal_notes) {
          if (p?.default_expiry_days) draftData.expiry_days = Number(p.default_expiry_days);
          if (p?.default_deposit_mode && p.default_deposit_mode !== 'none') {
            draftData.deposit_required = true;
            if (p.default_deposit_mode === 'percent') draftData.deposit_percent = Number(p.default_deposit_value || 20);
            else draftData.deposit_amount = Number(p.default_deposit_value || 0);
          }
          if (defaults) {
            draftData.expiry_days = defaults.expiryDays;
            draftData.deposit_required = defaults.depositRequired;
            if (defaults.depositRequired) draftData.deposit_percent = defaults.depositPercent;
          }
        }

        dispatch(actions.setDraft(draftData));
        if (draftData.assumptions?.trim()) dispatch(actions.setShowDetails(true));
        dispatch(actions.setLineItems(
          (q.line_items || []).map(i => ({
            id: i.id || makeId(), name: i.name, quantity: Number(i.quantity || 1),
            unit_price: Number(i.unit_price || 0), notes: i.notes || '',
            included: i.included !== false, category: i.category || '',
          })),
          false // don't mark dirty
        ));
        refs.current.initialLoadComplete = true;
        dispatch(actions.setPhase('review'));

        // Offline draft restore
        getOfflineDraft(existingQuoteId).then(od => {
          if (!od) return;
          if (new Date(od.savedAt || 0).getTime() > new Date(q.updated_at || 0).getTime()) {
            if (od.title !== undefined) dispatch(actions.setDraft(prev => ({ ...prev, ...od })));
            if (Array.isArray(od.line_items)) {
              dispatch(actions.setLineItems(od.line_items.map(i => ({
                id: i.id || makeId(), name: i.name, quantity: Number(i.quantity || 1),
                unit_price: Number(i.unit_price || 0), notes: i.notes || '',
                included: i.included !== false, category: i.category || '',
              }))));
            }
            dispatch(actions.setOfflineDraft(true));
            toast('Restored offline draft', 'info');
          }
        }).catch(e => console.warn('[PL]', e));
      }).catch(e => dispatch(actions.setError(friendly(e))));
    }

    // Telemetry: flow session
    if (!existingQuoteId) {
      if (!hasActiveFlowSession()) trackQuoteFlowStarted({ source: 'builder_direct' });
    } else {
      const restored = restoreFlowSession(existingQuoteId);
      if (!restored) trackQuoteFlowStarted({ quoteId: existingQuoteId, source: 'builder_direct' });
    }

    // Demo carry-through
    if (!existingQuoteId) {
      try {
        const d = JSON.parse(sessionStorage.getItem('pl_demo_quote') || 'null');
        if (d?.description) {
          dispatch(actions.setDescription(d.description));
          if (d.trade) dispatch(actions.setTrade(d.trade));
          sessionStorage.removeItem('pl_demo_quote');
        }
      } catch (e) { console.warn('[PL]', e); }

      const demoDesc = new URLSearchParams(location.search).get('demo');
      const demoTrade = new URLSearchParams(location.search).get('trade');
      if (demoDesc) dispatch(actions.setDescription(demoDesc));
      if (demoTrade) dispatch(actions.setTrade(demoTrade));

      // First-time sample
      if (!demoDesc && !location.state?.prefill) {
        try {
          if (!localStorage.getItem('pl_has_built_quote')) {
            profileP.then(p => {
              const t = p?.trade || 'Other';
              const sample = DESC_PLACEHOLDERS[t] || DESC_PLACEHOLDERS.Other;
              // Only set if description is still empty (user hasn't started typing)
              if (!state.description) dispatch(actions.setDescription(sample));
            }).catch(e => console.warn('[PL]', e));
          }
        } catch (e) { console.warn('[PL]', e); }
      }
    }
  }, [user, existingQuoteId]);

  // ── Deposit sync ──
  useEffect(() => {
    if (!refs.current.initialLoadComplete || !draft.deposit_required) return;
    const pct = draft.deposit_percent || 0;
    if (pct <= 0) return;
    const base = Math.max(0, totals.subtotal - (draft.discount || 0));
    const newAmt = Math.round(base * pct / 100);
    if (newAmt !== draft.deposit_amount) {
      dispatch(actions.batch(
        actions.updateDraft('deposit_amount', newAmt)
      ));
    }
  }, [totals.subtotal, draft.discount, draft.deposit_percent, draft.deposit_required]);

  // ── Autosave ──
  useEffect(() => {
    if (!quoteId) return;
    if (!isDirty) {
      if (offlineDraft && navigator.onLine && saveRef.current) {
        saveRef.current(null, true).then(synced => {
          if (synced) toast('Back online — quote synced', 'success');
        });
      }
      return;
    }
    if (refs.current.saving || isLocked || !refs.current.initialLoadComplete) return;
    if (lineItems.length === 0) return;
    const t = setTimeout(() => {
      if (saveRef.current) saveRef.current(null, true);
    }, 800);
    return () => clearTimeout(t);
  }, [isDirty, draft, lineItems, title, description, quoteId, isLocked, offlineDraft]);

  // ── Flush on tab hide ──
  useEffect(() => {
    if (!quoteId) return;
    const flush = () => {
      if (refs.current.dirty && !refs.current.saving && !isLocked && refs.current.initialLoadComplete && lineItems.length > 0) {
        if (saveRef.current) saveRef.current(null, true);
      }
    };
    window.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [quoteId, isLocked, lineItems.length]);

  // ── Undo cancel on unmount ──
  useEffect(() => () => { refs.current.undoCancel?.(); }, []);

  // ── Telemetry: abandoned flow ──
  useEffect(() => {
    function onPageHide() {
      if (!refs.current.sent) trackQuoteFlowAbandoned();
    }
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      if (!refs.current.sent) endQuoteFlowSession();
    };
  }, []);

  // ── AI Pre-warm ──
  useEffect(() => {
    if (!description.trim() || description.length < 15) return;
    const timer = setTimeout(() => {
      const pw = refs.current.aiPreWarm;
      if (pw.controller && pw.forDescription !== description) pw.controller.abort();
      if (pw.forDescription === description && pw.promise) return;

      const controller = new AbortController();
      refs.current.aiPreWarm = {
        controller,
        forDescription: description,
        promise: requestAiScope({ description, trade, province, country, estimatorRoute: 'balanced', signal: controller.signal })
          .catch(err => { if (err.name !== 'AbortError') return null; return null; }),
      };
    }, 600);
    return () => clearTimeout(timer);
  }, [description, trade, province, country]);

  // Cancel pre-warm on unmount
  useEffect(() => () => { refs.current.aiPreWarm.controller?.abort(); }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!window.matchMedia('(pointer:fine)').matches) return;
    function onKeyDown(e) {
      const tag = e.target?.tagName?.toLowerCase();
      const inInput = tag === 'input' || tag === 'textarea' || tag === 'select';
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key === 'k') {
        e.preventDefault();
        const el = document.querySelector('.rq-customer-section input, .jd-input[placeholder*="Search or add customer"]');
        if (el) el.focus();
        return;
      }
      if (meta && e.key === 'Enter') {
        e.preventDefault();
        // Handled via handlers reference
        return;
      }
      if (e.key === '?' && !inInput && !meta) {
        e.preventDefault();
        dispatch(actions.setShowKbdHelp(p => !p));
        return;
      }
      if (e.key === 'Escape' && showKbdHelp) {
        dispatch(actions.setShowKbdHelp(false));
        return;
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [phase, description, showKbdHelp]);
}
