/* ═══════════════════════════════════════════════════════════════
   Punchlist — Landing page (v6 — B+C: skeptic meets psychology)
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
  { name: 'Demo vanity, toilet & tub surround', price: 850 },
  { name: 'Rough-in plumbing — new layout', price: 2200 },
  { name: 'Install vanity & shower valve', price: 1800 },
  { name: 'Tile backer & waterproofing', price: 750 },
];
const TOTAL = ITEMS.reduce((s, i) => s + i.price, 0);
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
          <div className="qc-avatar">JR</div>
          <div>
            <div className="qc-biz">JR Plumbing & Mechanical</div>
            <div className="qc-job">Bathroom Reno — Main Floor</div>
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
    document.title = 'Punchlist — Stop losing $5,000 jobs to sticker shock.';
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
              Send quotes with monthly payments.
              Your customer sees $234/mo.
              You get paid $5,600 in full, upfront.
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

      {/* ═══ 2. MATH BAR ═══ */}
      <div className="math-bar rv">
        <div className="ln-w math-bar-inner">
          <div className="math-col math-col--bad">
            <div className="math-col-label">Traditional lump-sum quote</div>
            <div className="math-col-rate">$5,600</div>
            <div className="math-col-sub">"That's more than we budgeted"</div>
            <div className="math-col-kept">Customer shops around. You lose the job.</div>
          </div>
          <div className="math-vs">vs</div>
          <div className="math-col math-col--good">
            <div className="math-col-label">Punchlist monthly quote</div>
            <div className="math-col-rate math-col-rate--gn">$234/mo</div>
            <div className="math-col-sub">Same job. Same margin. Zero risk to you.</div>
            <div className="math-col-kept math-col-kept--gn">Customer approves. You get paid in full.</div>
          </div>
        </div>
      </div>

      {/* ═══ 3. ANCHOR — Price reveal ═══ */}
      <section className="ln-dark">
        <div className="ln-dark-noise" aria-hidden="true" />
        <div className="ln-w">
          <div className="anchor-wrap rv">
            <div className="anchor-side anchor-side--bad">
              <div className="anchor-tag anchor-tag--bad">Without Punchlist</div>
              <div className="anchor-price anchor-price--full">$5,600</div>
              <div className="anchor-msg">"That's more than we expected.<br />We'll get another quote."</div>
              <div className="anchor-result anchor-result--lost">Lost · ~$5,600</div>
            </div>
            <div className="anchor-arrow">
              <div className="anchor-arrow-line" />
              <div className="anchor-arrow-label">same job<br />same price</div>
            </div>
            <div className="anchor-side anchor-side--good">
              <div className="anchor-tag anchor-tag--good">With Punchlist</div>
              <div className="anchor-price anchor-price--mo">
                $234<span>/mo</span>
              </div>
              <div className="anchor-msg">"$234 a month is way more doable.<br />When can you start?"</div>
              <div className="anchor-result anchor-result--won">Won · $5,600 paid in full</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 4. HOW IT WORKS ═══ */}
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
                desc: 'Type what you\'re quoting. AI builds a full itemized scope with trade-accurate pricing.',
                in: 'Main floor bathroom reno…',
                out: '→ 8 line items · $5,600 · 14 sec',
              },
              {
                num: '02',
                title: 'Set the monthly term',
                desc: 'Pick 6, 12, 18, or 24 months. The total stays the same. You always get paid in full.',
                in: '$5,600 total',
                out: '→ Customer sees $234/mo',
              },
              {
                num: '03',
                title: 'Customer approves. Done.',
                desc: 'They get a link, see the monthly price, sign from their phone. The financing partner pays you the full amount — usually within 1–2 business days.',
                in: 'Sarah tapped "Approve"',
                out: '→ $5,600 deposited in 1–2 business days',
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

      {/* ═══ 5. THE CATCH ═══ */}
      <section className="ln-sec ln-sec--alt">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">No catch</span>
            <h2 className="ln-h2">Every question contractors ask first.</h2>
          </div>
          <div className="catch-grid">
            {[
              {
                q: 'Who takes the financing risk?',
                a: 'Not you — ever. A licensed consumer lender underwrites the loan and pays you the full job amount upfront, typically within 1–2 business days. Your customer repays the lender monthly. If they miss a payment, that\'s between them and the lender. Your payment is already in your account.',
              },
              {
                q: 'What\'s the interest rate for my customer?',
                a: 'The lender sets the rate based on the customer\'s credit profile — typically in line with personal loan rates. The customer sees the monthly payment and the total financed amount before they sign. No surprises. You\'re never the one quoting them an interest rate.',
              },
              {
                q: 'What if my customer isn\'t approved?',
                a: 'The quote automatically shows the full price as the payment option. Nothing breaks, nothing changes on your end. The job stays live and your customer can still approve it at the full amount — or ask for a revised quote.',
              },
              {
                q: 'What provinces and states does this cover?',
                a: 'Currently available across Canada. US coverage is expanding — sign up and you\'ll be notified the moment your state goes live. The quoting, AI scope builder, and all other features work everywhere regardless.',
              },
              {
                q: 'What does it cost me?',
                a: 'Free for 5 quotes/month — no card required, no time limit. Pro is $29/month and unlocks unlimited quotes, activity tracking, invoicing, and deposit collection. One extra closed job per year covers the cost many times over.',
              },
            ].map((item, i) => (
              <div key={i} className={`catch-card rv rv--d${Math.min(i, 2)}`}>
                <div className="catch-q">{item.q}</div>
                <div className="catch-a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 6. PROOF ═══ */}
      <section className="ln-sec">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">From contractors</span>
            <h2 className="ln-h2">Real results.</h2>
          </div>
          <div className="testi-grid">
            {[
              {
                amount: '$9,200 closed',
                result: 'Booked in the same week',
                quote: 'Customer called my $9,200 furnace quote "too much." I sent it through Punchlist showing $383/month and they approved it the next morning. I\'ve started sending every quote over $3k this way.',
                name: 'Dave Kowalski',
                trade: 'HVAC Technician · Edmonton, AB',
                initials: 'DK',
              },
              {
                amount: '3 of 4 jobs closed',
                result: 'In the first month',
                quote: 'I was skeptical — I don\'t like financing anything. But I\'m not financing anything. The lender does. I quoted four jobs, closed three. At $29/month for Pro, I made that back on the first call.',
                name: 'Mike Sullivan',
                trade: 'Master Plumber · Calgary, AB',
                initials: 'MS',
              },
              {
                amount: '$14,000 panel upgrade',
                result: 'No negotiation',
                quote: 'Panel upgrades are the jobs that get shopped to death because of the price. I quoted $581/month instead. Customer didn\'t ask for a second quote. Deposit paid before I even left the driveway.',
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
      <section className="ln-sec ln-sec--alt" id="pricing">
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
            Stop losing jobs<br />to sticker shock.
          </h2>
          <p className="ln-final-p">Free to start. Works from your phone. First quote in 4 minutes.</p>
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
