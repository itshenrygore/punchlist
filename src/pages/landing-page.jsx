import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';
import Logo from '../components/logo';

/* ═══════════════════════════════════════════════════════════════
 Punchlist Landing Page v2 — Precision Polish
 Fonts: Clash Display (headlines) + Inter (body)
 Zero CLS · Smooth sequencing · Premium micro-interactions
 ═══════════════════════════════════════════════════════════════ */

/* dynamically import lucide-react icons we need */
import { ChevronDown, Eye, Bell, CheckCircle, DollarSign, Send, Zap, ArrowRight, Menu, X, Star, TrendingUp, MessageSquare } from 'lucide-react';

function useReveal(t = 0.15) {
 const ref = useRef(null);
 const [vis, setVis] = useState(false);
 useEffect(() => {
 const el = ref.current; if (!el) return;
 const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: t });
 obs.observe(el); return () => obs.disconnect();
 }, [t]);
 return [ref, vis];
}

function useCountUp(to, active, dur = 1200) {
 const [v, setV] = useState(0);
 useEffect(() => {
 if (!active) { setV(0); return; }
 const s = performance.now();
 function tick(n) { const p = Math.min((n - s) / dur, 1); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); }
 requestAnimationFrame(tick);
 }, [active, to, dur]);
 return v;
}

function Rv({ children, className = '', delay = 0, style = {} }) {
 const [ref, vis] = useReveal();
 return <div ref={ref} className={`rv ${vis ? 'vis' : ''} ${className}`} style={{ transitionDelay: `${delay}ms`, ...style }}>{children}</div>;
}

/* ═══ NAV ═══ */
function LpNav() {
 const [sc, setSc] = useState(false);
 const [op, setOp] = useState(false);
 useEffect(() => { const fn = () => setSc(window.scrollY > 30); window.addEventListener('scroll', fn, { passive: true }); return () => window.removeEventListener('scroll', fn); }, []);
 return (
 <header className={`lp-nav ${sc ? 'lp-nav--scrolled' : ''}`}>
 <div className="lp-nav-inner">
 <Link to="/" className="lp-brand" aria-label="Punchlist home">
 <Logo size="sm" dark={true} />
 </Link>
 <nav className="lp-desk-nav">
 <a href="#how" className="lp-nav-link">How it works</a>
 <a href="#pricing" className="lp-nav-link">Pricing</a>
 <a href="#faq" className="lp-nav-link">FAQ</a>
 <div className="lp-nav-divider" />
 <Link to="/login" className="lp-nav-link lp-nav-link--strong">Log in</Link>
 <Link to="/signup" className="btn-glow lp-nav-cta">Try free</Link>
 </nav>
 <button type="button" className="lp-mob-btn" onClick={() => setOp(!op)}>{op ? <X size={22} /> : <Menu size={22} />}</button>
 </div>
 {op && (
 <div className="lp-mob-dropdown">
 {[['How it works','#how'],['Pricing','#pricing'],['FAQ','#faq']].map(([l,h]) => <a key={l} href={h} onClick={() => setOp(false)} className="lp-mob-link">{l}</a>)}
 <Link to="/login" onClick={() => setOp(false)} className="lp-mob-link">Log in</Link>
 <Link to="/signup" className="lp-mob-cta" onClick={() => setOp(false)}>Send your first quote free</Link>
 </div>
 )}
 </header>
 );
}

/* ═══ HERO ═══ */
function LpHero() {
 const [ok, setOk] = useState(false);
 useEffect(() => { const t = setTimeout(() => setOk(true), 300); return () => clearTimeout(t); }, []);
 return (
 <section className="lp-hero">
 <div className="lp-container">
 <div className="lp-hero-grid">
 <div className="lp-hero-copy">
 <div className="lp-eyebrow-pill"><div className="lp-pulse-dot" /><span>Quote-to-close for contractors</span></div>
 <h1 className="lp-h1">Send quotes<br />that actually <span className="lp-accent-text">close.</span></h1>
 <p className="lp-hero-sub">Professional quotes in minutes — with monthly payment options that remove sticker shock. Track every view. Follow up at the right moment. Get paid in full.</p>
 <div className="lp-hero-ctas">
 <Link to="/signup" className="btn-glow lp-btn-primary">Send your first quote free <ArrowRight size={17} /></Link>
 <a href="#how" className="btn-ghost lp-btn-secondary">See how it works</a>
 </div>
 <div className="lp-hero-proof">
 {['Free forever plan', 'No credit card', 'Works from your phone'].map(t => <span key={t} className="lp-proof-item"><CheckCircle size={13} className="lp-green-icon" /> {t}</span>)}
 </div>
 </div>
 <div className="lp-hero-visual">
 <HeroScene active={ok} />
 </div>
 </div>
 </div>
 </section>
 );
}

