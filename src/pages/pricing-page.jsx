import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Bell, DollarSign, Calendar, Send, Receipt } from 'lucide-react';
import Header from '../components/header';
import { createCheckout } from '../lib/api';
import { PLANS, FEATURE_COMPARISON, FAQ, PRICING } from '../lib/billing';

function CheckIcon() {
 return <span className="pp-inline-flex-421d"><svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'><polyline points='20 6 9 17 4 12'/></svg></span>;
}
function XIcon() {
 return <span className="pp-fs-sm-5e57">—</span>;
}

function FAQItem({ q, a }) {
 const [open, setOpen] = useState(false);
 return (
 <div className="pp-s17-8dcd">
 <button type="button" onClick={() => setOpen(!open)} className="pp-flex_ta-left_fs-base-f17c">
 <span>{q}</span>
 <span style={{ color: 'var(--muted)', fontSize: 'var(--text-xl)', flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
 </button>
 {open && (
 <p className="pp-fs-sm-bc24">{a}</p>
 )}
 </div>
 );
}

export default function PricingPage() {
 const [checkingOut, setCheckingOut] = useState(false);

 async function handleCheckout(priceKey) {
 setCheckingOut(true);
 try { await createCheckout(priceKey); }
 catch { setCheckingOut(false); }
 }

 const free = PLANS.free;
 const pro = PLANS.pro_monthly;
 const annual = PLANS.pro_annual;

 return (
 <div className="site-wrap">
 <Header />

 {/eyebrow pp-s16-9eabRO ── */}
 <section className="pp-ta-center-506e">
 <div className="pp-s8-7d60">
 <div className="eyebrow">Pricing</div>
 <h1 className="pp-s15-ad09">
 Simple pricing.<br />Pays for itself on one&nbsp;job.
 </h1>
 <p className="muted">
 Start free. No credit card. Upgrade when Punchlist is making you money.
 notice-banner pp-ta-center_fs-base-0649 </div>
 </section>

 {/* ── ROI STRIP ── */}
 <section className="pp-ta-center-cddf">
 <div className="notice-banner">
 <strong>One missed line item</strong> on one job costs more than 8 months of Pro. Most contractors mpricing-cards-grid pp-grid-b052job.
 </div>
 </section>

 {/* ── PRICING CARDS ── */}
 <section className="pp-s4-070f">
 <div className="pricing-cards-grid">

 {/* FREE */}
 <div className="panel">
 <div className="pp-s11-7a5f">
 <div className="pp-fs-sm-c154">{free.name}</div>
 <div className="pp-flex-1391">
 <span className="pp-s10-f341">$0</span>
 </div>
 <div className="pp-fs-xs-2c9d">No credit card, no time limit</div>
 </div>
 <div className="pp-grid-4838">
 {free.features.map(f => (
 <div key={f} className="pp-flex_fs-sm-8ad3"n btn-secondary full-width pp-fs-sm-46d4Icon /><span>{f}</span>
 </div>
 ))}
 </div>
 <Link className="btn btn-secondary full-width">
 Build your first quote →
 </Link>
 </div>

 {/* PRO — visually dominant */}
 <div className="panel">
 <div className="pp-fs-2xs-7e44">Most Popular</div>
 <div className="pp-s11-7a5f">
 <div className="pp-fs-sm-ca34">Pro</div>
 <div className="pp-flex-1391">
 <span className="pp-s10-f341">${PRICING.monthly}</span>
 <span className="pp-fs-base-9286">/mo</span>
 </div>
 <div className="pp-fs-xs-2c9d">Full platform. No limits.</div>
 </div>
 <div className="pp-grid-4838">
 {pro.features.map(f => (
 <div key={f} className="pp-flex_fs-sm-8ad3"ry full-width pp-fs-base-d0cc <CheckIcon /><span>{f}</span>
 </div>
 ))}
 </div>
 <button className="btn btn-primary full-width" type="buttonmuted pp-ta-center_fs-2xs-47e1abled={checkingOut} onClick={() => handleCheckout('monthly')}>
 {checkingOut ? 'Loading…' : 'Upgrade to Pro'}
 </button>
 <div classpanel pp-s12-8273"muted" >Cancel anytime</div>
 </div>

 {/* ANNUAL */}
 <div className="panel">
 <div className="pp-fs-2xs-6fac">Save ${PRICING.annualSavings}</div>
 <div className="pp-s11-7a5f">
 <div className="pp-fs-sm-67b6">Annual</div>
 <div className="pp-flex-1391">
 <span className="pp-s10-f341">${PRICING.annual}</span>
 <span className="pp-fs-base-9286">/yr</span>
 </div>
 <div className="pp-fs-xs-2c9d">${PRICING.annualMonthly}/mo · save ${PRICING.annualSavings} vs monthly</div>
 </div>
 <div className="pp-grid-4838">
 {annual.features.map(f => (
 <div key={f} className="pp-flex_fs-sm-8ad3"ry full-width pp-fs-base-4068 <CheckIcon /><span>{f}</span>
 </div>
 ))}
 </div>
 <button className="btn btn-primary full-width" type="bmuted pp-ta-center_fs-2xs-47e1" disabled={checkingOut} onClick={() => handleCheckout('yearly')}>
 {checkingOut ? 'Loading…' : 'Get Annual'}
 </button>
 <div className="muted">Best value · cancel anytime</div>
 </div>
 </div>
 </section>

 {/* ── WHEN YOU'LL WANT PRO ── */}
 <section className="pp-s9-5414">
 <div className="pp-s8-7d60"muted pp-ta-center_fs-base-71ad <h2 className="pp-ta-center-9e25">When you'll want Pro</h2>
 <p className="muted">Upgrade makes sense when Punchlist becomes part of how you run jobs</p>
 <div className="pp-grid-422e">
 {[
 { icon: 'send', text: "You're sending more than 5 quotes per month and need unlimited" },
 { icon: 'eye', text: 'Track every view — see the moment customers open your quote' },
 { icon: 'bell', text: 'Follow-up prompts so quotes don\'t go cold' },
 { icon: 'dollar', text: 'Collect deposits upfront before you start work' },
 { icon: 'calendar', text: 'Schedule jobs from the same app you quoted in' },
 { icon: 'receipt', text: 'Invoice customers and collect payment online — they can pay monthly' },
 ].map(({ icon, text }) => (
 <div key={text} className="pp-flex-bb0f">
 <span className="pp-inline-flex-6bb4">
 {icon === 'eye' && <Eye size={18} strokeWidth={1.75} />}
 {icon === 'bell' && <Bell size={18} strokeWidth={1.75} />}
 {icon === 'dollar' && <DollarSign size={18} strokeWidth={1.75} />}
 {icon === 'calendar' && <Calendar size={18} strokeWidth={1.75} />}
 {icon === 'send' && <Send size={18} strokeWidth={1.75} />}
 {icon === 'receipt' && <Receipt size={18} strokeWidth={1.75} />}
 </span>
 <span className="pp-fs-sm-760e">{text}</span>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* ── FEATURE COMPARISON ── */}
 <section className="pp-s4-070f">
 <div className="pp-s3-980b"panel pp-s7-7bc0 <h2 className="pp-ta-center-47ae">What's included</h2>
 <div className="panel">
 <table className="pp-fs-sm-2246">
 <thead>
 <tr className="pp-s6-af88">
 <th className="pp-ta-left_fs-xs-0ec6">Feature</th>
 <th className="pp-ta-center_fs-xs-ee2e">Free</th>
 <th className="pp-ta-center_fs-xs-b2b6">Pro</th>
 </tr>
 </thead>
 <tbody>
 {FEATURE_COMPARISON.map(({ feature, free: freeVal, pro: proVal }) => (
 <tr key={feature} className="pp-s6-af88">
 <td className="pp-s5-e3b3">{feature}</td>
 <td className="pp-ta-center-b904">
 {typeof freeVal === 'string' ? <span className="pp-fs-xs-ec86">{freeVal}</span> : freeVal ? <CheckIcon /> : <XIcon />}
 </td>
 <td className="pp-ta-center-b904">
 {typeof proVal === 'string' ? <span className="pp-fs-xs-fce1">{proVal}</span> : proVal ? <CheckIcon /> : <XIcon />}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </section>

 {/* ── FAQ ── */}
 <section className="pp-s4-070f">
 <div className="pp-s3-980b">
 <h2 className="pp-ta-center-47ae">Questions</h2>
 {FAQ.map(({ q, a }) => <FAQItem key={q} q={q} a={a} />)}
 </div>
 </section>

 {/* ── FINAL CTA ── */}
 <section className="pp-ta-center-b3a7">
 <p className="pp-fs-xs-758b">All prices in Canadian dollars (CAD).</p>
 <div className="pp-s2-f47e"ed pp-fs-base-3a8e <h2 className="pp-s1-1b17">You have a job to quote this&nbsp;week.</h2>
 <p className="muted">Try Punchlist on that one job. Free, no credit card, takes two minutes.</p>
 <Link className="btn btn-primary" to="/signup" >
 Try Punchlist free →
 </Link>
 <p className="pp-fs-xs-6bbe">
 Already have an account? <Link to="/login" className="pp-s0-bad0">Log in</Link>
 </p>
 </div>
 </section>
 </div>
 );
}
