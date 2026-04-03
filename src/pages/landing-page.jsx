import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import InteractiveDemo from '../components/interactive-demo';

/**
 * Landing Page v2 — Complete rewrite.
 * 
 * Strategic shifts:
 * 1. Position as margin-protection tool, not "fast quoting"
 * 2. Hero leads with revenue pain (underpricing, missed items)
 * 3. Foreman moved UP — strongest differentiator
 * 4. Social proof is money-specific
 * 5. Mobile-first copy: short, punchy, contractor-grade
 */

/* ─── Foreman Demo ─── */
function ForemanDemo() {
  const bodyRef = useRef(null);
  const [started, setStarted] = useState(false);
  const sectionRef = useRef(null);
  const timersRef = useRef([]);

  const FM = [
    {
      m: [
        { r: 'u', t: 'Customer wants kitchen faucet replaced. What am I missing?' },
        { r: 't' },
        {
          r: 'b',
          t: 'Classic one. 90% of guys miss these:<br><br>' +
            '• <strong>Shut-off valves</strong> — swap them now or you\'re coming back free<br>' +
            '• <strong>Supply lines</strong> — braided stainless. $18 in parts, $0 in callbacks<br>' +
            '• <strong>Disposal fee</strong> — old faucet doesn\'t vanish<br><br>' +
            'That\'s $150–$210 you\'re leaving behind. Want me to add them?'
        },
        { r: 'u', t: 'Add them' },
        { r: 't' },
        {
          r: 'b',
          t: '3 line items added. Quote updated: <strong>$485 → $650</strong><br><br>That\'s $165 you would\'ve missed.',
          a: 'View updated quote →'
        },
      ],
    },
    {
      m: [
        { r: 'p', t: '📷 Photo from job site' },
        { r: 'u', t: 'Customer says it just needs a quick fix. What do you think?' },
        { r: 't' },
        {
          r: 'b',
          t: 'Not a quick fix. Green patina = active corrosion, weeping at the joint.<br><br>' +
            '<strong>Don\'t patch it.</strong> Replace the valve and 6" of line both sides. Solder over corrosion and you\'re back in 3 months — free.<br><br>' +
            'Parts ~$35, labour 45 min. Quote <strong>$265</strong>, not $85.',
          a: 'Add to quote →'
        },
      ],
    },
  ];

  useEffect(() => {
    if (!sectionRef.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started) setStarted(true);
    }, { threshold: 0.25 });
    obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started || !bodyRef.current) return;
    let cycleTimer;
    function runFM(idx) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      const body = bodyRef.current;
      if (!body) return;
      body.innerHTML = '';
      let t = 500;
      FM[idx].m.forEach(msg => {
        if (msg.r === 't') {
          timersRef.current.push(setTimeout(() => {
            const e = document.createElement('div');
            e.className = 'fm-typing';
            e.innerHTML = '<span></span><span></span><span></span>';
            e.id = 'fmtt';
            body.appendChild(e);
            body.scrollTop = body.scrollHeight;
          }, t));
          t += 1400;
          timersRef.current.push(setTimeout(() => {
            const e = document.getElementById('fmtt');
            if (e) e.remove();
          }, t));
          return;
        }
        timersRef.current.push(setTimeout(() => {
          const e = document.createElement('div');
          if (msg.r === 'p') {
            e.className = 'fm-msg fm-msg-photo';
            e.textContent = msg.t;
          } else if (msg.r === 'u') {
            e.className = 'fm-msg fm-msg-user';
            e.textContent = msg.t;
          } else {
            e.className = 'fm-msg fm-msg-bot';
            let h = msg.t;
            if (msg.a) h += '<div class="fm-msg-action">' + msg.a + '</div>';
            e.innerHTML = h;
          }
          body.appendChild(e);
          requestAnimationFrame(() => requestAnimationFrame(() => e.classList.add('show')));
          body.scrollTop = body.scrollHeight;
        }, t));
        t += msg.r === 'u' || msg.r === 'p' ? 800 : 200;
      });
      t += 6500;
      cycleTimer = setTimeout(() => runFM((idx + 1) % FM.length), t);
    }
    runFM(0);
    return () => {
      timersRef.current.forEach(clearTimeout);
      clearTimeout(cycleTimer);
    };
  }, [started]);

  return (
    <div ref={sectionRef} className="fm-demo" id="fm-demo">
      <div className="fm-demo-head">
        <div className="fm-demo-head-left">
          <div className="fm-demo-avatar">🔨</div>
          <div>
            <div className="fm-demo-title">Foreman</div>
            <div className="fm-demo-sub">Catches what you miss</div>
          </div>
        </div>
        <div className="fm-demo-online" />
      </div>
      <div className="fm-demo-body" id="fm-body" ref={bodyRef} />
      <div className="fm-demo-input">
        <span className="fm-demo-input-field">Ask anything…</span>
        <div className="fm-demo-input-icons"><span>📷</span><span>🎤</span></div>
      </div>
    </div>
  );
}

