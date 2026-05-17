/* ═══════════════════════════════════════════════════════════════
   Punchlist — Landing page (v7 — premium, tight copy)
   ═══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X, Check, Star } from 'lucide-react';
import Logo from '../components/logo';
import '../styles/landing.css';

function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); }
      }),
      { threshold: 0.06, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.rv').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ── Nav ── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <nav className={`ln-nav${scrolled ? ' ln-nav--s' : ''}`}>
      <div className="ln-w ln-nav-in">
        <Link to="/" className="ln-nav-logo"><Logo size="sm" /></Link>
        <div className={`ln-nav-links${open ? ' --open' : ''}`}>
          <a href="#how" className="ln-nav-a" onClick={() => setOpen(false)}>How it works</a>
          <a href="#pricing" className="ln-nav-a" onClick={() => setOpen(false)}>Pricing</a>
          <Link to="/login" className="ln-nav-a" onClick={() => setOpen(false)}>Log in</Link>
          <Link to="/signup" className="ln-btn ln-btn--sm" onClick={() => setOpen(false)}>Start free</Link>
        </div>
        <button className="ln-nav-mob" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </nav>
  );
}

/* ── Interactive Quote Card ── */
const ITEMS = [
  { name: 'Remove & dispose of existing furnace + AC', price: 480 },
  { name: 'Supply & install gas furnace — 96% AFUE, 80k BTU', price: 4200 },
  { name: 'Supply & install central AC — 3.5 ton, 16 SEER', price: 4600 },
  { name: 'Lineset, flue liner, electrical & Ecobee thermostat', price: 1520 },
];
const TOTAL = ITEMS.reduce((s, i) => s + i.price, 0); // $10,800 — all terms divide clean
const TERMS = [6, 12, 18, 24];

