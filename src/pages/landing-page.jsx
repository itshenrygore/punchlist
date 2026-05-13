/* ═══════════════════════════════════════════════════════════════
   Punchlist 2.0 Landing Page
   
   One message: "Your customer sees $199/month. You get paid in full."
   
   Structure:
     1. Nav (minimal)
     2. Hero (the line they'll remember)
     3. Quote preview (what the customer sees)
     4. How it works (3 steps)
     5. Why financing (the differentiator)
     6. Pricing (Free + Pro)
     7. CTA
     8. Footer
   
   673 lines → ~350 lines.
   No InteractiveDemo, no ForemanShowcase, no WorkflowDepth.
   ═══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X, CheckCircle, Send, DollarSign, Eye, Zap } from 'lucide-react';
import Logo from '../components/logo';
import '../styles/landing.css';

/* ── Scroll reveal ── */
function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); }
      }),
      { threshold: 0.12 }
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
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <nav className={`lp-nav ${scrolled ? 'lp-nav--scrolled' : ''}`}>
      <div className="lp-container lp-nav-inner">
        <Link to="/" className="lp-nav-brand"><Logo size="sm" /></Link>
        <div className={`lp-nav-links ${open ? 'lp-nav-links--open' : ''}`}>
          <a href="#how" className="lp-nav-link" onClick={() => setOpen(false)}>How it works</a>
          <a href="#pricing" className="lp-nav-link" onClick={() => setOpen(false)}>Pricing</a>
          <Link to="/login" className="lp-nav-link" onClick={() => setOpen(false)}>Log in</Link>
          <Link to="/signup" className="lp-btn-primary lp-nav-cta" onClick={() => setOpen(false)}>
            Start free <ArrowRight size={14} />
          </Link>
        </div>
        <button className="lp-nav-toggle" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </nav>
  );
}

