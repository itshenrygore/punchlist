// ═══════════════════════════════════════════════════════════════════════════
// PUNCHLIST — FollowupModal
// v100 Workstream A Part 2 (M3). Spec: PHASE4-V100-PLAN.md §3.4.
//
// Shows when the contractor wants to nudge a customer on a sent/viewed quote.
// Pre-fills with the appropriate follow-up tier template, lets them edit,
// then POSTs to /api/send-followup.
//
// Props:
//   quote          — full quote object (needs followup_count, last_followup_at,
//                    views_since_followup, customer, share_token, title, total)
//   userProfile    — { company_name, full_name } for token resolution
//   templates      — array from listTemplates() (may be undefined; falls back to defaults)
//   onClose()      — close without sending
//   onSent(state)  — called with { followup_count, last_followup_at, views_since_followup }
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { renderTemplate, getFollowupKeyByCount, getSystemDefaults } from '../lib/api/templates';
import { currency } from '../lib/format';
import { supabase } from '../lib/supabase';
import { DUR, isReducedMotion } from '../lib/motion';
import SmsComposerField from './ui/SmsComposerField';

// ── Urgency colour coding per §3.4 ──
// daysSinceNudge: green 0–1 (fresh), amber 2–4 (due now), red 5+ (overdue)
function nudgeUrgency(lastFollowupAt) {
  if (!lastFollowupAt) return 'new'; // Never nudged — neutral
  const daysSince = (Date.now() - new Date(lastFollowupAt).getTime()) / 86_400_000;
  if (daysSince < 2) return 'green';
  if (daysSince < 5) return 'amber';
  return 'red';
}

const URGENCY_COLORS = {
  new:   'var(--text-2)',
  green: 'var(--green)',
  amber: 'var(--amber)',
  red:   'var(--red)',
};

function daysAgo(ts) {
  if (!ts) return null;
  const d = Math.round((Date.now() - new Date(ts).getTime()) / 86_400_000);
  if (d === 0) return 'today';
  if (d === 1) return '1d ago';
  return `${d}d ago`;
}

// ── Token helpers ──
function buildTokens(quote, userProfile) {
  const firstName  = quote.customer?.name?.split(' ')[0] || '';
  const senderName = userProfile?.company_name || userProfile?.full_name || 'Your contractor';
  const appUrl     = (typeof window !== 'undefined' ? window.location.origin : 'https://punchlist.ca');
  const link       = quote.share_token ? `${appUrl}/public/${quote.share_token}` : '';
  const total      = quote.total
    ? new Intl.NumberFormat(quote.country === 'US' ? 'en-US' : 'en-CA', {
        style: 'currency', currency: quote.country === 'US' ? 'USD' : 'CAD', maximumFractionDigits: 0,
      }).format(Number(quote.total))
    : '';
  return { firstName, senderName, quoteTitle: quote.title || 'your quote', total, link };
}

function getTemplateBody(templates, followupCount) {
  const key = getFollowupKeyByCount(
    // followup_count on the quote is the count of ALREADY SENT nudges.
    // If 0, this is the first nudge → key = followup_1_sms.
    // getFollowupKeyByCount(0) returns 'initial_sms'; we want followup_1 for count 0.
    // So add 1: 0 → followup_1, 1 → followup_2, 2+ → followup_3.
    Math.min(Math.max(0, Number(followupCount) || 0) + 1, 3)
  );
  // Prefer user's custom template
  const row = templates?.find(t => t.template_key === key);
  return row?.body || getSystemDefaults()[key] || '';
}