/* ─── Pricing Toggle ─── */
function PricingToggle() {
  const [billing, setBilling] = useState('y');
  return (
    <>
      <div className="billing-toggle">
        <button className={`tog-btn ${billing === 'm' ? 'on' : ''}`} onClick={() => setBilling('m')}>Monthly</button>
        <button className={`tog-btn ${billing === 'y' ? 'on' : ''}`} onClick={() => setBilling('y')}>Yearly <span className="save-tag">Save $99</span></button>
      </div>
      <div className="price-top">
        <span className="price-num">{billing === 'm' ? '$29' : '$249'}</span>
        <span className="price-per">{billing === 'm' ? '/month' : '/year'}</span>
      </div>
      {billing === 'y' && <div className="price-equiv">$20.75/mo — one missed line item pays for 6 months</div>}
    </>
  );
}

/* ─── Sticky Bottom CTA ─── */
function StickyBottomCTA() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    function check() {
      const y = window.scrollY;
      const docH = document.documentElement.scrollHeight;
      const winH = window.innerHeight;
      const nearBottom = y + winH > docH - 300;
      setShow(y > 500 && !nearBottom);
    }
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, []);

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      transform: show ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform .25s ease',
      background: 'rgba(20,22,26,.97)', backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255,255,255,.06)',
      padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
    }}>
      <Link to="/signup" style={{
        padding: '10px 24px', background: 'linear-gradient(180deg,#ed7648,#e76a3c)',
        color: '#fff', fontSize: 14, fontWeight: 700, borderRadius: 10,
        textDecoration: 'none', boxShadow: '0 2px 10px rgba(231,106,60,.2)', whiteSpace: 'nowrap',
      }}>Build your first quote free →</Link>
    </div>
  );
}

