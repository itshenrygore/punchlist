/* ═══════════════════════════════════════════════════════════════
   Punchlist — Landing page (v4)
   
   Structure: 7 sections, zero redundancy, each advances the argument.
   1. Hero: the line + interactive proof
   2. Problem: emotional tension (one section, not three)
   3. Product: visual walkthrough with inline phone mockups
   4. Trust: credibility signals
   5. Pricing: clean and fair
   6. Final CTA
   7. Footer
   ═══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X, Check, ChevronRight } from 'lucide-react';
import Logo from '../components/logo';
import '../styles/landing.css';

function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
    );
    document.querySelectorAll('.rv').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ════════════════════════════════════════════
   NAV
   ════════════════════════════════════════════ */
function Nav() {
  const [s, setS] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setS(window.scrollY > 30);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <nav className={`ln-nav${s ? ' ln-nav--s' : ''}`}>
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

/* ════════════════════════════════════════════
   INTERACTIVE QUOTE CARD
   Realistic bathroom reno. Working term selector.
   The visitor experiences the aha moment before signup.
   ════════════════════════════════════════════ */
const ITEMS = [
  { name: 'Demo vanity, toilet & tub surround', price: 850 },
  { name: 'Rough-in plumbing — new layout', price: 2200 },
  { name: 'Install vanity, toilet & shower valve', price: 1800 },
  { name: 'Tile backer board & waterproofing', price: 750 },
];
const TOTAL = ITEMS.reduce((s, i) => s + i.price, 0);
const TERMS = [6, 12, 18, 24];

function LiveQuoteCard() {
  const [term, setTerm] = useState(24);
  const [tapped, setTapped] = useState(false);
  const monthly = Math.ceil(TOTAL / term);

  return (
    <div className="qc">
      <div className="qc-glow" />
      <div className="qc-body">
        {/* Header */}
        <div className="qc-head">
          <div className="qc-dot">JR</div>
          <div><div className="qc-biz">JR Plumbing & Mechanical</div><div className="qc-job">Bathroom Renovation — Main Floor</div></div>
        </div>
        {/* Price */}
        <div className="qc-price">
          <div className="qc-monthly" key={monthly}>
            <span className="qc-mo-n">${monthly}</span><span className="qc-mo-u">/mo</span>
          </div>
          <div className="qc-or">for {term} months · ${TOTAL.toLocaleString()} total</div>
        </div>
        {/* Terms */}
        <div className="qc-terms">
          {TERMS.map(t => (
            <button key={t} type="button" className={`qc-t${term === t ? ' qc-t--on' : ''}`}
              onClick={() => { setTerm(t); setTapped(false); }}>{t}mo</button>
          ))}
        </div>
        {/* Items */}
        <div className="qc-items">
          {ITEMS.map((it, i) => (
            <div key={i} className="qc-row">
              <span>{it.name}</span><span className="qc-row-p">${it.price.toLocaleString()}</span>
            </div>
          ))}
          <div className="qc-row qc-row--t"><span>Total</span><span>${TOTAL.toLocaleString()}</span></div>
        </div>
        {/* CTA */}
        {!tapped ? (
          <button className="qc-cta" type="button" onClick={() => setTapped(true)}>
            Approve & Pay ${monthly}/mo
          </button>
        ) : (
          <div className="qc-ok">
            <span className="qc-ok-check">✓</span>
            <span>Approved — you'd get paid ${TOTAL.toLocaleString()}</span>
          </div>
        )}
        <div className="qc-hint">{!tapped ? 'Try tapping the terms above ↑' : 'Customer pays monthly. You get the full amount.'}</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   MINI PHONE MOCKUP
   Used in the product walkthrough section
   ════════════════════════════════════════════ */
function Phone({ children, label }) {
  return (
    <div className="ph-wrap">
      <div className="ph">
        <div className="ph-notch" />
        <div className="ph-screen">{children}</div>
      </div>
      {label && <div className="ph-label">{label}</div>}
    </div>
  );
}

/* ════════════════════════════════════════════
   MAIN
   ════════════════════════════════════════════ */
export default function LandingPage() {
  useReveal();
  useEffect(() => {
    document.title = 'Punchlist — Your customer sees $199/month. You get paid in full.';
  }, []);

  return (
    <div className="ln">
      <Nav />

      {/* ═══ 1. HERO ═══ */}
      <section className="ln-hero">
        <div className="ln-w ln-hero-grid">
          <div className="ln-hero-txt">
            <div className="ln-pill rv"><span className="ln-pill-dot" />Now in early access</div>
            <h1 className="ln-h1 rv rv--d1">
              Your customer sees<br />
              <span className="ln-hi">$199/month.</span><br />
              You get paid in full.
            </h1>
            <p className="ln-hero-p rv rv--d2">
              Send professional quotes with built-in monthly payments.
              Customers approve from their phone. You get the
              full amount deposited — upfront.
            </p>
            <div className="ln-hero-ctas rv rv--d2">
              <Link to="/signup" className="ln-btn">Start free <ArrowRight size={15} /></Link>
              <a href="#how" className="ln-btn ln-btn--ghost">How it works</a>
            </div>
            <div className="ln-hero-tags rv rv--d3">
              <span><Check size={14} strokeWidth={3} /> No credit card</span>
              <span><Check size={14} strokeWidth={3} /> 3 free quotes/month</span>
              <span><Check size={14} strokeWidth={3} /> Works from your phone</span>
            </div>
          </div>
          <div className="ln-hero-card rv rv--d2">
            <LiveQuoteCard />
          </div>
        </div>
      </section>

      {/* ═══ 2. THE PROBLEM ═══ */}
      <section className="ln-dark">
        <div className="ln-w">
          <div className="ln-dark-grid rv">
            {/* Before */}
            <div className="ba-side">
              <div className="ba-lbl ba-lbl--b">Without monthly payments</div>
              <div className="ba-msgs">
                <div className="ba-in"><div className="ba-bub">Hey Mike — $5,600 is a lot more than we were expecting for the bathroom.</div><div className="ba-t">Sarah · 2:41 PM</div></div>
                <div className="ba-in"><div className="ba-bub">We're going to get another quote. Thanks though.</div><div className="ba-t">Sarah · 2:42 PM</div></div>
                <div className="ba-out"><div className="ba-bub ba-bub--o">No worries, let me know 👍</div></div>
                <div className="ba-dead">She didn't.</div>
              </div>
            </div>
            {/* After */}
            <div className="ba-side rv rv--d2">
              <div className="ba-lbl ba-lbl--a">With Punchlist</div>
              <div className="ba-msgs">
                <div className="ba-notif">
                  <div className="ba-notif-icon">✓</div>
                  <div><div className="ba-notif-h">Quote approved</div><div className="ba-notif-b">Sarah Chen approved your quote — $5,600</div></div>
                </div>
                <div className="ba-in"><div className="ba-bub">$234 a month is way more doable. Just approved it! When can you start?</div><div className="ba-t">Sarah · 2:38 PM</div></div>
                <div className="ba-out"><div className="ba-bub ba-bub--o">Monday morning. Thanks Sarah! 🔧</div></div>
              </div>
              <div className="ba-punchline">Same job. Same price. She saw $234/mo instead of $5,600.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 3. THE PRODUCT (visual walkthrough) ═══ */}
      <section className="ln-sec" id="how">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">How it works</span>
            <h2 className="ln-h2">Three steps. Three minutes.<br/>From your phone.</h2>
          </div>

          <div className="walkthrough">
            {/* Step 1 */}
            <div className="wt-step rv">
              <div className="wt-info">
                <div className="wt-num">01</div>
                <h3 className="wt-title">Describe the job</h3>
                <p className="wt-desc">Type what you're quoting in plain English. AI builds an itemized scope with trade-accurate pricing from a catalog of 1,400+ plumbing, electrical, and HVAC items.</p>
              </div>
              <Phone label="AI builds your scope in seconds">
                <div className="ph-mock">
                  <div className="ph-top"><span className="ph-back">←</span><span className="ph-title">New Quote</span><span /></div>
                  <div className="ph-input-box">
                    <div className="ph-fake-text">Main floor bathroom reno — demo existing vanity, tub surround, and toilet. New layout with walk-in shower, floating vanity, wall-mount toilet.</div>
                  </div>
                  <div className="ph-btn-mock">Build Scope →</div>
                  <div className="ph-items-mock">
                    <div className="ph-li"><span>Demo vanity, toilet & tub</span><span>$850</span></div>
                    <div className="ph-li"><span>Rough-in plumbing</span><span>$2,200</span></div>
                    <div className="ph-li"><span>Install fixtures</span><span>$1,800</span></div>
                    <div className="ph-li"><span>Tile backer & waterproof</span><span>$750</span></div>
                  </div>
                </div>
              </Phone>
            </div>

            {/* Step 2 */}
            <div className="wt-step wt-step--rev rv rv--d1">
              <div className="wt-info">
                <div className="wt-num">02</div>
                <h3 className="wt-title">Set the payment terms</h3>
                <p className="wt-desc">Choose how the monthly payment appears on your customer's quote. Pick the term length that makes the price feel right — 6, 12, 18, or 24 months. The total stays the same.</p>
              </div>
              <Phone label="The financing preview — the money moment">
                <div className="ph-mock">
                  <div className="ph-top"><span className="ph-back">←</span><span className="ph-title">Review Terms</span><span /></div>
                  <div className="ph-eyebrow">Sarah will see</div>
                  <div className="ph-big-price"><span className="ln-hi">$234</span><span className="ph-big-unit">/mo</span></div>
                  <div className="ph-big-sub">for 24 months · $5,600 total</div>
                  <div className="ph-term-row">
                    <span className="ph-term">6mo</span>
                    <span className="ph-term">12mo</span>
                    <span className="ph-term">18mo</span>
                    <span className="ph-term ph-term--on">24mo</span>
                  </div>
                  <div className="ph-btn-mock">Send Quote →</div>
                </div>
              </Phone>
            </div>

            {/* Step 3 */}
            <div className="wt-step rv rv--d2">
              <div className="wt-info">
                <div className="wt-num">03</div>
                <h3 className="wt-title">Customer approves. You get paid.</h3>
                <p className="wt-desc">Your customer gets a link, sees the monthly price, and approves from their phone in under 60 seconds. No login, no app download. You get the full amount deposited to your bank account.</p>
              </div>
              <Phone label="One-tap approval from the customer's phone">
                <div className="ph-mock">
                  <div className="ph-top"><span /><span className="ph-title">Quote from JR Plumbing</span><span /></div>
                  <div className="ph-cust-price">
                    <div className="ph-cust-mo"><span className="ln-hi">$234</span>/mo</div>
                    <div className="ph-big-sub">for 24 months · $5,600 total</div>
                  </div>
                  <div className="ph-li"><span>Demo vanity, toilet & tub</span><span>$850</span></div>
                  <div className="ph-li"><span>Rough-in plumbing</span><span>$2,200</span></div>
                  <div className="ph-li"><span>Install fixtures</span><span>$1,800</span></div>
                  <div className="ph-approve-mock">Approve & Pay $234/mo</div>
                  <div className="ph-or">or pay $5,600 in full</div>
                </div>
              </Phone>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 4. TRUST ═══ */}
      <section className="ln-sec ln-sec--alt">
        <div className="ln-w">
          <div className="trust-grid rv">
            {[
              { val: '1,400+', label: 'Trade-specific items in the pricing catalog — plumbing, electrical, HVAC, and general contracting' },
              { val: '<60s', label: 'Average customer approval time — they see the quote, tap approve, sign, done' },
              { val: '$0', label: 'Risk to you — the financing provider pays you in full, upfront, every time' },
            ].map((t, i) => (
              <div key={i} className={`trust-card rv rv--d${i + 1}`}>
                <div className="trust-val">{t.val}</div>
                <div className="trust-lbl">{t.label}</div>
              </div>
            ))}
          </div>
          <div className="trust-note rv rv--d2">
            <p>Built in Calgary for Canadian trades contractors. Punchlist handles the quoting and financing presentation — your Stripe account handles the money. We never touch your funds.</p>
          </div>
        </div>
      </section>

      {/* ═══ 5. PRICING ═══ */}
      <section className="ln-sec" id="pricing">
        <div className="ln-w">
          <div className="ln-sh rv">
            <span className="ln-ey">Pricing</span>
            <h2 className="ln-h2">One closed job pays for a year.</h2>
          </div>
          <div className="pr-grid rv rv--d1">
            <div className="pr-plan">
              <div className="pr-top">
                <div className="pr-name">Free</div>
                <div className="pr-price">$0<span>/mo</span></div>
                <div className="pr-desc">Start sending quotes with monthly payments.</div>
              </div>
              <div className="pr-feats">
                {['3 quotes per month', 'Monthly payment display', 'Customer e-signature', 'AI scope builder', 'Push notifications'].map((f, i) => (
                  <div key={i} className="pr-f"><Check size={15} strokeWidth={2.5} />{f}</div>
                ))}
              </div>
              <Link to="/signup" className="ln-btn ln-btn--outline ln-btn--full">Start free</Link>
            </div>
            <div className="pr-plan pr-plan--pro">
              <div className="pr-tag">Most popular</div>
              <div className="pr-top">
                <div className="pr-name">Pro</div>
                <div className="pr-price">$39<span>/mo</span></div>
                <div className="pr-desc">Unlimited quotes. Financing checkout. No watermark.</div>
              </div>
              <div className="pr-feats">
                {['Everything in Free', 'Unlimited quotes', 'Financing checkout enabled', 'Foreman AI scope checker', 'Activity tracking (views, opens)', 'Follow-up nudges', 'Priority notifications'].map((f, i) => (
                  <div key={i} className="pr-f"><Check size={15} strokeWidth={2.5} />{f}</div>
                ))}
              </div>
              <Link to="/signup" className="ln-btn ln-btn--full">Start free trial <ArrowRight size={14} /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 6. FINAL CTA ═══ */}
      <section className="ln-final rv">
        <div className="ln-w">
          <h2 className="ln-h2">Stop losing $5,000 jobs<br/>to sticker shock.</h2>
          <p className="ln-final-p">Your customer sees $199/month. You get paid in full.</p>
          <Link to="/signup" className="ln-btn ln-btn--lg">Start free — no credit card <ArrowRight size={16} /></Link>
        </div>
      </section>

      {/* ═══ 7. FOOTER ═══ */}
      <footer className="ln-foot">
        <div className="ln-w ln-foot-in">
          <div className="ln-foot-brand">
            <Logo size="sm" />
            <div className="ln-foot-tag">Financing-first quoting for Canadian contractors.</div>
          </div>
          <div className="ln-foot-links">
            <Link to="/pricing">Pricing</Link><Link to="/login">Log in</Link><Link to="/signup">Sign up</Link><Link to="/terms">Terms</Link><a href="mailto:hello@punchlist.ca">Contact</a>
          </div>
          <div className="ln-foot-copy">© {new Date().getFullYear()} Punchlist · Calgary, AB</div>
        </div>
      </footer>
    </div>
  );
}
