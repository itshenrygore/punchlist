import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FREE_QUOTE_LIMIT } from '../lib/billing';
import { createCheckout } from '../lib/api';

/**
 * Upgrade system for Punchlist — contextual, useful, not annoying.
 *
 * Components exported:
 *   - UsageMeter          — "2 / 3 free quotes used this month"
 *   - UpgradeBanner       — slim top banner (dismissible per session)
 *   - LockedFeatureCard   — visible but locked Pro feature with upgrade CTA
 *   - UpgradePrompt       — modal overlay (default export)
 *
 * Helper exports:
 *   - shouldShowUpgrade   — fatigue guard
 *   - recordUpgradeShown  — fatigue tracker
 */

// ── Trigger configs ──
const TRIGGERS = {
  quote_limit: {
    icon: '📊',
    headline: "You've sent 5 quotes this month",
    body: (ctx) => `You can still edit and manage your existing quotes. Upgrade to Pro for unlimited quotes and keep the momentum going.`,
    cta: 'Upgrade now',
  },
  near_limit: {
    icon: '⚡',
    headline: "You're getting real use out of Punchlist",
    body: (ctx) => `You've sent ${ctx?.count || 4} of ${FREE_QUOTE_LIMIT} quotes this month. Upgrade anytime for unlimited quotes.`,
    cta: 'Upgrade to Pro',
  },
  quote_viewed: {
    icon: '👀',
    headline: 'Your customer is looking',
    body: (ctx) => `"${ctx?.title || 'Your quote'}" was just viewed. Good sign — you're getting traction. Upgrade anytime to keep sending without limits.`,
    cta: 'Keep the momentum going',
  },
  quote_approved: {
    icon: '🎉',
    headline: 'You just won the job',
    body: (ctx) => `"${ctx?.title || 'Your quote'}" was approved${ctx?.total ? ` for ${ctx.total}` : ''}. Keep the momentum going — upgrade for unlimited quotes and full job tracking.`,
    cta: 'Upgrade now',
  },
  deposits: {
    icon: '💰',
    headline: 'Collect deposits upfront',
    body: () => 'Pro members require deposits before starting work. Get paid faster with Stripe-powered online payments.',
    cta: 'Unlock deposits',
  },
  scheduling: {
    icon: '📅',
    headline: 'Schedule jobs in one click',
    body: () => 'Book jobs directly from approved quotes. See your schedule, avoid conflicts, and keep customers informed.',
    cta: 'Unlock scheduling',
  },
  invoicing: {
    icon: '🧾',
    headline: 'Send invoices in one click',
    body: () => 'Turn completed jobs into professional invoices. Track payments, send reminders, and accept online payments.',
    cta: 'Unlock invoicing',
  },
  additional_work: {
    icon: '🔧',
    headline: 'Handle change requests',
    body: () => 'When scope changes mid-job, send additional work requests for customer approval — no awkward back-and-forth.',
    cta: 'Unlock additional work',
  },
  analytics: {
    icon: '📊',
    headline: 'See how your business is doing',
    body: () => 'Win rate, revenue trends, average job size — Pro members get a full analytics dashboard to grow smarter.',
    cta: 'Unlock analytics',
  },
  follow_ups: {
    icon: '🔔',
    headline: 'Never let a quote go cold',
    body: () => 'Pro members get smart follow-up reminders based on quote activity. Close more jobs by following up at the right time.',
    cta: 'Unlock follow-ups',
  },
};

// ── Fatigue guards ──
function getPromptCount() {
  try { return parseInt(localStorage.getItem('pl_upgrade_shown') || '0', 10); } catch { return 0; }
}
function incrementPromptCount() {
  try { localStorage.setItem('pl_upgrade_shown', String(getPromptCount() + 1)); } catch {}
}
function getLastDismissed() {
  try { return parseInt(localStorage.getItem('pl_upgrade_dismissed_at') || '0', 10); } catch { return 0; }
}
function resetDailyCount() {
  try {
    const lastReset = localStorage.getItem('pl_upgrade_reset_date');
    const today = new Date().toDateString();
    if (lastReset !== today) {
      localStorage.setItem('pl_upgrade_shown', '0');
      localStorage.setItem('pl_upgrade_reset_date', today);
    }
  } catch {}
}

/**
 * Should we show an upgrade prompt?
 * - Max 3 per day
 * - 2-hour cooldown between dismissals
 * - No duplicate triggers per session
 * - Don't show on very first use
 */
export function shouldShowUpgrade(trigger, quotesCount = 0) {
  resetDailyCount();
  if (quotesCount < 1) return false;
  const lastDismissed = getLastDismissed();
  if (Date.now() - lastDismissed < 7200000) return false;
  if (getPromptCount() >= 3) return false;
  try {
    const shown = JSON.parse(sessionStorage.getItem('pl_upgrade_triggers') || '[]');
    if (shown.includes(trigger)) return false;
  } catch {}
  return true;
}

export function recordUpgradeShown(trigger) {
  incrementPromptCount();
  try {
    const shown = JSON.parse(sessionStorage.getItem('pl_upgrade_triggers') || '[]');
    shown.push(trigger);
    sessionStorage.setItem('pl_upgrade_triggers', JSON.stringify(shown));
  } catch {}
}

