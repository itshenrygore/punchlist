/* ═══════════════════════════════════════════════════════════════
   Punchlist 2.0 Landing Page — Premium rebuild
   
   Design: warm neutral base, orange as precision accent only.
   Mobile-first responsive grid. Stripe/Linear-tier polish.
   ═══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X, Check, Zap, Send, DollarSign, Eye } from 'lucide-react';
import Logo from '../components/logo';
import '../styles/landing.css';

function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); }
      }),
      { threshold: 0.1 }
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
    <nav className={`ln-nav${scrolled ? ' ln-nav--scrolled' : ''}`}>
      <div className="ln-contain ln-nav-inner">
        <Link to="/" className="ln-nav-logo"><Logo size="sm" /></Link>
        <div className={`ln-nav-links${open ? ' ln-nav-links--open' : ''}`}>
          <a href="#how" className="ln-nav-link" onClick={() => setOpen(false)}>How it works</a>
          <a href="#pricing" className="ln-nav-link" onClick={() => setOpen(false)}>Pricing</a>
          <Link to="/login" className="ln-nav-link" onClick={() => setOpen(false)}>Log in</Link>
          <Link to="/signup" className="ln-cta ln-cta--sm" onClick={() => setOpen(false)}>
            Get started <ArrowRight size={14} />
          </Link>
        </div>
        <button className="ln-nav-toggle" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </nav>
  );
}

/* ── Quote Preview Card ── */
function QuoteCard() {
  return (
    <div className="ln-quote-card rv rv--d2">
      <div className="ln-qc-header">
        <div className="ln-qc-avatar">S</div>
        <div>
          <div className="ln-qc-company">Smith & Sons Plumbing</div>
          <div className="ln-qc-title">Kitchen Renovation</div>
        </div>
      </div>
      <div className="ln-qc-price-card">
        <div className="ln-qc-monthly">$199<span>/mo</span></div>
        <div className="ln-qc-terms">for 24 months · or $4,800 total</div>
      </div>
      <div className="ln-qc-items">
        {[
          ['Remove existing fixtures', '$650'],
          ['Install new faucet & disposal', '$480'],
          ['Plumbing rough-in for island', '$1,800'],
          ['Permit & inspection', '$350'],
        ].map(([name, price], i) => (
          <div key={i} className="ln-qc-item">
            <span>{name}</span><span className="ln-qc-item-price">{price}</span>
          </div>
        ))}
      </div>
      <div className="ln-qc-total">
        <span>Total</span><span>$4,800</span>
      </div>
      <button className="ln-qc-approve" type="button">Approve & Pay Monthly</button>
      <div className="ln-qc-alt">or pay $4,800 in full</div>
    </div>
  );
}

/* ── Step Card ── */
function StepCard({ num, icon, title, desc, delay }) {
  return (
    <div className={`ln-step rv rv--d${delay}`}>
      <div className="ln-step-num">{num}</div>
      <div className="ln-step-icon">{icon}</div>
      <h3 className="ln-step-title">{title}</h3>
      <p className="ln-step-desc">{desc}</p>
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ value, label, delay }) {
  return (
    <div className={`ln-stat rv rv--d${delay}`}>
      <div className="ln-stat-val">{value}</div>
      <div className="ln-stat-label">{label}</div>
    </div>
  );
}

/* ── Check Item ── */
function CheckItem({ children }) {
  return (
    <div className="ln-check">
      <div className="ln-check-icon"><Check size={14} strokeWidth={2.5} /></div>
      <span>{children}</span>
    </div>
  );
}