/* ═══ HERO SCENE ═══ */
const JOBS = [
 { title:'Hot Water Tank Replacement', trade:'Plumbing', items:[{n:'Tank removal + disposal',p:280},{n:'50-gal Bradford White install',p:2450},{n:'Venting + gas line',p:890},{n:'Permit + inspection',p:250}], total:4847, mo:404 },
 { title:'200A Panel Upgrade', trade:'Electrical', items:[{n:'200A panel + breakers',p:1850},{n:'Service entrance rewire',p:1400},{n:'Grounding + bonding',p:750},{n:'Permit + inspection',p:350}], total:4350, mo:363 },
 { title:'Furnace Replacement', trade:'HVAC', items:[{n:'High-efficiency gas furnace',p:2800},{n:'Installation labour',p:1650},{n:'Venting + gas line',p:480},{n:'Old unit disposal',p:270}], total:5200, mo:434 },
];

function HeroScene({ active }) {
 const [idx, setIdx] = useState(0);
 const [ph, setPh] = useState('show');
 const job = JOBS[idx];
 const total = useCountUp(job.total, active && ph === 'show', 800);
 const mo = useCountUp(job.mo, active && ph === 'show', 800);
 useEffect(() => {
 if (!active) return;
 const iv = setInterval(() => { setPh('out'); setTimeout(() => { setIdx(i => (i+1)%JOBS.length); setPh('in'); }, 350); setTimeout(() => setPh('show'), 450); }, 5000);
 return () => clearInterval(iv);
 }, [active]);
 return (
 <div className="lp-scene-wrap">
 <div className="lp-hero-chips"><Chip icon={<Eye size={12}/>} text="Lisa viewed your quote" color="var(--lp-blue)" show={active} delay="0.6s"/></div>
 <div className="lp-hero-chips"><Chip icon={<CheckCircle size={12}/>} text="Approved + signed" color="var(--lp-green)" show={active} delay="1.8s"/></div>
 <div className="lp-hero-chips"><Chip icon={<DollarSign size={12}/>} text="Paid in full" color="var(--lp-accent)" show={active} delay="3s"/></div>
 <div className="card-lift lp-quote-card">
 <div className="lp-chrome"><div className="lp-chrome-dots"><div/><div/><div/></div><div className="lp-chrome-url">punchlist.ca/quote</div></div>
 <div className="lp-quote-content">
 <div className="lp-quote-header"><span className="lp-meta">Mike's {job.trade} · Calgary, AB</span><span className="lp-trade-badge">{job.trade}</span></div>
 <h3 className="lp-quote-title">{job.title}</h3>
 <div className="lp-line-items">
 {job.items.map((item, i) => (
 <div key={i} className="lp-line-item">
 <span className="lp-line-name">{item.n}</span>
 <span className="lp-line-price">${item.p.toLocaleString()}</span>
 </div>
 ))}
 </div>
 <div className="lp-price-row">
 <div className="lp-price-cell"><div className="lp-price-label">Total</div><div className="lp-price-value">${total.toLocaleString()}</div></div>
 <div className="lp-price-cell lp-price-cell--right"><div className="lp-price-label">Or as low as</div><div className="lp-price-value lp-accent-text">${mo}<span className="lp-price-suffix">/mo</span></div></div>
 </div>
 <div className="lp-approve-btn">Approve & Sign →</div>
 <div className="lp-trust-row">{['No payment now','Price locked'].map(t => <span key={t} className="lp-trust-chip"><CheckCircle size={10} className="lp-green-icon"/> {t}</span>)}</div>
 </div>
 <div className="lp-dots">{JOBS.map((_,i) => <div key={i} className={`lp-dot ${i===idx?'lp-dot--active':''}`}/>)}</div>
 </div>
 </div>
 );
}

function Chip({ icon, text, color, show, delay='0s' }) {
 return (
 <div className="lp-chip">
 <div className="lp-chip-icon">{icon}</div>
 <span>{text}</span>
 </div>
 );
}