function LiveQuoteCard() {
  const [term, setTerm] = useState(24);
  const [approved, setApproved] = useState(false);
  const monthly = Math.ceil(TOTAL / term);

  return (
    <div className="qc">
      <div className="qc-badge">Live demo — try it</div>
      <div className="qc-body">
        <div className="qc-head">
          <div className="qc-avatar">CA</div>
          <div>
            <div className="qc-biz">Comfort Air HVAC Ltd.</div>
            <div className="qc-job">Furnace + AC Replacement — Full System</div>
          </div>
          <div className="qc-status-dot" />
        </div>

        <div className="qc-price">
          <div className="qc-anchor-row">
            <span className="qc-anchor-label">Job total</span>
            <span className="qc-anchor-total">${TOTAL.toLocaleString()}</span>
          </div>
          <div className="qc-divider" />
          <div className="qc-price-label">Your customer sees</div>
          <div className="qc-monthly" key={monthly}>
            <span className="qc-mo-n">${monthly.toLocaleString()}</span>
            <span className="qc-mo-u">/mo</span>
          </div>
          <div className="qc-total-line">You get paid ${TOTAL.toLocaleString()} in full</div>
        </div>

        <div className="qc-terms">
          {TERMS.map(t => (
            <button key={t} type="button"
              className={`qc-t${term === t ? ' qc-t--on' : ''}`}
              onClick={() => { setTerm(t); setApproved(false); }}>
              {t}mo
            </button>
          ))}
        </div>

        <div className="qc-items">
          {ITEMS.map((it, i) => (
            <div key={i} className="qc-row">
              <span className="qc-row-name">{it.name}</span>
              <span className="qc-row-p">${it.price.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {!approved ? (
          <button className="qc-cta" type="button" onClick={() => setApproved(true)}>
            Approve — ${monthly.toLocaleString()}/mo <ArrowRight size={14} />
          </button>
        ) : (
          <div className="qc-ok">
            <div className="qc-ok-icon">✓</div>
            <div>
              <div className="qc-ok-title">Approved</div>
              <div className="qc-ok-sub">${TOTAL.toLocaleString()} in your account in 2 days</div>
            </div>
          </div>
        )}
        <div className="qc-hint">
          {!approved ? 'Tap a term to change the monthly price' : 'Customer pays monthly. You got the full amount.'}
        </div>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function LandingPage() {
  useReveal();
  useEffect(() => {
    document.title = 'Punchlist — Quotes that close.';
  }, []);

  return (
    <div className="ln">
      <Nav />

      {/* ═══ 1. HERO ═══ */}
      <section className="ln-hero">
        <div className="ln-hero-bg" aria-hidden="true">
          <div className="ln-hero-orb ln-hero-orb--1" />
          <div className="ln-hero-orb ln-hero-orb--2" />
          <div className="ln-hero-grid-lines" />
        </div>
        <div className="ln-w ln-hero-inner">
          <div className="ln-hero-txt">
            <h1 className="ln-h1 rv">
              Stop losing $5,000 jobs<br />
              <span className="ln-hi">to sticker shock.</span>
            </h1>
            <p className="ln-hero-p rv rv--d1">
              Describe any job. AI builds the full itemized scope.
              Your customer gets a monthly price they'll actually say yes to.
            </p>
            <div className="ln-hero-ctas rv rv--d2">
              <Link to="/signup" className="ln-btn ln-btn--hero">
                Start free <ArrowRight size={16} />
              </Link>
              <a href="#how" className="ln-btn ln-btn--ghost">See how it works</a>
            </div>
            <div className="ln-hero-tags rv rv--d3">
              <span><Check size={12} strokeWidth={3} />5 free quotes/month</span>
              <span><Check size={12} strokeWidth={3} />Works from your phone</span>
              <span><Check size={12} strokeWidth={3} />No credit card</span>
            </div>
          </div>
          <div className="ln-hero-card rv rv--d1">
            <LiveQuoteCard />
          </div>
        </div>
      </section>

      {/* ═══ 2. TRADES STRIP ═══ */}
      <div className="ln-proof-bar rv">
        <div className="ln-w trades-strip">
          <span className="trades-strip-label">Built for</span>
          <div className="trades-strip-list">
            {['Plumbers', 'Electricians', 'HVAC Techs', 'Roofers', 'General Contractors', 'Renovators'].map((t) => (
              <span key={t} className="trades-strip-trade">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ 3. HOW IT WORKS ═══ */}
      <section className="ln-sec" id="how">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">How it works</span>
            <h2 className="ln-h2">Quote to approved in under 3 minutes.</h2>
          </div>
          <div className="steps-grid">
            {[
              {
                num: '01',
                title: 'Describe the job',
                desc: 'Type what you\'re quoting in plain English. AI builds a full itemized scope with trade-accurate pricing.',
                in: '200A panel upgrade, knob-and-tube removal, 2-car garage sub-panel…',
                out: '→ 7 line items · $7,800 · 9 sec',
              },
              {
                num: '02',
                title: 'Set the monthly term',
                desc: 'Pick 6, 12, 18, or 24 months. Your customer sees a number that fits their budget. You always get paid the full amount.',
                in: '$7,800 total',
                out: '→ Customer sees $325/mo',
              },
              {
                num: '03',
                title: 'Customer approves. Done.',
                desc: 'They tap Approve from their phone. A licensed lender pays you the full amount — typically within 1–2 business days.',
                in: 'Mike tapped "Approve"',
                out: '→ $7,800 deposited in 1–2 business days',
              },
            ].map((s, i) => (
              <div key={i} className={`step-card rv rv--d${i}`}>
                <div className="step-num">{s.num}</div>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
                <div className="step-example">
                  <div className="step-ex-in">{s.in}</div>
                  <div className="step-ex-out">{s.out}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. FEATURES ═══ */}
      <section className="ln-dark">
        <div className="ln-dark-noise" aria-hidden="true" />
        <div className="ln-w">
          <div className="ln-sh--light rv">
            <span className="ln-ey ln-ey--light">What's included</span>
            <h2 className="ln-h2 ln-h2--light">Everything you need to close the job.</h2>
          </div>
          <div className="feat-grid">
            {[
              {
                icon: '🤖',
                title: 'AI Scope Builder',
                desc: 'Describe the job in plain English. Get a full itemized scope with trade-accurate line items in seconds — not 45 minutes.',
              },
              {
                icon: '👁',
                title: 'See when they view it',
                desc: 'Know the moment your customer opens the quote. No more guessing when to follow up.',
              },
              {
                icon: '🛡',
                title: 'Foreman',
                desc: 'Catches missed line items and underpricing before you send. Your margin, protected on every job.',
              },
              {
                icon: '💳',
                title: 'Deposits & invoicing',
                desc: 'Collect a deposit on approval. Invoice when done. Track what\'s paid — all in one place.',
              },
              {
                icon: '📱',
                title: 'Built for the job site',
                desc: 'Build, send, and track quotes from your phone. First quote takes 3 minutes.',
              },
              {
                icon: '✍️',
                title: 'E-signature',
                desc: 'Customers sign on the quote link. No printing, no scanning, no back and forth.',
              },
            ].map((f, i) => (
              <div key={i} className={`feat-card feat-card--dark rv rv--d${Math.min(i % 3, 2)}`}>
                <div className="feat-icon">{f.icon}</div>
                <div className="feat-title">{f.title}</div>
                <div className="feat-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5. THE CATCH ═══ */}
      <section className="ln-sec">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">No catch</span>
            <h2 className="ln-h2">The questions every contractor asks first.</h2>
          </div>
          <div className="catch-grid">
            {[
              {
                q: 'Who takes the financing risk?',
                a: 'Not you — ever. A licensed consumer lender underwrites the loan and pays you the full job amount upfront, typically within 1–2 business days. If your customer misses a payment later, that\'s between them and the lender. Your money is already in your account.',
              },
              {
                q: 'What if my customer isn\'t approved?',
                a: 'The quote automatically falls back to showing the full price. Nothing breaks. The job stays live and your customer can still approve it at the lump sum — or you can adjust the quote and resend.',
              },
              {
                q: 'What does it cost me?',
                a: 'Free for 5 quotes/month — no card required, no time limit. Pro is $29/month: unlimited quotes, activity tracking, Foreman, invoicing, and deposit collection. One extra closed job covers a full year.',
              },
            ].map((item, i) => (
              <div key={i} className={`catch-card rv rv--d${i}`}>
                <div className="catch-q">{item.q}</div>
                <div className="catch-a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 6. PROOF ═══ */}
      <section className="ln-sec ln-sec--alt">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">From contractors</span>
            <h2 className="ln-h2">From the field.</h2>
          </div>
          <div className="testi-grid">
            {[
              {
                amount: '$9,200 closed',
                result: 'Booked in the same week',
                quote: 'Customer called my $9,200 furnace and AC quote "too much." Sent it back showing $384/month on 24 months and they approved it the next morning. I send every quote over $3k this way now.',
                name: 'Dave Kowalski',
                trade: 'HVAC Technician · Edmonton, AB',
                initials: 'DK',
              },
              {
                amount: '$7,400 main drain replacement',
                result: 'Approved same evening',
                quote: 'Customer went dead silent when I said $7,400 to replace the main drain. Sent it back through Punchlist at $309/month. They approved it that evening. I was skeptical about financing, but I\'m not financing anything — the lender does.',
                name: 'Mike Sullivan',
                trade: 'Master Plumber · Calgary, AB',
                initials: 'MS',
              },
              {
                amount: '$14,000 panel upgrade',
                result: 'No negotiation',
                quote: 'Panel upgrades get shopped to death on price. I quoted $584/month on 24 months instead of the $14k lump sum. Customer didn\'t ask for a second quote. Deposit paid before I even left the driveway.',
                name: 'Tyler Reimer',
                trade: 'Journeyman Electrician · Vancouver, BC',
                initials: 'TR',
              },
            ].map((t, i) => (
              <div key={i} className={`testi-card rv rv--d${i}`}>
                <div className="testi-amount">{t.amount}</div>
                <div className="testi-result">{t.result}</div>
                <div className="testi-stars">
                  {[...Array(5)].map((_, j) => <Star key={j} size={12} fill="currentColor" />)}
                </div>
                <p className="testi-quote">"{t.quote}"</p>
                <div className="testi-who">
                  <div className="testi-avatar">{t.initials}</div>
                  <div>
                    <div className="testi-name">{t.name}</div>
                    <div className="testi-trade">{t.trade}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 7. PRICING ═══ */}
      <section className="ln-sec" id="pricing">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">Pricing</span>
            <h2 className="ln-h2">One closed job pays for Pro for a year.</h2>
            <p className="ln-sh-sub">$29/mo × 12 = $348. Average job closed with monthly pricing: $4,000+. The math is obvious.</p>
          </div>
          <div className="pr-grid rv rv--d1">
            <div className="pr-plan">
              <div className="pr-plan-header">
                <div className="pr-name">Free</div>
                <div className="pr-price-wrap">
                  <span className="pr-price">$0</span>
                  <span className="pr-per">/month</span>
                </div>
                <p className="pr-desc">Start right now. No card, no time limit.</p>
              </div>
              <ul className="pr-feats">
                {[
                  '5 quotes per month',
                  'AI scope builder',
                  'Monthly payment display',
                  'Customer e-signature',
                  'Push notifications when viewed',
                ].map((f, i) => (
                  <li key={i} className="pr-f"><Check size={14} strokeWidth={2.5} />{f}</li>
                ))}
              </ul>
              <Link to="/signup" className="ln-btn ln-btn--outline ln-btn--full">Get started — no card</Link>
            </div>

            <div className="pr-plan pr-plan--pro">
              <div className="pr-tag">Most popular</div>
              <div className="pr-plan-header">
                <div className="pr-name pr-name--pro">Pro</div>
                <div className="pr-price-wrap">
                  <span className="pr-price">$29</span>
                  <span className="pr-per">/month</span>
                </div>
                <p className="pr-desc">Unlimited quotes. Full financing checkout. Full workflow.</p>
              </div>
              <ul className="pr-feats">
                {[
                  'Everything in Free',
                  'Unlimited quotes',
                  'Financing checkout for customers',
                  'Foreman — catches missed items & underpricing',
                  'Quote activity tracking + nudge reminders',
                  'Deposit collection',
                  'Invoicing + payment tracking',
                ].map((f, i) => (
                  <li key={i} className="pr-f"><Check size={14} strokeWidth={2.5} />{f}</li>
                ))}
              </ul>
              <Link to="/signup" className="ln-btn ln-btn--full">Start free — upgrade anytime <ArrowRight size={14} /></Link>
              <div className="pr-trial-note">No credit card required to start</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 8. FINAL CTA ═══ */}
      <section className="ln-final">
        <div className="ln-final-bg" aria-hidden="true">
          <div className="ln-final-orb" />
        </div>
        <div className="ln-w ln-final-inner rv">
          <h2 className="ln-h2 ln-final-h">
            Send them a number<br />they can say yes to.
          </h2>
          <p className="ln-final-p">Free to start. Works from your phone. First quote in 3 minutes.</p>
          <div className="ln-final-ctas">
            <Link to="/signup" className="ln-btn ln-btn--hero ln-btn--xl">
              Start free — no credit card <ArrowRight size={16} />
            </Link>
          </div>
          <div className="ln-final-tags">
            <span><Check size={12} strokeWidth={3} />5 free quotes/month</span>
            <span><Check size={12} strokeWidth={3} />No credit card to start</span>
            <span><Check size={12} strokeWidth={3} />Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="ln-foot">
        <div className="ln-w ln-foot-in">
          <div className="ln-foot-left">
            <Logo size="sm" />
            <div className="ln-foot-tag">Trades-first quoting with built-in financing.</div>
            <div className="ln-foot-copy">© {new Date().getFullYear()} Punchlist · Calgary, AB</div>
          </div>
          <div className="ln-foot-links">
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
            <Link to="/terms">Terms</Link>
            <a href="mailto:hello@punchlist.ca">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
