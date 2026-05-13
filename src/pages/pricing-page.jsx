import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Bell, DollarSign, Calendar, Send, Receipt } from 'lucide-react';
import Header from '../components/header';
import { createCheckout } from '../lib/api';
import { PLANS, FEATURE_COMPARISON, FAQ, PRICING } from '../lib/billing';

function CheckIcon() {
  return <span className="pr-check-icon"><svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'><polyline points='20 6 9 17 4 12'/></svg></span>;
}
function XIcon() {
  return <span className="pr-dash-icon">&mdash;</span>;
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pr-faq-item">
      <button type="button" onClick={() => setOpen(!open)} className="pr-faq-q">
        <span>{q}</span>
        <span className="pr-faq-toggle" style={{ transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      {open && (
        <p className="pr-faq-a">{a}</p>
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
      <section className="pr-hero">
        <div className="pr-hero-inner">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Pricing</div>
          <h1 className="pr-hero-title">
            Simple pricing.<br />Pays for itself on one&nbsp;job.
          </h1>
          <p className="muted pr-hero-sub">
            Start free. No credit card. Upgrade when Punchlist is making you money.
          </p>
        </div>
      </section>

      {/* ── ROI STRIP ── */}
      <section className="pr-roi-section">
        <div className="notice-banner pr-roi-banner">
          <strong>One missed line item</strong> on one job costs more than 8 months of Pro. Most contractors miss $150–$300 per job.
        </div>
      </section>

      {/* ── PRICING CARDS ── */}
      <section className="pr-cards-section">
        <div className="pr-cards-grid">

          {/* FREE */}
          <div className="panel pr-card">
            <div className="pr-card-header">
              <div className="pr-tier-label">{free.name}</div>
              <div className="pr-price-row">
                <span className="pr-price">$0</span>
              </div>
              <div className="pr-price-hint">No credit card, no time limit</div>
            </div>
            <div className="pr-features">
              {free.features.map(f => (
                <div key={f} className="pr-feature-row">
                  <CheckIcon /><span>{f}</span>
                </div>
              ))}
            </div>
            <Link className="btn btn-secondary full-width pr-card-cta" to="/signup">
              Build your first quote &rarr;
            </Link>
          </div>

          {/* PRO */}
          <div className="panel pr-card pr-card--popular">
            <div className="pr-popular-badge">Most Popular</div>
            <div className="pr-card-header">
              <div className="pr-tier-label" style={{ color: 'var(--brand)' }}>Pro</div>
              <div className="pr-price-row">
                <span className="pr-price">${PRICING.monthly}</span>
                <span className="pr-price-period">/mo</span>
              </div>
              <div className="pr-price-hint">Full platform. No limits.</div>
            </div>
            <div className="pr-features">
              {pro.features.map(f => (
                <div key={f} className="pr-feature-row">
                  <CheckIcon /><span>{f}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary full-width pr-card-cta" type="button" disabled={checkingOut} onClick={() => handleCheckout('monthly')}>
              {checkingOut ? 'Loading\u2026' : 'Upgrade to Pro'}
            </button>
            <div className="pr-card-note muted">Cancel anytime</div>
          </div>

          {/* ANNUAL */}
          <div className="panel pr-card pr-card--annual">
            <div className="pr-save-badge">Save ${PRICING.annualSavings}</div>
            <div className="pr-card-header">
              <div className="pr-tier-label" style={{ color: 'var(--green)' }}>Annual</div>
              <div className="pr-price-row">
                <span className="pr-price">${PRICING.annual}</span>
                <span className="pr-price-period">/yr</span>
              </div>
              <div className="pr-price-hint">${PRICING.annualMonthly}/mo &middot; save ${PRICING.annualSavings} vs monthly</div>
            </div>
            <div className="pr-features">
              {annual.features.map(f => (
                <div key={f} className="pr-feature-row">
                  <CheckIcon /><span>{f}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary full-width pr-card-cta pr-card-cta--green" type="button" disabled={checkingOut} onClick={() => handleCheckout('yearly')}>
              {checkingOut ? 'Loading\u2026' : 'Get Annual'}
            </button>
            <div className="pr-card-note muted">Best value &middot; cancel anytime</div>
          </div>
        </div>
      </section>

      {/* ── WHEN YOU'LL WANT PRO ── */}
      <section className="pr-why-section">
        <div className="pr-why-inner">
          <h2 className="pr-section-heading">When you'll want Pro</h2>
          <p className="muted pr-section-sub">Upgrade makes sense when Punchlist becomes part of how you run jobs</p>
          <div className="pr-why-grid">
            {[
              { icon: 'send', text: "You're sending more than 5 quotes per month and need unlimited" },
              { icon: 'eye', text: 'Track every view — see the moment customers open your quote' },
              { icon: 'bell', text: 'Follow-up prompts so quotes don\'t go cold' },
              { icon: 'dollar', text: 'Collect deposits upfront before you start work' },
              { icon: 'calendar', text: 'Schedule jobs from the same app you quoted in' },
              { icon: 'receipt', text: 'Invoice customers and collect payment online — they can pay monthly' },
            ].map(({ icon, text }) => (
              <div key={text} className="pr-why-item">
                <span className="pr-why-icon">
                  {icon === 'eye' && <Eye size={18} strokeWidth={1.75} />}
                  {icon === 'bell' && <Bell size={18} strokeWidth={1.75} />}
                  {icon === 'dollar' && <DollarSign size={18} strokeWidth={1.75} />}
                  {icon === 'calendar' && <Calendar size={18} strokeWidth={1.75} />}
                  {icon === 'send' && <Send size={18} strokeWidth={1.75} />}
                  {icon === 'receipt' && <Receipt size={18} strokeWidth={1.75} />}
                </span>
                <span className="pr-why-text">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURE COMPARISON ── */}
      <section className="pr-compare-section">
        <div className="pr-compare-inner">
          <h2 className="pr-section-heading">What's included</h2>
          <div className="panel pr-compare-panel">
            <table className="pr-compare-table">
              <thead>
                <tr>
                  <th className="pr-th pr-th--feature">Feature</th>
                  <th className="pr-th pr-th--plan">Free</th>
                  <th className="pr-th pr-th--plan pr-th--pro">Pro</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_COMPARISON.map(({ feature, free: freeVal, pro: proVal }) => (
                  <tr key={feature} className="pr-tr">
                    <td className="pr-td pr-td--feature">{feature}</td>
                    <td className="pr-td pr-td--plan">
                      {typeof freeVal === 'string' ? <span className="pr-plan-val">{freeVal}</span> : freeVal ? <CheckIcon /> : <XIcon />}
                    </td>
                    <td className="pr-td pr-td--plan">
                      {typeof proVal === 'string' ? <span className="pr-plan-val pr-plan-val--pro">{proVal}</span> : proVal ? <CheckIcon /> : <XIcon />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="pr-faq-section">
        <div className="pr-faq-inner">
          <h2 className="pr-section-heading">Questions</h2>
          {FAQ.map(({ q, a }) => <FAQItem key={q} q={q} a={a} />)}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="pr-final-cta">
        <p className="pr-cad-note muted">All prices in Canadian dollars (CAD).</p>
        <div className="pr-final-inner">
          <h2 className="pr-final-title">You have a job to quote this&nbsp;week.</h2>
          <p className="muted pr-final-sub">Try Punchlist on that one job. Free, no credit card, takes two minutes.</p>
          <Link className="btn btn-primary pr-final-btn" to="/signup">
            Try Punchlist free &rarr;
          </Link>
          <p className="pr-final-login">
            Already have an account?{' '}
            <Link to="/login" className="pr-final-login-link">Log in</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
