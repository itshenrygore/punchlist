import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, Smartphone, CheckCircle, Lock, ChevronDown } from 'lucide-react';
import AppShell from '../components/app-shell';

const FAQ = [
  {
    q: 'Do I get the full amount even if my customer pays monthly?',
    a: 'Yes. The financing provider pays you in full within 2 business days. Your customer repays them over 3–12 months. You never wait on installments.',
  },
  {
    q: 'What does it cost?',
    a: 'A standard processing fee (around 2.5%) is deducted from each payment. No monthly fees, no setup fee, no minimums. You only pay when you get paid.',
  },
  {
    q: 'How long does setup take?',
    a: 'About 10 minutes. Stripe walks you through entering your business details and bank account. Once connected, a Pay Now button automatically appears on your quotes and invoices.',
  },
  {
    q: 'What if my customer doesn\'t qualify for financing?',
    a: 'They can still pay the full amount by credit or debit card. The monthly option only appears on larger jobs — if a customer isn\'t approved, they simply see the card option. No extra work for you.',
  },
  {
    q: 'Can I still accept e-transfer, cash, or cheque?',
    a: 'Absolutely. This is in addition to however you already collect payment. Customers who prefer e-transfer or cheque can still do that.',
  },
  {
    q: 'How do refunds work?',
    a: 'You can process refunds through your Stripe dashboard. If a customer disputes a charge, Stripe handles the process and keeps you informed.',
  },
  {
    q: 'Does this work in both Canada and the US?',
    a: 'Yes. Currency is set automatically based on your profile — CAD for Canada, USD for the US.',
  },
  {
    q: 'Is this required?',
    a: 'No. Payments are completely optional. Your quotes and invoices work the same way with or without it — your customers just won\'t see a Pay Now button. You can connect anytime.',
  },
];

export default function PaymentsSetupPage() {
  const [expandedFaq, setExpandedFaq] = useState(null);

  return (
    <AppShell title="Payments">
      <div className="ps-page">

        {/* Back link */}
        <Link to="/app/settings" className="ps-back">← Settings</Link>

        {/* Hero */}
        <div className="ps-hero">
          <h1 className="ps-hero-title font-display">Get paid faster</h1>
          <p className="ps-hero-sub">
            Accept card payments on your quotes and invoices. Your customers can pay instantly or
            spread larger jobs over monthly payments — and you still get the full amount up front.
          </p>
        </div>

        {/* Steps */}
        <div className="ps-steps panel">
          <div className="ps-steps-label eyebrow">How it works</div>
          <div className="ps-step">
            <div className="ps-step-num">1</div>
            <div>
              <strong>Connect your Stripe account</strong>
              <p className="ps-step-hint">One-time setup — takes about 10 minutes.</p>
            </div>
          </div>
          <div className="ps-step">
            <div className="ps-step-num">2</div>
            <div>
              <strong>Customers see a Pay Now button</strong>
              <p className="ps-step-hint">On every quote and invoice. Card or monthly payments on larger jobs.</p>
            </div>
          </div>
          <div className="ps-step">
            <div className="ps-step-num">3</div>
            <div>
              <strong>You get paid in full</strong>
              <p className="ps-step-hint">Deposited to your bank within 2 business days — even if they chose monthly.</p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="ps-benefits">
          {[
            { Icon: DollarSign, title: 'No more chasing payments', desc: 'Customers pay right from the quote — no waiting on e-transfers or cheques.' },
            { Icon: Smartphone, title: 'Close bigger jobs', desc: 'A $6,000 job becomes ~$250/mo. Easier for customers to say yes.' },
            { Icon: CheckCircle, title: 'Full amount, every time', desc: 'Regardless of how they pay, the full total is deposited to your account.' },
            { Icon: Lock, title: 'Collect deposits up front', desc: 'Require a deposit before work begins. Money in your account before day one.' },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="ps-benefit panel">
              <span className="ps-benefit-icon"><Icon size={20} /></span>
              <div>
                <strong className="ps-benefit-title">{title}</strong>
                <span className="ps-benefit-desc">{desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="ps-cta panel">
          <strong className="ps-cta-title">Ready to get started?</strong>
          <p className="ps-cta-sub">
            Connect your Stripe account and start accepting payments today. No commitments — you can disconnect at any time.
          </p>
          <Link className="btn btn-primary" to="/app/payments/setup">
            Connect Stripe →
          </Link>
        </div>

        {/* FAQ */}
        <div className="ps-faq">
          <h2 className="ps-faq-title font-display">Questions</h2>
          {FAQ.map((item, i) => (
            <div key={i} className="ps-faq-item panel">
              <button
                type="button"
                className="ps-faq-q"
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                aria-expanded={expandedFaq === i}
              >
                <span>{item.q}</span>
                <ChevronDown size={16} className={`ps-faq-chevron${expandedFaq === i ? ' ps-faq-chevron--open' : ''}`} />
              </button>
              {expandedFaq === i && (
                <div className="ps-faq-a">{item.a}</div>
              )}
            </div>
          ))}
        </div>

      </div>
    </AppShell>
  );
}