/* ═══ STATS ═══ */
function LpStats() {
 const [ref,vis] = useReveal(0.3);
 const a=useCountUp(2847,vis,1400), b=useCountUp(418,vis,1200), c=useCountUp(68,vis,1000);
 return (
 <div ref={ref} className="lp-stats-bar">
 <div className="lp-stats-inner">
 {[{v:a.toLocaleString(),l:'quotes sent'},{v:`$${b}K`,l:'closed this month'},{v:`${c}%`,l:'approval rate'}].map((s,i) => (
 <div key={i} className="lp-stat"><div className="lp-stat-num">{s.v}</div><div className="lp-stat-label">{s.l}</div></div>
 ))}
 </div>
 </div>
 );
}

/* ═══ OUTCOMES ═══ */
function LpOutcomes() {
 return (
 <section className="lp-section">
 <div className="lp-container">
 <Rv><div className="lp-section-head"><span className="lp-eyebrow">The outcome</span><h2 className="lp-h2">Three things that<br/>change your business.</h2></div></Rv>
 <div className="lp-outcomes-grid">
 <Rv delay={0}><OC num="01" title="Close more jobs" desc="Show $500/mo next to $6,000. Customers stop hesitating and start approving." visual={<CloseV/>} accent="var(--lp-accent)"/></Rv>
 <Rv delay={100}><OC num="02" title="Track every quote" desc="Know the second they open it. See when they come back. Follow up at the right moment." visual={<TrackV/>} accent="var(--lp-blue)"/></Rv>
 <Rv delay={200}><OC num="03" title="Get paid in full" desc="Customer picks monthly. You get the full amount deposited. Zero risk on your end." visual={<PaidV/>} accent="var(--lp-green)"/></Rv>
 </div>
 </div>
 </section>
 );
}
function OC({ num, title, desc, visual, accent }) {
 return (
 <div className="card-lift lp-outcome-card">
 <span className="lp-outcome-num">{num}</span>
 <h3 className="lp-outcome-title">{title}</h3>
 <p className="lp-outcome-desc">{desc}</p>
 <div className="lp-outcome-visual">{visual}</div>
 </div>
 );
}lp-pc-amount lp-s18-0a7aoseV() {
 return (
 <div className="lp-close-visual">
 <div className="lplp-pc-react lp-s14-622cold"><div className="lp-pc-label">Full price</div><div className="lp-pc-amount">$6,000</div><div className="lp-pc-react">lp-pc-label lp-s16-2804nk about it"</div></div>
 <ArrowRight size={14} className="lp-s17-0586"/>
 <div className="lplp-pc-react lp-s9-4fb8new"><div className="lp-pc-label">Monthly</div><div className="lp-pc-amount lp-accent-text">$500/mo</div><div className="lp-pc-react">"When can you start?"</div></div>
 </div>
 );
}
function TrackV() {
 return <div>{[{d:'var(--lp-blue)',t:'Lisa viewed quote',tm:'2m ago'},{d:'var(--lp-purple)',t:'Viewed (3rd time)',tm:'1h ago'},{d:'var(--lp-accent)',t:'Follow-up sent',tm:'3h ago'}].map((e,i) => (
 <div key={i} className="lp-track-ev">
 <div className="lp-track-dot" style={{background:e.d}}/><span className="lp-track-text">{e.t}</span><span className="lp-track-time">{e.tm}</span>
 </div>
 ))}</div>;
}
function PaidV() {
 return (<div className="lp-ta-center-99ae"><div className="lp-paid-badge"><CheckCircle size={15} className="lp-green-icon"/><span>$4,847 deposited</span></div><div className="lp-paid-sub">Customer pays monthly · You get paid now</div></div>);
}