// ── UsageMeter — "3 of 5 quotes used" (passive, not alarming) ──
export function UsageMeter({ sent, limit }) {
  if (limit === Infinity) return null;
  const pct = Math.min(100, (sent / limit) * 100);
  const atLimit = sent >= limit;
  const nearLimit = sent >= limit - 2 && !atLimit;
  const barColor = atLimit ? 'var(--brand)' : nearLimit ? 'var(--amber)' : 'var(--green)';

  return (
    <div className="usage-meter">
      <div className="usage-meter-label">
        <span className="usage-meter-count">{sent} of {limit}</span>
        <span className="usage-meter-text">quotes used this month</span>
      </div>
      <div className="usage-meter-track">
        <div className="usage-meter-bar" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      {atLimit && (
        <div className="usage-meter-warning">
          <Link to="/pricing" style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 12 }}>Upgrade for unlimited →</Link>
        </div>
      )}
    </div>
  );
}

// ── UpgradeBanner — slim dismissible bar ──
export function UpgradeBanner({ trigger = 'near_limit', context = {}, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);
  const config = TRIGGERS[trigger] || TRIGGERS.near_limit;

  function handleDismiss() {
    setDismissed(true);
    try { sessionStorage.setItem('pl_banner_dismissed_' + trigger, '1'); } catch {}
    onDismiss?.();
  }

  // Check session dismissal
  try { if (sessionStorage.getItem('pl_banner_dismissed_' + trigger) === '1') return null; } catch {}
  if (dismissed) return null;

  return (
    <div className="upgrade-banner">
      <div className="upgrade-banner-content">
        <span className="upgrade-banner-icon">{config.icon}</span>
        <span className="upgrade-banner-text">
          <strong>{config.headline}.</strong>{' '}
          {typeof config.body === 'function' ? config.body(context) : config.body}
        </span>
      </div>
      <div className="upgrade-banner-actions">
        <Link className="btn btn-primary btn-sm" to="/pricing">{config.cta}</Link>
        <button className="upgrade-banner-close" type="button" onClick={handleDismiss} aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}

// ── LockedFeatureCard — shows locked Pro feature with benefit copy ──
export function LockedFeatureCard({ feature = 'deposits', style }) {
  const config = TRIGGERS[feature] || TRIGGERS.deposits;
  const [checkingOut, setCheckingOut] = useState(false);

  async function handleUpgrade() {
    setCheckingOut(true);
    try { await createCheckout('monthly'); }
    catch { setCheckingOut(false); }
  }

  return (
    <div className="locked-card" style={style}>
      <div className="locked-card-badge">Pro</div>
      <div className="locked-card-icon">{config.icon}</div>
      <div className="locked-card-headline">{config.headline}</div>
      <div className="locked-card-body">{typeof config.body === 'function' ? config.body() : config.body}</div>
      <button className="btn btn-primary btn-sm full-width" type="button" disabled={checkingOut} onClick={handleUpgrade}>
        {checkingOut ? 'Loading…' : config.cta}
      </button>
    </div>
  );
}

// ── UpgradePrompt (default export) — modal overlay ──
export default function UpgradePrompt({ trigger = 'quote_limit', context = {}, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const config = TRIGGERS[trigger] || TRIGGERS.quote_limit;

  function handleDismiss() {
    setDismissed(true);
    try { localStorage.setItem('pl_upgrade_dismissed_at', String(Date.now())); } catch {}
    onDismiss?.();
  }

  async function handleUpgrade(priceKey) {
    setCheckingOut(true);
    try { await createCheckout(priceKey); }
    catch { setCheckingOut(false); }
  }

  if (dismissed) return null;

  return (
    <div className="modal-overlay" onClick={handleDismiss}>
      <div className="modal-content upgrade-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Upgrade to Pro">
        <div className="upgrade-modal-icon">{config.icon}</div>
        <h2 className="upgrade-modal-headline">{config.headline}</h2>
        <p className="upgrade-modal-body">{typeof config.body === 'function' ? config.body(context) : config.body}</p>

        <div className="upgrade-modal-pricing">
          <div className="upgrade-modal-options">
            <button className="upgrade-modal-option" type="button" disabled={checkingOut} onClick={() => handleUpgrade('monthly')}>
              <div className="upgrade-modal-option-price">$29<span>/mo</span></div>
              <div className="upgrade-modal-option-label">Monthly</div>
            </button>
            <button className="upgrade-modal-option upgrade-modal-option-best" type="button" disabled={checkingOut} onClick={() => handleUpgrade('yearly')}>
              <div className="upgrade-modal-option-badge">Save $99</div>
              <div className="upgrade-modal-option-price">$249<span>/yr</span></div>
              <div className="upgrade-modal-option-label">Annual · $20.75/mo</div>
            </button>
          </div>
        </div>

        <div className="upgrade-modal-features">
          <div>✓ Unlimited quotes</div>
          <div>✓ Activity tracking</div>
          <div>✓ Deposits & payments</div>
          <div>✓ Scheduling</div>
          <div>✓ Invoicing</div>
          <div>✓ Analytics</div>
        </div>
        <button className="upgrade-modal-dismiss" type="button" onClick={handleDismiss}>Maybe later</button>
      </div>
    </div>
  );
}
