import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, Smartphone, CheckCircle, Lock } from 'lucide-react';
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
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link to="/app/settings" style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            ← Back to Settings
          </Link>
          <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', letterSpacing: '-.03em', margin: '0 0 8px' }}>
            Punchlist Payments
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-base)', lineHeight: 1.6, margin: 0 }}>
            Accept card payments and give your customers the option to pay over time on bigger jobs. You get paid the full amount up front — no waiting on installments.
          </p>
        </div>

        {/* How it works */}
        <div className="panel" style={{ marginBottom: 24, background: 'var(--surface-alt, #f8f9fa)' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>How it works</div>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand)', color: 'var(--always-white, #fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-base)', fontWeight: 700, flexShrink: 0 }}>1</div>
              <div><strong style={{ fontSize: 'var(--text-base)' }}>You connect your account</strong><p className="muted small" style={{ margin: '2px 0 0' }}>One-time setup in Settings. Takes about 10 minutes — Stripe handles the details.</p></div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand)', color: 'var(--always-white, #fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-base)', fontWeight: 700, flexShrink: 0 }}>2</div>
              <div><strong style={{ fontSize: 'var(--text-base)' }}>Your customer sees a Pay Now button</strong><p className="muted small" style={{ margin: '2px 0 0' }}>On every quote and invoice. They can pay by card or choose monthly payments on larger jobs.</p></div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand)', color: 'var(--always-white, #fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-base)', fontWeight: 700, flexShrink: 0 }}>3</div>
              <div><strong style={{ fontSize: 'var(--text-base)' }}>You get paid in full</strong><p className="muted small" style={{ margin: '2px 0 0' }}>The full amount goes to your bank within 2 business days — even if the customer chose monthly payments.</p></div>
            </div>
          </div>
        </div>

        {/* Key benefits */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 'var(--text-xl)', letterSpacing: '-.02em', margin: '0 0 16px' }}>Why set this up</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { Icon: DollarSign, title: 'Get paid faster', desc: 'Customer pays right from the quote — no chasing e-transfers or waiting for cheques.' },
              { Icon: Smartphone, title: 'Bigger jobs get approved', desc: 'When customers can pay monthly, a $6,000 job becomes $250/mo. Easier to say yes.' },
              { Icon: CheckCircle, title: 'You always get the full amount', desc: 'Regardless of how the customer pays, the full quote total is deposited to your account.' },
              { Icon: Lock, title: 'Deposits before you start', desc: 'Require a deposit when the customer approves. Money in your account before the job begins.' },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="panel" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, color: 'var(--brand)', marginTop: 2 }}><Icon size={22} /></span>
                <div>
                  <strong style={{ fontSize: 'var(--text-sm)', display: 'block', marginBottom: 2 }}>{title}</strong>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="panel" style={{ textAlign: 'center', padding: '24px 20px', marginBottom: 32, background: 'var(--brand-bg)', border: '1px solid var(--brand-line)' }}>
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 6 }}>Ready to accept payments?</div>
          <p className="muted small" style={{ marginBottom: 14, lineHeight: 1.5, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>Connect your Stripe account to start accepting card payments and deposits. Takes about 10 minutes.</p>
          <Link className="btn btn-primary" to="/app/payments/setup" style={{ fontSize: 'var(--text-sm)', padding: '11px 24px' }}>
            Start Stripe Setup →
          </Link>
        </div>

        {/* FAQ */}
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', letterSpacing: '-.02em', margin: '0 0 16px' }}>Common questions</h2>
          <div style={{ display: 'grid', gap: 2 }}>
            {FAQ.map((item, i) => (
              <div key={i} className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  style={{
                    width: '100%', padding: '14px 20px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left', fontSize: 'var(--text-base)', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    color: 'var(--text)',
                  }}
                >
                  {item.q}
                  <span style={{ fontSize: 'var(--text-xl)', color: 'var(--muted)', transform: expandedFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }}>+</span>
                </button>
                {expandedFaq === i && (
                  <div style={{ padding: '0 20px 16px', fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.7 }}>
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