/* ═══ STICKER SHOCK ═══ */
function LpStickerShock() {
 const [ref,vis] = useReveal(0.2);
 const [flipped,setFlipped] = useState(false);
 useEffect(() => { if (!vis) return; const iv = setInterval(() => setFlipped(f => !f), 3000); return () => clearInterval(iv); }, [vis]);
 return (
 <section ref={ref} className="lp-lp-h2 lp-s6-e8e5on lp-section--warm">
 <div className="lp-container lp-shock-wrap">
 <Rv>
 <span className="lp-eyebrow">The real problem</span>
 <h2 className="lp-h2">The quotes you lose<br/>aren't bad quotes.</h2>
 <p className="lp-shock-sub">They're good quotes with big numbers — and no way to soften the sticker shock.</p>
 </Rv>
 <Rv delay={150}>
 <div className="lp-shock-container">
 <div className="lp-shock-amount" style={{opacity:flipped?0:1,transform:flipped?'scale(0.96) translateY(-6px)':'scale(1)',filter:flipped?'blur(3px)':'blur(0)'}}>
 <div className=">$6,000</div>
 <div className="lp-shock-label">Customer sees the total</div>
 <div className="lp-shock-reaction">"I need to think about it."</div>
 </div>
 <div className="lp-shock-card lp-shock-card--accent">
 <divlp-shock-reaction lp-s9-4fb8ock-amount lp-accent-text">~$500/mo</div>
 <div className="lp-shock-label">Same job, monthly option</div>
 <div className="lp-shock-reaction">"When can you start?"</div>
 </div>
 </div>
 </Rv>
 <Rv delay={300}>
 <div className="lp-shock-metrics">
 <div><div className="lp-shock-metric-num">+14%</div><div className="lp-shock-metric-label">more revenue with<br/>monthly options</div></div>
 <div><div className="lp-shock-metric-num">+20%</div><div className="lp-shock-metric-label">more spent per job<br/>with split payments</div></div>
 </div>
 </Rv>
 </div>
 </section>
 );
}

/* ═══ HOW IT Wlp-container lp-s13-5537function LpHowItWorks() {
 return (
 <section id="how" className="lp-section lp-section--dark">
 <div className="lp-glow-orb"/>
 <div classNalp-h2 lp-s12-c3c9p-container" >
 <Rv><div className="lp-section-head"><span className="lp-eyebrow">How it works</span><h2 className="lp-h2">You know the job.<br/>We handle the quote.</h2></div></Rv>
 <div className="lp-how-steps">
 {[{n:'01',t:'Describe the job',d:'Type it, speak it, or snap a photo. Punchlist builds a line-item scope from 1,000+ trade catalog items.',icon:<MessageSquare size={22}/>},{n:'02',t:'Send the quote',d:'One tap texts a professional link. Customer sees the total and a monthly option. Approves and e-signs from their phone.',icon:<Send size={22}/>},{n:'03',t:'Close the job',d:'Track views in real time. Get follow-up prompts. Customer approves — you get paid in full.',icon:<CheckCircle size={22}/>}].map((s,i) => (
 <Rv key={i} delay={i*120}>
 <div className="lp-how-step">
 <div className="lp-how-icon">{s.icon}</div>
 <div><span className="lp-how-num">Step {s.n}</span><h3 className="lp-how-title">{s.t}</h3><p className="lp-how-desc">{s.d}</p></div>
 </div>
 </Rv>
 ))}
 </div>
 </div>
 </section>
 );
}

/* ═══ FOREMAN ═══ */
function LpForeman() {
 return (
 <section className="lp-section">
 <div className="lp-container lp-foreman-grid">
 <Rv>
 <div className="card-lift lp-foreman-card">
 <div className="lp-foreman-badge"><Zap size={12}/> Foreman AI</div>
 {[{icon:<Bell size={14} className="lp-s11-8250"/>,bg:'var(--lp-accent-light)',t:'You may be missing venting',sub:'93% of similar jobs include this'},{icon:<TrendingUp size={14} className="lp-s10-f17c"/>,bg:'rgba(53,115,226,0.08)',t:'Typical range: $4,200 – $5,400',sub:'Based on Alberta pricing data'},{icon:<CheckCircle size={14} className="lp-s9-4fb8"/>,bg:'var(--lp-green-light)',t:'Add: Permit + inspection — $250',sub:'Required for gas appliance work'}].map((item,i) => (
 <div key={i} className="lp-foreman-item">
 <div className="lp-foreman-item-icon">{item.icon}</div>
 <div className="lp-s8-30f9"><div className="lp-foreman-item-title">{item.t}</div><div className="lp-foremalp-eyebrow lp-s7-8801">{item.sub}</div></div>
 </div>
 ))}
 </div>
 lp-h2 lp-s6-e8e5/Rv>
 <Rv delay={80}>
 <div>
 <span className="lp-eyebrow">Intelligence layer</span>
 <h2 className="lp-h2">Foreman catches what<br/>you might miss.</h2>
 <p className="lp-foreman-desc">Every quote gets checked against trade data. Missing items, underpricing, forgotten permits — flagged before the customer sees it.</p>
 {['Suggests scope from 1,000+ item catalog','Flags underpricing from regional data','Catches commonly forgotten items'].map(t => (
 <div key={t} className="lp-check-item"><CheckCircle size={15} className="lp-green-icon"/> {t}</div>
 ))}
 </div>
 </Rv>
 </div>
 </section>
 );
}