/* ── Quote Preview Card — what the customer sees ── */
function QuotePreview() {
  return (
    <div className="rv rv-d2" style={{
      maxWidth: 340, margin: '0 auto', borderRadius: 20,
      background: 'var(--panel, #fff)', padding: '24px 20px 20px',
      boxShadow: '0 4px 24px rgba(28,20,12,0.12), 0 1px 3px rgba(28,20,12,0.06)',
      border: '1px solid var(--line, rgba(17,24,39,0.06))',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Smith & Sons Plumbing</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>Kitchen Renovation</div>
      </div>
      <div style={{
        textAlign: 'center', padding: '20px 16px', borderRadius: 14, marginBottom: 14,
        background: 'linear-gradient(135deg, rgba(184,81,40,0.06), rgba(184,81,40,0.02))',
        border: '1px solid rgba(184,81,40,0.12)',
      }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--brand, #B85128)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>
          $199<span style={{ fontSize: 16, fontWeight: 600, color: 'var(--muted)' }}>/mo</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>for 24 months · or $4,800 total</div>
      </div>
      {['Remove existing fixtures', 'Install new faucet & disposal', 'Plumbing rough-in for island', 'Permit & inspection'].map((item, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', padding: '7px 0',
          borderBottom: i < 3 ? '1px solid rgba(17,24,39,0.06)' : 'none',
          fontSize: 13, color: 'var(--text-2)',
        }}>
          <span>{item}</span>
          <span style={{ color: 'var(--muted)', fontWeight: 600 }}>${[650, 480, 1800, 350][i]}</span>
        </div>
      ))}
      <div style={{
        marginTop: 14, padding: '12px', borderRadius: 10,
        background: 'var(--brand, #B85128)', textAlign: 'center',
        color: '#fff', fontWeight: 700, fontSize: 14,
      }}>
        Approve & Pay Monthly
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
        or pay $4,800 in full
      </div>
    </div>
  );
}

/* ═══ MAIN ═══ */
export default function LandingPage() {
  useReveal();

  useEffect(() => {
    document.title = 'Punchlist — Your customer sees $199/month. You get paid in full.';
  }, []);

  return (
    <div className="lp">
      <Nav />

      {/* ═══ HERO ═══ */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="lp-hero-grid">
            <div>
              <div className="lp-eyebrow-pill rv">
                <span className="lp-pulse-dot" />
                Financing-first quoting for contractors
              </div>
              <h1 className="lp-h1 rv rv-d1">
                Your customer sees<br />
                <span className="lp-accent-text">$199/month.</span><br />
                You get paid in full.
              </h1>
              <p className="lp-hero-sub rv rv-d2">
                Create professional quotes with built-in monthly payment options.
                Your customer approves from their phone in under a minute.
                You get paid the full amount — upfront.
              </p>
              <div className="lp-hero-ctas rv rv-d2">
                <Link to="/signup" className="lp-btn-primary btn-glow">
                  Start free <ArrowRight size={16} />
                </Link>
              </div>
              <div className="lp-hero-proof rv rv-d3">
                <span className="lp-proof-item">
                  <CheckCircle size={13} className="lp-green-icon" />
                  Free forever plan
                </span>
                <span className="lp-proof-item">
                  <CheckCircle size={13} className="lp-green-icon" />
                  No credit card needed
                </span>
                <span className="lp-proof-item">
                  <CheckCircle size={13} className="lp-green-icon" />
                  Works from your phone
                </span>
              </div>
            </div>
            <QuotePreview />
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="lp-section" id="how">
        <div className="lp-container">
          <div className="lp-section-head rv">
            <span className="lp-eyebrow">How it works</span>
            <h2 className="lp-h2">Quote, send, get paid. Under 3 minutes.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginTop: 32 }}>
            {[
              {
                icon: <Zap size={22} />,
                title: 'Describe the job',
                desc: 'Type a sentence. AI builds your scope with trade-accurate pricing. Adjust anything. Done in 60 seconds.',
              },
              {
                icon: <Send size={22} />,
                title: 'Send with monthly payments',
                desc: 'Your customer gets a professional quote showing $199/mo instead of $4,800. They approve and sign from their phone.',
              },
              {
                icon: <DollarSign size={22} />,
                title: 'Get paid in full',
                desc: 'The financing provider pays you the full amount upfront. Your customer pays monthly. You never chase a check.',
              },
            ].map((step, i) => (
              <div key={i} className={`rv rv-d${i + 1}`} style={{
                padding: '24px 20px', borderRadius: 14,
                background: 'var(--panel, #fff)',
                border: '1px solid var(--line, rgba(17,24,39,0.06))',
                boxShadow: '0 1px 3px rgba(28,20,12,0.04)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, marginBottom: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--brand-bg, rgba(184,81,40,0.06))',
                  color: 'var(--brand, #B85128)',
                }}>
                  {step.icon}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
                  {step.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WHY FINANCING ═══ */}
      <section className="lp-section lp-section--warm">
        <div className="lp-container">
          <div className="lp-section-head rv">
            <span className="lp-eyebrow">Why monthly payments</span>
            <h2 className="lp-h2">Sticker shock kills deals. Monthly payments close them.</h2>
            <p className="lp-sub">
              A $5,000 bathroom reno feels expensive. $199/month feels manageable.
              The job is the same — the psychology is completely different.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 28 }}>
            {[
              { stat: '60%', label: 'of homeowners prefer monthly payments for home services over $2,000' },
              { stat: '2.4×', label: 'higher approval rate when monthly payment is shown prominently on the quote' },
              { stat: '$0', label: 'risk to you — the financing provider pays you in full, upfront' },
            ].map((s, i) => (
              <div key={i} className={`rv rv-d${i + 1}`} style={{
                padding: '24px 20px', borderRadius: 14,
                background: 'var(--panel, #fff)',
                border: '1px solid var(--line, rgba(17,24,39,0.06))',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: 36, fontWeight: 800, color: 'var(--brand, #B85128)',
                  fontFamily: 'var(--font-display)', letterSpacing: '-0.03em',
                }}>
                  {s.stat}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TRACKING ═══ */}
      <section className="lp-section">
        <div className="lp-container" style={{ textAlign: 'center' }}>
          <div className="rv">
            <Eye size={28} style={{ color: 'var(--brand)', marginBottom: 12 }} />
            <h2 className="lp-h2">Know the second they open it.</h2>
            <p className="lp-sub" style={{ maxWidth: 480, margin: '0 auto' }}>
              Get a push notification when your customer views, approves, or signs your quote.
              Follow up at the perfect moment — not too early, not too late.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="lp-section lp-section--warm" id="pricing">
        <div className="lp-container">
          <div className="lp-section-head rv">
            <span className="lp-eyebrow">Pricing</span>
            <h2 className="lp-h2">One extra closed job pays for a year.</h2>
          </div>
          <div className="lp-pricing-grid rv rv-d1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 28 }}>
            {/* Free */}
            <div style={{
              padding: '28px 24px', borderRadius: 16,
              background: 'var(--panel, #fff)',
              border: '1px solid var(--line, rgba(17,24,39,0.06))',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Free</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>$0<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>/month</span></div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, marginBottom: 16 }}>Get started, no commitment.</div>
              {['3 quotes per month', 'Monthly payment display', 'Customer approval + e-sign', 'AI scope builder', 'Push notifications'].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, color: 'var(--text-2)' }}>
                  <CheckCircle size={14} style={{ color: 'var(--green, #0F7A50)', flexShrink: 0 }} /> {f}
                </div>
              ))}
              <Link to="/signup" style={{
                display: 'block', marginTop: 20, padding: '12px', borderRadius: 10,
                textAlign: 'center', fontWeight: 700, fontSize: 14,
                border: '1px solid var(--line-2)', color: 'var(--text)',
                textDecoration: 'none', background: 'transparent',
              }}>
                Start free
              </Link>
            </div>
            {/* Pro */}
            <div style={{
              padding: '28px 24px', borderRadius: 16,
              background: 'var(--panel, #fff)',
              border: '2px solid var(--brand, #B85128)',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: -10, right: 16, padding: '3px 10px',
                borderRadius: 6, background: 'var(--brand)', color: '#fff',
                fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>Most popular</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pro</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>$39<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>/month</span></div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, marginBottom: 16 }}>Close more, earn more.</div>
              {['Unlimited quotes', 'Financing checkout enabled', 'No watermark', 'Scope checker (Foreman AI)', 'Activity tracking (views, opens)', 'Nudge / follow-up', 'Priority notifications (email + SMS)'].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, color: 'var(--text-2)' }}>
                  <CheckCircle size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} /> {f}
                </div>
              ))}
              <Link to="/signup" style={{
                display: 'block', marginTop: 20, padding: '12px', borderRadius: 10,
                textAlign: 'center', fontWeight: 700, fontSize: 14,
                background: 'var(--brand)', color: '#fff',
                textDecoration: 'none', boxShadow: '0 2px 8px rgba(184,81,40,0.25)',
              }}>
                Start free trial <ArrowRight size={14} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="lp-section" style={{ textAlign: 'center', paddingTop: 48, paddingBottom: 60 }}>
        <div className="lp-container rv">
          <h2 className="lp-h2">Stop losing jobs to sticker shock.</h2>
          <p className="lp-sub" style={{ maxWidth: 440, margin: '12px auto 24px' }}>
            Your customer sees $199/month. You get paid in full.
            Start sending quotes that close.
          </p>
          <Link to="/signup" className="lp-btn-primary btn-glow" style={{ fontSize: 16 }}>
            Start free — no credit card <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-brand">
            <Logo size="sm" />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              Financing-first quoting for Canadian contractors.
            </div>
          </div>
          <div className="lp-footer-links">
            <Link to="/pricing">Pricing</Link>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
            <Link to="/terms">Terms</Link>
            <a href="mailto:hello@punchlist.ca">Contact</a>
          </div>
          <div className="lp-footer-copy">
            © {new Date().getFullYear()} Punchlist · Calgary, AB
          </div>
        </div>
      </footer>
    </div>
  );
}