/* ─── Main Landing Page ─── */
export default function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    let link = document.getElementById('landing-css');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/landing.css';
      link.id = 'landing-css';
      document.head.appendChild(link);
    }
    return () => {
      const el = document.getElementById('landing-css');
      if (el) el.remove();
    };
  }, []);

  useEffect(() => {
    function onScroll() { setNavScrolled(window.scrollY > 60); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <div className="landing-page">
        {/* NAV */}
        <header className={`nav ${navScrolled ? 'scrolled' : ''}`} id="nav">
          <div className="nav-inner">
            <Link to="/" className="brand"><div className="brand-mark" />punchlist</Link>
            <nav className="nav-links">
              <a href="#how-it-works">How it works</a>
              <a href="#pricing">Pricing</a>
              <Link to="/login" className="nav-login">Log in</Link>
              <Link to="/signup" className="nav-cta">Try it free</Link>
            </nav>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════
            HERO — Revenue pain + confidence framing
            ═══════════════════════════════════════════════════ */}
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-dot" />Trusted by trades contractors across Canada</div>
              <h1>Stop leaving money <span className="hl">on the table.</span></h1>
              <p className="hero-sub">You quote after hours. You forget line items. You underprice. Punchlist builds a complete, professional scope while you're still on-site — so nothing gets missed and every job is priced right.</p>
              <div className="hero-ctas">
                <Link to="/signup" className="btn-p btn-lg">Build your first quote free →</Link>
                <a href="#foreman" className="btn-s">See Foreman catch missed items</a>
              </div>
              <div className="hero-proof">
                <span>No credit card required</span>
                <span>1,000+ trade-specific line items</span>
                <span>Works from your truck</span>
              </div>
            </div>
            <div className="demo-wrap">
              <InteractiveDemo inline />
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            PAIN STRIP — Emotional gut-punch numbers
            ═══════════════════════════════════════════════════ */}
        <section className="section pain-strip">
          <div className="container">
            <div className="pain-grid">
              <div className="pain-card">
                <div className="pain-icon">💸</div>
                <div className="pain-num">$200–$800</div>
                <div className="pain-label">left on the table per job when you quote from memory</div>
              </div>
              <div className="pain-card pain-card-mid">
                <div className="pain-icon">📋</div>
                <div className="pain-num">3 in 10</div>
                <div className="pain-label">quotes have at least one forgotten line item</div>
              </div>
              <div className="pain-card">
                <div className="pain-icon">🌙</div>
                <div className="pain-num">10pm</div>
                <div className="pain-label">when most contractors finally sit down to write quotes</div>
              </div>
            </div>
          </div>
        </section>

        {/* MARGIN TAGLINE */}
        <div className="margin-callout">
          <div className="container">
            <p className="margin-callout-text">Most contractors don't lose jobs — they lose margin.</p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            FOREMAN — Moved UP. Strongest differentiator.
            ═══════════════════════════════════════════════════ */}
        <section className="section" id="foreman">
          <div className="container fm-section-grid">
            <div className="fm-section-copy">
              <div className="eyebrow-sm">Your second set of eyes</div>
              <h2>The journeyman in your pocket that catches what you&nbsp;miss.</h2>
              <p>Before you hit send, Foreman reviews your scope. It flags the disposal fee you forgot. The shut-off valves the customer won't think to ask about. The permit line you always leave off residential jobs. One caught item pays for months of Punchlist.</p>
              <div className="fm-features">
                {[
                  ['🔍', 'Catches missed line items', '"You quoted a faucet swap but didn\'t include shut-off valves or supply lines — that\'s $165 you\'d lose"'],
                  ['📷', 'Photo diagnosis', 'Snap a photo on-site → get what\'s wrong, how to fix it, and what to charge. No guessing.'],
                  ['💰', 'Flags underpricing', '"Your labour rate on this panel upgrade is 20% below market for your area"'],
                  ['🔧', 'On-site troubleshooting', '"Breaker keeps tripping" → step-by-step diagnostic → quote draft in 30 seconds'],
                ].map(([icon, title, desc]) => (
                  <div className="fm-feat" key={title}>
                    <div className="fm-feat-icon">{icon}</div>
                    <div className="fm-feat-text"><strong>{title}</strong><span>{desc}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div><ForemanDemo /></div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            HOW IT WORKS — 3 steps, outcome-driven
            ═══════════════════════════════════════════════════ */}
        <section id="how-it-works" className="section section-alt">
          <div className="container narrow">
            <div className="section-head"><div className="eyebrow-sm">How it works</div><h2>Describe the job. Get a complete quote. Send it before you leave.</h2></div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div>
                  <h3>Describe the job</h3>
                  <p>Type it, speak it, or snap a photo — the way you'd text your apprentice. No forms, no dropdowns.</p>
                </div>
              </div>
              <div className="step-line" />
              <div className="step">
                <div className="step-num">2</div>
                <div>
                  <h3>Review the scope</h3>
                  <p>Punchlist builds your line items from a 1,000+ item trade catalog. Toggle items on or off, adjust pricing. Nothing goes out without your say.</p>
                </div>
              </div>
              <div className="step-line" />
              <div className="step">
                <div className="step-num">3</div>
                <div>
                  <h3>Send a quote that wins the job</h3>
                  <p>Your customer gets a clean, professional quote on their phone. They approve, sign, and pay — all in one place.</p>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <Link to="/signup" className="btn-p">Try it now — build a real quote in 2 minutes →</Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            BEFORE / AFTER — Concrete transformation
            ═══════════════════════════════════════════════════ */}
        <section className="section">
          <div className="container narrow">
            <div className="section-head" style={{ textAlign: 'center' }}>
              <div className="eyebrow-sm">The difference</div>
              <h2>How you quote now vs. how you could.</h2>
            </div>
            <div className="diff-grid">
              <div className="diff-before">
                <div className="diff-label">Without Punchlist</div>
                <div className="diff-row bad"><span className="diff-x">✕</span>Quote from memory at 10pm</div>
                <div className="diff-row bad"><span className="diff-x">✕</span>Forget disposal, permits, supply lines</div>
                <div className="diff-row bad"><span className="diff-x">✕</span>Underprice because you're tired</div>
                <div className="diff-row bad"><span className="diff-x">✕</span>Customer gets a text message as a "quote"</div>
                <div className="diff-row bad"><span className="diff-x">✕</span>Chase approvals for days</div>
              </div>
              <div className="diff-after">
                <div className="diff-label">With Punchlist</div>
                <div className="diff-row good"><span className="diff-ck">✓</span>Quote from the driveway before you leave</div>
                <div className="diff-row good"><span className="diff-ck">✓</span>Every line item, every time</div>
                <div className="diff-row good"><span className="diff-ck">✓</span>Market-rate pricing you can stand behind</div>
                <div className="diff-row good"><span className="diff-ck">✓</span>Professional quote your customer can approve on their phone</div>
                <div className="diff-row good"><span className="diff-ck">✓</span>Approved, signed, and deposit collected — same day</div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            TESTIMONIALS — Money-specific, outcome-driven
            ═══════════════════════════════════════════════════ */}
        <section className="section section-alt">
          <div className="container">
            <div className="section-head" style={{ textAlign: 'center' }}><div className="eyebrow-sm">From the field</div><h2>Contractors don't stay because it's fast.<br className="hide-mobile" /> They stay because they make more.</h2></div>
            <div className="testimonials">
              {[
                ['"Sent the quote from the customer\'s driveway. They approved it before I got home. That never happened when I was texting estimates."', '— Plumber, Calgary', '$650 kitchen faucet job'],
                ['"It flagged the shut-off valves and disposal fee I always forget. That one catch was $165 I would\'ve eaten. Punchlist paid for itself on the first job."', '— Plumber, Vancouver', 'Paid for itself day one'],
                ['"My quotes used to be a text message with a number. Now customers tell me I look more professional than shops with 10 trucks. I started winning jobs I used to lose."', '— HVAC Tech, Toronto', 'Winning bigger jobs'],
              ].map(([quote, author, outcome]) => (
                <div className="testimonial" key={author}>
                  <div className="testimonial-outcome">{outcome}</div>
                  <p>{quote}</p>
                  <div className="testimonial-author">{author}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            PRICING — Value-anchored
            ═══════════════════════════════════════════════════ */}
        <section id="pricing" className="section">
          <div className="container" style={{ maxWidth: 680 }}>
            <div className="section-head" style={{ textAlign: 'center' }}>
              <div className="eyebrow-sm">Pricing</div>
              <h2>One caught line item pays for&nbsp;months.</h2>
              <p className="pricing-sub">Start free. Upgrade when you see the difference in your quotes.</p>
            </div>
            <div className="pricing-grid">
              <div className="price-card">
                <div className="price-plan-label">Free</div>
                <div className="price-plan-tagline">See what you've been missing</div>
                <div className="price-features">
                  {['5 quotes per month', 'Full trade catalog (1,000+ items)', 'Professional quote output', 'Customer approval + e-signature', 'No credit card required'].map(f => (
                    <div className="feature-row" key={f}><span className="feature-check">✓</span>{f}</div>
                  ))}
                </div>
                <Link to="/signup" className="btn-s full-w" style={{ marginTop: 4, textDecoration: 'none' }}>Start free →</Link>
              </div>
              <div className="price-card price-card-pro">
                <div className="price-plan-label" style={{ color: 'var(--accent)' }}>Pro</div>
                <div className="price-plan-tagline">For contractors who quote every week</div>
                <PricingToggle />
                <div className="price-features">
                  {['Unlimited quotes', 'Foreman AI assistant', 'Deposits & payment collection', 'Booking & scheduling', 'Invoicing + partial payments', 'Voice input + photo diagnosis'].map(f => (
                    <div className="feature-row" key={f}><span className="feature-check">✓</span>{f}</div>
                  ))}
                </div>
                <Link to="/signup" className="btn-p full-w" style={{ marginTop: 4, textDecoration: 'none' }}>Start with Pro →</Link>
                <div className="price-micro">Cancel anytime · no contracts · no obligation</div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            FAQ — Objection handling, contractor tone
            ═══════════════════════════════════════════════════ */}
        <section className="section section-alt">
          <div className="container narrow">
            <div className="section-head" style={{ textAlign: 'center' }}><h2>Common questions</h2></div>
            <div className="faq-grid">
              {[
                ['What if the scope is wrong?', 'You check every line before it goes out. Think of it as a first draft from a really fast estimator — except it pulls from a 1,000+ item trade catalog, not memory.'],
                ['Does it work for my trade?', 'Plumbing, electrical, HVAC, roofing, carpentry, painting, general contracting, handyman — yes. The catalog is built by tradespeople, not software people.'],
                ['I usually just text my quotes. Why change?', 'A text message with a number leaves money on the table. Punchlist catches the line items you forget and makes you look like the most professional option — which means you win the job and you win it at a better price.'],
                ['What happens after the customer approves?', 'They sign on their phone. You schedule the job, mark it complete, and send the invoice — all from Punchlist. Quote to cash, one app.'],
              ].map(([q, a]) => (
                <div className="faq-item" key={q}><div className="faq-q">{q}</div><div className="faq-a">{a}</div></div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            FINAL CTA — Revenue-anchored close
            ═══════════════════════════════════════════════════ */}
        <section className="final-cta">
          <div className="container final-inner">
            <h2>The next quote you send could be your best one&nbsp;yet.</h2>
            <p>Complete scope. Professional output. Nothing missed. Build your first quote in 2 minutes — free.</p>
            <div className="final-btns"><Link to="/signup" className="btn-p btn-lg">Build your first quote free →</Link></div>
            <div className="final-micro">No credit card · 5 free quotes · cancel anytime</div>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <div className="container footer-inner">
            <div>
              <span className="brand" style={{ fontSize: 14 }}><span className="brand-mark" style={{ width: 22, height: 22, borderRadius: 6 }} />punchlist</span>
              <div className="footer-tag">Quote-to-cash for trades contractors</div>
            </div>
            <div className="footer-links">
              <a href="#how-it-works">How it works</a>
              <a href="#pricing">Pricing</a>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up free</Link>
            </div>
            <div className="footer-copy">© 2026 Punchlist · punchlist.ca</div>
          </div>
        </footer>

        <StickyBottomCTA />
      </div>
    </>
  );
}