/* ═══ MAIN ═══ */
export default function LandingPage() {
  useReveal();
  useEffect(() => {
    document.title = 'Punchlist — Financing-first quoting for contractors';
  }, []);

  return (
    <div className="ln">
      <Nav />

      {/* ═══ HERO ═══ */}
      <section className="ln-hero">
        <div className="ln-contain">
          <div className="ln-hero-grid">
            <div className="ln-hero-text">
              <div className="ln-pill rv">
                <span className="ln-pill-dot" />
                Financing-first quoting
              </div>
              <h1 className="ln-h1 rv rv--d1">
                Your customer sees <span className="ln-accent">$199/month.</span><br />
                You get paid in full.
              </h1>
              <p className="ln-hero-sub rv rv--d2">
                Create professional quotes with built-in monthly payment options. 
                Customers approve from their phone in under a minute. 
                You get paid the full amount upfront.
              </p>
              <div className="ln-hero-actions rv rv--d2">
                <Link to="/signup" className="ln-cta">
                  Start free <ArrowRight size={16} />
                </Link>
                <a href="#how" className="ln-cta ln-cta--ghost">
                  See how it works
                </a>
              </div>
              <div className="ln-hero-proof rv rv--d3">
                <span><Check size={14} /> Free forever plan</span>
                <span><Check size={14} /> No credit card</span>
                <span><Check size={14} /> Works from your phone</span>
              </div>
            </div>
            <div className="ln-hero-visual">
              <QuoteCard />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF BAR ═══ */}
      <section className="ln-proof-bar rv">
        <div className="ln-contain">
          <p className="ln-proof-text">Built for electricians, plumbers, HVAC techs, and general contractors across Canada.</p>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="ln-section" id="how">
        <div className="ln-contain">
          <div className="ln-section-head rv">
            <span className="ln-eyebrow">How it works</span>
            <h2 className="ln-h2">Quote, send, get paid.<br/>Under 3 minutes.</h2>
          </div>
          <div className="ln-steps">
            <StepCard num="1" icon={<Zap size={24} />} title="Describe the job" desc="Type a sentence. AI builds your scope with trade-accurate pricing from a catalog of 1,400+ items. Adjust anything." delay={1} />
            <StepCard num="2" icon={<Send size={24} />} title="Send with monthly payments" desc="Your customer gets a professional quote showing monthly payments front and center. They approve and sign from their phone." delay={2} />
            <StepCard num="3" icon={<DollarSign size={24} />} title="Get paid in full" desc="The financing provider pays you the full amount upfront. Your customer pays monthly. You never chase a check." delay={3} />
          </div>
        </div>
      </section>

      {/* ═══ WHY FINANCING ═══ */}
      <section className="ln-section ln-section--alt">
        <div className="ln-contain">
          <div className="ln-section-head rv">
            <span className="ln-eyebrow">Why monthly payments</span>
            <h2 className="ln-h2">Sticker shock kills deals.<br/>Monthly payments close them.</h2>
            <p className="ln-section-sub">A $5,000 bathroom reno feels expensive. $199/month feels manageable. The job is the same — the psychology is different.</p>
          </div>
          <div className="ln-stats">
            <StatCard value="60%" label="of homeowners prefer monthly payments for home services over $2,000" delay={1} />
            <StatCard value="2.4×" label="higher approval rate when monthly payment is shown on the quote" delay={2} />
            <StatCard value="$0" label="risk to you — financing provider pays you in full, upfront" delay={3} />
          </div>
        </div>
      </section>

      {/* ═══ TRACKING ═══ */}
      <section className="ln-section">
        <div className="ln-contain ln-tracking rv">
          <div className="ln-tracking-icon"><Eye size={28} /></div>
          <h2 className="ln-h2">Know the moment they open it.</h2>
          <p className="ln-section-sub">
            Get a push notification when your customer views, approves, or signs your quote.
            Follow up at the perfect moment.
          </p>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="ln-section ln-section--alt" id="pricing">
        <div className="ln-contain">
          <div className="ln-section-head rv">
            <span className="ln-eyebrow">Pricing</span>
            <h2 className="ln-h2">One extra closed job pays for a year.</h2>
          </div>
          <div className="ln-pricing rv rv--d1">
            {/* Free */}
            <div className="ln-plan">
              <div className="ln-plan-name">Free</div>
              <div className="ln-plan-price">$0<span>/mo</span></div>
              <div className="ln-plan-desc">Get started, send your first quotes.</div>
              <div className="ln-plan-features">
                <CheckItem>3 quotes per month</CheckItem>
                <CheckItem>Monthly payment display</CheckItem>
                <CheckItem>Customer approval + e-sign</CheckItem>
                <CheckItem>AI scope builder</CheckItem>
                <CheckItem>Push notifications</CheckItem>
              </div>
              <Link to="/signup" className="ln-cta ln-cta--outline ln-cta--full">Start free</Link>
            </div>
            {/* Pro */}
            <div className="ln-plan ln-plan--pro">
              <div className="ln-plan-badge">Recommended</div>
              <div className="ln-plan-name">Pro</div>
              <div className="ln-plan-price">$39<span>/mo</span></div>
              <div className="ln-plan-desc">Close more jobs, earn more.</div>
              <div className="ln-plan-features">
                <CheckItem>Unlimited quotes</CheckItem>
                <CheckItem>Financing checkout enabled</CheckItem>
                <CheckItem>No watermark on quotes</CheckItem>
                <CheckItem>Scope checker (Foreman AI)</CheckItem>
                <CheckItem>Activity tracking (views, opens)</CheckItem>
                <CheckItem>Nudge / follow-up</CheckItem>
                <CheckItem>Priority notifications</CheckItem>
              </div>
              <Link to="/signup" className="ln-cta ln-cta--full">Start free trial <ArrowRight size={14} /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="ln-final rv">
        <div className="ln-contain">
          <h2 className="ln-h2">Stop losing jobs to sticker shock.</h2>
          <p className="ln-final-sub">Your customer sees $199/month. You get paid in full. Start sending quotes that close.</p>
          <Link to="/signup" className="ln-cta ln-cta--lg">
            Start free — no credit card <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="ln-footer">
        <div className="ln-contain ln-footer-inner">
          <div className="ln-footer-brand">
            <Logo size="sm" />
            <div className="ln-footer-tagline">Financing-first quoting for Canadian contractors.</div>
          </div>
          <div className="ln-footer-links">
            <Link to="/pricing">Pricing</Link>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
            <Link to="/terms">Terms</Link>
            <a href="mailto:hello@punchlist.ca">Contact</a>
          </div>
          <div className="ln-footer-copy">© {new Date().getFullYear()} Punchlist · Calgary, AB</div>
        </div>
      </footer>
    </div>
  );
}
