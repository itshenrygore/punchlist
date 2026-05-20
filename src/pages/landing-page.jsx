/* ═══════════════════════════════════════════════════════════════
   Punchlist — Landing page (v8 — 10M redesign)
   ═══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X, Check, Sparkles, Eye, ShieldCheck, CreditCard, Smartphone, PenLine } from 'lucide-react';
import Logo from '../components/logo';
import '../styles/landing.css';

function useReveal() {
  useEffect(() => {
    // Opt in to the fade-in: until this class is present .rv elements
    // render visible so non-JS / small-viewport users always see
    // content even if the IO callback never fires.
    document.documentElement.classList.add('js-reveal');
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); }
      }),
      { threshold: 0.06, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.rv').forEach(el => obs.observe(el));
    return () => {
      obs.disconnect();
      document.documentElement.classList.remove('js-reveal');
    };
  }, []);
}

/* ── Nav ── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 48);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  // Body scroll-lock + Esc-close + backdrop-click when the mobile
  // menu is open. Previously it was a positioned dropdown with no
  // way out: tapping outside didn't close, page scrolled behind it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <nav className={`ln-nav${scrolled ? ' ln-nav--s' : ''}${open ? ' ln-nav--open' : ''}`}>
      {open && <div className="ln-nav-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div className="ln-w ln-nav-in">
        <Link to="/" className="ln-nav-logo"><Logo size="sm" dark={!scrolled} /></Link>
        <div className={`ln-nav-links${open ? ' --open' : ''}`}>
          <a href="#how" className="ln-nav-a" onClick={() => setOpen(false)}>How it works</a>
          <a href="#pricing" className="ln-nav-a" onClick={() => setOpen(false)}>Pricing</a>
          <Link to="/login" className="ln-nav-a" onClick={() => setOpen(false)}>Log in</Link>
          <Link to="/signup" className="ln-btn ln-btn--sm" onClick={() => setOpen(false)}>Start free</Link>
        </div>
        <button className="ln-nav-mob" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </nav>
  );
}

/* ── Jobs marquee data ── */
const MARQUEE = [
  { amount: '$10,830', job: 'Furnace + AC replacement', city: 'Edmonton, AB' },
  { amount: '$13,750', job: 'Panel upgrade to 200A', city: 'Vancouver, BC' },
  { amount: '$7,440',  job: 'Main drain replacement', city: 'Calgary, AB' },
  { amount: '$22,175', job: 'Kitchen renovation', city: 'Toronto, ON' },
  { amount: '$12,640', job: 'Roof replacement — 30yr shingle', city: 'Ottawa, ON' },
  { amount: '$8,925',  job: 'Full bathroom reno', city: 'Burnaby, BC' },
  { amount: '$9,180',  job: 'Boiler swap + radiators', city: 'Mississauga, ON' },
  { amount: '$6,375',  job: 'Basement electrical + panel', city: 'Regina, SK' },
];

/* ── Interactive Quote Card ── */
const ITEMS = [
  { name: 'Remove & dispose of existing furnace + AC', price: 475 },
  { name: 'Supply & install gas furnace — 96% AFUE, 80k BTU', price: 4180 },
  { name: 'Supply & install central AC — 3.5 ton, 16 SEER', price: 4625 },
  { name: 'Lineset, flue liner, electrical & Ecobee thermostat', price: 1550 },
];
const TOTAL = ITEMS.reduce((s, i) => s + i.price, 0);

// Realistic BNPL terms with actual APR-based payments
// Rates based on Affirm/Klarna typical home improvement offers
function calcMonthly(principal, termMonths, apr) {
  if (apr === 0) return Math.ceil(principal / termMonths);
  const r = apr / 12;
  return Math.ceil(principal * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1));
}
const TERMS = [
  { months: 6,  apr: 0,      label: '6mo', monthly: calcMonthly(TOTAL, 6,  0) },
  { months: 12, apr: 0.0999, label: '12mo', monthly: calcMonthly(TOTAL, 12, 0.0999) },
  { months: 18, apr: 0.1499, label: '18mo', monthly: calcMonthly(TOTAL, 18, 0.1499) },
  { months: 24, apr: 0.1999, label: '24mo', monthly: calcMonthly(TOTAL, 24, 0.1999) },
];

