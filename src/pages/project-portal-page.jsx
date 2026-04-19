import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { currency as formatCurrency, formatDate, formatQuoteNumber, friendly } from '../lib/format';
import { getCustomerActions } from '../lib/workflow';
import { estimateMonthly } from '../lib/financing';
import { FileText, FileEdit, CreditCard, MessageSquare, Pencil, RefreshCw, ChevronDown, ChevronUp, Eye, Check, Phone, Mail, Link2 } from 'lucide-react';
import ConvAvatar from '../components/conv-avatar';
import PublicPageShell from '../components/public-page-shell';
import SignaturePad from '../components/signature-pad';
import useScrollLock from '../hooks/use-scroll-lock';
import PublicLoadingState from '../components/public-loading-state';
import PublicErrorState from '../components/public-error-state';
import '../styles/document.css';
import { AmendmentCard, AdditionalWorkCard } from '../components/update-card';
import PublicQuoteView from '../components/public-quote';
import { TermsBody } from '../components/ui';

/* ════════════════════════════════════════════════════════════════════════════
 PUNCHLIST — Customer Project Portal
 One URL per customer-job: /project/:shareToken
 Tabs: Quote · Updates · Payments · Messages
 ════════════════════════════════════════════════════════════════════════════ */

/* ── Shared small components ── */

function TabBar({ tabs, active, onChange, badges }) {
 return (
 <div className="pp-tab-bar">
 {tabs.map(t => (
 <button type="button"
 key={t.id}
 type="button"
 className={`pp-tab ${active === t.id ? 'pp-tab--active' : ''}`}
 onClick={() => onChange(t.id)}
 >
 <span className="pp-tab-icon"><t.Icon size={16} /></span>
 <span className="pp-tab-label">{t.label}</span>
 {(badges[t.id] || 0) > 0 && <span className="pp-tab-badge">{badges[t.id]}</span>}
 </button>
 ))}
 </div>
 );
}

