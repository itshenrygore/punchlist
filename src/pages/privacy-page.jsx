import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy — Punchlist';
    return () => { document.title = 'Punchlist'; };
  }, []);

  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: 40, paddingBottom: 60 }}>
      <div className="panel auth-card terms-card">
        <Link className="brand" to="/" style={{ fontSize: '1rem', marginBottom: 16, display: 'inline-block' }}>Punchlist</Link>
        <h1 className="terms-page-title">Privacy Policy</h1>
        <p className="muted small" style={{ marginBottom: 20 }}>Last updated: May 2026</p>

        <div className="terms-body">
          <p>
            Punchlist Technologies Inc. ("Punchlist", "we", "our") is committed to protecting your
            personal information in compliance with the <em>Personal Information Protection and
            Electronic Documents Act</em> (PIPEDA) and applicable provincial privacy legislation.
            This policy explains what we collect, why we collect it, how we use it, and your rights.
          </p>

          <h3 className="terms-heading">1. Who This Policy Applies To</h3>
          <p>
            This policy applies to contractors, tradespeople, and business owners ("Contractors")
            who create an account on Punchlist, and to their customers ("Customers") who receive
            and interact with quotes or invoices sent through Punchlist.
          </p>

          <h3 className="terms-heading">2. Information We Collect</h3>
          <p><strong>From Contractors:</strong></p>
          <ul className="terms-list">
            <li>Name, company name, email address, and password</li>
            <li>Trade, province/state, and region (used to personalize pricing and catalog)</li>
            <li>Company logo (if uploaded)</li>
            <li>Business and payment information required for Stripe Connect onboarding</li>
            <li>Quote and invoice data you create within the platform</li>
            <li>Customer contact information you enter (names, emails, phone numbers, addresses)</li>
            <li>Payment method preferences and deposit settings</li>
            <li>Usage data (quote activity, open rates, follow-up history)</li>
          </ul>
          <p><strong>From Customers (recipients of contractor quotes):</strong></p>
          <ul className="terms-list">
            <li>Name (as entered by the contractor or provided during approval)</li>
            <li>Email address and phone number (if provided)</li>
            <li>Electronic signature data (drawn or typed when approving a quote)</li>
            <li>Payment information processed through Stripe, Affirm, or Klarna at checkout</li>
            <li>IP address and device information when viewing a quote link</li>
          </ul>

          <h3 className="terms-heading">3. How We Use Your Information</h3>
          <ul className="terms-list">
            <li>To provide, operate, and improve the Punchlist platform</li>
            <li>To generate AI-assisted quotes using your job description and trade data</li>
            <li>To send quotes, invoices, and follow-up messages on behalf of contractors</li>
            <li>To process deposits and invoice payments via Stripe Connect</li>
            <li>To display activity tracking (open rates, view counts) to contractors</li>
            <li>To send transactional emails and SMS notifications related to your account</li>
            <li>To comply with legal and regulatory obligations</li>
            <li>To detect fraud and ensure platform security</li>
          </ul>
          <p>We do not sell your personal information to third parties.</p>

          <h3 className="terms-heading">4. Third-Party Service Providers</h3>
          <p>We share data with trusted third parties only as required to deliver our service:</p>
          <ul className="terms-list">
            <li><strong>Stripe</strong> — payment processing and Stripe Connect for contractor payouts</li>
            <li><strong>Affirm / Klarna</strong> — consumer financing options at customer checkout</li>
            <li><strong>Resend</strong> — transactional email delivery</li>
            <li><strong>Twilio</strong> — SMS delivery for follow-up messages</li>
            <li><strong>Supabase</strong> — cloud database and authentication infrastructure</li>
            <li><strong>Anthropic / Claude</strong> — AI-powered quote scope generation (job descriptions are sent to generate line items; no personally identifying customer data is included)</li>
          </ul>
          <p>All providers are bound by data processing agreements and applicable privacy laws.</p>

          <h3 className="terms-heading">5. Data Retention</h3>
          <p>
            We retain your account data for as long as your account is active. If you delete your
            account, your data is permanently removed from our systems within 30 days, except
            where retention is required by law (e.g., financial records).
          </p>
          <p>
            Quote and invoice records may be retained for up to 7 years for accounting and legal
            compliance purposes.
          </p>

          <h3 className="terms-heading">6. Your Rights</h3>
          <p>Under PIPEDA (Canada), the California Consumer Privacy Act (CCPA) for California residents, and other applicable privacy laws, you have the right to:</p>
          <ul className="terms-list">
            <li>Access the personal information we hold about you</li>
            <li>Correct inaccurate information</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent for non-essential data uses</li>
            <li>Opt out of any "sale" or "sharing" of personal information for cross-context behavioural advertising (we do neither)</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:privacy@punchlist.ca">privacy@punchlist.ca</a>.
            Canadian residents may also file a complaint with the Office of the Privacy
            Commissioner of Canada. California residents may file a complaint with the
            California Attorney General.
          </p>

          <h3 className="terms-heading">7. Security</h3>
          <p>
            We use industry-standard safeguards including TLS encryption for data in transit,
            row-level security on all database records, and Stripe's PCI-compliant payment
            infrastructure. We do not store credit card numbers on our servers.
          </p>

          <h3 className="terms-heading">8. Cookies and Tracking</h3>
          <p>
            We use session cookies for authentication. We may use analytics tools (e.g., PostHog)
            to understand how the platform is used in aggregate. We do not use advertising
            trackers or sell behavioral data.
          </p>

          <h3 className="terms-heading">9. Changes to This Policy</h3>
          <p>
            We will notify you by email or in-app notification if we make material changes to
            this policy. Continued use of Punchlist after such notice constitutes acceptance
            of the updated policy.
          </p>

          <h3 className="terms-heading">10. Contact</h3>
          <p>
            For privacy questions or requests, contact our Privacy Officer at:{' '}
            <a href="mailto:privacy@punchlist.ca">privacy@punchlist.ca</a>
            <br />Punchlist Technologies Inc. · Calgary, AB, Canada
          </p>
        </div>

        <div style={{ marginTop: 32, display: 'flex', gap: 16 }}>
          <Link to="/terms" className="btn btn-secondary btn-sm">Terms of Service</Link>
          <Link to="/" className="btn-link" style={{ fontSize: 'var(--text-sm)' }}>Back to home</Link>
        </div>
      </div>
    </div>
  );
}
