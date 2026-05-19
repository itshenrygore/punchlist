import { useEffect, useRef, useState } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { currency as formatCurrency } from '../lib/format';
import { smsNotify } from '../lib/sms';

/**
 * PaidCelebrationCard
 *
 * The contractor just got paid. This is the most under-celebrated
 * moment in most B2B SaaS. We replace a generic toast with a real
 * moment: PAID stamp, the amount, the customer, optional MTD tally,
 * optional thank-you SMS, and a haptic burst.
 *
 * Two variants:
 *   - normal: any paid invoice
 *   - milestone: first-ever paid invoice on this account — extra
 *     copy + a referral nudge
 *
 * Props:
 *   invoice, customer, country, totalPaid, monthToDate (nullable),
 *   isFirstEver, onClose
 */
export default function PaidCelebrationCard({
  invoice, customer, country, totalPaid, monthToDate, isFirstEver, onClose,
}) {
  const cardRef = useRef(null);
  const [sentThanks, setSentThanks] = useState(false);
  const [sendingThanks, setSendingThanks] = useState(false);

  // Scroll the celebration card into view + autofocus close button
  // so Esc / Enter dismiss it cleanly.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { /* */ }
    const close = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);

  const firstName = customer?.name?.split(' ')[0] || 'them';
  const amount = totalPaid > 0 ? totalPaid : Number(invoice?.total || 0);
  const fmt = (n) => formatCurrency(n, country || invoice?.country);

  async function handleThanks() {
    if (sendingThanks || sentThanks) return;
    if (!customer?.phone) return;
    setSendingThanks(true);
    try {
      const r = await smsNotify.customMessage({
        to: customer.phone,
        body: `Thanks ${firstName}! Got the payment for ${invoice?.title || 'the job'} — really appreciate you. Let me know if you need anything else.`,
      });
      if (r?.ok) setSentThanks(true);
    } finally {
      setSendingThanks(false);
    }
  }

  return (
    <div className="pl-paid-card" ref={cardRef} role="status" aria-live="polite">
      <button type="button" className="pl-paid-close" onClick={onClose} aria-label="Dismiss">
        <X size={16} strokeWidth={2} />
      </button>
      {/* Stamp + confetti dots — pure decoration. */}
      <div className="pl-paid-stamp" aria-hidden="true">
        <span className="pl-paid-stamp-text">PAID</span>
        <span className="pl-paid-confetti pl-paid-confetti--1" />
        <span className="pl-paid-confetti pl-paid-confetti--2" />
        <span className="pl-paid-confetti pl-paid-confetti--3" />
        <span className="pl-paid-confetti pl-paid-confetti--4" />
        <span className="pl-paid-confetti pl-paid-confetti--5" />
      </div>
      <div className="pl-paid-body">
        <div className="pl-paid-eyebrow">
          {isFirstEver ? 'Your first paid invoice on Punchlist' : `Payment received from ${customer?.name || 'customer'}`}
        </div>
        <div className="pl-paid-amount tabular">{fmt(amount)}</div>
        {monthToDate && monthToDate > amount && (
          <div className="pl-paid-mtd">
            <strong className="tabular">{fmt(monthToDate)}</strong> collected this month
          </div>
        )}
        {isFirstEver && (
          <p className="pl-paid-milestone">
            This is what Punchlist is for. Save the next quote as a template
            so the next one takes half the time.
          </p>
        )}
        <div className="pl-paid-actions">
          {customer?.phone && (
            <button
              type="button"
              className="btn btn-primary pl-paid-thanks-btn"
              onClick={handleThanks}
              disabled={sendingThanks || sentThanks}
            >
              <MessageSquare size={14} strokeWidth={2} />
              {sentThanks ? 'Thanks sent ✓' : sendingThanks ? 'Sending…' : `Text ${firstName} thanks`}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
