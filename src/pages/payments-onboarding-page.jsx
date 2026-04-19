import StepDots from '../components/ui/StepDots';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';

/* ═══════════════════════════════════════════════════════════════════
   PAYMENTS ONBOARDING FLOW
   A dedicated mini-flow for Stripe Connect setup.
   States: intro → expect → acknowledge → redirect → success
   Also handles: resume, pending_review, action_required, restricted
   ═══════════════════════════════════════════════════════════════════ */

const TERMS_VERSION = '2026-04-07';

// ── Friendly requirement translations ──
const REQUIREMENT_MAP = {
  'individual.first_name': 'Your first name',
  'individual.last_name': 'Your last name',
  'individual.dob.day': 'Date of birth',
  'individual.dob.month': 'Date of birth',
  'individual.dob.year': 'Date of birth',
  'individual.address.line1': 'Your address',
  'individual.address.city': 'Your city',
  'individual.address.state': 'Your province / state',
  'individual.address.postal_code': 'Your postal code',
  'individual.id_number': 'Government ID number',
  'individual.ssn_last_4': 'Last 4 of your SSN',
  'individual.verification.document': 'A photo of your government ID',
  'individual.verification.additional_document': 'An additional verification document',
  'individual.phone': 'Your phone number',
  'individual.email': 'Your email address',
  'business_profile.url': 'Your business website',
  'business_profile.mcc': 'Your business type',
  'business_profile.product_description': 'A description of your services',
  'external_account': 'Your bank account details',
  'tos_acceptance.date': 'Stripe terms acceptance',
  'tos_acceptance.ip': 'Stripe terms acceptance',
};

