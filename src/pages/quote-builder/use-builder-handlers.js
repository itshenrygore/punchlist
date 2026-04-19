import { useCallback, useMemo } from 'react';
import { actions } from './use-quote-draft';
import { normSuggestion } from './builder-utils';
import {
  requestAiScope, getWonQuoteContext, getProfile, getQuote, updateQuote,
  createQuote, createCustomer, updateCustomer, uploadQuotePhoto,
  findCustomerByContact, sendQuoteEmail,
} from '../../lib/api';
import { listTemplates, renderTemplate, getSystemDefaults } from '../../lib/api/templates';
import { isPro, canSendQuote } from '../../lib/billing';
import { saveOfflineDraft, getOfflineDraft, deleteOfflineDraft, isNetworkError } from '../../lib/offline';
import { smsNotify } from '../../lib/sms';
import { currency, friendly } from '../../lib/format';
import { makeId } from '../../lib/utils';
import { invalidateCustomers } from '../../hooks/use-customers';
import {
  trackFirstBuild, trackFirstSend, trackQuoteSent,
  trackQuoteFlowCustomerSelected, trackQuoteFlowDescriptionCommitted,
  trackQuoteFlowScopeReady, trackQuoteFlowSent, setQuoteFlowQuoteId,
} from '../../lib/analytics';
import { estimateMonthly, showFinancing } from '../../lib/financing';

/* ═══════════════════════════════════════════════════════════
   useBuilderHandlers — All user-facing actions.

   Phase 1 changes:
     • handleConfirmSend: fires actualSend immediately — no
       3-second undo delay. The confirm button IS the safety net.
     • SMS fallback: no longer writes status: sent optimistically.
       Writes only after user confirms.
   ═══════════════════════════════════════════════════════════ */

