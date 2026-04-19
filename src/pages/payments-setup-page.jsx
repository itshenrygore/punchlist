import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/app-shell';

const FAQ = [
 {
 q: 'Do I get paid in full even if the customer pays monthly?',
 a: 'Yes. When a customer chooses monthly payments, Affirm pays you the full amount within 2 business days. The customer repays Affirm over 3–12 months. You don\'t wait for installments — you get the full job value upfront.',
 },
 {
 q: 'How do I set this up?',
 a: 'Go to Settings → Payments and tap "Turn on customer financing." Stripe walks you through entering your business details and bank account — takes about 10 minutes. Once connected, your quotes and invoices automatically show a Pay Now button with monthly options.',
 },
 {
 q: 'What does it cost me?',
 a: 'A small processing fee (around 2.5%) is deducted from each payment. There\'s no monthly fee, no setup fee, and no minimum. You only pay when you get paid.',
 },
 {
 q: 'How much can customers finance?',
 a: 'Customers can finance jobs from about $50 up to $20,000, with repayment over 3 to 12 months depending on the amount and the customer\'s approval. Jobs under $50 show card-only checkout.',
 },
 {
 q: 'What if the customer doesn\'t qualify for monthly?',
 a: 'They can always pay the full amount by credit or debit card. Monthly payment options appear automatically on larger jobs — if the customer doesn\'t qualify, they just see the card option. No extra work for you.',
 },
 {
 q: 'Can I still accept e-transfer, cash, or cheque?',
 a: 'Yes. Punchlist Payments is in addition to however you already collect. Customers who want to pay by e-transfer or cheque can still do that — you just won\'t see it tracked inside Punchlist.',
 },
 {
 q: 'What about refunds?',
 a: 'You can process refunds through your Stripe dashboard. If a customer disputes a charge, Stripe handles the process and notifies you.',
 },
 {
 q: 'Does this work in Canada and the US?',
 a: 'Yes. Payments work in both countries. The currency is set automatically based on your profile — CAD for Canada, USD for the US.',
 },
 {
 q: 'What if I don\'t want to set this up?',
 a: 'No problem. Punchlist Payments is optional. Your quotes and invoices still work — customers just won\'t see a Pay Now button. You can always connect later.',
 },
];

export default function PaymentsSetupPage() {
 const [expandedFaq, setExpandedFaq] = useState(null);

 return (
 <AppShell title="Punchlist Payments">
 <div className="psp-s7-6923">

 {/* Header */}
 <div className="psp-s2-1d3c">
 <Link to="/app/settings" className="psp-inline-flex_fs-sm-0bb7">
 ← Back to Settings
 </Link>
 <h1 className="psp-s6-dd66">
 Punchlist Payments
 </h1>
 <p className="psp-fs-base-1cc3">
 Accept card payments and give your customers the option to pay panel psp-s5-33abtime on bigger jobs. You get paid the full amount up front — no waiting on installments.
 </p>eyebrow psp-s4-f682 </div>

 {/* How it works */}
 <div className="panel">
 <div className="eyebrow">How it works</div>
 <div className="psp-grid-4b24">
 <div className="psp-flex-64c8">
 <div className="psp-flex_fs-base-ba4f">1</div>
 <div><strong className="psp-fs-base-a3b5">You connect your account</strong><p className="muted small">One-time setup in Settings. Takes about 10 minutes — Stripe handles the details.</p></div>
 </div>
 <div className="psp-flex-64c8">
 <div className="psp-flex_fs-base-ba4f">2</div>
 <div><strong className="psp-fs-base-a3b5">Your customer sees a Pay Now button</strong><p className="muted small">On every quote and invoice. They can pay by card or choose monthly payments on larger jobs.</p></div>
 </div>
 <div className="psp-flex-64c8">
 <div className="psp-flex_fs-base-ba4f">3</div>
 <div><strong className="psp-fs-base-a3b5">You get paid in full</strong><p className="muted small">The full amount goes to your bank within 2 business days — even if the customer chose monthly payments.</p></div>
 </div>
 </div>
 </div>

 {/* Key benefits */}
 <div className="psp-s2-1d3c">
 <h2 className="psp-fs-xl-211b">Why set this up</h2>
 <div className="psp-grid-5127">
 {[
 { icon: 'dollar', title: 'Get paid faster', desc: 'Customer pays right from the quote — no chasing e-transfers or waiting for cheques.' },
 { icon: 'mobile', title: 'Bigger jobs get approved', desc: 'When customers can pay monthly, a $6,000 job becomes $250/mo. Easier to say yes.' },
 { icon: '✅', title: 'You always get the full amount', desc: 'Regardless of how the customer pays, the full quote total is deposited to your account.' },
 { icon: 'lock', title: 'Deposits before you start', desc: 'Require a deposit panel psp-flex-0995the customer approves. Money in your account before the job begins.' },
 ].map(({ icon, title, desc }) => (
 <div key={title} className="panel">
 <span className="psp-fs-2xl-0482">{icon}</span>
 <div>
 <strong className="psp-block_fs-sm-3f6b">{title}</strong>
 <span className="psp-fs-xs-80c9">{desc}</span>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* CTA */}
 <div className="panel">
 <div className="psp-fs-md-f7e3">Ready to accept payments?</div>
 <p className="muted small">Go to Settings → Payment Methods and click "Connect with Stripe." It takes about 10 minutes.</p>
 <Link className="btn btn-primary" to="/app/settings" >
 Go to Settings →
 </Link>
 </div>

 {/* FAQ */}
 <div>
 <h2 className="psp-fs-xl-211b">Common questions</h2>
 <div className="psp-grid-4586">
 {FAQ.map((item, i) => (
 <div key={i} className="panel">
 <button
 type="button"
 onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
 className="psp-flex_ta-left_fs-base-7ea1">
 {item.q}
 <span style={{ fontSize: 'var(--text-xl)', color: 'var(--muted)', transform: expandedFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }}>+</span>
 </button>
 {expandedFaq === i && (
 <div className="psp-fs-sm-9ddc">
 {item.a}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>

 </div>
 </AppShell>
 );
}
