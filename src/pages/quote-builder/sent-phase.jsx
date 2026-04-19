import { useQuoteBuilder } from './quote-builder-context';
import { actions } from './use-quote-draft';
import { currency } from '../../lib/format';
import { estimateMonthly, showFinancing } from '../../lib/financing';
import { supabase } from '../../lib/supabase';
import { trackPushEnabled } from '../../lib/analytics';

/* ═══════════════════════════════════════════════════════════
   SentPhase — Post-send success screen.

   Shows:
     • First-send confetti + celebration
     • Repeat-send compact confirmation
     • View quote / New quote / Dashboard CTAs
     • Push notification opt-in nudge (first send only)
   ═══════════════════════════════════════════════════════════ */

export default function SentPhase() {
  const { state, dispatch, derived, handlers } = useQuoteBuilder();
  const { quoteId, country } = state;
  const { grandTotal, selCustomer, user, nav } = derived;

  const isFirst = (() => {
    try { return localStorage.getItem('pl_has_sent_quote_first') !== '1'; } catch { return false; }
  })();
  try { localStorage.setItem('pl_has_sent_quote_first', '1'); } catch (e) { /* */ }

  const custName = selCustomer?.name || 'Your customer';
  const firstName = custName.split(' ')[0];
  const mo = showFinancing(grandTotal) ? estimateMonthly(grandTotal) : null;

  function handleNewQuote() {
    dispatch(actions.resetForNewQuote());
    nav('/app/quotes/new', { replace: true });
  }

  async function handleEnablePush() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });
      const { data: { session: pushSession } } = await supabase.auth.getSession();
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(pushSession?.access_token ? { Authorization: `Bearer ${pushSession.access_token}` } : {}),
        },
        body: JSON.stringify({ user_id: user?.id, subscription: sub.toJSON() }),
      });
      handlers.toast('Notifications enabled', 'success');
    } catch { /* silent */ }
  }

  return (
    <div className={`rq-sent-banner${isFirst ? ' rq-sent-first' : ''}`}
      style={isFirst ? { background: 'var(--green-bg)', borderColor: 'var(--green-line)' } : undefined}
    >
      {isFirst && (
        <div className="rq-sent-confetti" aria-hidden="true">
          <span /><span /><span /><span /><span /><span /><span /><span />
        </div>
      )}

      {isFirst ? (
        <div className="qb-sent-first-body">
          <div className="rq-sent-emoji">🎉</div>
          <div className="qb-sent-headline">
            Quote sent — {currency(grandTotal, country)}
          </div>
          {mo && (
            <div className="qb-sent-subline">
              {firstName} will see {currency(grandTotal, country)} or as low as {currency(mo, country)}/mo
            </div>
          )}
          <div className="qb-sent-tracking-badge">
            <div className="qb-sent-tracking-dot" />
            <span>You'll get notified the moment {firstName} opens it</span>
          </div>
          <div className="rq-sent-steps">
            <div className="rq-sent-step"><span className="rq-sent-step-num">1</span><span>{firstName} gets your quote via text</span></div>
            <div className="rq-sent-step"><span className="rq-sent-step-num">2</span><span>You see when they open it</span></div>
            <div className="rq-sent-step"><span className="rq-sent-step-num">3</span><span>They approve and you get paid</span></div>
          </div>
        </div>
      ) : (
        <div className="qb-sent-repeat-body">
          <div className="qb-sent-repeat-check">✓ Quote sent to {firstName}</div>
          <div className="qb-sent-repeat-detail">
            {currency(grandTotal, country)}
            {mo ? ` · ${firstName} sees options from ${currency(mo, country)}/mo` : ''}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="qb-sent-actions">
        {quoteId && (
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={() => nav(`/app/quotes/${quoteId}`)}
          >
            View quote →
          </button>
        )}
        <button className="btn btn-secondary btn-sm" type="button" onClick={handleNewQuote}>
          + New quote
        </button>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={() => nav('/app')}
        >
          Dashboard
        </button>
      </div>

      {/* Push notification nudge — first send only */}
      {isFirst && 'PushManager' in window && Notification?.permission === 'default' && (
        <button type="button" className="rq-push-nudge" onClick={handleEnablePush}>
          <span className="qb-push-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </span>
          <span>Get notified when {firstName} opens this — enable push notifications</span>
        </button>
      )}
    </div>
  );
}
