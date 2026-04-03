import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/header';
import { createCheckout } from '../lib/api';
import { PLANS, FEATURE_COMPARISON, FAQ, PRICING } from '../lib/billing';

function CheckIcon() {
  return <span style={{ color: 'var(--green)', fontWeight: 700, flexShrink: 0, fontSize: 14 }}>✓</span>;
}
function XIcon() {
  return <span style={{ color: 'var(--muted)', fontWeight: 400, flexShrink: 0, fontSize: 13, opacity: 0.5 }}>—</span>;
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--line)', padding: '16px 0' }}>
      <button type="button" onClick={() => setOpen(!open)} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
        fontSize: 14, fontWeight: 700, color: 'var(--text)', textAlign: 'left', gap: 12,
      }}>
        <span>{q}</span>
        <span style={{ color: 'var(--muted)', fontSize: 18, flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      {open && (
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: '10px 0 0', paddingRight: 24 }}>{a}</p>
      )}
    </div>
  );
}

export default function PricingPage() {
  const [checkingOut, setCheckingOut] = useState(false);

  async function handleCheckout(priceKey) {
    setCheckingOut(true);
    try { await createCheckout(priceKey); }
    catch { setCheckingOut(false); }
  }

  const free = PLANS.free;
  const pro = PLANS.pro_monthly;
  const annual = PLANS.pro_annual;

  return (
    <div className="site-wrap">
      <Header />

      {/* ── HERO ── */}
      <section style={{ padding: '56px 16px 32px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Pricing</div>
          <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', letterSpacing: '-.04em', lineHeight: 1.1, margin: '0 0 14px' }}>
            Simple pricing that pays<br />for itself fast
          </h1>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
            Start free. Upgrade once Punchlist is helping you win real jobs. No credit card required.
          </p>
        </div>
      </section>

      {/* ── ROI STRIP ── */}
      <section style={{ padding: '0 16px 36px', textAlign: 'center' }}>
        <div className="notice-banner" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', fontSize: 14, lineHeight: 1.6, padding: '14px 20px' }}>
          <strong>Think about it:</strong> if Punchlist helps you win one extra job this month, it pays for itself. One missed line item typically costs $100–$300.
        </div>
      </section>

      {/* ── PRICING CARDS ── */}
      <section style={{ padding: '0 16px 48px' }}>
        <div className="pricing-cards-grid" style={{ maxWidth: 880, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'start' }}>

          {/* FREE */}
          <div className="panel" style={{ padding: 24, borderRadius: 'var(--r-xl)' }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{free.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1 }}>$0</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>No credit card required</div>
            </div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
              {free.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                  <CheckIcon /><span>{f}</span>
                </div>
              ))}
            </div>
            <Link className="btn btn-secondary full-width" to="/signup" style={{ fontSize: 13, padding: '11px', borderRadius: 'var(--r)' }}>
              Build your first quote →
            </Link>
          </div>

          {/* PRO — visually dominant */}
          <div className="panel" style={{
            padding: 24, borderRadius: 'var(--r-xl)',
            border: '2px solid var(--brand)',
            boxShadow: '0 8px 32px rgba(232,107,48,.12)',
            position: 'relative',
          }}>
            <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'var(--brand)', color: 'white', fontSize: 10, fontWeight: 800, padding: '3px 12px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap', letterSpacing: '.04em', textTransform: 'uppercase' }}>Most Popular</div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Pro</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1 }}>${PRICING.monthly}</span>
                <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>/mo</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Everything you need to run jobs</div>
            </div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
              {pro.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                  <CheckIcon /><span>{f}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary full-width" style={{ fontSize: 14, padding: '13px', borderRadius: 'var(--r)' }} type="button" disabled={checkingOut} onClick={() => handleCheckout('monthly')}>
              {checkingOut ? 'Loading…' : 'Upgrade to Pro'}
            </button>
            <div className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 8 }}>Cancel anytime</div>
          </div>

          {/* ANNUAL */}
          <div className="panel" style={{ padding: 24, borderRadius: 'var(--r-xl)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: 'white', fontSize: 10, fontWeight: 800, padding: '3px 12px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap', letterSpacing: '.04em', textTransform: 'uppercase' }}>Save ${PRICING.annualSavings}</div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Annual</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1 }}>${PRICING.annual}</span>
                <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>/yr</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>${PRICING.annualMonthly}/mo · save ${PRICING.annualSavings} vs monthly</div>
            </div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
              {annual.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                  <CheckIcon /><span>{f}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary full-width" style={{ fontSize: 14, padding: '13px', borderRadius: 'var(--r)', background: 'var(--green)', borderColor: 'var(--green)' }} type="button" disabled={checkingOut} onClick={() => handleCheckout('yearly')}>
              {checkingOut ? 'Loading…' : 'Get Annual'}
            </button>
            <div className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 8 }}>Best value · cancel anytime</div>
          </div>
        </div>
      </section>

      {/* ── WHEN YOU'LL WANT PRO ── */}
      <section style={{ padding: '32px 16px 48px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.3rem,3vw,1.8rem)', letterSpacing: '-.03em', textAlign: 'center', margin: '0 0 8px' }}>When you'll want Pro</h2>
          <p className="muted" style={{ textAlign: 'center', fontSize: 14, marginBottom: 24 }}>Upgrade makes sense when Punchlist becomes part of how you run jobs</p>
          <div style={{ display: 'grid', gap: 12 }}>
            {[
              { icon: '📤', text: "You're sending quotes regularly and hit the free limit" },
              { icon: '👀', text: 'You want to see when customers open your quotes' },
              { icon: '🔔', text: "You want follow-up reminders so nothing slips" },
              { icon: '💰', text: 'You want to collect deposits before starting work' },
              { icon: '📅', text: "You're booking and scheduling jobs through Punchlist" },
              { icon: '🧾', text: 'You want to invoice and get paid through the app' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--panel-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>{icon}</span>
                <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURE COMPARISON ── */}
      <section style={{ padding: '0 16px 48px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.3rem,3vw,1.8rem)', letterSpacing: '-.03em', textAlign: 'center', margin: '0 0 20px' }}>What's included</h2>
          <div className="panel" style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Feature</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', width: 80 }}>Free</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 12, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.04em', width: 80 }}>Pro</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_COMPARISON.map(({ feature, free: freeVal, pro: proVal }) => (
                  <tr key={feature} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--text-2)' }}>{feature}</td>
                    <td style={{ textAlign: 'center', padding: '10px 14px' }}>
                      {typeof freeVal === 'string' ? <span style={{ fontWeight: 600, fontSize: 12 }}>{freeVal}</span> : freeVal ? <CheckIcon /> : <XIcon />}
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 14px' }}>
                      {typeof proVal === 'string' ? <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--brand)' }}>{proVal}</span> : proVal ? <CheckIcon /> : <XIcon />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '0 16px 48px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.3rem,3vw,1.8rem)', letterSpacing: '-.03em', textAlign: 'center', margin: '0 0 20px' }}>Questions</h2>
          {FAQ.map(({ q, a }) => <FAQItem key={q} q={q} a={a} />)}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: '0 16px 64px', textAlign: 'center' }}>
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', letterSpacing: '-.03em', margin: '0 0 12px' }}>Ready to quote faster?</h2>
          <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>Create your first quote free — no credit card, no commitment.</p>
          <Link className="btn btn-primary" to="/signup" style={{ fontSize: 14, padding: '13px 28px', borderRadius: 'var(--r)' }}>
            Create your first quote free
          </Link>
          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--brand-dark)', fontWeight: 600 }}>Log in</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
