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

/* ── Jobs marquee data ──
 * A real contractor's day spans $200 service calls to $20k renovations.
 * The marquee mixes small / mid / large so a one-person plumber doing
 * faucet swaps and a GC doing kitchen renos both see themselves on the
 * page. Skews slightly to mid-size since that's where most service
 * contractors actually live. */
const MARQUEE = [
  { amount: '$185',    job: 'Kitchen faucet replacement',         city: 'Calgary, AB' },
  { amount: '$1,290',  job: 'Water heater swap — 50 gal gas',     city: 'Edmonton, AB' },
  { amount: '$420',    job: 'Dishwasher install + shutoff',       city: 'Burnaby, BC' },
  { amount: '$3,150',  job: 'Bathroom faucet + vanity reno',      city: 'Toronto, ON' },
  { amount: '$675',    job: '15A circuit + GFCI in garage',       city: 'Phoenix, AZ' },
  { amount: '$10,830', job: 'Furnace + AC replacement',           city: 'Edmonton, AB' },
  { amount: '$2,480',  job: 'Toilet + main shutoff swap',         city: 'Austin, TX' },
  { amount: '$13,750', job: 'Panel upgrade to 200A',              city: 'Vancouver, BC' },
  { amount: '$890',    job: 'EV charger circuit — 40A',           city: 'Denver, CO' },
  { amount: '$5,420',  job: 'Roof leak repair + 6 sq shingles',   city: 'Ottawa, ON' },
  { amount: '$340',    job: 'Hose bib replacement + insulation',  city: 'Winnipeg, MB' },
  { amount: '$7,440',  job: 'Main drain replacement',             city: 'Atlanta, GA' },
  { amount: '$1,650',  job: 'Bathroom fan + ducting through roof',city: 'Halifax, NS' },
  { amount: '$22,175', job: 'Kitchen renovation',                 city: 'Toronto, ON' },
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
// Affirm's home-improvement category commonly approves 3 / 6 / 12-mo
// terms for residential job sizes. Showing 18 / 24 mo here is rare for
// typical Punchlist quotes and would misrepresent what the customer
// actually sees at checkout. Cap the marketing card at 12 mo.
const TERMS = [
  { months: 3,  apr: 0,      label: '3mo',  monthly: calcMonthly(TOTAL, 3,  0) },
  { months: 6,  apr: 0,      label: '6mo',  monthly: calcMonthly(TOTAL, 6,  0) },
  { months: 12, apr: 0.0999, label: '12mo', monthly: calcMonthly(TOTAL, 12, 0.0999) },
];

function LiveQuoteCard() {
  // Start on the shortest term so the auto-cycle demo below has
  // somewhere to go. Once it lands on the cheapest monthly (12mo)
  // it stops there for the rest of the page life.
  const [termIdx, setTermIdx] = useState(0);
  const [approved, setApproved] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const termObj = TERMS[termIdx];
  const monthly = termObj.monthly;

  // Auto-cycle through the terms one time after page load — shows
  // the visitor that the chips do something AND lands on the
  // cheapest monthly figure. Stops the moment the user taps a chip.
  useEffect(() => {
    if (userInteracted) return;
    const ids = [];
    // Delay so the page has settled and the count-up animation
    // has space to read as intentional.
    ids.push(setTimeout(() => setTermIdx(i => userInteracted ? i : Math.min(i + 1, 2)), 1400));
    ids.push(setTimeout(() => setTermIdx(i => userInteracted ? i : Math.min(i + 1, 2)), 2800));
    return () => ids.forEach(clearTimeout);
  }, [userInteracted]);

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
      <div className="qc-badge">What your customer sees — tap a term</div>
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
              onClick={() => { setUserInteracted(true); setTermIdx(i); setApproved(false); }}>
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
              Describe the job. Get a starting scope with pricing for your area.
              Edit, adjust, send. Your customer signs and picks how to pay —
              all from their phone.
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
            <div className="ln-hero-trust rv rv--d3">
              Built in Calgary — for the contractors we'd trust with our own house.
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
            <p className="ln-sh-sub">First quote takes about 3 minutes. Every one after is faster.</p>
          </div>
          <div className="wf-grid">

            {/* Step 1 — Scope */}
            <div className="wf-step rv">
              <div className="wf-step-num">01</div>
              <h3 className="wf-step-head">Describe it. We surface matching line items.</h3>
              <p className="wf-step-desc">Suggested items pulled from a 1,300-item trade catalog, priced for where you work. You add the ones you want, edit prices, drop in anything we missed.</p>
              <div className="wf-vis wf-vis--scope">
                <div className="wf-vis-tag">Suggested in 9 sec</div>
                {[
                  ['Remove old water heater + safe disposal', '$120'],
                  ['Supply & install 50 gal natural gas heater', '$895'],
                  ['New flex connectors, expansion tank, T&P valve', '$185'],
                  ['Re-pipe + leak test + city permit', '$90'],
                ].map(([name, price], i) => (
                  <div key={i} className="wf-scope-row">
                    <span className="wf-scope-name">{name}</span>
                    <span className="wf-scope-price">{price}</span>
                  </div>
                ))}
                <div className="wf-scope-total"><span>Total</span><span>$1,290</span></div>
              </div>
            </div>

            {/* Step 2 — Monthly price (on $500+ jobs only — that's where
                the financing value prop actually moves the close) */}
            <div className="wf-step rv rv--d1">
              <div className="wf-step-num">02</div>
              <h3 className="wf-step-head">On bigger jobs, a monthly option gets the yes.</h3>
              <p className="wf-step-desc">For jobs over $500, customers can pick a monthly payment at checkout. They sign from their phone. Affirm pays you the full amount in 1–2 business days.</p>
              <div className="wf-vis wf-vis--price">
                <div className="wf-price-eyebrow">Customer sees</div>
                <div className="wf-price-big">$654<span>/mo</span></div>
                <div className="wf-price-sub">Same $7,440 main drain. Same margin. Zero risk to you.</div>
                <div className="wf-price-won">✓ Approved — $7,440 paid in full</div>
              </div>
            </div>

            {/* Step 3 — Get paid (was "track + follow up"; reframed as
                the conclusion of the arc so the visitor finishes on the
                outcome, not the tooling) */}
            <div className="wf-step rv rv--d2">
              <div className="wf-step-num">03</div>
              <h3 className="wf-step-head">Track it, follow up, get paid.</h3>
              <p className="wf-step-desc">You get a text the moment they open the quote. Punchlist auto-follows-up if they go quiet. Deposit hits your bank — done.</p>
              <div className="wf-vis wf-vis--notif">
                <div className="wf-notif rv">
                  <div className="wf-notif-icon">📋</div>
                  <div className="wf-notif-body">
                    <div className="wf-notif-app">Punchlist</div>
                    <div className="wf-notif-msg">Kevin opened your $1,290 quote</div>
                  </div>
                  <div className="wf-notif-time">now</div>
                </div>
                <div className="wf-followup rv rv--d1">
                  <div className="wf-followup-dot" />
                  <div className="wf-followup-content">
                    <div className="wf-followup-label">Deposit hit your account</div>
                    <div className="wf-followup-msg">$258 from Kevin · Stripe payout in 2 business days.</div>
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
          {/* Lead with the three features that matter most: the catalog
              (the unfair advantage), Foreman (the differentiator),
              customer payment (the close mechanic). Below the fold, the
              other three are listed as a plus row so they don't compete
              for attention. */}
          <div className="feat-grid feat-grid--big">
            {[
              { Icon: Sparkles,    title: 'Catalog + your-area pricing', desc: 'Describe the job — Punchlist surfaces matching line items from a 1,300-item trade catalog, priced for where you work. Review, edit, and add anything we missed. You\'re in control of the final scope.' },
              { Icon: ShieldCheck, title: 'Foreman — your assistant',     desc: 'Snap a photo or describe what you\'re looking at. Foreman suggests scope items, flags missing permits, and helps you diagnose in the field. Every suggestion is yours to accept or skip.' },
              { Icon: CreditCard,  title: 'Customer monthly pay or full',  desc: 'Customers pick a monthly payment on bigger jobs; the lender pays you the full amount in 1–2 business days. Deposits and invoicing built in.' },
            ].map((f, i) => (
              <div key={i} className={`feat-card feat-card--dark feat-card--big rv rv--d${Math.min(i, 2)}`}>
                <div className="feat-icon" aria-hidden="true"><f.Icon size={28} strokeWidth={1.75} /></div>
                <div className="feat-title">{f.title}</div>
                <div className="feat-desc">{f.desc}</div>
              </div>
            ))}
          </div>

          <div className="feat-plus-row rv rv--d2">
            <span className="feat-plus-label">Also included</span>
            <ul className="feat-plus-list">
              <li><Eye size={14} strokeWidth={2} /><strong>Open tracking + auto follow-ups</strong> — text when they view, nudge if they go cold.</li>
              <li><Smartphone size={14} strokeWidth={2} /><strong>Built for the job site</strong> — works offline, fully thumb-driven, first quote in ~3 minutes.</li>
              <li><PenLine size={14} strokeWidth={2} /><strong>E-signature + messaging</strong> — customer signs on the link, asks questions in the same thread.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ═══ 4b. FOREMAN SPOTLIGHT ═══ */}
      <section className="ln-foreman">
        <div className="ln-w">
          <div className="ln-foreman-grid">
            <div className="ln-foreman-txt">
              <span className="ln-ey">Meet Foreman</span>
              <h2 className="ln-h2 ln-foreman-h">
                Your second set of eyes on every quote.
              </h2>
              <p className="ln-foreman-p">
                Snap a photo or describe what you're looking at. Foreman suggests
                a scope, checks your prices against your region, and flags items
                you'd want to include. Every suggestion is just that — a suggestion.
                You're the one who adds it to the quote.
              </p>
              <ul className="ln-foreman-list">
                <li><span className="ln-foreman-dot" /> Photo or text in — suggested scope items + pricing back</li>
                <li><span className="ln-foreman-dot" /> Flags missing line items (permits, disposal, common omissions for your trade)</li>
                <li><span className="ln-foreman-dot" /> Checks labour and material pricing against your region</li>
                <li><span className="ln-foreman-dot" /> Field-ready: pull it up for a second opinion on a part, code, or repair</li>
              </ul>
            </div>
            <div className="ln-foreman-card">
              <div className="ln-foreman-chat">
                <div className="ln-foreman-bubble ln-foreman-bubble--user ln-foreman-bubble--photo">
                  <div className="ln-foreman-photo-thumb" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <div>
                    <div className="ln-foreman-photo-label">On the job — kitchen sink</div>
                    <div className="ln-foreman-photo-cap">"Customer says this faucet's been dripping for weeks. Wants it fixed today."</div>
                  </div>
                </div>
                <div className="ln-foreman-msg">
                  <div className="ln-foreman-avatar" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 17h18" /><path d="M5 17a7 7 0 0 1 14 0" />
                      <path d="M12 5v5" /><path d="M8.5 11.5l-.5 4" /><path d="M15.5 11.5l.5 4" />
                    </svg>
                  </div>
                  <div className="ln-foreman-bubble">
                    Single-handle Moen — looks like the <strong>1225 cartridge</strong>. Cartridge swap's a 25-minute job, ~$45 part. While you're under there the supply hoses look 10+ years old too — common upsell. Want me to put a quick scope together you can review?
                  </div>
                </div>
                <div className="ln-foreman-action-row">
                  <button type="button" className="ln-foreman-chip">+ Suggest scope</button>
                  <button type="button" className="ln-foreman-chip">What if it's behind the wall?</button>
                </div>
              </div>
            </div>
          </div>

          {/* Inline CTA — picks up the visitor at peak engagement after
              they see Foreman in action. No pricing distraction, no
              card requested. */}
          <div className="ln-section-cta rv rv--d2">
            <Link to="/signup" className="ln-btn ln-btn--hero">
              Try Foreman free <ArrowRight size={14} />
            </Link>
            <span className="ln-section-cta-note">5 free quotes/month · No credit card</span>
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

          {/* Featured testimonial — keep one big monthly-pay win as the
              page anchor. Monthly figure now matches the platform's 12mo
              cap so the math reads honest if a contractor checks it. */}
          <div className="testi-feature rv">
            <div className="testi-feature-badge">$13,750 closed · Deposit paid in the kitchen</div>
            <blockquote className="testi-feature-quote">
              "Showed the customer $13,750 for a panel upgrade and you could see them
              mentally calling three other guys. Switched the quote to show
              $1,209/month and they just said okay. Paid the deposit right
              there in the kitchen."
            </blockquote>
            <div className="testi-feature-who">
              <div className="testi-avatar testi-avatar--lg">TR</div>
              <div>
                <div className="testi-name">Tyler R.</div>
                <div className="testi-trade">Electrician · Vancouver, BC</div>
              </div>
            </div>
          </div>

          {/* Supporting grid — one card per major feature so the proof
              reflects the whole product, not just financing. Each card
              has a consistent badge structure (top metric + result) to
              match the featured testimonial above. */}
          <div className="testi-grid rv rv--d1">
            {[
              {
                amount: '$420 caught', result: 'Before sending',
                quote: 'Snapped a photo of the panel and Foreman flagged that the breaker count I had wouldn\'t pass inspection in BC. Added the upgrade before I hit send — that would\'ve been a callback.',
                name: 'Marcus T.', trade: 'Electrician · Burnaby, BC', initials: 'MT',
              },
              {
                amount: '18 minutes', result: 'From first text to deposit',
                quote: 'Got the notification she opened the quote four times. Called her right then, answered her one question about the drain rough-in, deposit hit my account before I finished the call.',
                name: 'Mike S.', trade: 'Plumber · Calgary, AB', initials: 'MS',
              },
              {
                amount: '$2,680 saved', result: 'Pricing caught', tone: 'good',
                quote: 'I had a roof tear-off priced from memory. Foreman compared it to my area and said my disposal line was $300 light and I\'d forgotten ice & water shield on the eaves. Both real items I would have eaten on the job.',
                name: 'Dave L.', trade: 'Roofer · Edmonton, AB', initials: 'DL',
              },
              {
                amount: '3 minutes', result: 'From job site to quote sent',
                quote: 'Customer called about a furnace at 7pm. Drove over, typed it into Punchlist while standing in their basement, sent the quote before I got back to the truck. Signed by 7:45.',
                name: 'Sarah K.', trade: 'HVAC · Ottawa, ON', initials: 'SK',
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

          {/* Inline CTA — right after social proof, the most-likely
              "I'm sold" moment on the page. */}
          <div className="ln-section-cta rv rv--d2">
            <Link to="/signup" className="ln-btn ln-btn--hero">
              Start your first quote <ArrowRight size={14} />
            </Link>
            <span className="ln-section-cta-note">First quote takes ~3 minutes</span>
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
                q: 'Can I edit prices and items myself?',
                a: 'Yes. Every suggested line item is just that — a suggestion. You add the ones you want, change the price on any of them, add anything we missed, and remove anything that doesn\'t apply. The catalog is a starting point. You build the final quote.',
              },
              {
                q: 'What if my customer doesn\'t have a smartphone?',
                a: 'They can open the quote link on any device with a browser — laptop, tablet, even an old desktop. Or you can show it on your phone in their kitchen and they sign with their finger. Print + sign also works if they prefer paper.',
              },
              {
                q: 'How do I actually get paid?',
                a: 'Deposits and full payments hit your bank account through Stripe Connect (the same system Lyft and Shopify use). Set it up once in Settings → Payments and you\'re done. Most contractors see funds in 1–2 business days after the customer pays.',
              },
              {
                q: 'What does it cost me?',
                a: 'Free for 5 quotes/month — no card required, no time limit. Pro is $29/month: unlimited quotes, activity tracking, Foreman, invoicing, and deposit collection. One extra closed job covers a full year. A 2.5% platform fee applies to deposits and invoice payments collected through Punchlist — there are no other hidden charges.',
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
                  'Scope builder — 1,300 trade items',
                  'Provincial pricing built in',
                  'Customer monthly-payment display',
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
                  'Foreman — photo + field assistant',
                  'Customer financing at checkout',
                  'Activity tracking + auto follow-ups',
                  'Deposit collection',
                  'Invoicing + payment tracking',
                ].map((f, i) => <li key={i} className="pr-f"><Check size={14} strokeWidth={2.5} />{f}</li>)}
              </ul>
              <Link to="/signup" className="ln-btn ln-btn--full">Start free — upgrade anytime <ArrowRight size={14} /></Link>
              <div className="pr-trial-note">No credit card required to start</div>
              <div className="pr-fee-note">
                <span className="pr-fee-dot" aria-hidden="true">•</span>
                2.5% platform fee on payments your customer makes through Punchlist.
                No other charges.
              </div>
            </div>
          </div>

          {/* Competitive anchor — drop a quiet line so visitors who
              know what ServiceTitan / Houzz Pro cost see the value. */}
          <div className="pr-compare rv rv--d2">
            <div className="pr-compare-inner">
              <span className="pr-compare-row">
                <span className="pr-compare-name">ServiceTitan</span>
                <span className="pr-compare-price">$400+/mo</span>
              </span>
              <span className="pr-compare-row">
                <span className="pr-compare-name">Houzz Pro</span>
                <span className="pr-compare-price">~$99/mo</span>
              </span>
              <span className="pr-compare-row pr-compare-row--us">
                <span className="pr-compare-name">Punchlist Pro</span>
                <span className="pr-compare-price">$29/mo</span>
              </span>
            </div>
            <p className="pr-compare-note">Same workflow — quote, send, get paid. A fraction of the cost.</p>
          </div>

          {/* Integrations strip — answers the "is this a real tool"
              question without a separate section. Names of trusted
              partners do more than a logo grid would. */}
          <div className="pr-integ rv rv--d3">
            <span className="pr-integ-label">Built on infrastructure you already trust</span>
            <div className="pr-integ-list">
              <span>Stripe Connect for payouts</span>
              <span aria-hidden="true">·</span>
              <span>Twilio for SMS</span>
              <span aria-hidden="true">·</span>
              <span>Affirm / Klarna at checkout</span>
              <span aria-hidden="true">·</span>
              <span>CSV export for QuickBooks &amp; Xero</span>
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
