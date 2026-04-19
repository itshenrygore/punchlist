import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { currency as formatCurrency, formatDate } from '../lib/format';
import { estimateMonthly, showFinancing } from '../lib/financing';
import PublicPageShell from '../components/public-page-shell';
import PublicLoadingState from '../components/public-loading-state';
import PublicErrorState from '../components/public-error-state';
import { CopyChip } from '../components/ui';

// Import premium document styles
import '../styles/document.css';

export default function PublicInvoicePage() {
 const { shareToken } = useParams();
 const [invoice, setInvoice] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [payLoading, setPayLoading] = useState(false);

 async function handleConnectPay() {
 setPayLoading(true);
 try {
 const r = await fetch('/api/create-payment-session', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 type: 'invoice',
 invoiceId: invoice.id,
 shareToken: invoice.share_token,
 }),
 });
 const data = await r.json();
 if (data.url) window.location.href = data.url;
 else setError('Couldn\u2019t start payment. Try again, or contact your contractor.');
 } catch { setError('Couldn\u2019t reach the payment processor. Try again in a moment.'); }
 finally { setPayLoading(false); }
 }
 
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

 // Auto-include "Credit/Debit Card" when contractor has Stripe link
 // NOTE: Must be above early returns to avoid React hooks violation
 const effectivePaymentMethods = useMemo(() => {
 if (!invoice) return [];
 const base = Array.isArray(invoice.payment_methods) ? [...invoice.payment_methods] : [];
 if (invoice.contractor_stripe_link && !base.some(m => /credit|debit|card|stripe/i.test(m))) {
 base.unshift('Credit/Debit Card');
 }
 return base;
 }, [invoice?.payment_methods, invoice?.contractor_stripe_link]);

 // Loading state
 if (loading) return <PublicLoadingState label="Loading your invoice…" />;

 // Error state
 if (error && !invoice) return (
 <PublicErrorState
 docType="invoice"
 contractorName={null}
 onRetry={() => window.location.reload()}
 />
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

 // Auto-include "Credit/Debit Card" when contractor has Stripe link (computed above early returns)

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

 doc-status-icon pip-inline-flex-0510s banners ── */}
 {paymentSuccess && !isPaid && (
 <div className="doc-status doc-status--approved">
 <span className="doc-status-icon" ><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
 <div>
 <strong className="pip-block-b73a">Payment processing</strong>
 <span className="pip-fs-sm-bc08">Your payment is being processed. This page will update once confirmed.</span>
 doc-status-icon pip-inline-flex-0510iv>
 </div>
 )}
 {isPaid && (
 <div className="doc-status doc-status--approved">
 <span className="doc-status-icon" ><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
 <div>
 <strong className="pip-block-b73a">Invoice paid</strong>
 <span className="pip-fs-sm-bc08">
 Paid {invoice.paid_at ? formatDate(invoice.paid_at) : ''}
 {invoice.payment_method ? ` via ${invoice.payment_method}` : ''}
 </span>
 </div>
 </div>
 )}
 {isOverdue && (
 <div className="doc-status doc-status--warning">
 <span className="doc-status-icon">!</span>
 <div>
 <strong className="pip-block-b73a">Payment overdue</strong>
 <span className="pip-fs-sm-bc08">Was due {formatDate(invoice.due_at)}</span>
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
 <strong className="pip-s7-622c">−{currency(invoice.discount)}</strong>
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
 <strong>{currency(hasDepositCredit ? invoice.total - depdoc-total-row pip-s5-286c: invoice.total)}</strong>
 </div>
 {totalPaidViaPayments > 0 && !isPaid && (
 <>
 <div className="doc-total-row" >
 <span>Payments received</span>
 <strong>−{currency(totalPaidViaPayments)}</strong>
 </div>
 <div className="doc-total-row doc-total-row--grand">
 <span>Balance due</span>
 <strong className="pip-s7-622c">{currency(invoiceBalance)}</strong>
 </div>
 </>
 doc-section pip-s6-52ea </div>
 </div>

 {/* ── Payment history (if partial) ── */}
 {invoicePayments.length > 0 && (
 <div className="doc-section" >
 <h2 className="doc-section-title">Payment History</h2>
 <div className="doc-section-body">
 {invoicePayments.map(p => (
 <div key={p.id} className="pip-flex_fs-sm-18b9">
 <span>
 <strong className="pip-s5-286c">{currency(p.amount)}</strong>
 {p.method && <span className="pip-s4-6837">via {p.method}</span>}
 </span>
 <span className="pip-s3-7f0e">{formatDate(p.paid_at)}</span>
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
 {!isPaid && (doc-info-block pip-s2-5648div className="doc-info-grid">
 {/* Balance due — show prominently */}
 {invoiceBalance > 0 && (
 <div className="doc-info-block" >
 <div className="doc-info-label">Amount Due</div>
 {error && invoice && <div className="pip-fs-sm-e987">{error}</div>}
 <div className="doc-info-body">
 <div className="pip-fs-2xl-d90e">{currency(invoiceBalance)}</div>
 {/* Online payment buttons */}
 {invoice.stripe_connect_enabled ? (
 <div className="pip-flex-be24"p: 10, marginBottom: 6 }}>
 <button type="button" className="doc-cta-primary" onClick={handleConnectPay} disabled={payLoading} >
 {payLoading ? 'Loading…' : `Pay ${currency(invoiceBalance)}`}
 </button>
 {showFinancing(invoiceBalance) ? (
 <div className="pip-ta-center-99ae">
 <div className="pip-fs-sm-69cd">
 or from {currency(estimateMonthly(invoiceBalance))}/mo for 12 months
 </div>
 <div className="pip-fs-2xs-8a3c">
 Choose "Pay monthly" at checkout · Powered by Punchlist
 </div>
 </div>
 ) : (
 <span className="pip-ta-center_fs-xs-4d86">Powered by Punchlist · Secure checkout via Stripe</span>
 )}
 </div>
 ) : (invoice.contractor_stripe_link || invoice.square_payment_link || invoice.paypal_link) ? (
 <div className="pip-flex-eab6">
 {invoice.contractor_stripe_link && (
 doc-cta-primary pip-ta-center_fs-base-8064a href={invoice.contractor_stripe_link} target="_blank" rel="noreferrer" className="doc-cta-primary" >
 Pay {currency(invoiceBalance)} Online →
 </a>
 )}
 {invoice.square_payment_link && (
 doc-cta-primary pip-ta-center_fs-base-f56d <a href={invoice.square_payment_link} target="_blank" rel="noreferrer" className="doc-cta-primary" >
 Pay via Square
 </a>
 )}
 {invoice.paypal_link && (
 <a href={invoice.paypal_link.startsWith('http') ? invoice.paypal_link : `https://paypal.me/${invoice.paypal_link}`} target="_blank" rel=doc-cta-primary pip-ta-center_fs-base-c939assName="doc-cta-primary" >
 Pay via PayPal
 </a>
 )}
 </div>
 ) : (
 (invoice.etransfer_email || invoice.venmo_zelle_handle) ? (
 <p className="pip-fs-xs-31dc">See payment options below</p>
 ) : effectivePaymentMethods.length > 0 ? (
 <p className="pip-fs-xs-31dc">Pay via {effectivePaymentMethods.join(', ')}</p>
 ) : (
 <p className="pip-fs-xs-31dc">Contact {invoice.contractor_company || invoice.contractor_name || 'your contractor'} to arrange payment.</p>
 )
 )}
 </div>
 </div>
 )}

 {/* Other payment options — always shown when any link/email is set */}
 {(invoice.etransfer_email || invoice.square_payment_link || invoice.paypal_link || invoice.venmo_zelldoc-info-body pip-flex-0c06(
 <div className="doc-info-block">
 <div className="doc-info-label">Payment options</div>
 <div classpl-etransfer-row pip-s1-61c3ody" >
 {invoice.etransfer_email && (
 <p className="pl-etransfer-row" >
 <span className="pl-etransfer-label">E-Transfer to:</span>
 <strong className="pl-etransfer-email">{invoice.etransfer_email}</strong>
 <CopyChip value={invoice.etransfer_email} label="Copy" copiedLabel="Copied" />
 </p>
 )}
 {invoice.square_payment_link && (
 <a
 href={invoice.square_payment_link}
 target="_blank" rel="noreferrer"
 rel="noreferrer"
 className="doc-cta-primary pip-ta-center_fs-base-8064"
 
 >
 Pay via Square
 </a>
 )}
 {invoice.paypal_link && (
 <a
 href={invoice.paypal_link.startsWith('http') ? invoice.paypal_link : `https://paypal.me/${invoice.paypal_link}`}
 target="_blank" rel="noreferrer"
 rel="noreferrer"
 className="doc-cta-primary pip-ta-center_fs-base-8064"
 
 >
 Pay via PayPal
 </a>
 )}
 {invoice.venmo_zelle_handle && (
 <p className="pip-fs-sm-7cd6">Venmo/Zelle: <strong>{invoice.venmo_zelle_handle}</strong></p>
 )}
 </div>
 </div>
 )}

 {/* No payment options configured */}
 {!invoice.etransfer_email && !invoice.square_payment_link && !invoice.paypal_link && !invoice.venmo_zelle_handle && effectivePaymentMethods.length === 0 && (
 <div className="doc-info-block">
 <div className="doc-info-body">
 <p className="pip-fs-sm-ca15">
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
 <p>{invoice.nodoc-section pip-s0-d2d5 </div>
 </div>
 )}

 {/* ── Additional work notice ── */}
 {hasAdditionalWork && (
 <div className="doc-section" >
 <p className="pip-fs-sm-a9cc">
 <strong>Note:</strong> This invoice includes additional work that was approved after the original quote.
 </p>
 </div>
 )}

 {/* ── Actions ── */}
 <div className="doc-actions">
 {!isPaid && invoice.contractor_email && (
 <a doc-cta-secondary pip-ta-center-39d8className="doc-cta-secondary" 
 href={`mailto:${invoice.contractor_email}?subject=Payment for ${invoice.invoice_number}`}
 
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
 <button type="button"
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
 cdoc-cta-primary pip-ta-center-39d8ta-primary" 
 href={invoice.contractor_stripe_link}
 target="_blank" rel="noreferrer"
 rel="noreferrer"
 
 >
 Pay Online →
 </a>
 ) : invoice.square_payment_link ? (
 <a 
 doc-cta-primary pip-ta-center-39d8c-cta-primary" 
 href={invoice.square_payment_link}
 target="_blank" rel="noreferrer"
 rel="noreferrer"
 
 >
 Pay via Square
 </a>
 ) : invoice.paypal_link ? (
 <a 
 className="doc-cta-primary" 
 href={invoice.paypal_link.startsWith('http') ? invoice.paypal_link : `https://paypal.me/${invoice.paypal_link}`}
 target="_blank" rel="noreferrer"
 rel="noreferrer"
 className="pip-ta-center-39d8"
 >
 Pay via PayPal
 </a>
 ) : (
 <span className="pip-fs-xs-0524">
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
