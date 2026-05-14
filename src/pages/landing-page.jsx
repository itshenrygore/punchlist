/* ═══════════════════════════════════════════════════════════════
   Punchlist 2.0 Landing — Top 1%
   
   Design philosophy: Financial product confidence (Mercury/Ramp),
   not startup SaaS energy. The page demonstrates the product
   through an INTERACTIVE quote card with a working term slider.
   The contractor experiences the aha moment before signing up.
   
   Emotional arc: Tension (sticker shock kills deals) →
   Release (monthly payments close them) → Proof (interactive
   demo) → Credibility (how it works) → Action (start free).
   
   Orange appears in exactly 3 places: the $XXX/mo number,
   the CTA buttons, and the pill dot. Everything else is
   black/charcoal/warm gray.
   ═══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X, Check, ChevronRight } from 'lucide-react';
import Logo from '../components/logo';
import { currency } from '../lib/format';
import '../styles/landing.css';

/* ── Scroll reveal ── */
function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.rv').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ── Animated counter ── */
function useCountUp(target, duration = 800, trigger = true) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let start = 0;
    const startTime = performance.now();
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [target, duration, trigger]);
  return val;
}

/* ════════════════════════════════════════════
   NAV
   ════════════════════════════════════════════ */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <nav className={`ln-nav${scrolled ? ' ln-nav--s' : ''}`}>
      <div className="ln-w ln-nav-inner">
        <Link to="/" className="ln-nav-logo" aria-label="Home"><Logo size="sm" /></Link>
        <div className={`ln-nav-links${open ? ' ln-nav-links--open' : ''}`}>
          <a href="#how" className="ln-nav-link" onClick={() => setOpen(false)}>How it works</a>
          <a href="#pricing" className="ln-nav-link" onClick={() => setOpen(false)}>Pricing</a>
          <Link to="/login" className="ln-nav-link" onClick={() => setOpen(false)}>Log in</Link>
          <Link to="/signup" className="ln-btn ln-btn--sm" onClick={() => setOpen(false)}>Get started</Link>
        </div>
        <button className="ln-nav-mob" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </nav>
  );
}

/* ════════════════════════════════════════════
   INTERACTIVE QUOTE CARD — the centerpiece
   Working term slider. Live monthly payment.
   This IS the demo.
   ════════════════════════════════════════════ */
