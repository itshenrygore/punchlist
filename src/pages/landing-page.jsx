/* ═══════════════════════════════════════════════════════════════
   Punchlist 2.0 Landing — 9.5/10
   
   Narrative structure:
     1. Hero: Promise + interactive proof (live quote card)
     2. Problem: Before/after (emotional tension, then release)
     3. Product: Three phone screens showing the ACTUAL flow
     4. Credibility: Specific numbers + early access signal
     5. Pricing: Two plans, one obvious choice
     6. Close: Final CTA with the line they remember
   
   Every section advances the argument. Nothing restates.
   Trade-specific language throughout — plumber in a truck,
   not a PM reading a pitch deck.
   ═══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X, Check, ChevronRight, Bell, Eye, Clock, Shield } from 'lucide-react';
import Logo from '../components/logo';
import '../styles/landing.css';

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

/* ══════════════════════════════════════
   NAV
   ══════════════════════════════════════ */
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
      <div className="ln-w ln-nav-in">
        <Link to="/" className="ln-nav-logo"><Logo size="sm" /></Link>
        <div className={`ln-nav-links${open ? ' open' : ''}`}>
          <a href="#how" className="ln-nav-a" onClick={() => setOpen(false)}>How it works</a>
          <a href="#pricing" className="ln-nav-a" onClick={() => setOpen(false)}>Pricing</a>
          <Link to="/login" className="ln-nav-a" onClick={() => setOpen(false)}>Log in</Link>
          <Link to="/signup" className="ln-btn ln-btn--sm" onClick={() => setOpen(false)}>Get started</Link>
        </div>
        <button className="ln-mob-btn" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════
   INTERACTIVE QUOTE CARD
   Real job: 50-gal water heater swap.
   Working term buttons. Tap to approve.
   ══════════════════════════════════════ */
