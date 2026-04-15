import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/header';
import { createCheckout } from '../lib/api';
import { PLANS, FEATURE_COMPARISON, FAQ, PRICING } from '../lib/billing';

function CheckIcon() {
  return <span style={{ color: 'var(--green)', flexShrink: 0, display:'inline-flex' }}><svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'><polyline points='20 6 9 17 4 12'/></svg></span>;
}
function XIcon() {
  return <span style={{ color: 'var(--muted)', fontWeight: 400, flexShrink: 0, fontSize: 'var(--text-sm)', opacity: 0.5 }}>—</span>;
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--line)', padding: '16px 0' }}>
      <button type="button" onClick={() => setOpen(!open)} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
        fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text)', textAlign: 'left', gap: 12,
      }}>
        <span>{q}</span>
        <span style={{ color: 'var(--muted)', fontSize: 'var(--text-xl)', flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      {open && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.6, margin: '10px 0 0', paddingRight: 24 }}>{a}</p>
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
            Simple pricing.<br />Pays for itself on one&nbsp;job.
          </h1>
          <p className="muted" style={{ fontSize: 'var(--text-md)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
            Start free. No credit card. Upgrade when Punchlist is making you money.
          </p>
        </div>
      </section>

      {/* ── ROI STRIP ── */}
      <section style={{ padding: '0 16px 36px', textAlign: 'center' }}>
        <div className="notice-banner" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', fontSize: 'var(--text-base)', lineHeight: 1.6, padding: '14px 20px' }}>
          <strong>One missed line item</strong> on one job costs more than 8 months of Pro. Most contractors miss $150–$300 per job.
        </div>
      </section>

      {/* ── PRICING CARDS ── */}
      <section style={{ padding: '0 16px 48px' }}>
        <div className="pricing-cards-grid" style={{ maxWidth: 880, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'start' }}>

          {/* FREE */}
          <div className="panel" style={{ padding: 24, borderRadius: 'var(--r-xl)' }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{free.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1 }}>$0</span>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: 4 }}>No credit card, no time limit</div>
            </div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
              {free.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
                  <CheckIcon /><span>{f}</span>
                </div>
              ))}
            </div>
            <Link className="btn btn-secondary full-width" to="/signup" style={{ fontSize: 'var(--text-sm)', padding: '11px', borderRadius: 'var(--r)' }}>
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
            <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'var(--brand)', color: 'white', fontSize: 'var(--text-2xs)', fontWeight: 800, padding: '3px 12px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap', letterSpacing: '.04em', textTransform: 'uppercase' }}>Most Popular</div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Pro</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1 }}>${PRICING.monthly}</span>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--muted)', fontWeight: 500 }}>/mo</span>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: 4 }}>Full platform. No limits.</div>
            </div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
              {pro.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
                  <CheckIcon /><span>{f}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary full-width" style={{ fontSize: 'var(--text-base)', padding: '13px', borderRadius: 'var(--r)' }} type="button" disabled={checkingOut} onClick={() => handleCheckout('monthly')}>
              {checkingOut ? 'Loading…' : 'Upgrade to Pro'}
            </button>
            <div className="muted" style={{ fontSize: 'var(--text-2xs)', textAlign: 'center', marginTop: 8 }}>Cancel anytime</div>
          </div>

          {/* ANNUAL */}
          <div className="panel" style={{ padding: 24, borderRadius: 'var(--r-xl)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: 'white', fontSize: 'var(--text-2xs)', fontWeight: 800, padding: '3px 12px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap', letterSpacing: '.04em', textTransform: 'uppercase' }}>Save ${PRICING.annualSavings}</div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Annual</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1 }}>${PRICING.annual}</span>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--muted)', fontWeight: 500 }}>/yr</span>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: 4 }}>${PRICING.annualMonthly}/mo · save ${PRICING.annualSavings} vs monthly</div>
            </div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
              {annual.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
                  <CheckIcon /><span>{f}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary full-width" style={{ fontSize: 'var(--text-base)', padding: '13px', borderRadius: 'var(--r)', background: 'var(--green)', borderColor: 'var(--green)' }} type="button" disabled={checkingOut} onClick={() => handleCheckout('yearly')}>
              {checkingOut ? 'Loading…' : 'Get Annual'}
            </button>
            <div className="muted" style={{ fontSize: 'var(--text-2xs)', textAlign: 'center', marginTop: 8 }}>Best value · cancel anytime</div>
          </div>
        </div>
      </section>

      {/* ── WHEN YOU'LL WANT PRO ── */}
      <section style={{ padding: '32px 16px 48px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.3rem,3vw,1.8rem)', letterSpacing: '-.03em', textAlign: 'center', margin: '0 0 8px' }}>When you'll want Pro</h2>
          <p className="muted" style={{ textAlign: 'center', fontSize: 'var(--text-base)', marginBottom: 24 }}>Upgrade makes sense when Punchlist becomes part of how you run jobs</p>
          <div style={{ display: 'grid', gap: 12 }}>
            {[
              { icon: 'send', text: "You're sending more than 5 quotes per month and need unlimited" },
              { icon: 'eye', text: 'Track every view — see the moment customers open your quote' },
              { icon: 'bell', text: 'Follow-up prompts so quotes don\'t go cold' },
              { icon: 'dollar', text: 'Collect deposits upfront before you start work' },
              { icon: 'calendar', text: 'Schedule jobs from the same app you quoted in' },
              { icon: 'receipt', text: 'Invoice customers and collect payment online — they can pay monthly' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--panel-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                <span style={{ flexShrink: 0, display:'inline-flex', alignItems:'center', color:'var(--brand)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html: {eye:'<path d=\"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>',bell:'<path d=\"M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9\"/><path d=\"M13.73 21a2 2 0 0 1-3.46 0\"/>',dollar:'<line x1=\"12\" y1=\"1\" x2=\"12\" y2=\"23\"/><path d=\"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6\"/>',calendar:'<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\"/><line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/><line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/><line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/>',send:'<line x1=\"22\" y1=\"2\" x2=\"11\" y2=\"13\"/><polygon points=\"22 2 15 22 11 13 2 9 22 2\"/>',receipt:'<path d=\"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z\"/><line x1=\"16\" y1=\"8\" x2=\"8\" y2=\"8\"/><line x1=\"16\" y1=\"12\" x2=\"8\" y2=\"12\"/><line x1=\"12\" y1=\"16\" x2=\"8\" y2=\"16\"/>'}[icon]}} />
                </span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.5 }}>{text}</span>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Feature</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', width: 80 }}>Free</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.04em', width: 80 }}>Pro</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_COMPARISON.map(({ feature, free: freeVal, pro: proVal }) => (
                  <tr key={feature} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--text-2)' }}>{feature}</td>
                    <td style={{ textAlign: 'center', padding: '10px 14px' }}>
                      {typeof freeVal === 'string' ? <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>{freeVal}</span> : freeVal ? <CheckIcon /> : <XIcon />}
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 14px' }}>
                      {typeof proVal === 'string' ? <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--brand)' }}>{proVal}</span> : proVal ? <CheckIcon /> : <XIcon />}
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
          <h2 style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', letterSpacing: '-.03em', margin: '0 0 12px' }}>You have a job to quote this&nbsp;week.</h2>
          <p className="muted" style={{ fontSize: 'var(--text-base)', marginBottom: 20 }}>Try Punchlist on that one job. Free, no credit card, takes two minutes.</p>
          <Link className="btn btn-primary" to="/signup" style={{ fontSize: 'var(--text-base)', padding: '13px 28px', borderRadius: 'var(--r)' }}>
            Try Punchlist free →
          </Link>
          <p style={{ marginTop: 16, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--brand-dark)', fontWeight: 600 }}>Log in</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
