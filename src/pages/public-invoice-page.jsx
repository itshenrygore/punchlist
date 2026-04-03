import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { currency as formatCurrency, formatDate } from '../lib/format';
import PublicPageShell from '../components/public-page-shell';

// Import premium document styles
import '../styles/document.css';

export default function PublicInvoicePage() {
  const { shareToken } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const currency = (n) => formatCurrency(n, invoice?.country);

  useEffect(() => {
    fetch(`/api/public-invoice?token=${shareToken}`)
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Could not load invoice');
        return j.invoice;
      })
      .then(setInvoice)
      .catch(e => setError('This invoice could not be loaded. Try refreshing the page.'))
      .finally(() => setLoading(false));
  }, [shareToken]);

  // Group items by category
  const groupedItems = useMemo(() => {
    if (!invoice?.invoice_items) return {};
    return invoice.invoice_items.reduce((acc, item) => {
      const key = item.category || 'Work';
      acc[key] ||= [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [invoice]);

  // Loading state
  if (loading) return (
    <div className="doc-shell">
      <div className="doc-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--doc-muted)' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
          Loading your invoice…
        </div>
      </div>
    </div>
  );

  // Error state
  if (error && !invoice) return (
    <div className="doc-shell">
      <div className="doc-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🔗</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: 'var(--doc-text)' }}>Invoice unavailable</h2>
          <p style={{ fontSize: 14, color: 'var(--doc-muted)', lineHeight: 1.6, margin: '0 0 20px' }}>
            This invoice link may have expired or been removed. Contact your contractor for assistance.
          </p>
          <button className="doc-cta-secondary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    </div>
  );

  if (!invoice) return null;

  const isPaid = invoice.status === 'paid';
  const isOverdue = invoice.due_at && new Date(invoice.due_at) < new Date() && !isPaid;
  const hasAdditionalWork = Object.keys(groupedItems).includes('Additional Work');
  const depositCredited = Number(invoice.deposit_credited || 0);
  const hasDepositCredit = depositCredited > 0;

  // 5E: Calculate balance from payments
  const invoicePayments = invoice.payments || [];
  const totalPaidViaPayments = invoicePayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const invoiceBalance = Math.max(0, Number(invoice.total || 0) - depositCredited - totalPaidViaPayments);
  const isPartial = invoice.status === 'partial' || (totalPaidViaPayments > 0 && !isPaid);

  // Auto-include "Credit/Debit Card" when contractor has Stripe link
  const effectivePaymentMethods = useMemo(() => {
    const base = Array.isArray(invoice.payment_methods) ? [...invoice.payment_methods] : [];
    if (invoice.contractor_stripe_link && !base.some(m => /credit|debit|card|stripe/i.test(m))) {
      base.unshift('Credit/Debit Card');
    }
    return base;
  }, [invoice.payment_methods, invoice.contractor_stripe_link]);

  // Check for payment success
  const urlParams = new URLSearchParams(window.location.search);
  const paymentSuccess = urlParams.get('payment') === 'success';

  // Sort groups: show "Additional Work" last
  const sortedGroupKeys = Object.keys(groupedItems).sort((a, b) => {
    if (a === 'Additional Work') return 1;
    if (b === 'Additional Work') return -1;
    return a.localeCompare(b);
  });

  return (
    <PublicPageShell contractorName={invoice.contractor_company || invoice.contractor_name} logoUrl={invoice.contractor_logo}>
    <div className="doc-shell">
      <div className="doc-container">
        <div className="doc-card">

          {/* ── Header: Contractor branding ── */}
          <div className="doc-header">
            <div className="doc-brand">
              {invoice.contractor_logo && <img src={invoice.contractor_logo} alt="" className="doc-logo" />}
              <div className="doc-company">{invoice.contractor_company || invoice.contractor_name || 'Your Contractor'}</div>
              {invoice.contractor_name && invoice.contractor_name !== invoice.contractor_company && (
                <div className="doc-contractor-name">{invoice.contractor_name}</div>
              )}
              <div className="doc-contact">
                {invoice.contractor_phone && <a href={`tel:${invoice.contractor_phone}`}>{invoice.contractor_phone}</a>}
                {invoice.contractor_email && <a href={`mailto:${invoice.contractor_email}`}>{invoice.contractor_email}</a>}
              </div>
            </div>
            <div className="doc-meta">
              <div className="doc-type">Invoice</div>
              <div className="doc-number">{invoice.invoice_number}</div>
              <div className="doc-date">{formatDate(invoice.issued_at)}</div>
            </div>
          </div>

          {/* ── Status banners ── */}
          {paymentSuccess && !isPaid && (
            <div className="doc-status doc-status--approved">
              <span className="doc-status-icon">✓</span>
              <div>
                <strong style={{ display: 'block' }}>Payment processing</strong>
                <span style={{ fontSize: 13, opacity: 0.9 }}>Your payment is being processed. This page will update once confirmed.</span>
              </div>
            </div>
          )}
          {isPaid && (
            <div className="doc-status doc-status--approved">
              <span className="doc-status-icon">✓</span>
              <div>
                <strong style={{ display: 'block' }}>Invoice paid</strong>
                <span style={{ fontSize: 13, opacity: 0.9 }}>
                  Paid {invoice.paid_at ? formatDate(invoice.paid_at) : ''}
                  {invoice.payment_method ? ` via ${invoice.payment_method}` : ''}
                </span>
              </div>
            </div>
          )}
          {isOverdue && (
            <div className="doc-status doc-status--warning">
              <span className="doc-status-icon">⚠️</span>
              <div>
                <strong style={{ display: 'block' }}>Payment overdue</strong>
                <span style={{ fontSize: 13, opacity: 0.9 }}>Was due {formatDate(invoice.due_at)}</span>
              </div>
            </div>
          )}

          {/* ── Invoice hero ── */}
          <div className="doc-hero">
            <h1 className="doc-title">{invoice.title || invoice.invoice_number}</h1>
            <div className="doc-customer">
              Bill to <strong>{invoice.customer_name || 'Customer'}</strong>
            </div>
            {invoice.customer_address && <div className="doc-address">{invoice.customer_address}</div>}
            
            <div className="doc-meta-grid">
              <div className="doc-meta-item">
                <div className="doc-meta-label">Invoice date</div>
                <div className="doc-meta-value">{formatDate(invoice.issued_at)}</div>
              </div>
              <div className="doc-meta-item">
                <div className="doc-meta-label">Due date</div>
                <div className={`doc-meta-value ${isOverdue && !isPaid ? 'doc-meta-value--danger' : ''}`}>
                  {formatDate(invoice.due_at)}
                </div>
              </div>
              <div className="doc-meta-item">
                <div className="doc-meta-label">Status</div>
                <div className={`doc-meta-value ${isPaid ? 'doc-meta-value--success' : isOverdue ? 'doc-meta-value--danger' : ''}`}>
                  {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Payment due'}
                </div>
              </div>
            </div>
          </div>

          {/* ── Description ── */}
          {invoice.description && (
            <div className="doc-section">
              <h2 className="doc-section-title">Description</h2>
              <div className="doc-section-body">
                <p>{invoice.description}</p>
              </div>
            </div>
          )}

          {/* ── Line items ── */}
          <div className="doc-items">
            <div className="doc-items-header">
              <h2 className="doc-section-title">Breakdown</h2>
            </div>
            
            {sortedGroupKeys.map(category => (
              <div key={category} className={`doc-group ${category === 'Additional Work' ? 'doc-group--optional' : ''}`}>
                <div className="doc-group-label">
                  {category === 'Additional Work' ? '+ Additional approved work' : category}
                </div>
                {groupedItems[category].map(item => (
                  <div key={item.id} className="doc-item">
                    <div className="doc-item-left">
                      <div className="doc-item-name">{item.name}</div>
                      {item.notes && <div className="doc-item-note">{item.notes}</div>}
                      <div className="doc-item-qty">{item.quantity} × {currency(item.unit_price)}</div>
                    </div>
                    <div className="doc-item-right">
                      {currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* ── Totals ── */}
          <div className="doc-totals">
            <div className="doc-totals-inner">
              <div className="doc-total-row">
                <span>Subtotal</span>
                <strong>{currency(invoice.subtotal)}</strong>
              </div>
              {Number(invoice.discount || 0) > 0 && (
                <div className="doc-total-row">
                  <span>Discount</span>
                  <strong style={{ color: '#EF4444' }}>−{currency(invoice.discount)}</strong>
                </div>
              )}
              <div className="doc-total-row">
                <span>Tax ({invoice.province})</span>
                <strong>{currency(invoice.tax)}</strong>
              </div>
              {hasDepositCredit && (
                <div className="doc-total-row doc-total-row--credited">
                  <span>Deposit paid</span>
                  <strong>−{currency(depositCredited)}</strong>
                </div>
              )}
              <div className="doc-total-row doc-total-row--grand">
                <span>{hasDepositCredit || totalPaidViaPayments > 0 ? 'Invoice total' : 'Total'}</span>
                <strong>{currency(hasDepositCredit ? invoice.total - depositCredited : invoice.total)}</strong>
              </div>
              {totalPaidViaPayments > 0 && !isPaid && (
                <>
                  <div className="doc-total-row" style={{ color: '#22C55E' }}>
                    <span>Payments received</span>
                    <strong>−{currency(totalPaidViaPayments)}</strong>
                  </div>
                  <div className="doc-total-row doc-total-row--grand">
                    <span>Balance due</span>
                    <strong style={{ color: '#EF4444' }}>{currency(invoiceBalance)}</strong>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Payment history (if partial) ── */}
          {invoicePayments.length > 0 && (
            <div className="doc-section" style={{ marginTop: 0 }}>
              <h2 className="doc-section-title">Payment History</h2>
              <div className="doc-section-body">
                {invoicePayments.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e8e6e1', fontSize: 13 }}>
                    <span>
                      <strong style={{ color: '#22C55E' }}>{currency(p.amount)}</strong>
                      {p.method && <span style={{ color: '#667085', marginLeft: 6 }}>via {p.method}</span>}
                    </span>
                    <span style={{ color: '#667085' }}>{formatDate(p.paid_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Paid stamp ── */}
          {isPaid && (
            <div className="doc-paid-stamp">
              <div className="doc-paid-stamp-text">PAID</div>
              {invoice.paid_at && (
                <div className="doc-paid-stamp-date">{formatDate(invoice.paid_at)}</div>
              )}
            </div>
          )}

          {/* ── Payment info (if not paid) ── */}
          {!isPaid && (
            <div className="doc-info-grid">
              {/* Balance due — show prominently */}
              {invoiceBalance > 0 && (
                <div className="doc-info-block" style={{ background: 'var(--doc-deposit-bg, #fff7ed)', border: '1px solid var(--doc-deposit-border, rgba(234,88,12,.15))' }}>
                  <div className="doc-info-label">Amount Due</div>
                  <div className="doc-info-body">
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--doc-text)', letterSpacing: '-.02em', marginBottom: 4 }}>{currency(invoiceBalance)}</div>
                    {/* Online payment buttons */}
                    {(invoice.contractor_stripe_link || invoice.square_payment_link || invoice.paypal_link) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, marginBottom: 6 }}>
                        {invoice.contractor_stripe_link && (
                          <a href={invoice.contractor_stripe_link} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ textAlign: 'center', textDecoration: 'none', fontSize: 14, padding: '12px 16px' }}>
                            Pay {currency(invoiceBalance)} Online →
                          </a>
                        )}
                        {invoice.square_payment_link && (
                          <a href={invoice.square_payment_link} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ textAlign: 'center', textDecoration: 'none', fontSize: 14, padding: '12px 16px', background: 'var(--doc-text)', color: '#fff' }}>
                            Pay via Square
                          </a>
                        )}
                        {invoice.paypal_link && (
                          <a href={invoice.paypal_link.startsWith('http') ? invoice.paypal_link : `https://paypal.me/${invoice.paypal_link}`} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ textAlign: 'center', textDecoration: 'none', fontSize: 14, padding: '12px 16px', background: '#0070ba', color: '#fff' }}>
                            Pay via PayPal
                          </a>
                        )}
                      </div>
                    )}
                    {!(invoice.contractor_stripe_link || invoice.square_payment_link || invoice.paypal_link) && (
                      (invoice.etransfer_email || invoice.venmo_zelle_handle) ? (
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--doc-muted)' }}>See payment options below</p>
                      ) : effectivePaymentMethods.length > 0 ? (
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--doc-muted)' }}>Pay via {effectivePaymentMethods.join(', ')}</p>
                      ) : (
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--doc-muted)' }}>Contact {invoice.contractor_company || invoice.contractor_name || 'your contractor'} to arrange payment.</p>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Other payment options — always shown when any link/email is set */}
              {(invoice.etransfer_email || invoice.square_payment_link || invoice.paypal_link || invoice.venmo_zelle_handle) && (
                <div className="doc-info-block">
                  <div className="doc-info-label">Payment options</div>
                  <div className="doc-info-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {invoice.etransfer_email && (
                      <p style={{ margin: 0, fontSize: 13 }}>
                        E-Transfer to: <strong>{invoice.etransfer_email}</strong>{' '}
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard?.writeText(invoice.etransfer_email); }}
                          style={{ fontSize: 11, padding: '2px 8px', marginLeft: 4, cursor: 'pointer' }}
                        >Copy</button>
                      </p>
                    )}
                    {invoice.square_payment_link && (
                      <a
                        href={invoice.square_payment_link}
                        target="_blank"
                        rel="noreferrer"
                        className="doc-cta-primary"
                        style={{ textAlign: 'center', textDecoration: 'none', fontSize: 14, padding: '12px 16px' }}
                      >
                        Pay via Square
                      </a>
                    )}
                    {invoice.paypal_link && (
                      <a
                        href={invoice.paypal_link.startsWith('http') ? invoice.paypal_link : `https://paypal.me/${invoice.paypal_link}`}
                        target="_blank"
                        rel="noreferrer"
                        className="doc-cta-primary"
                        style={{ textAlign: 'center', textDecoration: 'none', fontSize: 14, padding: '12px 16px' }}
                      >
                        Pay via PayPal
                      </a>
                    )}
                    {invoice.venmo_zelle_handle && (
                      <p style={{ margin: 0, fontSize: 13 }}>Venmo/Zelle: <strong>{invoice.venmo_zelle_handle}</strong></p>
                    )}
                  </div>
                </div>
              )}

              {/* No payment options configured */}
              {!invoice.etransfer_email && !invoice.square_payment_link && !invoice.paypal_link && !invoice.venmo_zelle_handle && effectivePaymentMethods.length === 0 && (
                <div className="doc-info-block">
                  <div className="doc-info-body">
                    <p style={{ margin: 0, fontSize: 13, color: '#667085' }}>
                      Contact {invoice.contractor_company || invoice.contractor_name || 'your contractor'} to arrange payment.
                    </p>
                  </div>
                </div>
              )}

              {/* Payment methods tags */}
              {effectivePaymentMethods.length > 0 && (
                <div className="doc-info-block">
                  <div className="doc-info-label">Payment methods</div>
                  <div className="doc-info-body">
                    <div className="doc-payment-methods">
                      {effectivePaymentMethods.map(m => (
                        <span key={m} className="doc-payment-tag">{m}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Payment instructions — always shown when set */}
              {invoice.payment_instructions && (
                <div className="doc-info-block">
                  <div className="doc-info-label">Payment instructions</div>
                  <div className="doc-info-body">
                    <p>{invoice.payment_instructions}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Notes ── */}
          {invoice.notes && (
            <div className="doc-section">
              <h2 className="doc-section-title">Notes</h2>
              <div className="doc-section-body">
                <p>{invoice.notes}</p>
              </div>
            </div>
          )}

          {/* ── Additional work notice ── */}
          {hasAdditionalWork && (
            <div className="doc-section" style={{ background: 'var(--doc-accent-soft)', margin: '0 -1px', padding: '16px 28px' }}>
              <p style={{ fontSize: 13, color: 'var(--doc-accent)', margin: 0 }}>
                <strong>Note:</strong> This invoice includes additional work that was approved after the original quote.
              </p>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="doc-actions">
            {!isPaid && invoice.contractor_email && (
              <a 
                className="doc-cta-secondary" 
                href={`mailto:${invoice.contractor_email}?subject=Payment for ${invoice.invoice_number}`}
                style={{ textAlign: 'center', textDecoration: 'none' }}
              >
                Contact about payment
              </a>
            )}
            <button className="doc-cta-secondary" type="button" onClick={() => window.print()}>
              Print
            </button>
          </div>

          {/* ── Footer ── */}
          <div className="doc-footer">
            <div>
              <div>{invoice.contractor_company || invoice.contractor_name}</div>
              {invoice.contractor_phone && <div>{invoice.contractor_phone}</div>}
            </div>
            <div>
              <div>Invoice {invoice.invoice_number}</div>
              <div>{formatDate(invoice.issued_at)}</div>
            </div>
            <div className="doc-footer-actions">
              <button
                type="button"
                className="doc-footer-link"
                onClick={() => { window.location.href = `/api/export-pdf?invoice_token=${invoice.share_token}`; }}
              >
                Save as PDF
              </button>
            </div>
          </div>
        </div>

      {/* ── Mobile sticky CTA for unpaid invoices ── */}
      {!isPaid && invoiceBalance > 0 && (
        <div className="doc-sticky-cta">
          <div className="doc-sticky-total">{currency(invoiceBalance)}</div>
          {invoice.contractor_stripe_link ? (
            <a 
              className="doc-cta-primary" 
              href={invoice.contractor_stripe_link}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none', textAlign: 'center' }}
            >
              Pay Online →
            </a>
          ) : invoice.square_payment_link ? (
            <a 
              className="doc-cta-primary" 
              href={invoice.square_payment_link}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none', textAlign: 'center' }}
            >
              Pay via Square
            </a>
          ) : invoice.paypal_link ? (
            <a 
              className="doc-cta-primary" 
              href={invoice.paypal_link.startsWith('http') ? invoice.paypal_link : `https://paypal.me/${invoice.paypal_link}`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none', textAlign: 'center' }}
            >
              Pay via PayPal
            </a>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--doc-muted)' }}>
              {effectivePaymentMethods.length > 0
                ? `Pay via ${effectivePaymentMethods.join(', ')}`
                : `Contact ${invoice.contractor_company || 'your contractor'}`}
            </span>
          )}
        </div>
      )}
      </div>
    </div>
    </PublicPageShell>
  );
}
