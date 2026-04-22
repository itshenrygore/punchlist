import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Menu, X, ChevronDown, Star, CheckCircle,
  Send, Zap, Eye, DollarSign, Bell, TrendingUp, MessageSquare,
} from 'lucide-react';
import Logo from '../components/logo';
import HeroScene from '../components/landing/HeroScene';
import InteractiveDemo from '../components/landing/InteractiveDemo';
import ForemanShowcase from '../components/landing/ForemanShowcase';
import CustomerView from '../components/landing/CustomerView';
import WorkflowDepth from '../components/landing/WorkflowDepth';
import '../styles/landing.css';

/* ═══════════════════════════════════════════
   Reveal on scroll — IntersectionObserver
   ═══════════════════════════════════════════ */
function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('vis');
          obs.unobserve(e.target);
        }
      }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.rv').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ═══════════════════════════════════════════
   NAV
   ═══════════════════════════════════════════ */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'Demo', href: '#demo' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <nav className={`lp-nav${scrolled ? ' lp-nav--scrolled' : ''}`}>
      <div className="lp-nav-inner">
        <Link to="/" className="lp-brand">
          <Logo size="sm" dark={false} />
        </Link>
        <div className="lp-desk-nav">
          {links.map(l => (
            <a key={l.href} href={l.href} className="lp-nav-link">{l.label}</a>
          ))}
          <div className="lp-nav-divider" />
          <Link to="/login" className="lp-nav-link">Log in</Link>
          <Link to="/signup" className="lp-nav-cta">Get started free</Link>
        </div>
        <button className="lp-mob-btn" onClick={() => setOpen(o => !o)} aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="lp-mob-dropdown">
          {links.map(l => (
            <a key={l.href} href={l.href} className="lp-mob-link" onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link to="/login" className="lp-mob-link" onClick={() => setOpen(false)}>Log in</Link>
          <Link to="/signup" className="lp-mob-cta" onClick={() => setOpen(false)}>Get started free</Link>
        </div>
      )}
    </nav>
  );
}

/* ═══════════════════════════════════════════
   STATS BAR — animated count-up
   ═══════════════════════════════════════════ */
function StatsBar() {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setActive(true); }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="lp-stats-bar" ref={ref}>
      <div className="lp-stats-inner">
        <Stat target={2847} suffix="" label="Quotes sent" active={active} />
        <Stat target={418} suffix="K" label="Revenue closed" prefix="$" active={active} />
        <Stat target={68} suffix="%" label="Approval rate" active={active} />
      </div>
    </div>
  );
}