function LiveQuoteCard() {
  const [term, setTerm] = useState(24);
  const [approved, setApproved] = useState(false);
  const total = 4800;
  const monthly = Math.ceil(total / term);
  const terms = [6, 12, 18, 24];

  return (
    <div className="ln-qc">
      {/* Glow effect */}
      <div className="ln-qc-glow" />

      <div className="ln-qc-inner">
        <div className="ln-qc-head">
          <div className="ln-qc-avatar">S</div>
          <div>
            <div className="ln-qc-biz">Smith & Sons Plumbing</div>
            <div className="ln-qc-job">Kitchen Renovation</div>
          </div>
        </div>

        {/* Price card */}
        <div className="ln-qc-price">
          <div className="ln-qc-mo" key={monthly}>
            <span className="ln-qc-mo-num">${monthly}</span>
            <span className="ln-qc-mo-unit">/mo</span>
          </div>
          <div className="ln-qc-or">for {term} months · or $4,800 total</div>
        </div>

        {/* Term selector — the interactive magic */}
        <div className="ln-qc-terms">
          {terms.map(t => (
            <button
              key={t}
              type="button"
              className={`ln-qc-term${term === t ? ' ln-qc-term--on' : ''}`}
              onClick={() => { setTerm(t); setApproved(false); }}
            >
              {t}mo
            </button>
          ))}
        </div>

        {/* Line items */}
        <div className="ln-qc-items">
          {[
            ['Remove existing fixtures', 650],
            ['Install faucet & disposal', 480],
            ['Plumbing rough-in for island', 1800],
            ['Permit & inspection', 350],
          ].map(([name, price], i) => (
            <div key={i} className="ln-qc-row">
              <span className="ln-qc-row-name">{name}</span>
              <span className="ln-qc-row-price">${price.toLocaleString()}</span>
            </div>
          ))}
          <div className="ln-qc-row ln-qc-row--total">
            <span>Total</span>
            <span>$4,800</span>
          </div>
        </div>

        {/* CTA */}
        {!approved ? (
          <button className="ln-qc-cta" type="button" onClick={() => setApproved(true)}>
            Approve & Pay ${monthly}/mo
          </button>
        ) : (
          <div className="ln-qc-approved">
            <div className="ln-qc-approved-check">✓</div>
            <div className="ln-qc-approved-text">Approved — you'd get paid $4,800</div>
          </div>
        )}

        <div className="ln-qc-sub">
          {!approved ? `or pay $4,800 in full` : 'The customer pays monthly. You get the full amount.'}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   BEFORE/AFTER — the sticker shock moment
   ════════════════════════════════════════════ */
function BeforeAfter() {
  return (
    <div className="ln-ba">
      {/* Before */}
      <div className="ln-ba-side rv">
        <div className="ln-ba-label ln-ba-label--before">Without Punchlist</div>
        <div className="ln-ba-msg-stack">
          <div className="ln-ba-msg ln-ba-msg--in">
            <div className="ln-ba-bubble">Got the quote. $4,800 is more than I expected…</div>
            <div className="ln-ba-meta">Sarah · 2:41 PM</div>
          </div>
          <div className="ln-ba-msg ln-ba-msg--in">
            <div className="ln-ba-bubble">Let me think about it and get back to you</div>
            <div className="ln-ba-meta">Sarah · 2:42 PM</div>
          </div>
          <div className="ln-ba-msg ln-ba-msg--out">
            <div className="ln-ba-bubble ln-ba-bubble--out">No problem, take your time 👍</div>
          </div>
          <div className="ln-ba-ghost">She never got back.</div>
        </div>
      </div>

      {/* After */}
      <div className="ln-ba-side rv rv--d2">
        <div className="ln-ba-label ln-ba-label--after">With Punchlist</div>
        <div className="ln-ba-msg-stack">
          <div className="ln-ba-notif">
            <div className="ln-ba-notif-dot" />
            <div>
              <div className="ln-ba-notif-title">Quote approved</div>
              <div className="ln-ba-notif-body">Sarah Chen approved your quote — $4,800</div>
            </div>
          </div>
          <div className="ln-ba-msg ln-ba-msg--in">
            <div className="ln-ba-bubble">$199/mo is perfect. Just approved it!</div>
            <div className="ln-ba-meta">Sarah · 2:43 PM</div>
          </div>
          <div className="ln-ba-msg ln-ba-msg--out">
            <div className="ln-ba-bubble ln-ba-bubble--out">Amazing, I'll get started Monday 🔧</div>
          </div>
          <div className="ln-ba-result">Same job. Same price. Different framing.</div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════ */
export default function LandingPage() {
  useReveal();
  useEffect(() => {
    document.title = 'Punchlist — Your customer sees $199/month. You get paid in full.';
  }, []);

  return (
    <div className="ln">
      <Nav />

      {/* ═══ HERO ═══ */}
      <section className="ln-hero">
        <div className="ln-w">
          <div className="ln-hero-grid">
            <div className="ln-hero-text">
              <div className="ln-pill rv"><span className="ln-pill-dot" />Built for Canadian contractors</div>
              <h1 className="ln-h1 rv rv--d1">
                Your customer sees<br />
                <span className="ln-accent">$199/month.</span><br />
                You get paid in full.
              </h1>
              <p className="ln-hero-sub rv rv--d2">
                Professional quotes with built-in monthly payments.
                Customers approve from their phone.
                You get paid the full amount — upfront.
              </p>
              <div className="ln-hero-ctas rv rv--d2">
                <Link to="/signup" className="ln-btn">Start free <ArrowRight size={15} /></Link>
                <a href="#how" className="ln-btn ln-btn--ghost">See how it works</a>
              </div>
              <div className="ln-hero-badges rv rv--d3">
                <span><Check size={14} strokeWidth={2.5} /> Free forever plan</span>
                <span><Check size={14} strokeWidth={2.5} /> No credit card</span>
                <span><Check size={14} strokeWidth={2.5} /> Works from your phone</span>
              </div>
            </div>
            <div className="ln-hero-card rv rv--d2">
              <LiveQuoteCard />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BEFORE / AFTER ═══ */}
      <section className="ln-dark" id="problem">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">The problem</span>
            <h2 className="ln-h2 ln-h2--light">Sticker shock kills deals.<br/>Monthly payments close them.</h2>
            <p className="ln-sub ln-sub--light">Same job. Same price. The only difference is how the customer sees the number.</p>
          </div>
          <BeforeAfter />
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="ln-sec" id="how">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">How it works</span>
            <h2 className="ln-h2">Three steps. Three minutes.</h2>
          </div>
          <div className="ln-flow">
            {[
              {
                num: '01',
                title: 'Describe the job',
                desc: 'Type what you\'re quoting in plain English. AI builds your scope with trade-accurate pricing from a catalog of 1,400+ items.',
              },
              {
                num: '02',
                title: 'Review & set terms',
                desc: 'See exactly what your customer will see. Pick the monthly payment term that makes the price feel right — 6, 12, 18, or 24 months.',
              },
              {
                num: '03',
                title: 'Send & get paid',
                desc: 'Customer gets a link, sees the monthly price, approves from their phone, and signs. You get the full amount deposited to your account.',
              },
            ].map((step, i) => (
              <div key={i} className={`ln-flow-step rv rv--d${i + 1}`}>
                <div className="ln-flow-num">{step.num}</div>
                <div className="ln-flow-body">
                  <h3 className="ln-flow-title">{step.title}</h3>
                  <p className="ln-flow-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ THE MATH ═══ */}
      <section className="ln-sec ln-sec--alt">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">The math</span>
            <h2 className="ln-h2">One extra closed job pays for 12 months of&nbsp;Punchlist.</h2>
          </div>
          <div className="ln-math rv rv--d1">
            <div className="ln-math-card">
              <div className="ln-math-val">$4,800</div>
              <div className="ln-math-label">Average job that was "too expensive" at full price</div>
            </div>
            <div className="ln-math-arrow">→</div>
            <div className="ln-math-card">
              <div className="ln-math-val ln-accent">$199/mo</div>
              <div className="ln-math-label">What the customer actually sees and approves</div>
            </div>
            <div className="ln-math-arrow">→</div>
            <div className="ln-math-card">
              <div className="ln-math-val">$4,800</div>
              <div className="ln-math-label">What you get deposited — the full amount, upfront</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES (minimal) ═══ */}
      <section className="ln-sec">
        <div className="ln-w">
          <div className="ln-feats rv">
            {[
              { title: 'AI scope builder', desc: 'Describe the job. Get an itemized quote with trade-accurate pricing in seconds.' },
              { title: 'Instant notifications', desc: 'Know the second your customer opens, views, or approves your quote.' },
              { title: 'One-tap approval', desc: 'Customers approve and sign from their phone. No login, no app download.' },
              { title: 'Offline-ready', desc: 'Start quotes in basements and crawl spaces. Syncs when you\'re back online.' },
            ].map((f, i) => (
              <div key={i} className={`ln-feat rv rv--d${i + 1}`}>
                <h3 className="ln-feat-title">{f.title}</h3>
                <p className="ln-feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="ln-sec ln-sec--alt" id="pricing">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">Pricing</span>
            <h2 className="ln-h2">Simple. No surprises.</h2>
          </div>
          <div className="ln-plans rv rv--d1">
            <div className="ln-plan">
              <div className="ln-plan-top">
                <div className="ln-plan-name">Free</div>
                <div className="ln-plan-price">$0<span>/month</span></div>
                <div className="ln-plan-desc">Start quoting with monthly payments.</div>
              </div>
              <div className="ln-plan-feats">
                {['3 quotes per month', 'Monthly payment display', 'Customer e-signature', 'AI scope builder', 'Push notifications'].map((f, i) => (
                  <div key={i} className="ln-plan-feat"><Check size={15} strokeWidth={2.5} />{f}</div>
                ))}
              </div>
              <Link to="/signup" className="ln-btn ln-btn--outline ln-btn--full">Start free</Link>
            </div>
            <div className="ln-plan ln-plan--featured">
              <div className="ln-plan-tag">Most popular</div>
              <div className="ln-plan-top">
                <div className="ln-plan-name">Pro</div>
                <div className="ln-plan-price">$39<span>/month</span></div>
                <div className="ln-plan-desc">Close more. Earn more.</div>
              </div>
              <div className="ln-plan-feats">
                {['Unlimited quotes', 'Financing checkout enabled', 'No Punchlist watermark', 'Foreman AI scope checker', 'Activity tracking', 'Follow-up nudges', 'Priority notifications'].map((f, i) => (
                  <div key={i} className="ln-plan-feat"><Check size={15} strokeWidth={2.5} />{f}</div>
                ))}
              </div>
              <Link to="/signup" className="ln-btn ln-btn--full">Start free trial <ArrowRight size={14} /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="ln-final rv">
        <div className="ln-w">
          <h2 className="ln-h2">Stop losing jobs<br/>to sticker shock.</h2>
          <p className="ln-final-sub">Your customer sees $199/month. You get paid in full.</p>
          <Link to="/signup" className="ln-btn ln-btn--lg">Start free — no credit card <ArrowRight size={16} /></Link>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="ln-foot">
        <div className="ln-w ln-foot-inner">
          <div className="ln-foot-brand">
            <Logo size="sm" />
            <div className="ln-foot-tag">Financing-first quoting for Canadian contractors.</div>
          </div>
          <div className="ln-foot-links">
            <Link to="/pricing">Pricing</Link>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
            <Link to="/terms">Terms</Link>
            <a href="mailto:hello@punchlist.ca">Contact</a>
          </div>
          <div className="ln-foot-copy">© {new Date().getFullYear()} Punchlist · Calgary, AB</div>
        </div>
      </footer>
    </div>
  );
}