function friendlyRequirement(raw) {
  return REQUIREMENT_MAP[raw] || raw.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function dedupeRequirements(arr) {
  const seen = new Set();
  return (arr || []).map(friendlyRequirement).filter(label => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

// ── Step indicator ──
// ── Shared layout wrapper ──
function FlowFrame({ children, onBack, showBack = false }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
    }}>
      {showBack && (
        <button
          onClick={onBack}
          style={{
            position: 'fixed', top: 'max(16px, env(safe-area-inset-top, 16px))', left: 16,
            background: 'var(--panel)', border: '1px solid var(--line)',
            borderRadius: 10, padding: '8px 14px', fontSize: 'var(--text-sm)',
            color: 'var(--text-2)', cursor: 'pointer', zIndex: 10,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ← Back
        </button>
      )}
      <div style={{
        width: '100%',
        maxWidth: 440,
        animation: 'onb-fade-in .4s var(--ease)',
      }}>
        {children}
      </div>
      <style>{`
        @keyframes onb-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes onb-check-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes onb-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes onb-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }

        /* ── Payments-onboarding shared layout classes (UX-063) ── */
        .po-screen-icon {
          width: 60px; height: 60px; border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
          font-size: var(--text-3xl);
        }
        .po-screen-icon--lg {
          width: 64px; height: 64px;
          font-size: var(--text-4xl);
        }
        .po-screen-heading {
          font-size: clamp(1.3rem, 4.5vw, 1.6rem);
          font-weight: 800;
          letter-spacing: -.04em;
          margin: 0 0 8px;
          color: var(--text);
        }
        .po-screen-heading--lg {
          font-size: clamp(1.5rem, 5vw, 1.85rem);
          margin: 0 0 10px;
          line-height: 1.15;
        }
        .po-screen-subtext {
          font-size: var(--text-sm);
          color: var(--muted);
          line-height: 1.6;
          margin: 0;
          max-width: 360px;
          margin-left: auto;
          margin-right: auto;
        }
        .po-screen-subtext--base {
          font-size: var(--text-base);
          line-height: 1.65;
          max-width: 340px;
        }
        .po-feature-row {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .po-feature-icon {
          font-size: var(--text-2xl);
          line-height: 1;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .po-feature-title {
          font-size: var(--text-sm);
          font-weight: 700;
          color: var(--text);
          margin-bottom: 2px;
        }
        .po-feature-sub {
          font-size: var(--text-xs);
          color: var(--muted);
          line-height: 1.45;
        }
        .po-timeline-row {
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }
        .po-timeline-num {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: var(--brand-bg);
          border: 1px solid var(--brand-line);
          display: flex; align-items: center; justify-content: center;
          font-size: var(--text-xs); font-weight: 800;
          color: var(--brand);
          flex-shrink: 0;
        }
        .po-timeline-title {
          font-size: var(--text-sm);
          font-weight: 700;
          color: var(--text);
        }
        .po-timeline-time {
          font-size: var(--text-2xs);
          color: var(--subtle);
          font-weight: 500;
          white-space: nowrap;
        }
        .po-timeline-desc {
          font-size: var(--text-xs);
          color: var(--muted);
          line-height: 1.45;
          margin-top: 2px;
        }
        .po-screen-center {
          text-align: center;
          margin-bottom: 28px;
        }
        .po-skip-link {
          display: block;
          text-align: center;
          margin-top: 12px;
          font-size: var(--text-sm);
          color: var(--muted);
          text-decoration: none;
        }
        .po-trust-grid {
          display: grid;
          gap: 8px;
          margin-top: 28px;
        }
        .po-footnote {
          text-align: center;
          margin-top: 16px;
          font-size: var(--text-2xs);
          color: var(--subtle);
          line-height: 1.5;
        }
        .po-panel-box {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 20px;
        }
        .po-req-label {
          font-size: var(--text-2xs);
          font-weight: 700;
          color: var(--subtle);
          text-transform: uppercase;
          letter-spacing: .06em;
          margin-bottom: 10px;
        }
        .po-req-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--amber);
          flex-shrink: 0;
        }
        .po-req-item {
          display: flex;
          gap: 8px;
          align-items: center;
          font-size: var(--text-sm);
          color: var(--text-2);
        }
        .po-actions-grid {
          display: grid;
          gap: 10px;
        }
        .po-spinner {
          border-radius: 50%;
          border: 3px solid var(--line);
          border-top-color: var(--brand);
          animation: onb-spin .8s linear infinite;
        }
        .po-screen-text-center {
          text-align: center;
        }
      `}</style>
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled, loading, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%',
        padding: '15px 24px',
        background: disabled ? 'var(--line)' : 'var(--brand)',
        color: disabled ? 'var(--subtle)' : 'var(--always-white, #fff)',
        border: 'none',
        borderRadius: 12,
        fontSize: 'var(--text-md)',
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all .2s var(--ease)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        letterSpacing: '-.01em',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {loading && (
        <div style={{
          width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)',
          borderTopColor: 'var(--always-white, #fff)', borderRadius: '50%',
          animation: 'onb-spin .6s linear infinite',
        }} />
      )}
      {children}
    </button>
  );
}

function SecondaryBtn({ children, onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '13px 24px',
        background: 'var(--panel)',
        color: 'var(--text-2)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        fontSize: 'var(--text-base)',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all .2s var(--ease)',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function TrustBadge({ icon, text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.4,
    }}>
      <span style={{ fontSize: 'var(--text-md)', flexShrink: 0 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

// ════════════════════════════════════════════════
// SCREEN 1: INTRO — "Get paid faster"
// ════════════════════════════════════════════════
function IntroScreen({ onNext }) {
  return (
    <FlowFrame>
      <StepDots current={0} total={4} />

      <div className="po-screen-center" style={{ marginBottom: 32 }}>
        <div className="po-screen-icon po-screen-icon--lg" style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-line)' }}>
          
        </div>
        <h1 className="po-screen-heading po-screen-heading--lg">
          Get paid faster
        </h1>
        <p className="po-screen-subtext po-screen-subtext--base">
          Let your customers pay directly from your quotes — by card or monthly installments on bigger jobs. You always get the full amount.
        </p>
      </div>

      {/* Value props */}
      <div className="po-actions-grid" style={{ marginBottom: 32 }}>
        {[
          { icon: 'bolt', title: 'Customers pay right from the quote', sub: 'No chasing e-transfers or waiting for cheques' },
          { icon: 'mobile', title: 'Monthly payments close bigger jobs', sub: 'A $6K job becomes $250/mo — easier to say yes' },
          { icon: '✅', title: 'You get the full amount', sub: 'Deposited to your bank within 2 business days' },
        ].map(({ icon, title, sub }) => (
          <div key={title} className="po-feature-row">
            <span className="po-feature-icon">{icon}</span>
            <div>
              <div className="po-feature-title">{title}</div>
              <div className="po-feature-sub">{sub}</div>
            </div>
          </div>
        ))}
      </div>

      <PrimaryBtn onClick={onNext}>
        Set up payments
      </PrimaryBtn>

      <div className="po-skip-link">
        <Link to="/app/settings" className="po-skip-link">
          Maybe later
        </Link>
      </div>

      <div className="po-trust-grid">
        <TrustBadge icon="lock" text="Powered by Stripe — trusted by millions of businesses" />
        <TrustBadge icon="🆓" text="No monthly fees. You only pay a small processing fee when you get paid." />
      </div>
    </FlowFrame>
  );
}

// ════════════════════════════════════════════════
// SCREEN 2: WHAT TO EXPECT
// ════════════════════════════════════════════════
function ExpectScreen({ onNext, onBack }) {
  return (
    <FlowFrame showBack onBack={onBack}>
      <StepDots current={1} total={4} />

      <div className="po-screen-center">
        <div className="po-screen-icon" style={{ background: 'var(--blue-bg)', border: '1px solid rgba(96,165,250,.2)', width: 56, height: 56, borderRadius: 14, margin: '0 auto 18px' }}>
          
        </div>
        <h1 className="po-screen-heading">
          This only takes about 2 minutes
        </h1>
        <p className="po-screen-subtext">
          Here's what you'll need:
        </p>
      </div>

      <div className="po-feature-row" style={{ flexDirection: 'column', gap: 0, padding: '20px', borderRadius: 14, marginBottom: 28 }}>
        <div style={{ display: 'grid', gap: 18 }}>
          {[
            { num: '1', title: 'Basic info', desc: 'Your name, address, and date of birth', time: '30 sec' },
            { num: '2', title: 'Bank details', desc: 'Where you want payouts deposited', time: '30 sec' },
            { num: '3', title: 'Quick verification', desc: 'Stripe verifies your identity — usually instant', time: '~1 min' },
          ].map(({ num, title, desc, time }) => (
            <div key={num} className="po-timeline-row">
              <div className="po-timeline-num" style={{ borderRadius: 8 }}>
                {num}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span className="po-timeline-title">{title}</span>
                  <span className="po-timeline-time">{time}</span>
                </div>
                <div className="po-timeline-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <PrimaryBtn onClick={onNext}>
        Continue
      </PrimaryBtn>

      <div className="po-trust-grid" style={{ marginTop: 24 }}>
        <TrustBadge icon="lock" text="All information is encrypted and sent directly to Stripe" />
      </div>
    </FlowFrame>
  );
}

// ════════════════════════════════════════════════
// SCREEN 3: RESPONSIBILITY ACKNOWLEDGMENT
// ════════════════════════════════════════════════
function AcknowledgeScreen({ onNext, onBack, loading }) {
  const [accepted, setAccepted] = useState(false);

  return (
    <FlowFrame showBack onBack={onBack}>
      <StepDots current={2} total={4} />

      <div className="po-screen-center" style={{ marginBottom: 24 }}>
        <h1 className="po-screen-heading">
          One quick thing
        </h1>
        <p className="po-screen-subtext">
          When customers pay through your quotes, you're the one doing the work and handling the relationship.
        </p>
      </div>

      <div className="po-feature-row" style={{ flexDirection: 'column', gap: 0, padding: '20px', borderRadius: 14, marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 14, fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.6 }}>
          <div className="po-timeline-row" style={{ gap: 10 }}>
            <span className="po-feature-icon" style={{ fontSize: 'var(--text-md)' }}>🤝</span>
            <span>Payments go directly from your customer to you — Punchlist facilitates the technology but isn't a party to your agreements.</span>
          </div>
          <div className="po-timeline-row" style={{ gap: 10 }}>
            <span style={{ flexShrink:0, display:"inline-flex", color:"var(--muted)", marginTop:1 }}><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></span>
            <span>You're responsible for job quality, customer disputes, refunds, and chargebacks — just like any other payment you'd accept.</span>
          </div>
        </div>
      </div>

      {/* Checkbox */}
      <label
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          cursor: 'pointer',
          padding: '16px',
          background: accepted ? 'var(--brand-bg)' : 'var(--panel)',
          border: `1px solid ${accepted ? 'var(--brand-line)' : 'var(--line)'}`,
          borderRadius: 12,
          marginBottom: 24,
          transition: 'all .2s var(--ease)',
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          border: `2px solid ${accepted ? 'var(--brand)' : 'var(--line-2)'}`,
          background: accepted ? 'var(--brand)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: 1,
          transition: 'all .2s var(--ease)',
          animation: accepted ? 'onb-check-pop .25s var(--ease)' : 'none',
        }}>
          {accepted && (
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <path d="M1 5L4.5 8.5L11 1.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <input
          type="checkbox"
          checked={accepted}
          onChange={e => setAccepted(e.target.checked)}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        />
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.55 }}>
          I understand that I'm responsible for the work I quote and any disputes with my customers. I agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener" style={{ color: 'var(--brand)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
            Terms of Service
          </a>
          {' '}and{' '}
          <a href="/terms#payments" target="_blank" rel="noopener" style={{ color: 'var(--brand)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
            Payment Terms
          </a>.
        </span>
      </label>

      <PrimaryBtn onClick={() => onNext()} disabled={!accepted} loading={loading}>
        Continue to secure setup
      </PrimaryBtn>

      <p className="po-footnote">
        You'll be redirected to Stripe to enter your bank details and verify your identity. Punchlist never sees your banking information.
      </p>
    </FlowFrame>
  );
}

// ════════════════════════════════════════════════
// SCREEN 4: REDIRECT TRANSITION
// ════════════════════════════════════════════════
function RedirectScreen() {
  return (
    <FlowFrame>
      <div className="po-screen-text-center">
        <div className="po-spinner" style={{ width: 48, height: 48, margin: '0 auto 24px' }} />
        <h2 className="po-screen-heading" style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
          Taking you to Stripe…
        </h2>
        <p className="po-screen-subtext">
          You'll finish setup on Stripe's secure site, then come right back.
        </p>
      </div>
    </FlowFrame>
  );
}

// ════════════════════════════════════════════════
// SCREEN 5: SUCCESS
// ════════════════════════════════════════════════
function SuccessScreen({ returnTo }) {
  const navigate = useNavigate();
  return (
    <FlowFrame>
      <div className="po-screen-text-center">
        <div className="po-screen-icon" style={{ width: 72, height: 72, borderRadius: 18, background: 'var(--green-bg)', border: '1px solid var(--green-line)', margin: '0 auto 24px', fontSize: 'var(--text-5xl)', animation: 'onb-check-pop .4s var(--ease) .2s both' }}>
          ✅
        </div>
        <h1 className="po-screen-heading po-screen-heading--lg" style={{ margin: '0 0 10px' }}>
          You're ready to get paid
        </h1>
        <p className="po-screen-subtext po-screen-subtext--base" style={{ margin: '0 0 8px' }}>
          Customers will see a <strong style={{ color: 'var(--text)' }}>Pay Now</strong> button on every quote and invoice you send. Card payments and monthly installment options are now live.
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--subtle)', lineHeight: 1.5, margin: '0 0 32px' }}>
          Funds are deposited to your bank within 2 business days.
        </p>

        <div className="po-actions-grid">
          <PrimaryBtn onClick={() => navigate(returnTo || '/app/quotes/new')}>
            {returnTo ? 'Back to your quote' : 'Create a quote'}
          </PrimaryBtn>
          <SecondaryBtn onClick={() => navigate('/app')}>
            Go to dashboard
          </SecondaryBtn>
        </div>
      </div>
    </FlowFrame>
  );
}

// ════════════════════════════════════════════════
// SCREEN: RESUME SETUP (incomplete onboarding)
// ════════════════════════════════════════════════
function ResumeScreen({ onResume, loading }) {
  return (
    <FlowFrame>
      <div className="po-screen-center">
        <div className="po-screen-icon" style={{ background: 'var(--amber-bg)', border: '1px solid rgba(245,158,11,.2)' }}>
          🔄
        </div>
        <h1 className="po-screen-heading">
          Finish setting up payments
        </h1>
        <p className="po-screen-subtext" style={{ maxWidth: 340 }}>
          You started the setup but didn't finish. Pick up right where you left off — it only takes a minute or two.
        </p>
      </div>

      <PrimaryBtn onClick={onResume} loading={loading}>
        Resume secure setup
      </PrimaryBtn>
      <Link to="/app/settings" className="po-skip-link">
        I'll do this later
      </Link>

      <div className="po-trust-grid" style={{ marginTop: 24, gap: 0 }}>
        <TrustBadge icon="lock" text="Your progress is saved. You won't need to re-enter anything." />
      </div>
    </FlowFrame>
  );
}

// ════════════════════════════════════════════════
// SCREEN: PENDING REVIEW
// ════════════════════════════════════════════════
function PendingScreen() {
  const navigate = useNavigate();
  return (
    <FlowFrame>
      <div className="po-screen-center">
        <div className="po-screen-icon" style={{ background: 'var(--blue-bg)', border: '1px solid rgba(96,165,250,.2)' }}>
          🔍
        </div>
        <h1 className="po-screen-heading">
          Your account is being reviewed
        </h1>
        <p className="po-screen-subtext">
          Stripe is verifying your details. This usually takes a few minutes, but can sometimes take up to 24 hours. We'll let you know as soon as you're approved.
        </p>
      </div>

      <PrimaryBtn onClick={() => navigate('/app')}>
        Back to dashboard
      </PrimaryBtn>
      <p className="po-footnote">
        You don't need to do anything — we'll email you when it's ready.
      </p>
    </FlowFrame>
  );
}

// ════════════════════════════════════════════════
// SCREEN: ACTION REQUIRED
// ════════════════════════════════════════════════
function ActionRequiredScreen({ requirements, onFix, loading }) {
  const items = dedupeRequirements(requirements);
  return (
    <FlowFrame>
      <div className="po-screen-center" style={{ marginBottom: 24 }}>
        <div className="po-screen-icon" style={{ background: 'var(--amber-bg)', border: '1px solid rgba(245,158,11,.2)' }}>
          ⚠
        </div>
        <h1 className="po-screen-heading">
          Stripe needs a few more details
        </h1>
        <p className="po-screen-subtext">
          Almost there — just a couple of things to finish up.
        </p>
      </div>

      {items.length > 0 && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: '16px 18px',
          marginBottom: 24,
        }}>
          <div className="po-req-label">
            What's needed
          </div>
          <div className="po-actions-grid" style={{ gap: 8 }}>
            {items.map(label => (
              <div key={label} className="po-req-item">
                <div className="po-req-dot" />
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      <PrimaryBtn onClick={onFix} loading={loading}>
        Fix this now
      </PrimaryBtn>
      <Link to="/app/settings" className="po-skip-link">
        I'll do this later
      </Link>
    </FlowFrame>
  );
}

// ════════════════════════════════════════════════
// SCREEN: RESTRICTED
// ════════════════════════════════════════════════
function RestrictedScreen({ onFix, loading }) {
  return (
    <FlowFrame>
      <div className="po-screen-center" style={{ marginBottom: 24 }}>
        <div className="po-screen-icon" style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,.2)' }}>
          🚫
        </div>
        <h1 className="po-screen-heading">
          Your payment setup needs attention
        </h1>
        <p className="po-screen-subtext">
          Stripe has paused your account. This usually means they need an updated document or additional verification. Let's get it fixed.
        </p>
      </div>

      <PrimaryBtn onClick={onFix} loading={loading} style={{ background: 'var(--red)' }}>
        Fix payment setup
      </PrimaryBtn>
      <Link to="/app/settings" className="po-skip-link">
        Back to settings
      </Link>
    </FlowFrame>
  );
}

// ════════════════════════════════════════════════
// SCREEN: LOADING
// ════════════════════════════════════════════════
function LoadingScreen() {
  return (
    <FlowFrame>
      <div className="po-screen-text-center">
        <div className="po-spinner" style={{ width: 40, height: 40, margin: '0 auto 20px' }} />
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--muted)' }}>Checking your payment status…</p>
      </div>
    </FlowFrame>
  );
}


// ════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ════════════════════════════════════════════════
export default function PaymentsOnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show: toast } = useToast();
  const [searchParams] = useSearchParams();

  // Where to return after success (e.g. /app/quotes/review/abc)
  const returnTo = searchParams.get('return') || null;
  const connectParam = searchParams.get('connect'); // 'complete' or 'refresh'

  const [screen, setScreen] = useState('loading'); // loading | intro | expect | acknowledge | redirect | success | resume | pending | action_required | restricted
  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const hasChecked = useRef(false);

  // ── Determine initial screen from account state ──
  const checkStatus = useCallback(async () => {
    if (!user) return null;
    try {
      const r = await fetch('/api/connect-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', userId: user.id }),
      });
      const data = await r.json();
      setStatusData(data);

      if (data.onboarded && data.chargesEnabled) {
        setScreen('success');
      } else if (data.paymentState === 'action_required') {
        setScreen('action_required');
      } else if (data.paymentState === 'restricted') {
        setScreen('restricted');
      } else if (data.paymentState === 'pending_review') {
        setScreen('pending');
      } else if (data.connected && !data.onboarded) {
        if (data.termsAccepted) {
          setScreen('resume');
        } else {
          setScreen('intro');
        }
      } else {
        setScreen('intro');
      }
      return data;
    } catch {
      setScreen('intro');
      return null;
    }
  }, [user]);

  useEffect(() => {
    if (hasChecked.current || !user) return;
    hasChecked.current = true;

    if (connectParam === 'complete') {
      checkStatus().then(() => {
        window.history.replaceState({}, '', '/app/payments/setup' + (returnTo ? `?return=${encodeURIComponent(returnTo)}` : ''));
      });
    } else if (connectParam === 'refresh') {
      // Stripe link expired — check status first to know if account exists, then redirect
      checkStatus().then(data => {
        if (data?.connected) {
          doStripeRedirect(true);
        } else {
          setScreen('intro');
        }
      });
    } else {
      checkStatus();
    }
  }, [user, connectParam, checkStatus, returnTo]);

  // ── Create / refresh Stripe account link and redirect ──
  // isRefresh: force action='refresh' (used when we know account exists)
  async function doStripeRedirect(isRefresh = false) {
    if (!user) return;
    setLoading(true);
    setScreen('redirect');
    try {
      const hasAccount = isRefresh || statusData?.connected;
      const action = hasAccount ? 'refresh' : 'create';
      const returnPath = '/app/payments/setup' + (returnTo ? `?return=${encodeURIComponent(returnTo)}` : '');

      const r = await fetch('/api/connect-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId: user.id,
          returnPath,
        }),
      });
      const data = await r.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast(data.error || 'Could not start Stripe setup. Try again.', 'error');
        setScreen('intro');
        setLoading(false);
      }
    } catch {
      toast('Connection error. Check your internet and try again.', 'error');
      setScreen('intro');
      setLoading(false);
    }
  }

  // ── Save terms acceptance then redirect to Stripe ──
  async function handleAcknowledge() {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch('/api/connect-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept_terms',
          userId: user.id,
          termsVersion: TERMS_VERSION,
        }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error);

      // Now create/refresh the Stripe link
      await doStripeRedirect();
    } catch (e) {
      toast(e?.message || 'Something broke on our end. Try again in a moment.', 'error');
      setLoading(false);
    }
  }

  // ── Screen routing ──
  if (screen === 'loading') return <LoadingScreen />;

  if (screen === 'intro') {
    return <IntroScreen onNext={() => setScreen('expect')} />;
  }

  if (screen === 'expect') {
    return <ExpectScreen onNext={() => setScreen('acknowledge')} onBack={() => setScreen('intro')} />;
  }

  if (screen === 'acknowledge') {
    return (
      <AcknowledgeScreen
        onNext={handleAcknowledge}
        onBack={() => setScreen('expect')}
        loading={loading}
      />
    );
  }

  if (screen === 'redirect') return <RedirectScreen />;

  if (screen === 'success') {
    return <SuccessScreen returnTo={returnTo} />;
  }

  if (screen === 'resume') {
    return <ResumeScreen onResume={doStripeRedirect} loading={loading} />;
  }

  if (screen === 'pending') return <PendingScreen />;

  if (screen === 'action_required') {
    return (
      <ActionRequiredScreen
        requirements={statusData?.requirements || []}
        onFix={doStripeRedirect}
        loading={loading}
      />
    );
  }

  if (screen === 'restricted') {
    return <RestrictedScreen onFix={doStripeRedirect} loading={loading} />;
  }

  return <LoadingScreen />;
}