/* ═══ TESTIMONIALS ═══ */
function LpTestimonials() {
 const d = [
 {text:'Customer sat on a $4,800 quote for three weeks. Resent it through Punchlist with the monthly option. She approved that night.',name:'Mike R.',role:'Electrician · Edmonton, AB',init:'MR'},
 {text:"Used to take me half the drive home to write up a quote. Now I describe the job on-site and text it before I'm back in the truck.",name:'Dave K.',role:'Plumber · Calgary, AB',init:'DK'},
 {text:'Seeing when they open it changed everything. I follow up within the hour now instead of waiting a week and hoping.',name:'Sam R.',role:'HVAC · Mississauga, ON',init:'SR'},
 ];
 return (
 <section className="lp-section lp-section--warm">
 <div className="lp-container">
 <Rv><div className="lp-section-head"><span className="lp-eyebrow">From the field</span><h2 className="lp-h2">Real contractors. Real results.</h2></div></Rv>
 <div className="lp-testimonials-grid">
 {d.map((t,i) => (
 <Rv key={i} delay={i*80}>
 <div className="card-lift lp-testimonial">
 <div className="lp-stars">{[...Array(5)].map((_,j) => <Star key={j} size={13} fill="var(--lp-accent)" color="var(--lp-accent)"/>)}</div>
 <p className="lp-testimonial-text">"{t.text}"</p>
 <div className="lp-testimonial-author"><div className="lp-testimonial-avatar">{t.init}</div><div><div className="lp-testimonial-name">{t.name}</div><div className="lp-testimonial-role">{t.role}</div></div></div>
 </div>
 </Rv>
 ))}
 </div>
 </div>
 </section>
 lp-container lp-s5-0c1f PRICING ═══ */
function LpPricing() {
 const [yr,setYr] = useState(true);
 return (
 <section id="pricing" classNamlp-h2 lp-s4-f682-section">
 <div className="lp-container">
 <Rv><div className="lp-section-head"><span className="lp-eyebrow">Pricing</span><h2 className="lp-h2">One extra closed job<br/>pays for the year.</h2><p className="lp-pricing-sub">Start free, upgrade when it's working.</p></div></Rv>
 <Rv delay={50}>
 <div className="lp-billing-toggle-wrap">
 <div className="lp-billing-toggle">
 {[{k:false,l:'Monthly'},{k:true,l:'Yearly',b:'Save $99'}].map(b => (
 <button type="button" key={String(b.k)} onClick={() => setYr(b.k)} className={`lp-billing-btn ${yr===b.k?'lp-billing-btn--on':''}`}>{b.l}{b.b && <span className="lp-save-badge">{b.b}</span>}</button>
 ))}
 </div>
 </div>
 </Rv>
 <div className="lp-pricing-grid">
 <Rv delay={100}>
 <div className="lp-price-card">
 <div className="lp-price-plan">Free</div><div className="lp-price-tagline">See if Punchlist works for you.</div>
 <div className="lp-price-amount"><span className="lp-price-big">$0</span><span className="lp-price-per">forever</span></div>
 {['Professional quote link + e-sign','1,000+ item trade catalog','AI scope builder (Foreman)','Quote tracking','Up to 5 quotes/month','No credit card'].map(f => <div key={f} className="lp-feature-row"><CheckCircle size={15} className="lp-green-icon"/> {f}</div>)}
 <Link to="/signup" className="btn-ghost lp-price-cta-free">Start free →</Link>
 </div>
 </Rv>
 <Rv delay={180}>
 <div className="lp-price-card lp-price-card--pro">
 <div className="lp-pro-badge">Most popular</div>
 <div className="lp-price-plan lp-accent-text">Pro</div><div className="lp-price-tagline">Close every job.</div>
 <div className="lp-price-amount"><span className="lp-price-big">{yr?'$249':'$29'}</span><span className="lp-price-per">{yr?'/yr':'/mo'}</span></div>
 <div className="lp-price-equiv">{yr?'$20.75/mo — less than one hour of your time':'\u00A0'}</div>
 {['Everything in Free','Unlimited quotes','Customer financing (paid in full)','Real-time tracking + notifications','Follow-up prompts','Deposit collection via Stripe','Invoicing + scheduling'].map(f => <div key={f} className="lp-feature-row"><CheckCircle size={15} className="lp-s3-f6aa"/> {f}</div>)}
 <Link to="/signup" className="btn-glow lp-price-cta-pro">Start with Pro →</Link>
 <div className="lp-price-micro">Cancel anytime · No contracts · All prices in CAD</div>
 </div>
 </Rv>
 </div>
 </div>
 </section>
 );
}

/* ═══ FAQ ═══ */
function LpFaq() {
 const [op,setOp] = useState(null);
 const items = [
 ['What trades does this work for?','Plumbing, electrical, HVAC, roofing, general contracting, painting, carpentry — any trade that sends quotes. The catalog covers 1,000+ items, and you can add custom items for anything else.'],
 ['How does the monthly payment option work?','Quotes over $500 show a monthly option. If the customer chooses it, Klarna or Affirm handles it through Stripe. You get the full amount deposited upfront — zero risk on your end.'],
 ['Can I use my own prices?','Yes. Punchlist suggests from trade data, but you control every number. Nothing reaches the customer without your approval.'],
 ['Do I need a Stripe account?','For deposits and financing payouts, yes — setup takes about 5 minutes. Without Stripe, customers can still approve quotes.'],
 ['What happens at 5 quotes on Free?','Existing quotes keep working. You can\'t create new ones until next month, or upgrade to Pro for unlimited.'],
 ['Is my data secure?','Stored on Supabase with row-lelp-container lp-s2-a75c. All connections encrypted. We never share your data.'],
 ];
 return (
 <section id="faq" className="lp-section lp-section--warm">
 <div className="lp-container">
 <Rv><div className="lp-section-head"><h2 className="lp-h2">Questions contractors ask.</h2></div></Rv>
 <div className="lp-faq-list">
 {items.map(([q,a],i) => (
 <Rv key={i} delay={i*40}>
 <div className={`lp-faq-item ${op===i?'lp-faq-item--open':''}`}>
 <button type="button" onClick={() => setOp(op===i?null:i)} className="lp-faq-q"><span>{q}</span><ChevronDown size={16} className="lp-faq-chevron" style={{transform:op===i?'rotate(180deg)':'rotate(0)'}}/></button>
 <div className="lp-faq-a"><div className="lp-faq-a-inner">{a}</div></div>
 </div>
 </Rv>
 ))}lp-glow-orb lp-s1-f3c8div>
 </div>
 </section>
 );
}

/* ═══ FINAL CTA ═══ */
function LpFinlp-container lp-ta-center-430creturn (
 <section className="lp-final-cta">
 <div className="lp-glow-orb" />
 <div className="lp-container">
 <Rv>
 <h2 className="lp-final-h2">Your next quote<br/>should work harder.</h2>
 <p className="lp-final-sub">Build it in minutes. Know when they open it. Lebtn-glow lp-btn-primary lp-fs-lg-2e14se the job — and get paid in full.</p>
 <div className="lp-final-btns">
 <Link to="/signup" className="btn-glow lp-btn-primary">Send your first quote free <ArrowRight size={17}/></Link>
 <a href="#how" className="lp-btn-ghost-dark">See how it works</a>
 </div>
 <div className="lp-final-proof">{['Free plan','No credit card','Works from your phone','Built in Canada 🍁'].map(t => <span key={t}>{t}</span>)}</div>
 </Rv>
 </div>
 </section>
 );
}

/* ═══ FOOTER ═══ */
function LpFooter() {
 return (
 <footer className="lp-footer">
 <div className="lp-container lp-footer-inner">
 <div>
 <div className="lp-s0-b5d4"><Logo size="sm" dark={true} /></div>
 <div className="lp-fs-xs-384f">Quote it. Track it. Close it.</div>
 </div>
 <div className="lp-footer-links"><a href="#how">How it works</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a><Link to="/login">Log in</Link><Link to="/signup">Try free</Link><Link to="/terms">Terms</Link><a href="mailto:hello@punchlist.ca">Contact</a></div>
 <div className="lp-footer-copy">© 2026 Punchlist · punchlist.ca · Built in Canada 🍁</div>
 </div>
 </footer>
 );
}

/* ═══ PAGE ═══ */
export default function LandingPage() {
 return (
 <div className="lp">
 <LpNav />
 <LpHero />
 <LpStats />
 <LpOutcomes />
 <LpStickerShock />
 <LpHowItWorks />
 <LpForeman />
 <LpTestimonials />
 <LpPricing />
 <LpFaq />
 <LpFinalCTA />
 <LpFooter />
 </div>
 );
}
