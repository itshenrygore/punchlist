import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: 40, paddingBottom: 60 }}>
      <div className="panel auth-card" style={{ maxWidth: 680, width: '100%', padding: '32px 28px', lineHeight: 1.7 }}>
        <Link className="brand" to="/" style={{ fontSize: '1rem', marginBottom: 16, display: 'inline-block' }}>Punchlist</Link>
        <h1 style={{ fontSize: 'clamp(1.3rem,3vw,1.6rem)', margin: '0 0 8px' }}>Terms of Service</h1>
        <p className="muted small" style={{ marginBottom: 20 }}>Last updated: April 2026</p>

        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg)', lineHeight: 1.75 }}>
          <p>By using Punchlist to create, send, or accept quotes and payments, you ("Contractor") acknowledge and agree to the following:</p>

          <h3 style={{ fontSize: 'var(--text-base)', margin: '20px 0 6px' }}>1. Independent Transaction Relationship</h3>
          <p>Punchlist acts solely as a technology platform facilitating quoting, invoicing, and payment enablement. Punchlist is not a party to any agreement between Contractor and Customer.</p>

          <h3 style={{ fontSize: 'var(--text-base)', margin: '20px 0 6px' }}>2. Payment Processing Providers</h3>
          <p>Payments made through Punchlist may be processed via third-party providers, including but not limited to Stripe, and may offer financing options through providers such as Klarna or Afterpay. These services are subject to their own terms and approval processes.</p>

          <h3 style={{ fontSize: 'var(--text-base)', margin: '20px 0 6px' }}>3. Full Payment Responsibility</h3>
          <p>The Contractor is the merchant of record and is solely responsible for all services provided, pricing, scope, and fulfillment of work associated with any transaction.</p>

          <h3 style={{ fontSize: 'var(--text-base)', margin: '20px 0 6px' }}>4. Disputes & Chargebacks</h3>
          <p>The Contractor assumes full responsibility for:</p>
          <ul style={{ paddingLeft: 20, margin: '6px 0' }}>
            <li>Customer disputes, complaints, or dissatisfaction</li>
            <li>Refund requests or service-related claims</li>
            <li>Payment disputes, chargebacks, or reversals initiated through payment processors or financing providers</li>
          </ul>
          <p>Punchlist does not mediate, resolve, or assume liability for such disputes.</p>

          <h3 style={{ fontSize: 'var(--text-base)', margin: '20px 0 6px' }}>5. Refunds & Adjustments</h3>
          <p>Any refunds, partial refunds, or pricing adjustments are the sole responsibility of the Contractor and must be handled in accordance with the terms agreed upon with the Customer and the policies of the applicable payment provider.</p>

          <h3 style={{ fontSize: 'var(--text-base)', margin: '20px 0 6px' }}>6. Financing & Installment Payments</h3>
          <p>Where a Customer elects to use installment or financing options (e.g., Klarna, Afterpay), the Contractor acknowledges:</p>
          <ul style={{ paddingLeft: 20, margin: '6px 0' }}>
            <li>They will receive payment in accordance with the payment processor's settlement terms</li>
            <li>The Customer's repayment obligation is with the financing provider, not Punchlist</li>
            <li>Any disputes related to the underlying service remain the Contractor's responsibility</li>
          </ul>

          <h3 style={{ fontSize: 'var(--text-base)', margin: '20px 0 6px' }}>7. Limitation of Liability</h3>
          <p>To the fullest extent permitted by law, Punchlist shall not be liable for:</p>
          <ul style={{ paddingLeft: 20, margin: '6px 0' }}>
            <li>Any payment disputes, chargebacks, or financing-related claims</li>
            <li>Loss of funds due to Customer disputes or provider decisions</li>
            <li>Service quality, fulfillment, or contractual disagreements between Contractor and Customer</li>
          </ul>
        </div>

        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <Link to="/signup" className="btn btn-secondary">← Back to sign up</Link>
        </div>
      </div>
    </div>
  );
}