function Stat({ target, suffix = '', prefix = '', label, active }) {
  const [val, setVal] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const ease = t => 1 - Math.pow(1 - t, 3);
    const tick = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      setVal(Math.round(ease(p) * target));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, active]);

  return (
    <div>
      <div className="lp-stat-num">{prefix}{val.toLocaleString()}{suffix}</div>
      <div className="lp-stat-label">{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STICKER SHOCK
   ═══════════════════════════════════════════ */
function StickerShock() {
  const [flipped, setFlipped] = useState(false);
  const ref = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !intervalRef.current) {
        intervalRef.current = setInterval(() => setFlipped(f => !f), 3000);
      } else if (!e.isIntersecting && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => { obs.disconnect(); clearInterval(intervalRef.current); };
  }, []);

  return (
    <div className="lp-section" id="features" ref={ref}>
      <div className="lp-container" style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="lp-shock-wrap rv">
          <span className="lp-eyebrow">Sticker Shock</span>
          <h2 className="lp-h2" style={{ marginBottom: 12 }}>
            The quotes you lose aren't bad quotes.
          </h2>
          <p className="lp-shock-sub">
            They're just too much money all at once. Show a monthly option
            alongside your total — the customer picks what works for them,
            you get paid in full upfront. Zero risk.
          </p>

          <div className="lp-shock-container">
            {/* Full price card */}
            <div
              className="lp-shock-card"
              style={{
                opacity: flipped ? 0 : 1,
                transform: flipped ? 'scale(0.92)' : 'scale(1)',
                filter: flipped ? 'blur(4px)' : 'blur(0)',
              }}
            >
              <div className="lp-shock-amount">$4,847</div>
              <div className="lp-shock-label">Full price quote</div>
              <div className="lp-shock-reaction" style={{ color: 'var(--lp-text-3)' }}>
                "I need to think about it"
              </div>
            </div>
            {/* Monthly card */}
            <div
              className="lp-shock-card lp-shock-card--accent"
              style={{
                opacity: flipped ? 1 : 0,
                transform: flipped ? 'scale(1)' : 'scale(0.92)',
                filter: flipped ? 'blur(0)' : 'blur(4px)',
              }}
            >
              <div className="lp-shock-amount" style={{ color: 'var(--lp-accent)' }}>~$404/mo</div>
              <div className="lp-shock-label">Same job, monthly option</div>
              <div className="lp-shock-reaction" style={{ color: 'var(--lp-green)' }}>
                "When can you start?"
              </div>
            </div>
          </div>

          <div className="lp-shock-metrics">
            <div>
              <div className="lp-shock-metric-num">+14%</div>
              <div className="lp-shock-metric-label">more revenue<br />per month</div>
            </div>
            <div>
              <div className="lp-shock-metric-num">+20%</div>
              <div className="lp-shock-metric-label">more per<br />job average</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TESTIMONIALS
   ═══════════════════════════════════════════ */
const TESTIMONIALS = [
  {
    name: 'Mike R.', role: 'Electrician, Edmonton', initials: 'MR',
    text: "Quoted a panel upgrade for $4,350 — homeowner was hesitant. I showed her the monthly option, $363/mo, and she signed on the spot. I got the full deposit before I left. That job would've been a follow-up call I never made.",
  },
  {
    name: 'Dave K.', role: 'Plumber, Calgary', initials: 'DK',
    text: "I used to drive home, type up quotes for an hour, then email a PDF nobody opens. Now I build it on-site in five minutes and the customer gets a link right there. My close rate went from maybe 40% to closer to 70%.",
  },
  {
    name: 'Sam R.', role: 'HVAC, Mississauga', initials: 'SR',
    text: "The tracking is the thing nobody talks about. I can see when a customer opens my quote, how many times they look at it, whether they shared it with their spouse. If they've viewed it three times, I know to call.",
  },
];

function Testimonials() {
  return (
    <div className="lp-testimonials-grid">
      {TESTIMONIALS.map((t, i) => (
        <div className={`lp-testimonial card-lift rv rv-d${i + 1}`} key={i}>
          <div className="lp-stars">
            {[...Array(5)].map((_, j) => (
              <Star key={j} size={14} fill="#F59E0B" color="#F59E0B" />
            ))}
          </div>
          <div className="lp-testimonial-text">"{t.text}"</div>
          <div className="lp-testimonial-author">
            <div className="lp-testimonial-avatar">{t.initials}</div>
            <div>
              <div className="lp-testimonial-name">{t.name}</div>
              <div className="lp-testimonial-role">{t.role}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   PRICING
   ═══════════════════════════════════════════ */
function Pricing() {
  const [annual, setAnnual] = useState(true);

  const freeFeatures = [
    '5 quotes per month',
    'Scope builder (Foreman)',
    'Quote tracking',
    'Mobile-first customer view',
  ];
  const proFeatures = [
    'Unlimited quotes',
    'Customer financing (monthly payments)',
    'Deposit collection via Stripe',
    'Push notifications',
    'Photo sharing',
    'Amendments & e-signatures',
    'Invoicing',
    'Priority support',
  ];

  return (
    <div>
      <div className="lp-billing-toggle-wrap rv">
        <div className="lp-billing-toggle">
          <button
            className={`lp-billing-btn${annual ? ' lp-billing-btn--on' : ''}`}
            onClick={() => setAnnual(true)}
          >
            Annual <span className="lp-save-badge">Save 29%</span>
          </button>
          <button
            className={`lp-billing-btn${!annual ? ' lp-billing-btn--on' : ''}`}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="lp-pricing-grid rv rv-d1">
        {/* Free */}
        <div className="lp-price-card">
          <div className="lp-price-plan">Free</div>
          <div className="lp-price-tagline">Get started, no strings</div>
          <div className="lp-price-amount">
            <span className="lp-price-big">$0</span>
            <span className="lp-price-per">forever</span>
          </div>
          <div className="lp-price-equiv">&nbsp;</div>
          {freeFeatures.map((f, i) => (
            <div className="lp-feature-row" key={i}>
              <CheckCircle size={14} className="lp-green-icon" />
              <span>{f}</span>
            </div>
          ))}
          <Link to="/signup" className="lp-price-cta-free btn-ghost">Start free</Link>
          <div className="lp-price-micro">No credit card. No setup. 2 minutes.</div>
        </div>

        {/* Pro */}
        <div className="lp-price-card lp-price-card--pro">
          <div className="lp-pro-badge">Most popular</div>
          <div className="lp-price-plan">Pro</div>
          <div className="lp-price-tagline">Close more, get paid faster</div>
          <div className="lp-price-amount">
            <span className="lp-price-big">${annual ? '249' : '29'}</span>
            <span className="lp-price-per">/{annual ? 'yr' : 'mo'}</span>
          </div>
          <div className="lp-price-equiv">
            {annual ? 'That\'s ~$21/mo' : '$348/yr billed monthly'}
          </div>
          {proFeatures.map((f, i) => (
            <div className="lp-feature-row" key={i}>
              <CheckCircle size={14} className="lp-green-icon" />
              <span>{f}</span>
            </div>
          ))}
          <Link to="/signup?plan=pro" className="lp-price-cta-pro btn-glow">Get started</Link>
          <div className="lp-price-micro">One extra closed job pays for the year.</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   FAQ
   ═══════════════════════════════════════════ */
const FAQ_DATA = [
  {
    q: 'How do monthly payments work for my customer?',
    a: 'When a quote is over $500, the customer sees a monthly payment option alongside the full price. If they choose monthly, they set up payments through our financing partner. You get paid the full amount upfront — deposited to your account within 1–2 business days. Zero risk on your end.',
  },
  {
    q: 'How does the scope builder work?',
    a: 'Describe the job in plain language — type, speak, or snap a photo. Punchlist matches your description against a 1,000+ item trade catalog to build a detailed line-item scope. It catches commonly missed items like permits, haul-away, and rough-in work. You can edit every line before sending.',
  },
  {
    q: 'What can Foreman diagnose from photos?',
    a: 'Foreman can identify corroded fittings, water damage, mold risk, panel conditions, wiring issues, and more. It flags concerns with severity levels and recommends scope items with pricing. Think of it as a second opinion before you quote.',
  },
  {
    q: 'Can customers ask questions on the quote?',
    a: 'Yes. Customers can send messages and photos directly from the quote link on their phone. You get a push notification. All communication stays in one thread — no texting back and forth or digging through emails.',
  },
  {
    q: 'How do amendments work?',
    a: 'If the scope changes after you send a quote, you can send an amendment. The customer sees the updated quote with an "UPDATED" badge highlighting what changed. They re-approve and e-sign the new version. Full audit trail.',
  },
  {
    q: 'Can customers share photos through the quote?',
    a: 'Yes. The quote link includes a "Send a photo or message" bar. Customers can snap a photo of the issue, share it, and you\'ll see it instantly with a push notification. Useful for pre-job prep and change orders.',
  },
  {
    q: 'Is there a contract or can I cancel anytime?',
    a: 'No contract. The Free plan is free forever. Pro is month-to-month or annual — cancel anytime from your settings. If you cancel annual, you keep access through the end of your billing period.',
  },
  {
    q: 'How does deposit collection work?',
    a: 'When a customer approves your quote, they can pay the deposit right from the quote link — one tap, powered by Stripe. The money goes directly to your connected Stripe account. You set the deposit amount per quote.',
  },
];

function FAQ() {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div className="lp-faq-list">
      {FAQ_DATA.map((item, i) => (
        <div className={`lp-faq-item${openIdx === i ? ' lp-faq-item--open' : ''} rv rv-d${Math.min(i % 3 + 1, 3)}`} key={i}>
          <button
            className="lp-faq-q"
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
          >
            <span>{item.q}</span>
            <ChevronDown
              size={16}
              className="lp-faq-chevron"
              style={{ transform: openIdx === i ? 'rotate(180deg)' : 'rotate(0)' }}
            />
          </button>
          <div
            className="lp-faq-a"
            style={{
              maxHeight: openIdx === i ? '300px' : '0px',
              opacity: openIdx === i ? 1 : 0,
            }}
          >
            <div className="lp-faq-a-inner">{item.a}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════════ */
function HowItWorks() {
  const steps = [
    {
      num: '01', icon: MessageSquare,
      title: 'Describe the job',
      desc: 'Type, speak, or snap a photo. Punchlist builds your scope from a trade catalog with 1,000+ items.',
    },
    {
      num: '02', icon: Send,
      title: 'Send the quote',
      desc: 'Your customer gets a branded, mobile-first quote with a monthly payment option. One link, no PDFs.',
    },
    {
      num: '03', icon: DollarSign,
      title: 'Close the job',
      desc: 'Customer approves, e-signs, and pays their deposit in one tap. You get paid in full.',
    },
  ];

  return (
    <div className="lp-how-steps">
      {steps.map((s, i) => (
        <div className={`lp-how-step rv rv-d${i + 1}`} key={i}>
          <div className="lp-how-icon">
            <s.icon size={22} color="#fff" />
          </div>
          <div>
            <span className="lp-how-num">Step {s.num}</span>
            <div className="lp-how-title">{s.title}</div>
            <div className="lp-how-desc">{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function LandingPage() {
  useReveal();

  useEffect(() => {
    document.title = 'Punchlist — Send quotes that actually close';
  }, []);

  return (
    <div className="lp">
      <Nav />

      {/* ── 1. Hero ── */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="lp-hero-grid">
            <div>
              <div className="lp-eyebrow-pill rv">
                <span className="lp-pulse-dot" />
                Quote-to-close for contractors
              </div>
              <h1 className="lp-h1 rv rv-d1">
                Send quotes that<br />actually <span className="lp-accent-text">close.</span>
              </h1>
              <p className="lp-hero-sub rv rv-d2">
                Build professional, branded quotes on-site before you leave the driveway.
                Offer monthly payment options that remove sticker shock, and know the second
                your customer opens it. No more PDFs nobody reads.
              </p>
              <div className="lp-hero-ctas rv rv-d2">
                <Link to="/signup" className="lp-btn-primary btn-glow">
                  Start free <ArrowRight size={16} />
                </Link>
                <a href="#demo" className="lp-btn-secondary btn-ghost">
                  See it in action
                </a>
              </div>
              <div className="lp-hero-proof rv rv-d3">
                <span className="lp-proof-item">
                  <CheckCircle size={13} className="lp-green-icon" />
                  Free forever plan
                </span>
                <span className="lp-proof-item">
                  <CheckCircle size={13} className="lp-green-icon" />
                  No credit card
                </span>
                <span className="lp-proof-item">
                  <CheckCircle size={13} className="lp-green-icon" />
                  Works from your phone
                </span>
              </div>
            </div>
            <div className="rv rv-d2">
              <HeroScene />
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Stats bar ── */}
      <StatsBar />

      {/* ── 3. Sticker Shock ── */}
      <StickerShock />

      {/* ── 4. Outcomes ── */}
      <section className="lp-section lp-section--warm">
        <div className="lp-container">
          <div className="lp-section-head rv">
            <span className="lp-eyebrow">What changes</span>
            <h2 className="lp-h2">Three things that change your business.</h2>
            <p className="lp-sub">
              Close more jobs with monthly options. See every open, view, and question in real time.
              Collect deposits before you leave the site.
            </p>
          </div>
          <WorkflowDepth />
        </div>
      </section>

      {/* ── 5. Interactive Demo ── */}
      <section className="lp-section" id="demo">
        <div className="lp-container">
          <div className="lp-section-head rv">
            <span className="lp-eyebrow">Live demo</span>
            <h2 className="lp-h2">Describe the job. Get a quote.</h2>
            <p className="lp-sub">
              Pick a common job below. See how Punchlist builds the scope,
              catches missed items, and shows your customer a quote with a monthly option.
            </p>
          </div>
          <InteractiveDemo />
        </div>
      </section>

      {/* ── 6. Foreman Showcase ── */}
      <section className="lp-section lp-section--dark">
        <div className="lp-blueprint-grid" />
        <div className="lp-glow-orb" style={{ top: '-10%', right: '-5%' }} />
        <div className="lp-glow-orb" style={{ bottom: '-15%', left: '-8%' }} />
        <div className="lp-container">
          <ForemanShowcase />
        </div>
      </section>

      {/* ── 7. Communication ── */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head rv">
            <span className="lp-eyebrow">Communication</span>
            <h2 className="lp-h2">Every update. One thread.</h2>
            <p className="lp-sub">
              Approvals, questions, photos, amendments — everything between you and
              your customer lives in one place. No texting. No email chains.
            </p>
          </div>
          <CustomerView />
        </div>
      </section>

      {/* ── 8. How It Works ── */}
      <section className="lp-section lp-section--dark">
        <div className="lp-blueprint-grid" />
        <div className="lp-glow-orb" style={{ top: '20%', left: '10%' }} />
        <div className="lp-container">
          <div className="lp-section-head rv">
            <span className="lp-eyebrow" style={{ color: 'rgba(255,255,255,0.4)' }}>How it works</span>
            <h2 className="lp-h2" style={{ color: '#fff' }}>Three steps. That's it.</h2>
          </div>
          <HowItWorks />
        </div>
      </section>

      {/* ── 9. Testimonials ── */}
      <section className="lp-section lp-section--warm">
        <div className="lp-container">
          <div className="lp-section-head rv">
            <span className="lp-eyebrow">From the field</span>
            <h2 className="lp-h2">Contractors who close more.</h2>
          </div>
          <Testimonials />
        </div>
      </section>

      {/* ── 10. Pricing ── */}
      <section className="lp-section" id="pricing">
        <div className="lp-container">
          <div className="lp-section-head rv">
            <span className="lp-eyebrow">Pricing</span>
            <h2 className="lp-h2">Simple pricing. No surprises.</h2>
            <p className="lp-pricing-sub">
              Start free. Upgrade when you're ready.
            </p>
          </div>
          <Pricing />
        </div>
      </section>

      {/* ── 11. FAQ ── */}
      <section className="lp-section lp-section--warm" id="faq">
        <div className="lp-container">
          <div className="lp-section-head rv">
            <span className="lp-eyebrow">FAQ</span>
            <h2 className="lp-h2">Common questions.</h2>
          </div>
          <FAQ />
        </div>
      </section>

      {/* ── 12. Final CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 className="lp-final-h2 rv">Your next quote should<br />work harder.</h2>
          <p className="lp-final-sub rv rv-d1">
            Every quote you send as a PDF is a job you might lose to "I need to think about it."
            Punchlist gives your customer a reason to say yes right now. Free to start.
          </p>
          <div className="lp-final-btns rv rv-d2">
            <Link to="/signup" className="lp-btn-glow-dark">
              Get started free <ArrowRight size={16} />
            </Link>
            <a href="#demo" className="lp-btn-ghost-dark">
              Try the demo
            </a>
          </div>
          <div className="lp-final-proof rv rv-d3">
            <span>Free forever plan</span>
            <span>·</span>
            <span>No credit card</span>
            <span>·</span>
            <span>Works from your phone</span>
            <span>·</span>
            <span>Built in Canada 🍁</span>
          </div>
        </div>
      </section>

      {/* ── 13. Footer ── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-inner">
            <div>
              <Logo size="sm" dark={false} />
              <div className="lp-footer-tagline" style={{ marginTop: 6 }}>
                Quote it. Track it. Close it.
              </div>
            </div>
            <div className="lp-footer-links">
              <a href="#features">Features</a>
              <a href="#demo">Demo</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQ</a>
              <Link to="/login">Log in</Link>
              <Link to="/support">Support</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/privacy">Privacy</Link>
            </div>
          </div>
          <div className="lp-footer-copy">
            © {new Date().getFullYear()} Punchlist · Built in Canada 🍁
          </div>
        </div>
      </footer>
    </div>
  );
}