function TermsSection({ terms, accepted, onToggle }) {
 const [expanded, setExpanded] = useState(false);
 return (
 <div className="pq-terms">
 <button type="button" onClick={() => setExpanded(v => !v)} className="pq-terms-toggle">
 <span><FileText size={14} className="ppp-s18-e7fd" />Terms &amp; Conditions</span>
 <span className="ppp-fs-xs-3dcc">{expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
 </button>
 {expanded && (
 <div className="pq-terms-body">
 <TermsBody>{terms}</TermsBody>
 </div>
 )}
 <div className="pq-terms-accept">
 <input type="checkbox" id="terms-accept" checked={accepted} onChange={e => onToggle(e.target.checked)} className="ppp-s17-e3a3" />
 <label htmlFor="terms-accept" className="ppp-fs-sm-1abf">
 I have read and agree to the terms &amp; conditions
 </label>
 </div>
 </div>
 );
}

function OptionalItemRow({ item, selected, onToggle, currency }) {
 const price = Number(item.quantity || 1) * Number(item.unit_price || 0);
 return (
 <div className={`pq-optional-item ${selected ? 'pq-optional-item--on' : ''}`}>
 <div className="ppp-s16-0ff6">
 <button type="button" onClick={() => onToggle(item.id)} className={`pq-toggle ${selected ? 'pq-toggle--on' : ''}`} aria-label={selected ? 'Remove this add-on' : 'Add this add-on'}>
 <span className="pq-toggle-knob" />
 </button>
 </div>
 <div className="ppp-s15-d14f">
 <div className="doc-item-name" style={{ color: selected ? 'var(--doc-text)' : 'var(--doc-muted)' }}>{item.name}</div>
 {item.notes && <div className="doc-item-note">{item.notes}</div>}
 {Number(item.quantity) > 1 && <div className="doc-item-qty">{item.quantity} × {currency(item.unit_price)}</div>}
 </div>
 <div className="ppp-ta-right_fs-md-9877">
 {selected ? <span className="ppp-s14-93d0">+{currency(price)}</span> : <span className="ppp-s13-a3c9">{currency(price)}</span>}
 </div>
 </div>
 );
}

function ActionSheet({ type, onSubmit, onClose, sending }) {
 const [text, setText] = useState('');
 const [kbOpen, setKbOpen] = useState(false);
 const taRef = useRef(null);
 const config = {
 question: { title: 'Ask a question', placeholder: 'What would you like to know about this quote?', button: 'Send question', Icon: MessageSquare },
 changes: { title: 'Request changes', placeholder: 'What should be different? (scope, pricing, timeline…)', button: 'Send request', Icon: Pencil },
 decline: { title: 'Decline this quote', placeholder: 'Reason (optional — helps your contractor improve)', button: 'Confirm decline', icon: '✕' },
 };
 const c = config[type] || config.question;
 const required = type !== 'decline';

 useEffect(() => { const t = setTimeout(() => taRef.current?.focus(), 350); return () => clearTimeout(t); }, []);
 useEffect(() => { const vv = window.visualViewport; if (!vv) return; function onResize() { setKbOpen(vv.height < window.innerHeight * 0.75); } vv.addEventListener('resize', onResize); return () => vv.removeEventListener('resize', onResize); }, []);

 return (
 <div className={`pq-sheet-overlay${kbOpen ? ' keyboard-open' : ''}`} onClick={onClose}>
 <div className="pq-sheet" onClick={e => e.stopPropagation()}>
 <div className="pq-sheet-handle" />
 <div className="pq-sheet-header">
 <span className="ppp-fs-2xl-aa4e">{c.icon}</span>
 <h3 className="ppp-fs-xl-e524">{c.title}</h3>
 </div>
 <textarea ref={taRef} className="pq-sheet-textarea" value={text} onChange={e => setText(e.target.vadoc-cta-secondary ppp-s12-128d={c.placeholder} rows={4} />
 <div className="pq-sheet-footer">
 <button type="button" className="doc-cta-secondary" onClick={onClose} >Cancel</button>
 <button type="button" className={`doc-cta-primary ${type === 'decline' ? 'pq-btn-danger' : ''}`} className="ppp-s11-f72f"
 disabled={sending || (required && !text.trim())} onClick={() => onSubmit(text.trim())}>
 {sending ? 'Sending…' : c.button}
 </button>
 </div>
 </div>
 </div>
 );
}


/* ═══════════════════════════════════════════════════════════════════════════
 QUOTE TAB — thin wrapper; all logic lives in PublicQuoteView (UX-044)
 ═══════════════════════════════════════════════════════════════════════════ */
function QuoteTab({ quote, shareToken, isPreview, onQuoteUpdate, onSwitchTab }) {
 return (
 <PublicQuoteView
 quote={quote}
 shareToken={shareToken}
 isPreview={isPreview}
 onQuoteUpdate={onQuoteUpdate}
 onSwitchTab={onSwitchTab}
 mode="portal-tab"
 />
 );
}

/* ═══════════════════════════════════════════════════════════════════════════
 UPDATES TAB — Amendments + Additional Work
 ═══════════════════════════════════════════════════════════════════════════ */
function UpdatesTab({ quote, amendments, additionalWork, currency, shareToken, onAction: onBadgeAction }) {
 const [amendmentStates, setAmendmentStates] = useState({});
 const [awStates, setAwStates] = useState({});
 const [sending, setSending] = useState(false);
 const [error, setError] = useState('');

 const hasAny = amendments.length > 0 || additionalWork.length > 0;
 if (!hasAny) return (
 <div className="ppp-ta-center-ab99">
 <div className="ppp-s5-2d19"><FileText size={32} /></div>
 <div className="ppp-fs-md-5230">Nothing’s changed — yet</div>
 <div className="ppp-fs-sm-4b55">Scope changes and extra work show up here when they come in.</div>
 </div>
 );

 // All updates chronologically
 const updates = [
 ...amendments.map(a => ({ ...a, _type: 'amendment', _date: a.created_at })),
 ...additionalWork.map(a => ({ ...a, _type: 'additional_work', _date: a.created_at })),
 ].sort((a, b) => new Date(a._date) - new Date(b._date));

 async function handleAmendmentAction(amendment, action, sigData) {
 setSending(true); setError('');
 try {
 const body = { token: amendment.share_token, action, ...(sigData || {}) };
 const r = await fetch('/api/public-amendment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
 const data = await r.json();
 if (!r.ok) throw new Error(data.error || 'Failed');
 setAmendmentStates(prev => ({ ...prev, [amendment.id]: { status: data.status, actionDone: action === 'approve' ? 'approved' : 'declined' } }));
 if (onBadgeAction) onBadgeAction();
 } catch (e) { setError(friendly(e)); } finally { setSending(false); }
 }

 async function handleAwAction(aw, action, feedback) {
 setSending(true); setError('');
 try {
 const body = { token: aw.share_token, action, ...(feedback ? { feedback } : {}) };
 const r = await fetch('/api/public-additional-work', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
 const data = await r.json();
 if (!r.ok) throw new Error(data.error || 'Failed');
 setAwStates(prev => ({ ...prev, [aw.id]: { status: data.status, actionDone: action } }));
 if (onBadgeAction) onBadgeAction();
 } catch (e) { setError(friendly(e)); } finally { setSending(false); }
 }

 return (
 <div className="ppp-s10-bb52">
 {error && <div className="ppp-fs-sm-57af">{error}</div>}
 {updates.map(item => item._type === 'amendment'
 ? <AmendmentCard key={`a-${item.id}`} amendment={item} quote={quote} currency={currency}
 state={amendmentStates[item.id]} onAction={handleAmendmentAction} sending={sending} />
 : <AdditionalWorkCard key={`aw-${item.id}`} aw={item} currency={currency}
 state={awStates[item.id]} onAction={handleAwAction} sending={sending} />
 )}
 </div>
 );
}



/* ═══════════════════════════════════════════════════════════════════════════
 PAYMENTS TAB — Deposits + Invoices
 ═══════════════════════════════════════════════════════════════════════════ */
function PaymentsTab({ quote, invoices, currency }) {
 const [searchParams] = useSearchParams();
 const [payLoading, setPayLoading] = useState(null);
 const [error, setError] = useState('');
 const paymentSuccess = searchParams.get('payment') === 'success';

 const hasDeposit = quote.deposit_required && Number(quote.deposit_amount) > 0;
 const depositPaid = quote.deposit_status === 'paid';
 const hasAny = hasDeposit || invoices.length > 0;

 if (!hasAny) return (
 <div className="ppp-ta-center-ab99">
 <div className="ppp-s5-2d19"><CreditCard size={32} /></div>
 <div className="ppp-fs-md-5230">No payments yet</div>
 <div className="ppp-fs-sm-4b55">Deposit status and invoices will appear here once the project progresses.</div>
 </div>
 );

 async function handleInvoicePay(invoice) {
 setPayLoading(invoice.id); setError('');
 try {
 const r = await fetch('/api/create-payment-session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ type: 'invoice', invoiceId: invoice.id, shareToken: invoice.share_token }) });
 const data = await r.json();
 if (data.url) window.location.href = data.url;
 else setError('Couldn\u2019t start payment. Try again, or contact your contractor.');
 } catch { setError('Couldn\u2019t reach the payment processor. Try again in a moment.'); }
 finally { setPayLoading(null); }
 }

 return (
 <div className="ppp-s10-bb52">
 {error && <div className="ppp-fs-sm-57af"text-smdoc-status-icon ppp-inline-flex-0510div>}
 {paymentSuccess && (
 <div className="doc-status doc-status--approved" >
 <span className="doc-status-icon" ><Check size={14} /></span>
 <div><strong className="ppp-block-b73a">Payment received</strong><span className="ppp-fs-sm-bc08">Your payment is being processed. This page will update once confirmed.</span></div>
 </div>
 )}

 {/* Deposit status */}
 {hasDeposit && (
 <div className="pp-update-card">
 <div className="pp-update-header">
 <span className="pp-update-type" style={{ background: depositPaid ? 'var(--doc-green-soft)' : 'var(--amber-bg, #fef3c7)', color: depositPaid ? 'var(--doc-green)' : 'var(--amber-text)' }}>
 Deposit
 </span>
 <span className={`pp-update-status pp-update-status--${depositPaid ? 'approved' : 'pending'}`}>
 {depositPaid ? '✓ Paid' : 'Required'}
 </span>
 </div>
 <div className="ppp-flex-aa26">
 <span className="ppp-fs-md-0e73">{currency(quote.deposit_amount)}</span>
 {depositPaid && <span className="ppp-fs-xs-b5ea">✓ Payment received</span>}
 </div>
 </div>
 )}

 {/* Invoices */}
 {invoices.map(inv => <InvoiceCard key={inv.id} invoice={inv} currency={currency} onPay={handleInvoicePay} payLoading={payLoading === inv.id} />)}
 </div>
 );
}

function InvoiceCard({ invoice, currency, onPay, payLoading }) {
 const isPaid = invoice.status === 'paid';
 const isOverdue = invoice.due_at && new Date(invoice.due_at) < new Date() && !isPaid;
 const depositCredited = Number(invoice.deposit_credited || 0);
 const payments = invoice.payments || [];
 const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
 const balance = Math.max(0, Number(invoice.total || 0) - depositCredited - totalPaid);

 return (
 <div className="pp-update-card">
 <div className="pp-update-header">
 <div className="ppp-flex-a37f">
 <span className="pp-update-type" style={{ background: isPaid ? 'var(--doc-green-soft)' : isOverdue ? 'var(--doc-red-soft)' : 'var(--doc-accent-soft)', color: isPaid ? 'var(--doc-green)' : isOverdue ? 'var(--doc-red)' : 'var(--doc-accent)' }}>
 Invoice {invoice.invoice_number}
 </span>
 <span className={`pp-update-status pp-update-status--${isPaid ? 'approved' : isOverdue ? 'declined' : 'pending'}`}>
 {isPaid ? '✓ Paid' : isOverdue ? 'Overdue' : 'Due'}
 </span>
 </div>
 <div className="pp-update-date">{formatDate(invoice.issued_at)}</div>
 </div>

 <div className="ppp-fs-md-ba9d">{invoice.title}</div>
 {invoice.description && <p className="ppp-fs-sm-7d79">{invoice.description}</p>}

 {/* Items */}
 {(invoice.invoice_items || []).map(item => (
 <div key={item.id} className="doc-item">
 <div className="doc-item-left">
 <div className="doc-item-name">{item.name}</div>
 {Number(item.quantity) > 1 && <div className="doc-item-qty">{item.quantity} × {currency(item.unit_price)}</div>}
 </div>
 <div className="doc-item-right">{currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}</div>
 </div>
 ))}

 {/* Totals */}
 <div className="ppp-s8-bbed">
 <div className="ppp-flex_fs-sm-6468">
 <span>Subtotal</span><span>{currency(invoice.subtotal)}</span>
 </div>
 {Number(invoice.tax) > 0 && (
 <div className="ppp-flex_fs-sm-6468">
 <span>Tax</span><span>{currency(invoice.tax)}</span>
 </div>
 )}
 {depositCredited > 0 && (
 <div className="ppp-flex_fs-sm-e859">
 <span>Deposit credited</span><span>−{currency(depositCredited)}</span>
 </div>
 )}
 <div className="ppp-flex_fs-md-a69b">
 <span>{isPaid ? 'Total' : 'Balance due'}</span>
 <span style={{ color: isPaid ? 'var(--doc-green)' : isOverdue ? 'var(--doc-red)' : 'var(--doc-text)' }}>{currency(isPaid ? invoice.total : balance)}</span>
 </div>
 </div>

 {/* Payment history */}
 {payments.length > 0 && (
 <div className="ppp-s7-e058">
 <div className="ppp-fs-2xs-3421">Payment history</div>
 {payments.map(p => (
 <div key={p.id} className="ppp-flex_fs-xs-40ac">
 <span><strong className="ppp-s6-7649">{currency(p.amount)}</strong> {p.method && `via ${p.method}`}</span>
 <span>{formatDate(p.paid_at)}</span>
 </div>
 ))}
 </div>
 )}

 {isPaid && (
 <div className="ppp-ta-center_fs-base-84f3">
 ✓ PAID {invoice.paid_at ? `· ${formatDate(invoice.paid_at)}` : ''}
 </div>
 )}

 {/* Pay button */}
 {!isPadoc-cta-primary ppp-ta-center-8da2 0 && invoice.stripe_connect_enabled && (
 <button type="button" className="doc-cta-primary" onClick={() => onPay(invoice)} disabled={payLoading} >
 {payLoading ? 'Loading…' : `Pay ${currency(balance)} →`}
 </button>
 )}
 {!isPaid && balance > 0 && !invoice.stripe_connect_enabled && invoice.contractor_stripe_linkdoc-cta-primary ppp-block_ta-center-980ca href={invoice.contractor_stripe_link} target="_blank" rel="noreferrer" className="doc-cta-primary" >
 doc-cta-secondary ppp-ta-center-4a0dncy(balance)} Online →
 </a>
 )}

 {/* PDF download */}
 {invoice.share_token && (
 <button className="doc-cta-secondary" type="button" 
 onClick={() => { window.location.href = `/api/export-pdf?invoice_token=${invoice.share_token}`; }}>
 Download Invoice PDF
 </button>
 )}
 </div>
 );
}


/* ═══════════════════════════════════════════════════════════════════════════
 MESSAGES TAB — Conversation Thread
 ═══════════════════════════════════════════════════════════════════════════ */
function MessagesTab({ quote, shareToken, onQuoteUpdate }) {
 const conversation = Array.isArray(quote.conversation) ? quote.conversation : [];
 const [text, setText] = useState('');
 const [sending, setSending] = useState(false);
 const [error, setError] = useState('');
 const scrollRef = useRef(null);
 const contractorName = quote.contractor_company || quote.contractor_name || 'your contractor';

 useEffect(() => {
 scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
 }, [conversation.length]);

 async function sendMessage() {
 if (!text.trim()) return;
 if (!shareToken) { setError('Cannot send — no share token'); return; }
 setSending(true); setError('');
 try {
 const r = await fetch('/api/public-quote-action', { method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ token: shareToken, action: 'question', question: text.trim() }) });
 const data = await r.json();
 if (!r.ok) throw new Error(data.error || 'Failed');
 if (data.conversation) onQuoteUpdate(prev => ({ ...prev, conversation: data.conversation }));
 setText('');
 } catch (e) { setError(friendly(e)); } finally { setSending(false); }
 }

 return (
 <div className="ppp-flex-ca96">
 {conversation.length === 0 ? (
 <div className="ppp-ta-center-b920">
 <div className="ppp-s5-2d19"><MessageSquare size={32} /></div>
 <div className="ppp-fs-md-5230">No messages yet</div>
 <div className="ppp-fs-sm-4b55">Send a message to {contractorName} about this project.</div>
 </div>
 ) : (
 <div ref={scrollRef} className="ppp-s4-8f21">
 {conversation.map(entry => (
 <div key={entry.id} className={`pq-msg ${entry.role === 'contractor' ? 'pq-msg--right' : ''}`}>
 <div className={`pq-msg-avatar ${entry.role === 'contractor' ? 'pq-msg-avatar--contractor' : ''}`}>
 {null /* replaced by ConvAvatar */}
 </div>
 <div className="ppp-s3-db40">
 <div className="pq-msg-meta" style={{ textAlign: entry.role === 'contractor' ? 'right' : 'left' }}>
 <strong>{entry.name || (entry.role === 'customer' ? 'You' : contractorName)}</strong>
 {' · '}{new Date(entry.timestamp).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
 </div>
 <div className={`pq-msg-bubble ${entry.role === 'contractor' ? 'pq-msg-bubble--contractor' : ''}`}>
 {entry.text}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Compose */}
 <div className="ppp-s2-0e21">
 {error && <div className="ppp-fs-xs-9db8">{error}</div>}
 <div className="ppp-flex-84cf">
 <input
 type="text"
 value={text}
 onChange={e => setText(e.target.value)}
 onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
 placeholder={`Message ${contractorName}…`}
 className="ppp-fs-base-f5f8"ard-bg, #fff)' }}
 />
 <button type="button" className="doc-cta-primary" onClick={sendMessage} disabled={sending || !text.trim()} >
 {sending ? '…' : 'Send'}
 </button>
 </div>
 </div>
 </div>
 );
}


/* ═══════════════════════════════════════════════════════════════════════════
 MAIN PORTAL COMPONENT
 ═══════════════════════════════════════════════════════════════════════════ */
export default function ProjectPortalPage() {
 const { shareToken } = useParams();
 const [searchParams] = useSearchParams();
 const isPreview = searchParams.get('preview') === '1';

 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [project, setProject] = useState(null);
 const [activeTab, setActiveTab] = useState('quote');

 const currency = (n) => formatCurrency(n, project?.quote?.country);

 useEffect(() => {
 fetch(`/api/project-data?token=${shareToken}`)
 .then(async r => {
 const text = await r.text();
 let j; try { j = JSON.parse(text); } catch { throw new Error('Server error'); }
 if (!r.ok) throw new Error(j.error || 'Project not found');
 return j;
 })
 .then(data => {
 setProject(data);
 // Track view (same dedup as old page)
 if (!isPreview) {
 const viewKey = `pl_viewed_${shareToken}`;
 if (!sessionStorage.getItem(viewKey)) {
 fetch('/api/public-quote-action', { method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ token: shareToken, action: 'view' }) }).catch(e => console.warn('[PL]', e));
 try { sessionStorage.setItem(viewKey, '1'); } catch (e) { console.warn("[PL]", e); }
 }
 }
 // Auto-navigate to tab based on URL params
 if (searchParams.get('tab')) setActiveTab(searchParams.get('tab'));
 else if (searchParams.get('deposit') === 'success') setActiveTab('quote');
 else if (searchParams.get('payment') === 'success') setActiveTab('payments');
 // Print support (carried from old public-quote-page)
 if (searchParams.get('print') === '1') setTimeout(() => window.print(), 600);
 })
 .catch(e => setError(e.message || 'Could not load project'))
 .finally(() => setLoading(false));
 }, [shareToken]);

 useEffect(() => {
 if (!project?.quote) return;
 const q = project.quote;
 const contractor = q.contractor_company || q.contractor_name || 'Punchlist';
 document.title = `${q.title || 'Project'} — ${contractor}`;
 return () => { document.title = 'Punchlist'; };
 }, [project?.quote?.id]);

 function updateQuote(updater) {
 setProject(prev => ({ ...prev, quote: typeof updater === 'function' ? updater(prev.quote) : updater }));
 }

 function decrementBadge(key, amount = 1) {
 setProject(prev => ({
 ...prev,
 badges: { ...prev.badges, [key]: Math.max(0, (prev.badges[key] || 0) - amount) },
 }));
 }

 if (loading) return <PublicLoadingState label="Loading your project…" />;

 if (error && !project) return (
 <PublicErrorState
 docType="project"
 contractorName={null}
 onRetry={() => window.location.reload()}
 />
 );

 if (!project) return null;

 const { quote, amendments = [], additional_work = [], invoices = [], badges = {} } = project;
 const contractorDisplayName = quote.contractor_company || quote.contractor_name || 'your contractor';

 // Only show tabs that have content (quote always shows)
 const hasUpdates = amendments.length > 0 || additional_work.length > 0;
 const hasPayments = (quote.deposit_required && Number(quote.deposit_amount) > 0) || invoices.length > 0;
 const hasMessages = (Array.isArray(quote.conversation) && quote.conversation.length > 0) || ['sent', 'viewed', 'approved', 'approved_pending_deposit', 'scheduled'].includes(quote.status);

 const tabs = [
 { id: 'quote', label: 'Quote', Icon: FileText },
 ...(hasUpdates ? [{ id: 'updates', label: 'Updates', Icon: FileEdit }] : []),
 ...(hasPayments ? [{ id: 'payments', label: 'Payments', Icon: CreditCard }] : []),
 ...(hasMessages ? [{ id: 'messages', label: 'Messages', Icon: MessageSquare }] : []),
 ];

 // Guard: if activeTab points to a tab that doesn't exist (e.g. ?tab=payments but no invoices), fall back
 const resolvedTab = tabs.some(t => t.id === activeTab) ? activeTab : 'quote';

 return (
 <PublicPageShell contractorName={contractorDisplayName} logoUrl={quote.contractor_logo}>
 <div className="doc-shell">
 <div className="doc-container">
 <div className="doc-card pp-portal-card">

 {/* Header */}
 <div className="doc-header">
 <div className="doc-brand">
 {quote.contractor_logo && <img src={quote.contractor_logo} alt="" className="doc-logo" />}
 <div className="doc-company">{contractorDisplayName}</div>
 {quote.contractor_name && quote.contractor_name !== quote.contractor_company && <div className="doc-contractor-name">{quote.contractor_name}</div>}
 <div className="doc-contact">
 {quote.contractor_phone && <a href={`tel:${quote.contractor_phone}`}>{quote.contractor_phone}</a>}
 {quote.contractor_email && <a href={`mailto:${quote.contractor_email}`}>{quote.contractor_email}</a>}
 </div>
 </div>
 <div className="doc-meta">
 <div className="doc-type">Project{quote.quote_number ? ` ${formatQuoteNumber(quote.quote_number)}` : ''}</div>
 <div className="doc-date">{formatDate(quote.created_at)}</div>
 </div>
 </div>

 {/* Tab bar */}
 {tabs.length > 1 && (
 <TabBar tabs={tabs} active={resolvedTab} onChange={setActiveTab} badges={badges} />
 )}

 {/* Tab content */}
 {resolvedTab === 'quote' && (
 <QuoteTab quote={quote} shareToken={shareToken} isPreview={isPreview} currency={currency} onQuoteUpdate={updateQuote} onSwitchTab={setActiveTab} />
 )}
 {resolvedTab === 'updates' && (
 <UpdatesTab quote={quote} amendments={amendments} additionalWork={additional_work} currency={currency} shareToken={shareToken} onAction={() => decrementBadge('updates')} />
 )}
 {resolvedTab === 'payments' && (
 <PaymentsTab quote={quote} invoices={invoices} currency={currency} />
 )}
 {resolvedTab === 'messages' && (
 <MessagesTab quote={quote} shareToken={shareToken} onQuoteUpdate={updateQuote} />
 )}

 {/* Footer */}
 <div className="doc-footer">
 <div>
 <div className="ppp-s1-6e08">{contractorDisplayName}</div>
 {quote.contractor_phone && <div className="ppp-s0-816b">{quote.contractor_phone}</div>}
 {quote.contractor_email && <div className="ppp-s0-816b">{quote.contractor_email}</div>}
 </div>
 <div className="doc-footer-actions">
 <button type="button" className="doc-footer-link" onClick={() => {
 const url = `/api/export-pdf?token=${quote.share_token || shareToken}`;
 const a = document.createElement('a'); a.href = url;
 a.download = `${(quote?.title || 'project').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
 document.body.appendChild(a); a.click(); document.body.removeChild(a);
 }}>Download PDF</button>
 <button type="button" className="doc-footer-link" onClick={() => window.print()}>Print</button>
 </div>
 </div>
 </div>
 </div>
 </div>
 </PublicPageShell>
 );
}