export function useBuilderHandlers({
  state, dispatch, ud, refs,
  user, nav, toast, showUndo,
  allCustomers, localCustomersRef,
  totals, grandTotal, selCustomer, itemCount,
}) {
  const {
    quoteId, description, title, trade, province, country, photo,
    draft, lineItems, deliveryMethod, smsBody, isLocked,
    userProfile, sentThisMonth, companyName, initialSmsTemplate,
  } = state;

  // ── Save ──
  const save = useCallback(async (nextStatus = null, silent = false) => {
    if (refs.current.saveMutex) {
      try { await refs.current.saveMutex; } catch (e) { console.warn('[PL]', e); }
    }
    if (!user || !quoteId) return null;
    if (!nextStatus && !refs.current.initialLoadComplete) return null;
    if (!nextStatus && lineItems.length === 0) return null;

    const savePromise = (async () => {
      dispatch(actions.setSaving(true));
      refs.current.saving = true;
      dispatch(actions.setSaveState('saving'));

      try {
        const effectiveStatus = nextStatus || draft.status || 'draft';
        const pl = {
          ...draft, title: title || draft.title, description,
          status: effectiveStatus, line_items: lineItems,
          trade, province, country, delivery_method: deliveryMethod,
        };
        const q = await updateQuote(quoteId, pl);
        dispatch(actions.clearDirty());
        dispatch(actions.setSaveState('saved'));
        dispatch(actions.setLastSavedAt(new Date()));
        setTimeout(() => dispatch(actions.setSaveState('')), 2500);

        if (state.offlineDraft) {
          deleteOfflineDraft(quoteId).catch(e => console.warn('[PL]', e));
          dispatch(actions.setOfflineDraft(false));
        }
        if (!silent && nextStatus === 'sent') toast('Quote sent', 'success');
        return q;
      } catch (e) {
        if (isNetworkError(e) && quoteId) {
          try {
            await saveOfflineDraft({
              ...draft, title, description, line_items: lineItems,
              trade, province, country, id: quoteId,
              savedAt: new Date().toISOString(),
            });
            dispatch(actions.setOfflineDraft(true));
            dispatch(actions.setSaveState(''));
            if (!silent) toast('Saved offline — will sync when online', 'info');
            return null;
          } catch (e2) { console.warn('[PL]', e2); }
        }
        dispatch(actions.setError(friendly(e)));
        dispatch(actions.setSaveState(''));
        if (!silent) toast(friendly(e), 'error');
        return null;
      } finally {
        dispatch(actions.setSaving(false));
        refs.current.saving = false;
      }
    })();

    refs.current.saveMutex = savePromise;
    try { return await savePromise; } finally { refs.current.saveMutex = null; }
  }, [user, quoteId, draft, lineItems, title, description, trade, province, country, deliveryMethod, state.offlineDraft]);

  // ── Build scope ──
  const handleBuildScope = useCallback(async () => {
    if (!description.trim()) { dispatch(actions.setError('Describe the job first')); return; }
    dispatch(actions.setError(''));
    dispatch(actions.setPhase('building'));
    try { localStorage.setItem('pl_has_built_quote', '1'); } catch (e) { console.warn('[PL]', e); }
    trackFirstBuild();
    dispatch(actions.setScopeLoading(true));
    dispatch(actions.setScopeLoadingMsg('Analyzing job scope…'));
    const t1 = setTimeout(() => dispatch(actions.setScopeLoadingMsg('Still working — analyzing materials and pricing…')), 6000);
    const t2 = setTimeout(() => dispatch(actions.setScopeLoadingMsg('Almost there — finalizing suggestions…')), 12000);

    try {
      let draftId = quoteId;
      if (!draftId) {
        const d = await createQuote(user.id, {
          title: title || description.slice(0, 64), description, trade, province, country,
          customer_id: draft.customer_id || null, status: 'draft', line_items: [],
        });
        draftId = d.id;
        dispatch(actions.setQuoteId(draftId));
        setQuoteFlowQuoteId(draftId);
        nav(`/app/quotes/${draftId}/edit`, { replace: true });
      } else {
        await updateQuote(draftId, { title: title || description.slice(0, 64), description, trade, province, country });
      }

      // Upload photo
      if (photo) {
        try {
          const { url } = await uploadQuotePhoto(draftId, photo);
          await updateQuote(draftId, { photo_url: url });
          dispatch(actions.setPhotoSaved(true));
          toast('Photo saved to quote', 'success');
        } catch (e) {
          console.warn('[Punchlist] Photo upload failed:', e.message);
          toast('Photo upload failed — you can re-add it later', 'error');
        }
      }

      // Won quote context + labour rate
      let wonContext = [], labourRate = 0;
      try {
        const [wc, p] = await Promise.all([
          getWonQuoteContext(null, 5),
          userProfile ? Promise.resolve(userProfile) : getProfile(user.id),
        ]);
        wonContext = wc || [];
        labourRate = Number(p?.default_labour_rate || 0);
      } catch (e) { console.warn('[PL]', e); }

      // Photo base64 for AI
      let photoBase64 = null;
      if (photo) {
        try {
          photoBase64 = await new Promise((res, rej) => {
            const rd = new FileReader();
            rd.onload = () => res(rd.result.split(',')[1]);
            rd.onerror = rej;
            rd.readAsDataURL(photo);
          });
        } catch (e) { console.warn('[PL]', e); }
      } else {
        const existing = await getQuote(draftId);
        if (existing?.photo_url) {
          try {
            const r = await fetch(existing.photo_url);
            if (r.ok) {
              const b = await r.blob();
              photoBase64 = await new Promise((res, rej) => {
                const rd = new FileReader();
                rd.onload = () => res(rd.result.split(',')[1]);
                rd.onerror = rej;
                rd.readAsDataURL(b);
              });
            }
          } catch (e) { console.warn('[PL]', e); }
        }
      }

      // Use pre-warm if available
      let scopePromise;
      const pw = refs.current.aiPreWarm;
      if (pw.promise && pw.forDescription === description) {
        scopePromise = pw.promise;
      } else {
        pw.controller?.abort();
        scopePromise = requestAiScope({ description, trade, estimatorRoute: 'balanced', province, country, photo: photoBase64, wonQuotes: wonContext, labourRate });
      }
      refs.current.aiPreWarm = { promise: null, controller: null, forDescription: '' };

      const r = await scopePromise;

      if (r.source === 'error' || r.source === 'none') {
        console.warn('[Punchlist] AI returned:', r.source, r.warning);
        toast(r.warning || 'AI could not generate items — add them manually.', 'error');
        refs.current.initialLoadComplete = true;
        dispatch(actions.setScopeError(true));
        dispatch(actions.setPhase('review'));
        return;
      }

      refs.current.preAiLineItems = [...lineItems];
      let items = (r.items || r.line_items || []).map((it, i) => normSuggestion(it, i));
      items.sort((a, b) => ({ labour: 0, services: 1, materials: 2 }[a.tab] ?? 3) - ({ labour: 0, services: 1, materials: 2 }[b.tab] ?? 3));
      const upgrades = (r.optional_upgrades || []).map((u, i) => ({
        id: `upg_${i}_${Date.now()}`, name: u.description || '', category: u.category || 'Services',
        tab: 'services', unit_price: Number(u.unit_price || 0), typical_low: 0, typical_high: 0,
        why: u.why || '', when_needed: '', when_not_needed: '', notes: '', confidence: 'medium',
        source: 'Recommended upgrade', selected: false, isUpgrade: true,
      }));
      dispatch(actions.setSuggestions([...items, ...upgrades]));
      dispatch(actions.setScopeGaps(r.gaps || []));
      dispatch(actions.setScopeMeta({
        scope_summary: r.scope_summary || '',
        assumptions: (r.assumptions || []).join('\n'),
        exclusions: (r.exclusions || []).join('\n'),
      }));

      const selected = [...items, ...upgrades].filter(s => s.selected);
      const newLineItems = selected.map(s => ({
        id: s.id, name: s.name, quantity: s.quantity || 1, unit_price: s.unit_price || 0,
        notes: '', category: s.category || '', included: true,
      }));
      dispatch(actions.setLineItems(newLineItems));
      dispatch(actions.setDraft({
        ...draft,
        title: title || description.slice(0, 64), description,
        scope_summary: r.scope_summary || draft.scope_summary,
        assumptions: (r.assumptions || []).join('\n') || draft.assumptions,
        exclusions: (r.exclusions || []).join('\n') || draft.exclusions,
      }));
      refs.current.initialLoadComplete = true;

      await updateQuote(draftId, {
        scope_summary: r.scope_summary || '',
        assumptions: (r.assumptions || []).join('\n'),
        exclusions: (r.exclusions || []).join('\n'),
        line_items: newLineItems,
      });

      if (items.length < 2) {
        toast('Fewer items than expected were suggested. Add more below.', 'info');
      } else {
        const snapshotBefore = refs.current.preAiLineItems || [];
        const addedCount = newLineItems.length - snapshotBefore.length;
        if (addedCount > 0) {
          showUndo(
            `${addedCount} item${addedCount !== 1 ? 's' : ''} added by AI`,
            5000,
            null,
            () => { dispatch(actions.setLineItems(snapshotBefore)); dispatch(actions.markDirty()); toast('AI items removed', 'info'); }
          );
        } else {
          toast(`${items.length} items added to your quote`, 'success');
        }
      }
      trackQuoteFlowScopeReady(newLineItems.length);
      dispatch(actions.setPhase('review'));
    } catch (e) {
      console.error('[Punchlist] AI scope failed:', e.message);
      dispatch(actions.setScopeError(true));
      toast(
        e.message?.includes('timed out') || e.message?.includes('timeout')
          ? 'Quote generation timed out — add items manually or retry.'
          : 'Could not generate items — add them manually.',
        'error'
      );
      refs.current.initialLoadComplete = true;
      dispatch(actions.setPhase('review'));
    } finally {
      dispatch(actions.setScopeLoading(false));
      clearTimeout(t1);
      clearTimeout(t2);
    }
  }, [description, title, trade, province, country, photo, quoteId, draft, lineItems, userProfile, user]);

  // ── Skip to manual ──
  const handleSkipToManual = useCallback(async () => {
    if (!description.trim()) { dispatch(actions.setError('Describe the job first')); return; }
    try {
      const d = quoteId
        ? await updateQuote(quoteId, { title: title || description.slice(0, 64), description, trade, province, country })
        : await createQuote(user.id, { title: title || description.slice(0, 64), description, trade, province, country, customer_id: null, status: 'draft', line_items: [] });
      const id = d?.id || quoteId;
      if (!quoteId) { dispatch(actions.setQuoteId(id)); nav(`/app/quotes/${id}/edit`, { replace: true }); }
      refs.current.initialLoadComplete = true;
      dispatch(actions.setDraft(prev => ({ ...prev, title: title || description.slice(0, 64), description })));
      dispatch(actions.setPhase('review'));
    } catch (e) { dispatch(actions.setError(e.message || 'Failed')); }
  }, [description, title, trade, province, country, quoteId, user]);

  // ── Quick create customer ──
  const handleQuickCreateCustomer = useCallback(async () => {
    const { newCust } = state;
    if (!newCust.name.trim()) return;
    if (!newCust.phone.trim()) { dispatch(actions.setError('Add a phone number — that\u2019s how the quote gets sent.')); return; }
    try {
      const existing = await findCustomerByContact(user.id, { phone: newCust.phone, email: newCust.email });
      if (existing) {
        if (!allCustomers.some(c => c.id === existing.id)) {
          localCustomersRef.current.set(prev => [...prev, existing]);
        }
        ud('customer_id', existing.id);
        trackQuoteFlowCustomerSelected(existing.id);
        dispatch(actions.setShowNewCust(false));
        dispatch(actions.setNewCust({ name: '', email: '', phone: '', address: '' }));
        dispatch(actions.setCustomerSearch(''));
        toast(`Using existing contact: ${existing.name}`, 'info');
        return;
      }
      const c = await createCustomer(user.id, newCust);
      invalidateCustomers();
      localCustomersRef.current.set(prev => [...prev, c]);
      ud('customer_id', c.id);
      trackQuoteFlowCustomerSelected(c.id);
      dispatch(actions.setShowNewCust(false));
      dispatch(actions.setNewCust({ name: '', email: '', phone: '', address: '' }));
      dispatch(actions.setCustomerSearch(''));
      toast('Contact saved', 'success');
    } catch (e) { dispatch(actions.setError(friendly(e))); }
  }, [state.newCust, user, allCustomers]);

  // ── Send flow ──
  const handleSend = useCallback(() => {
    dispatch(actions.setError(''));
    if (!canSendQuote(userProfile, sentThisMonth)) { dispatch(actions.setShowUpgradeModal(true)); return; }
    if (!draft.customer_id && deliveryMethod !== 'copy') { dispatch(actions.setError('Add a customer to send via text. Or use "Copy link".')); return; }
    if (deliveryMethod === 'text' && draft.customer_id) {
      const cust = allCustomers.find(c => c.id === draft.customer_id);
      if (!cust?.phone) { dispatch(actions.setInlinePhone('')); dispatch(actions.setError('__needs_phone__')); return; }
    }
    if (deliveryMethod === 'email' && draft.customer_id) {
      const cust = allCustomers.find(c => c.id === draft.customer_id);
      if (!cust?.email) { dispatch(actions.setError('This customer has no email address. Add one or use "Copy link".')); return; }
    }
    if (!lineItems.some(i => i.name?.trim())) { dispatch(actions.setError('Add at least one item')); return; }
    const zeroItems = lineItems.filter(i => i.name?.trim() && Number(i.unit_price) === 0);
    if (zeroItems.length > 0) { dispatch(actions.setZeroItemConfirm(zeroItems.length)); return; }
    proceedToSend();
  }, [draft, deliveryMethod, lineItems, userProfile, sentThisMonth, allCustomers]);

  const proceedToSend = useCallback(() => {
    dispatch(actions.setZeroItemConfirm(null));
    if (!draft.scope_summary.trim()) {
      ud('scope_summary', `${title || draft.title || 'Work'}. Includes: ${lineItems.filter(i => i.name?.trim()).map(i => i.name).slice(0, 8).join(', ')}.`);
    }
    const firstName = selCustomer?.name?.split(' ')[0] || '';
    const senderName = companyName || userProfile?.full_name || 'Your contractor';
    const templateBody = initialSmsTemplate || getSystemDefaults().initial_sms;
    const totalFormatted = currency(grandTotal, country);
    dispatch(actions.setSmsBody(renderTemplate(templateBody, {
      firstName, senderName,
      quoteTitle: title || draft.title || 'Your quote',
      total: totalFormatted,
      link: '[link will be added automatically]',
    })));
    dispatch(actions.setShowSend(true));
  }, [draft, title, lineItems, selCustomer, companyName, userProfile, initialSmsTemplate, grandTotal, country]);

  // ── Phase 1: Confirm send fires immediately (no 3s undo delay) ──
  const handleConfirmSend = useCallback(async () => {
    dispatch(actions.setShowSend(false));
    dispatch(actions.setSending(true));

    try {
      const q = await save('sent');
      if (!q) { dispatch(actions.setSending(false)); return; }

      if (q.status || q.sent_at) {
        dispatch(actions.setDraft(prev => ({ ...prev, status: q.status ?? prev.status, sent_at: q.sent_at ?? prev.sent_at })));
      }
      const url = `${window.location.origin}/public/${q.share_token}`;
      const firstName = selCustomer?.name?.split(' ')[0] || '';

      if (deliveryMethod === 'text') {
        let finalBody = smsBody || '';
        if (finalBody.includes('[link will be added automatically]')) finalBody = finalBody.replace('[link will be added automatically]', url);
        else if (!finalBody.includes(url)) finalBody = finalBody.trim() + '\n' + url;

        const result = await smsNotify.customMessage({ to: selCustomer?.phone || '', body: finalBody });
        if (result?.ok) {
          const isFirst = !localStorage.getItem('pl_first_send_at');
          if (!isFirst) toast(`Quote texted to ${firstName || selCustomer?.phone}`, 'success');
          _markSent(firstName);
        } else {
          // SMS fallback: open native app, do NOT mark as sent yet
          window.open(`sms:${selCustomer?.phone}?body=${encodeURIComponent(finalBody)}`, '_self');
          // Roll status back to draft — only mark sent after user confirms
          try { await updateQuote(q.id, { status: 'draft', sent_at: null }); } catch (e) { console.warn('[PL]', e); }
          dispatch(actions.setDraft(prev => ({ ...prev, status: 'draft', sent_at: null })));
          dispatch(actions.setSmsConfirmPending({ url, phone: selCustomer?.phone, body: finalBody, quoteId: q.id, firstName }));
        }
      } else if (deliveryMethod === 'email') {
        const cust = allCustomers.find(c => c.id === draft.customer_id);
        const response = await sendQuoteEmail(q.id, cust?.email);
        if (response.status || response.sent_at) {
          dispatch(actions.setDraft(prev => ({ ...prev, status: response.status ?? prev.status, sent_at: response.sent_at ?? prev.sent_at })));
        }
        toast(`Quote emailed to ${firstName || cust?.email}`, 'success');
        _markSent(firstName);
      } else {
        try { await navigator.clipboard.writeText(url); toast('Link copied', 'success'); } catch { toast('Link: ' + url, 'info'); }
        _markSent(firstName);
      }
    } catch (e) { dispatch(actions.setError(e?.message || 'Send failed')); }
    finally { dispatch(actions.setSending(false)); }
  }, [save, deliveryMethod, smsBody, selCustomer, allCustomers, draft, grandTotal, trade, country]);

  function _markSent(customerFirstName) {
    dispatch(actions.setSentSuccess(true));
    dispatch(actions.setPhase('sent'));
    try { localStorage.setItem('pl_has_sent_quote', '1'); } catch (e) { console.warn('[PL]', e); }
    const isFirst = !localStorage.getItem('pl_first_send_at');
    trackQuoteSent(grandTotal, trade, isFirst);
    if (isFirst) {
      trackFirstSend(grandTotal, trade);
      try { localStorage.setItem('pl_first_send_at', new Date().toISOString()); } catch (e) { /* */ }
    }
    dispatch(actions.setSentThisMonth(sentThisMonth + 1));
    refs.current.sent = true;
    trackQuoteFlowSent({ deliveryMethod: refs.current.deliveryMethod, total: grandTotal });

    const fn = customerFirstName || selCustomer?.name?.split(' ')[0] || 'your customer';
    if (isFirst) {
      toast(`${fn}'s phone just buzzed — your first quote is on its way`, 'success');
    }
  }

  // ── SMS confirm / cancel ──
  const handleSmsConfirm = useCallback(() => {
    const pending = state.smsConfirmPending;
    dispatch(actions.setSmsConfirmPending(null));
    if (!pending) return;
    // Now mark as sent (user confirmed they tapped send in native app)
    const fn = pending.firstName || pending.phone;
    _markSent(pending.firstName);
    if (!localStorage.getItem('pl_first_send_at')) {
      // first-send toast already fired
    } else {
      toast(`Quote sent to ${fn}`, 'success');
    }
  }, [state.smsConfirmPending]);

  const handleSmsCancel = useCallback(async () => {
    dispatch(actions.setSmsConfirmPending(null));
    if (quoteId) {
      try { await updateQuote(quoteId, { status: 'draft', sent_at: null }); } catch (e) { console.warn('[PL] sms cancel rollback', e); }
    }
    dispatch(actions.setDraft(prev => ({ ...prev, status: 'draft', sent_at: null })));
    dispatch(actions.setPhase('review'));
    toast('Send cancelled — quote is still a draft', 'info');
  }, [quoteId]);

  // ── Preview ──
  const handlePreview = useCallback(async () => {
    const q = await save(null, true);
    if (q?.share_token) {
      window.open('/public/' + q.share_token + '?preview=1', '_blank');
    } else if (quoteId) {
      try {
        const ex = await getQuote(quoteId);
        if (ex?.share_token) window.open('/public/' + ex.share_token + '?preview=1', '_blank');
        else toast('Save the quote first to preview', 'info');
      } catch { toast('Save the quote first to preview', 'info'); }
    } else {
      toast('Save the quote first to preview', 'info');
    }
  }, [save, quoteId]);

  // ── Inline phone save ──
  const handleInlinePhoneSave = useCallback(async () => {
    try {
      const cust = allCustomers.find(c => c.id === draft.customer_id);
      if (!cust) return;
      await updateCustomer(cust.id, { phone: state.inlinePhone.trim() });
      localCustomersRef.current.set(prev =>
        prev.map(c => c.id === cust.id ? { ...c, phone: state.inlinePhone.trim() } : c)
      );
      invalidateCustomers();
      dispatch(actions.setError(''));
      toast('Phone saved', 'success');
      setTimeout(() => handleSend(), 100);
    } catch (e) { toast(friendly(e), 'error'); }
  }, [state.inlinePhone, draft.customer_id, allCustomers, handleSend]);

  // ── Description blur ──
  const onDescriptionBlur = useCallback((desc) => {
    if (desc.trim() && !refs.current.descCommitted) {
      refs.current.descCommitted = true;
      trackQuoteFlowDescriptionCommitted(desc.trim().length);
    }
  }, []);

  // ── Manual save (for footer button) ──
  const handleSave = useCallback(() => save(), [save]);

  return useMemo(() => ({
    handleBuildScope,
    handleSkipToManual,
    handleQuickCreateCustomer,
    handleSend,
    proceedToSend,
    handleConfirmSend,
    handleSmsConfirm,
    handleSmsCancel,
    handlePreview,
    handleInlinePhoneSave,
    handleSave,
    onDescriptionBlur,
    save,
    toast,
  }), [
    handleBuildScope, handleSkipToManual, handleQuickCreateCustomer,
    handleSend, proceedToSend, handleConfirmSend, handleSmsConfirm,
    handleSmsCancel, handlePreview, handleInlinePhoneSave, handleSave,
    onDescriptionBlur, save, toast,
  ]);
}