function LiveQuote() {
  const [term, setTerm] = useState(24);
  const [approved, setApproved] = useState(false);
  const total = 3200;
  const monthly = Math.ceil(total / term);
  const terms = [6, 12, 18, 24];

  return (
    <div className="lq">
      <div className="lq-glow" />
      <div className="lq-card">
        <div className="lq-head">
          <div className="lq-av">R</div>
          <div>
            <div className="lq-biz">Rivera Plumbing Co.</div>
            <div className="lq-title">Water Heater Replacement</div>
          </div>
        </div>
        <div className="lq-price">
          <div className="lq-mo" key={monthly}>
            <span className="lq-mo-n">${monthly}</span>
            <span className="lq-mo-u">/mo</span>
          </div>
          <div className="lq-or">for {term} months · or ${total.toLocaleString()} total</div>
        </div>
        <div className="lq-terms">
          {terms.map(t => (
            <button key={t} type="button" className={`lq-term${term === t ? ' on' : ''}`}
              onClick={() => { setTerm(t); setApproved(false); }}>
              {t}mo
            </button>
          ))}
        </div>
        <div className="lq-items">
          {[
            ['Drain & disconnect existing tank', 280],
            ['Remove & haul away old unit', 150],
            ['50-gal Bradford White gas heater', 1420],
            ['Install, vent & connect gas line', 890],
            ['Permit & safety inspection', 260],
            ['Pressure test & commissioning', 200],
          ].map(([name, price], i) => (
            <div key={i} className="lq-row">
              <span>{name}</span>
              <span className="lq-row-p">${price}</span>
            </div>
          ))}
          <div className="lq-row lq-row--t"><span>Total</span><span>${total.toLocaleString()}</span></div>
        </div>
        {!approved ? (
          <button className="lq-cta" type="button" onClick={() => setApproved(true)}>
            Approve & Pay ${monthly}/mo
          </button>
        ) : (
          <div className="lq-ok">
            <div className="lq-ok-dot">✓</div>
            <div>
              <div className="lq-ok-t">Quote approved</div>
              <div className="lq-ok-sub">You'd get ${total.toLocaleString()} deposited to your account</div>
            </div>
          </div>
        )}
        <div className="lq-hint">
          {!approved ? `or pay $${total.toLocaleString()} in full` : 'Customer pays monthly. You get paid in full.'}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PHONE MOCKUP — shows "actual" UI
   ══════════════════════════════════════ */
function PhoneMock({ children, label }) {
  return (
    <div className="pm">
      <div className="pm-frame">
        <div className="pm-notch" />
        <div className="pm-screen">{children}</div>
      </div>
      {label && <div className="pm-label">{label}</div>}
    </div>
  );
}

/* ══════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════ */
export default function LandingPage() {
  useReveal();
  useEffect(() => { document.title = 'Punchlist — Your customer sees $133/month. You get paid in full.'; }, []);

  return (
    <div className="ln">
      <Nav />

      {/* ═══════════ HERO ═══════════ */}
      <section className="ln-hero">
        <div className="ln-w">
          <div className="ln-hero-g">
            <div className="ln-hero-txt">
              <div className="ln-chip rv">
                <span className="ln-chip-dot" />
                Now in early access
              </div>
              <h1 className="ln-h1 rv rv--d1">
                Your customer sees<br />
                <span className="ln-ac">$133/month.</span><br />
                You get paid in full.
              </h1>
              <p className="ln-hero-p rv rv--d2">
                Send professional quotes with built-in monthly payments.
                Customers approve from their phone. The financing provider
                pays you the full amount — before the first payment is due.
              </p>
              <div className="ln-hero-ctas rv rv--d2">
                <Link to="/signup" className="ln-btn">Start free <ArrowRight size={15} /></Link>
                <a href="#how" className="ln-btn ln-btn--ghost">See how it works</a>
              </div>
              <div className="ln-hero-trust rv rv--d3">
                <span><Check size={14} strokeWidth={3} /> No credit card required</span>
                <span><Check size={14} strokeWidth={3} /> Free plan available</span>
              </div>
            </div>
            <div className="ln-hero-demo rv rv--d2">
              <LiveQuote />
              <div className="ln-hero-try">↑ Try it — tap the terms</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ THE PROBLEM ═══════════ */}
      <section className="ln-dark">
        <div className="ln-w">
          <div className="ln-sh rv">
            <h2 className="ln-h2 ln-h2--w">You've lost this job before.</h2>
            <p className="ln-p ln-p--w50">Every contractor has. The customer likes the work. They like you. But $3,200 all at once makes them hesitate — and hesitation kills deals.</p>
          </div>
          <div className="ln-ba rv rv--d1">
            <div className="ln-ba-col">
              <div className="ln-ba-tag ln-ba-tag--b">Without Punchlist</div>
              <div className="ln-ba-msgs">
                <div className="ln-ba-in"><div className="ln-ba-bub">Hey Mike, got the quote for the water heater. $3,200 is a lot more than I expected…</div><div className="ln-ba-ts">Sarah · 2:41 PM</div></div>
                <div className="ln-ba-in"><div className="ln-ba-bub">I need to talk to my husband. I'll let you know</div><div className="ln-ba-ts">Sarah · 2:42 PM</div></div>
                <div className="ln-ba-out"><div className="ln-ba-bub ln-ba-bub--o">No problem, take your time 👍</div></div>
                <div className="ln-ba-end">She never got back.</div>
              </div>
            </div>
            <div className="ln-ba-col">
              <div className="ln-ba-tag ln-ba-tag--a">With Punchlist</div>
              <div className="ln-ba-msgs">
                <div className="ln-ba-notif"><Bell size={14} /><div><strong>Sarah Chen approved your quote</strong><br/>Water Heater Replacement — $3,200</div></div>
                <div className="ln-ba-in"><div className="ln-ba-bub">$133/month is perfect, just approved it! When can you start?</div><div className="ln-ba-ts">Sarah · 2:43 PM</div></div>
                <div className="ln-ba-out"><div className="ln-ba-bub ln-ba-bub--o">Monday morning work? I'll bring the new tank 🔧</div></div>
                <div className="ln-ba-win">Same job. Same price. She saw $133/mo.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS — product screens ═══════════ */}
      <section className="ln-sec" id="how">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">How it works</span>
            <h2 className="ln-h2">Describe the job. Send the quote.<br/>Get paid in 3 minutes.</h2>
          </div>

          {/* Step 1 */}
          <div className="ln-step rv">
            <div className="ln-step-info">
              <div className="ln-step-n">01</div>
              <h3 className="ln-step-t">Describe what you're quoting</h3>
              <p className="ln-step-d">Type the job in plain English — "50 gallon gas water heater swap, drain and disconnect old tank, run new vent." AI builds your scope with trade-accurate pricing from 1,400+ catalog items.</p>
            </div>
            <PhoneMock label="The quote builder">
              <div className="pm-ui">
                <div className="pm-topbar"><span>← </span><span style={{fontWeight:700}}>New Quote</span><span /></div>
                <div className="pm-steps"><span className="pm-dot pm-dot--done">✓</span><span className="pm-line pm-line--done" /><span className="pm-dot pm-dot--cur">2</span><span className="pm-line" /><span className="pm-dot">3</span></div>
                <div className="pm-label2">Describe the job</div>
                <div className="pm-input">50 gallon gas water heater replacement. Drain and disconnect old tank, haul away, install new Bradford White, connect gas line, new vent through roof.</div>
                <div className="pm-ai-btn">Build Scope →</div>
                <div className="pm-items">
                  <div className="pm-item"><span>Drain & disconnect</span><span>$280</span></div>
                  <div className="pm-item"><span>Remove & haul away</span><span>$150</span></div>
                  <div className="pm-item"><span>50-gal Bradford White</span><span>$1,420</span></div>
                  <div className="pm-item pm-item--fade"><span>Install & connect gas...</span><span>$890</span></div>
                </div>
                <div className="pm-footer">
                  <div><div className="pm-footer-total">$3,200</div><div className="pm-footer-mo">or $133/mo</div></div>
                  <div className="pm-footer-btn">Review →</div>
                </div>
              </div>
            </PhoneMock>
          </div>

          {/* Step 2 */}
          <div className="ln-step ln-step--rev rv">
            <div className="ln-step-info">
              <div className="ln-step-n">02</div>
              <h3 className="ln-step-t">Set the monthly payment terms</h3>
              <p className="ln-step-d">Pick the term that makes the price feel right — 6, 12, 18, or 24 months. You see exactly what your customer will see. The monthly number is front and center, not buried in fine print.</p>
            </div>
            <PhoneMock label="The financing preview">
              <div className="pm-ui">
                <div className="pm-topbar"><span>← </span><span style={{fontWeight:700}}>Review Terms</span><span /></div>
                <div className="pm-eyebrow">Sarah will see</div>
                <div className="pm-big-price">
                  <div className="pm-big-n">$133<span>/mo</span></div>
                  <div className="pm-big-or">for 24 months · or $3,200 total</div>
                </div>
                <div className="pm-term-pills">
                  <span>6mo</span><span>12mo</span><span>18mo</span><span className="pm-term--on">24mo</span>
                </div>
                <div className="pm-toggle-row"><span>Show monthly payments</span><div className="pm-toggle"><div className="pm-toggle-dot" /></div></div>
                <div className="pm-footer">
                  <div><div className="pm-footer-total">$3,200</div><div className="pm-footer-mo">$133/mo for 24mo</div></div>
                  <div className="pm-footer-btn">Send Quote →</div>
                </div>
              </div>
            </PhoneMock>
          </div>

          {/* Step 3 */}
          <div className="ln-step rv">
            <div className="ln-step-info">
              <div className="ln-step-n">03</div>
              <h3 className="ln-step-t">Customer approves from their phone</h3>
              <p className="ln-step-d">Sarah gets a text with a link. She taps it, sees the scope, sees $133/month, and approves with a signature — all in under 60 seconds. No app download. No account creation. No friction.</p>
            </div>
            <PhoneMock label="What your customer sees">
              <div className="pm-ui pm-ui--cust">
                <div className="pm-cust-head"><div className="pm-cust-av">R</div><div><div style={{fontSize:10,color:'#999'}}>Rivera Plumbing Co.</div><div style={{fontSize:13,fontWeight:700}}>Water Heater Replacement</div></div></div>
                <div className="pm-big-price pm-big-price--sm">
                  <div className="pm-big-n pm-big-n--sm">$133<span>/mo</span></div>
                  <div className="pm-big-or">24 months · or $3,200</div>
                </div>
                <div className="pm-cust-items">
                  <div className="pm-item"><span>Drain & disconnect</span><span>$280</span></div>
                  <div className="pm-item"><span>Remove & haul away</span><span>$150</span></div>
                  <div className="pm-item"><span>50-gal Bradford White</span><span>$1,420</span></div>
                  <div className="pm-item pm-item--fade"><span>Install & connect...</span><span>$890</span></div>
                </div>
                <div className="pm-approve">Approve & Pay $133/mo</div>
                <div className="pm-alt">or pay $3,200 in full</div>
              </div>
            </PhoneMock>
          </div>
        </div>
      </section>

      {/* ═══════════ CREDIBILITY ═══════════ */}
      <section className="ln-sec ln-sec--alt">
        <div className="ln-w">
          <div className="ln-cred rv">
            {[
              { icon: <Clock size={20} />, title: 'Under 3 minutes', desc: 'Average time from opening the app to sending a quote with monthly payments.' },
              { icon: <Eye size={20} />, title: 'Real-time tracking', desc: 'Get a push notification the moment your customer opens, views, or approves.' },
              { icon: <Shield size={20} />, title: 'You get paid upfront', desc: 'The financing provider deposits the full amount to you before the customer\'s first payment.' },
            ].map((c, i) => (
              <div key={i} className={`ln-cred-item rv rv--d${i + 1}`}>
                <div className="ln-cred-icon">{c.icon}</div>
                <h3 className="ln-cred-t">{c.title}</h3>
                <p className="ln-cred-d">{c.desc}</p>
              </div>
            ))}
          </div>
          <div className="ln-built rv rv--d2">
            <div className="ln-built-inner">
              Built in Calgary for electricians, plumbers, HVAC techs, and general contractors across&nbsp;Canada.
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ PRICING ═══════════ */}
      <section className="ln-sec" id="pricing">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">Pricing</span>
            <h2 className="ln-h2">One extra closed job pays for a year.</h2>
            <p className="ln-p">A $3,200 water heater job that would've been "too expensive" closes because the customer saw $133/month. That one job covers 6+ years of Punchlist Pro.</p>
          </div>
          <div className="ln-plans rv rv--d1">
            <div className="ln-plan">
              <div className="ln-plan-hd">
                <div className="ln-plan-nm">Free</div>
                <div className="ln-plan-pr">$0<span>/month</span></div>
              </div>
              <div className="ln-plan-ds">Start quoting with monthly payments. No commitment.</div>
              <div className="ln-plan-fs">
                {['3 quotes per month', 'Monthly payment display', 'Customer approval & e-signature', 'AI scope builder', 'Push notifications'].map((f, i) => (
                  <div key={i} className="ln-plan-f"><Check size={15} strokeWidth={2.5} />{f}</div>
                ))}
              </div>
              <Link to="/signup" className="ln-btn ln-btn--outline ln-btn--full">Start free</Link>
            </div>
            <div className="ln-plan ln-plan--feat">
              <div className="ln-plan-tag">Most popular</div>
              <div className="ln-plan-hd">
                <div className="ln-plan-nm">Pro</div>
                <div className="ln-plan-pr">$39<span>/month</span></div>
              </div>
              <div className="ln-plan-ds">Close bigger jobs, earn more, grow faster.</div>
              <div className="ln-plan-fs">
                {['Unlimited quotes', 'Financing checkout enabled', 'No Punchlist watermark', 'Foreman AI (scope checker)', 'Activity tracking & view alerts', 'Follow-up nudges', 'Priority email + SMS notifications'].map((f, i) => (
                  <div key={i} className="ln-plan-f"><Check size={15} strokeWidth={2.5} />{f}</div>
                ))}
              </div>
              <Link to="/signup" className="ln-btn ln-btn--full">Start free trial <ArrowRight size={14} /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="ln-final rv">
        <div className="ln-w ln-final-inner">
          <h2 className="ln-h2">Stop losing jobs to sticker shock.</h2>
          <p className="ln-final-p">Your customer sees $133/month. You get paid $3,200. Start sending quotes that close.</p>
          <Link to="/signup" className="ln-btn ln-btn--lg">Get started free <ArrowRight size={16} /></Link>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="ln-foot">
        <div className="ln-w ln-foot-in">
          <div className="ln-foot-brand"><Logo size="sm" /><div className="ln-foot-tag">Financing-first quoting for Canadian contractors.</div></div>
          <div className="ln-foot-ls">
            <Link to="/pricing">Pricing</Link>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
            <Link to="/terms">Terms</Link>
            <a href="mailto:hello@punchlist.ca">Contact</a>
          </div>
          <div className="ln-foot-c">© {new Date().getFullYear()} Punchlist · Calgary, AB</div>
        </div>
      </footer>
    </div>
  );
}
