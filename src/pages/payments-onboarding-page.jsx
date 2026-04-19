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
 <div className="pop-flex-679c">
 {showBack && (
 <button
 onClick={onBack}
 className="pop-flex_fs-sm-2223"
 >
 ← Back
 </button>
 )}
 <div className="pop-s26-b119">
 {children}
 </div>
 <style>{`
 @keyframes onb-fade-in {
 from { opacity: 0; transform: translateY(12px); }
 to { opacity: 1; transform: translateY(0); }
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
 <div className="pop-s25-1cb7" />
 )}
 {children}
 </button>
 );
}

function SecondaryBtn({ children, onClick, style }) {
 return (
 <button
 onClick={onClick}
 className="pop-fs-base-9d87"
 >
 {children}
 </button>
 );
}

function TrustBadge({ icon, text }) {
 return (
 <div className="pop-flex_fs-xs-a2fc">
 <span className="pop-fs-md-adf4">{icon}</span>
 <span>{text}</span>
 </div>
 );
}

// ════════════════════════════════════════════════
// SCREEN 1: INTRO — "Get paid faster"
// ════════po-screen-center pop-s23-1d3c════════════════════════
function IntroScreen({ onNext }) {
 return (
 po-screen-icon po-screen-icon--lg pop-s24-c239rent={0} total={4} />

 <div className="po-screen-center" >
 <div className="po-screen-icon po-screen-icon--lg" >
 
 </div>
 <h1 className="po-screen-heading po-screen-heading--lg">
 Get paid faster
 </h1>
 <p className="po-screen-subtext po-screen-subtext--base">
 Let your customers pay directly from ypo-actions-grid pop-s23-1d3c card or monthly installments on bigger jobs. You always get the full amount.
 </p>
 </div>

 {/* Value props */}
 <div className="po-actions-grid" >
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
function ExpectScreen({ onNext, onpo-screen-icon pop-s22-ad36turn (
 <FlowFrame showBack onBack={onBack}>
 <StepDots current={1} total={4} />

 <div className="po-screen-center">
 <div className="po-screen-icon" >
 
 </div>
 <h1 className="po-screen-heading">
 Thipo-feature-row pop-s21-ebebbout 2 minutes
 </h1>
 <p className="po-screen-subtext">
 Here's what you'll need:
 </p>
 </div>

 <div className="po-feature-row" >
 <div className="pop-grid-fb72">
 {[
 { num: '1', title: 'Basic info', desc: 'Your name, address, and date of birth', time: '30 sec' },
 { num: '2', title: 'Bank details', desc: 'Where you want payouts deposited', time: '30 sec' },
 { num: '3', title: 'Quick verification', desc: 'Stripe verifies your identity — usuapo-timeline-num pop-s20-1e50ime: '~1 min' },
 ].map(({ num, title, desc, time }) => (
 <div key={num} className="po-timeline-row">
 <div className="po-timeline-num" >
 {num}
 </div>
 <div className="pop-s19-f72f">
 <div className="pop-flex-3a74">
 <span className="po-timeline-title">{title}</span>
 <span className="po-timeline-time">{time}</span>
 </div>
 <div className="po-timeline-desc">{desc}</div>
 po-trust-grid pop-s18-dbbe </div>
 ))}
 </div>
 </div>

 <PrimaryBtn onClick={onNext}>
 Continue
 </PrimaryBtn>

 <div className="po-trust-grid" >
 <TrustBadge icon="lock" text="All information is encrypted and sent directly to Stripe" />
 </div>
 </FlowFrame>
 );
}

// ════════════════════════════════════════════════
// SCREEN 3: RESPONSIBILITY ACKNOWLEDGMENT
// ════════════════════════════════════════════════
function AcknowledgeScreen({ onNext, onBack, loading }) {
 po-screen-center pop-s3-d5a3, setAccepted] = useState(false);

 return (
 <FlowFrame showBack onBack={onBack}>
 <StepDots current={2} total={4} />

 <div className="po-screen-center" >
 <h1 className="po-screen-heading">
 One quick thing
 </h1>
 <p className="po-screen-spo-feature-row pop-s17-eebb When customers pay through your quotes, you're the one doing the work and handling the relationship.
 </p>
 </div>

 <div className="po-feature-row" s16-b12f24 }}>
 <div className="pop-grid_fs-sm-00a5"eHeight: 1.6 }}>
 <div className="po-timeline-row" >
 <span className="po-feature-icon" >🤝</span>
 <span>Paymenpo-timeline-row pop-s16-b12ffrom your customer to you — Punchlist facilitates the technology but isn't a party to your agreements.</span>
 </div>
 <div className="po-timeline-row" >
 <span className="pop-inline-flex-be92"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></span>
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
 className="pop-s15-d1ce"
 />
 <span className="pop-fs-sm-d89d">
 I understand that I'm responsible for the work I quote and any disputes with my customers. I agree to the{' '}
 <a href="/terms" target="_blank" rel="noopener" className="pop-s14-8abf">
 Terms of Service
 </a>
 {' '}and{' '}
 <a href="/terms#payments" target="_blank" rel="noopener" className="pop-s14-8abf">
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
// ═po-spinner pop-s13-b96b═════════════════════════════════════
function RedirectScreen() {
 return (
 <FlowFramepo-screen-heading pop-fs-xl-1fc7sName="po-screen-text-center">
 <div className="po-spinner" />
 <h2 className="po-screen-heading" >
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
fpo-screen-icon pop-fs-5xl-4221sScreen({ returnTo }) {
 const navigate = useNavigate();
 return (
 <FlowFrame>
 <div className="po-screen-text-center">
 <div className="po-screen-icon" .2s both' }}>
 ✅
 </div>
 <h1 className="po-screen-subtext po-screen-subtext--base pop-s11-74f6>
 You're ready to get paid
 </h1>
 <p className="po-screen-subtext po-screen-subtext--base" >
 Customers will see a <strong className="pop-s10-0ee2">Pay Now</strong> button on every quote and invoice you send. Card payments and monthly installment options are now live.
 </p>
 <p className="pop-fs-xs-8f95">
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
// ═══════════════════po-screen-icon pop-s6-b476═══════════════
function ResumeScreen({ onResume, loading }) {
 return (
 <FlowFrame>
 <div className="po-screen-center">
 <div className="po-screen-icon" 9-b36e2)' }}>
 🔄
 </div>
 <h1 className="po-screen-heading">
 Finish setting up payments
 </h1>
 <p className="po-screen-subtext" >
 You started the setup but didn't finish. Pick up right where you left off — it only takes a minute or two.
 </p>
 </div>

 <PrimaryBtn onClick={onResume} loading={loading}>po-trust-grid pop-s8-152fme secure setup
 </PrimaryBtn>
 <Link to="/app/settings" className="po-skip-link">
 I'll do this later
 </Link>

 <div className="po-trust-grid" >
 <TrustBadge icon="lock" text="Your progress is saved. You won't need to re-enter anything." />
 </div>
 </FlowFrame>
 );
}

// ════════════════════════════════════════════════
// SCREEN: PENDING REVIEW
// ═════════════════════════════════po-screen-icon pop-s7-7839═
function PendingScreen() {
 const navigate = useNavigate();
 return (
 <FlowFrame>
 <div className="po-screen-center">
 <div className="po-screen-icon" >
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
// ═══════════════════════════════════════════════po-screen-center pop-s3-d5a3nRequiredScreen({ requirements, onFix, loading }) {
 po-screen-icon pop-s6-b476dedupeRequirements(requirements);
 return (
 <FlowFrame>
 <div className="po-screen-center" >
 <div className="po-screen-icon" >
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
 <div className="pop-s5-d113",
 }}>
 <div className="po-req-label">
 What's needed
 </div>
 <div className="po-actions-grid" >
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
// Spo-screen-center pop-s3-d5a3D
// ════════════════════════════════════════════════
po-screen-icon pop-s2-ae6bictedScreen({ onFix, loading }) {
 return (
 <FlowFrame>
 <div className="po-screen-center" >
 <div className="po-screen-icon" >
 🚫
 </div>
 <h1 className="po-screen-heading">
 Your payment setup needs attention
 </h1>
 <p className="po-screen-subtext">
 Stripe has paused your account. This usually means they need an updated document or additional verification. Let's get it fixed.
 </p>
 </div>

 <PrimaryBtn onClick={onFix} loading={loading} className="pop-s1-fbfe">
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
// po-spinner pop-s0-e5a1══════════════════════════════════════
function LoadingScreen() {
 return (
 <FlowFrame>
 <div className="po-screen-text-center">
 <div className="po-spinner" />
 <p className="pop-fs-base-7fe5">Checking your payment status…</p>
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