// ── Component ────────────────────────────────────────────────────────────────
export default function FollowupModal({ quote, userProfile, templates, onClose, onSent }) {
  const followupCount    = Number(quote?.followup_count) || 0;
  const lastFollowupAt   = quote?.last_followup_at || null;
  const viewsSince       = Number(quote?.views_since_followup) || 0;
  const urgency          = nudgeUrgency(lastFollowupAt);
  const tokens           = buildTokens(quote, userProfile);

  const defaultBody      = renderTemplate(getTemplateBody(templates, followupCount), tokens);
  const [body, setBody]  = useState(defaultBody);
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState('');

  // Return focus to the trigger element on close
  const returnFocusRef = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  useEffect(() => {
    const trigger = returnFocusRef.current;
    return () => { try { trigger?.focus(); } catch (e) { /* noop */ } };
  }, []);

  // Escape to close
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Recalculate if quote props change (e.g., parent rerenders after a prior send)
  useEffect(() => {
    setBody(renderTemplate(getTemplateBody(templates, followupCount), tokens));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.followup_count, quote?.id]);

  async function handleSend() {
    if (!body.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Your session has expired. Please refresh the page and try again.');
        setSending(false);
        return;
      }
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      };

      const res = await fetch('/api/send-followup', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          quoteId: quote.id,
          customMessage: body.trim() !== defaultBody.trim() ? body.trim() : undefined,
          method: quote.customer?.phone ? 'sms' : 'email',
        }),
      });

      // Defensive: handle non-JSON responses (HTML error pages from misconfigured
      // proxies/edge, or empty 502s) without throwing inside .json().
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setError('Your session has expired. Please refresh the page and try again.');
        setSending(false);
        return;
      }
      if (res.status === 429) {
        setError('You’ve hit the nudge limit for this customer this week. Try again in a few days.');
        setSending(false);
        return;
      }
      if (res.status === 503) {
        // Service is misconfigured (Twilio/Resend env vars missing).
        // Counter was NOT bumped so a retry won't burn a nudge slot.
        setError(data?.error || 'Sending is temporarily unavailable.');
        setSending(false);
        return;
      }

      // 502 is a partial-success: counters bumped, but the actual send failed
      // (Twilio not configured, invalid number, carrier rejected, etc).
      // Reconcile counters AND surface the specific reason so the user can act.
      if (res.status === 502) {
        const reasonMap = {
          not_configured: 'Direct send is unavailable right now. Open your messages app to send manually.',
          invalid_phone:  'That customer’s phone number isn’t valid. Update it in their profile and try again.',
          twilio_error:   'The carrier rejected the message. Try the customer’s email instead.',
          resend_error:   'Email send failed. Check your email setup in Settings.',
          network_error:  'Lost connection while sending. Check your network.',
        };
        setError(reasonMap[data?.sendReason] || data?.error || 'Message send failed.');
        // Reconcile counters anyway — server already incremented them.
        if (data?.followup_count != null) {
          onSent({
            followup_count:       data.followup_count,
            last_followup_at:     data.last_followup_at,
            views_since_followup: 0,
          });
        }
        setSending(false);
        return;
      }

      if (!res.ok) {
        setError(data?.error || `Send failed (${res.status}). Try again.`);
        setSending(false);
        return;
      }

      onSent({
        followup_count:       data.followup_count,
        last_followup_at:     data.last_followup_at,
        views_since_followup: 0,
      });
    } catch (e) {
      console.warn('[PL] FollowupModal send caught:', e);
      setError('Network error. Check your connection and try again.');
      setSending(false);
    }
  }

  // Context block content
  const nudgeTierLabel = followupCount === 0 ? 'First nudge' : followupCount === 1 ? 'Second nudge' : 'Last nudge';
  const recipientName  = quote?.customer?.name?.split(' ')[0] || 'Customer';
  const sendVia        = quote?.customer?.phone ? 'Text' : 'Email';

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Nudge ${recipientName}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content followup-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="followup-modal__header">
          <div>
            <h3 className="followup-modal__title">Nudge {recipientName}</h3>
            <div className="followup-modal__tier-label">{nudgeTierLabel}</div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={onClose}
            aria-label="Close"
          ><X size={14} /></button>
        </div>

        {/* ── Context block (§3.4) ── */}
        <div className="followup-modal__context" style={{ color: URGENCY_COLORS[urgency] }}>
          {lastFollowupAt ? (
            <>
              <span className="followup-modal__context-pill">
                Last nudge {daysAgo(lastFollowupAt)}
              </span>
              {viewsSince > 0 && (
                <span className="followup-modal__context-pill">
                  {viewsSince} view{viewsSince !== 1 ? 's' : ''} since
                </span>
              )}
              {viewsSince === 0 && (
                <span className="followup-modal__context-pill followup-modal__context-pill--muted">
                  Not viewed since last nudge
                </span>
              )}
            </>
          ) : (
            <span className="followup-modal__context-pill">
              Sent {daysAgo(quote?.sent_at) || '—'}
              {quote?.view_count > 0 ? ` · ${quote.view_count} view${quote.view_count !== 1 ? 's' : ''}` : ' · not opened yet'}
            </span>
          )}
        </div>

        {/* ── Message textarea ── */}
        <div className="followup-modal__field">
          <SmsComposerField
            id="followup-body"
            label={`Message ${sendVia}`}
            value={body}
            onChange={setBody}
            rows={5}
            showLinkHint={true}
            autoFocus={true}
          />
        </div>

        {error && (
          <div className="followup-modal__error" role="alert">{error}</div>
        )}

        {/* ── Actions ── */}
        <div className="followup-modal__actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary followup-modal__send-btn"
            type="button"
            onClick={handleSend}
            disabled={sending || !body.trim()}
          >
            {sending ? 'Sending…' : `${sendVia} nudge`}
          </button>
        </div>

        {/* ── Reassurance footer ── */}
        <p className="pl-sender-reassurance">
          You're the sender — this goes out as your message, not from Punchlist.
        </p>
      </div>
    </div>
  );
}