function LiveQuoteCard() {
  const [termIdx, setTermIdx] = useState(2); // default: 24 mo
  const [approved, setApproved] = useState(false);
  const termObj = TERMS[termIdx];
  const monthly = termObj.monthly;

  // Smooth count-up between term toggles instead of a hard cut. This
  // is the marquee moment the landing page sells — the monthly number
  // crossfading via easing makes the whole product feel responsive.
  const [displayMonthly, setDisplayMonthly] = useState(monthly);
  useEffect(() => {
    let raf;
    const start = displayMonthly;
    const target = monthly;
    if (start === target) return;
    const duration = 320;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayMonthly(Math.round(start + (target - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // displayMonthly intentionally excluded — only restart on target change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthly]);

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
          <div className="qc-monthly">
            <span className="qc-mo-n tabular">${displayMonthly.toLocaleString()}</span>
            <span className="qc-mo-u">/mo</span>
          </div>
          <div className="qc-total-line">
            You get paid ${TOTAL.toLocaleString()} in full
            {termObj.apr > 0 && <span className="qc-apr"> · est. {(termObj.apr * 100).toFixed(2)}% APR</span>}
          </div>
        </div>

        <div className="qc-terms">
          {TERMS.map((t, i) => (
            <button key={t.months} type="button"
              className={`qc-t${termIdx === i ? ' qc-t--on' : ''}`}
              onClick={() => { setTermIdx(i); setApproved(false); }}>
              {t.label}
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
          {!approved ? 'Try different terms to see monthly options' : 'Customer pays monthly. You got the full amount.'}
        </div>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function LandingPage() {
  useReveal();
  useEffect(() => {
    document.title = 'Punchlist — Built to close jobs, not just quote them.';
  }, []);

  // Show a sticky bottom CTA on mobile once the user has scrolled
  // past the hero. The hero CTA is in the upper third — once it's
  // out of view there's no thumb-reachable Start-free until the
  // pricing section >15 viewports later.
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowStickyCTA(window.scrollY > window.innerHeight * 0.85);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="ln">
      <Nav />

      {/* ═══ 1. HERO — dark ═══ */}
      <section className="ln-hero">
        <div className="ln-hero-bg" aria-hidden="true">
          <div className="ln-hero-orb ln-hero-orb--1" />
          <div className="ln-hero-orb ln-hero-orb--2" />
          <div className="ln-hero-grid-lines" />
        </div>
        <div className="ln-w ln-hero-inner">
          <div className="ln-hero-txt">
            <h1 className="ln-h1 rv">
              Built to close jobs,<br />
              <span className="ln-hi">not just quote them.</span>
            </h1>
            <p className="ln-hero-p rv rv--d1">
              Describe the job, get a full scope back in seconds. Monthly payments get the yes.
              You see when they open it — we follow up until it's closed.
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

      {/* ═══ 2. EXAMPLE JOBS MARQUEE ═══ */}
      <div className="marquee-section">
        <div className="marquee-label">Example quotes built with Punchlist</div>
        <div className="marquee-outer" aria-hidden="true">
          <div className="marquee-track">
            {[...MARQUEE, ...MARQUEE].map((item, i) => (
              <div key={i} className="marquee-item">
                <span className="marquee-check">✓</span>
                <span className="marquee-amount">{item.amount}</span>
                <span className="marquee-sep">·</span>
                <span className="marquee-job">{item.job}</span>
                <span className="marquee-sep">·</span>
                <span className="marquee-city">{item.city}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ 3. WORKFLOW ═══ */}
      <section className="ln-sec" id="how">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">How it works</span>
            <h2 className="ln-h2">From job description to deposit paid.</h2>
          </div>
          <div className="wf-grid">

            {/* Step 1 — Scope */}
            <div className="wf-step rv">
              <div className="wf-step-num">01</div>
              <h3 className="wf-step-head">Describe the job. Get the full scope.</h3>
              <p className="wf-step-desc">Trade-accurate line items, quantities, and pricing — back in seconds.</p>
              <div className="wf-vis wf-vis--scope">
                <div className="wf-vis-tag">Generated in 9 sec</div>
                {[
                  ['Remove & dispose of existing furnace + AC', '$475'],
                  ['Supply & install gas furnace — 96% AFUE, 80k BTU', '$4,180'],
                  ['Supply & install central AC — 3.5 ton, 16 SEER', '$4,625'],
                  ['Lineset, flue liner, electrical & Ecobee thermostat', '$1,550'],
                ].map(([name, price], i) => (
                  <div key={i} className="wf-scope-row">
                    <span className="wf-scope-name">{name}</span>
                    <span className="wf-scope-price">{price}</span>
                  </div>
                ))}
                <div className="wf-scope-total"><span>Total</span><span>$10,830</span></div>
              </div>
            </div>

            {/* Step 2 — Monthly price */}
            <div className="wf-step rv rv--d1">
              <div className="wf-step-num">02</div>
              <h3 className="wf-step-head">Your customer sees a number they'll approve.</h3>
              <p className="wf-step-desc">Monthly payment options on every quote. They sign from their phone. You get paid the full amount within 1–2 business days.</p>
              <div className="wf-vis wf-vis--price">
                <div className="wf-price-eyebrow">Customer sees</div>
                <div className="wf-price-big">$552<span>/mo</span></div>
                <div className="wf-price-sub">Same $10,830. Same margin. Zero risk.</div>
                <div className="wf-price-won">✓ Approved — $10,830 paid in full</div>
              </div>
            </div>

            {/* Step 3 — Track + follow up */}
            <div className="wf-step rv rv--d2">
              <div className="wf-step-num">03</div>
              <h3 className="wf-step-head">Know when they open it. We follow up for you.</h3>
              <p className="wf-step-desc">Real-time open tracking and automated follow-ups — built in. You just show up to do the job.</p>
              <div className="wf-vis wf-vis--notif">
                <div className="wf-notif rv">
                  <div className="wf-notif-icon">📋</div>
                  <div className="wf-notif-body">
                    <div className="wf-notif-app">Punchlist</div>
                    <div className="wf-notif-msg">Kevin opened your $10,830 quote</div>
                  </div>
                  <div className="wf-notif-time">now</div>
                </div>
                <div className="wf-followup rv rv--d1">
                  <div className="wf-followup-dot" />
                  <div className="wf-followup-content">
                    <div className="wf-followup-label">Auto follow-up sent</div>
                    <div className="wf-followup-msg">"Hey Kevin — any questions on the quote? Happy to walk you through it."</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ═══ 4. FEATURES — dark ═══ */}
      <section className="ln-dark">
        <div className="ln-dark-noise" aria-hidden="true" />
        <div className="ln-w">
          <div className="ln-sh--light rv">
            <span className="ln-ey ln-ey--light">What's included</span>
            <h2 className="ln-h2 ln-h2--light">Everything you need to close the job.</h2>
          </div>
          <div className="feat-grid">
            {[
              // Lucide icons render consistently across OSes — emoji
              // versions of the same glyphs vary by platform (Apple's
              // robot vs Google's robot) and read as low-effort on a
              // page where every other detail is custom.
              { Icon: Sparkles,    title: 'AI Scope Builder',       desc: 'Describe the job. Get a full itemized scope with trade-accurate line items in seconds — not 45 minutes.' },
              { Icon: Eye,         title: 'See when they view it',  desc: 'Know the moment your customer opens the quote. No more guessing when to follow up.' },
              { Icon: ShieldCheck, title: 'Foreman',                desc: 'Catches missed line items and underpricing before you send. Your margin, protected on every job.' },
              { Icon: CreditCard,  title: 'Deposits & invoicing',   desc: 'Collect a deposit on approval. Invoice when done. Track what\'s paid — all in one place.' },
              { Icon: Smartphone,  title: 'Built for the job site', desc: 'Build, send, and track quotes from your phone. First quote takes 3 minutes.' },
              { Icon: PenLine,     title: 'E-signature',            desc: 'Customers sign on the quote link. No printing, no scanning, no back and forth.' },
            ].map((f, i) => (
              <div key={i} className={`feat-card feat-card--dark rv rv--d${Math.min(i % 3, 2)}`}>
                <div className="feat-icon" aria-hidden="true"><f.Icon size={26} strokeWidth={1.75} /></div>
                <div className="feat-title">{f.title}</div>
                <div className="feat-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5. PROOF ═══ */}
      <section className="ln-sec">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">Real results</span>
            <h2 className="ln-h2">What contractors are saying.</h2>
          </div>

          {/* Featured testimonial */}
          <div className="testi-feature rv">
            <div className="testi-feature-badge">$13,750 closed · Deposit paid on site</div>
            <blockquote className="testi-feature-quote">
              "Showed the customer $13,750 for a panel upgrade and you could see them
              mentally calling three other guys. Switched it to $631/month and they just
              said okay. Paid the deposit right there in the kitchen."
            </blockquote>
            <div className="testi-feature-who">
              <div className="testi-avatar testi-avatar--lg">TR</div>
              <div>
                <div className="testi-name">Tyler R.</div>
                <div className="testi-trade">Electrician · Vancouver, BC</div>
              </div>
            </div>
          </div>

          {/* Supporting */}
          <div className="testi-grid testi-grid--2-centered rv rv--d1">
            {[
              {
                amount: '$9,180 closed', result: 'Approved next morning',
                quote: 'Lady said $9,180 was too much for the furnace and AC. I just resent it as $421/month — she approved it the next morning. Literally the same job, same price.',
                name: 'Dave K.', trade: 'HVAC · Edmonton, AB', initials: 'DK',
              },
              {
                amount: '$7,440 closed', result: 'Approved same evening',
                quote: 'Guy ghosted me after I quoted $7,440 for a main drain. Sent it again at $341/month and he texted back that night. I don\'t do the financing part — the lender handles all that.',
                name: 'Mike S.', trade: 'Plumber · Calgary, AB', initials: 'MS',
              },
            ].map((t, i) => (
              <div key={i} className="testi-card">
                <div className="testi-amount">{t.amount}</div>
                <div className="testi-result">{t.result}</div>
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

      {/* ═══ 6. NO CATCH ═══ */}
      <section className="ln-sec ln-sec--alt">
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
                a: 'The quote automatically falls back to showing the full price. Nothing breaks. The job stays live and your customer can still approve at the lump sum — or you adjust and resend.',
              },
              {
                q: 'What does it cost me?',
                a: 'Free for 5 quotes/month — no card required, no time limit. Pro is $29/month: unlimited quotes, activity tracking, Foreman, invoicing, and deposit collection. One extra closed job covers a full year. A 2.5% platform fee applies to deposits and invoice payments collected through Punchlist — there are no other hidden charges.',
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

      {/* ═══ 7. PRICING ═══ */}
      <section className="ln-sec" id="pricing">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">Pricing</span>
            <h2 className="ln-h2">One closed job pays for a year of Pro.</h2>
            <p className="ln-sh-sub">$29/mo × 12 = $348. One extra job closed with monthly pricing covers it many times over.</p>
          </div>
          <div className="pr-grid rv rv--d1">
            <div className="pr-plan">
              <div className="pr-plan-header">
                <div className="pr-name">Free</div>
                <div className="pr-price-wrap">
                  <span className="pr-price">$0</span>
                  <span className="pr-per">/month</span>
                </div>
              </div>
              <ul className="pr-feats">
                {[
                  '5 quotes per month',
                  'Scope builder — 1,000+ trade items',
                  'Monthly payment display on quotes',
                  'Customer e-signature',
                  'Works from your phone',
                ].map((f, i) => <li key={i} className="pr-f"><Check size={14} strokeWidth={2.5} />{f}</li>)}
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
              </div>
              <ul className="pr-feats">
                {[
                  'Everything in Free',
                  'Unlimited quotes',
                  'Financing checkout for customers',
                  'Foreman — catches missed items & underpricing',
                  'Activity tracking + auto follow-ups',
                  'Deposit collection',
                  'Invoicing + payment tracking',
                ].map((f, i) => <li key={i} className="pr-f"><Check size={14} strokeWidth={2.5} />{f}</li>)}
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
            <div className="ln-foot-tag">Built to close jobs, not just quote them.</div>
            <div className="ln-foot-copy">© {new Date().getFullYear()} Punchlist · Calgary, AB</div>
          </div>
          <div className="ln-foot-links">
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <a href="mailto:hello@punchlist.ca">Contact</a>
          </div>
        </div>
      </footer>

      {/* Mobile sticky bottom CTA — appears once the user scrolls past
          the hero so the primary action is always thumb-reachable on
          phones. Desktop ignores via media query. */}
      <div className={`ln-sticky-cta${showStickyCTA ? ' is-visible' : ''}`} aria-hidden={!showStickyCTA}>
        <Link to="/signup" className="ln-btn ln-btn--hero ln-sticky-cta-btn">
          Start free <ArrowRight size={16} />
        </Link>
        <span className="ln-sticky-cta-note">No credit card · 5 free quotes/month</span>
      </div>
    </div>
  );
}
