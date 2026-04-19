import { Card, Stat } from '../../components/ui';
import { useQuoteBuilder } from './quote-builder-context';
import { actions } from './use-quote-draft';
import { currency } from '../../lib/format';
import { estimateMonthly, showFinancing } from '../../lib/financing';

/* ═══════════════════════════════════════════════════════════
 QuoteSummary — Totals card + confidence indicator.

 Sits in the right sidebar of the review phase.
 Shows subtotal, discount, tax, grand total, and monthly
 payment option. Also houses the confidence badge and
 the customer preview button.

 Phase 1 changes vs. original:
 • "How this helps you close" checklist → removed
 • "What your customer sees" label → removed (redundant)
 • Tracking teaser → moved to post-send (SentPhase)
 • Confidence score → baked into CTA color (green = ready)
 ═══════════════════════════════════════════════════════════ */

export default function QuoteSummary() {
 const { state, dispatch, ud, derived, handlers } = useQuoteBuilder();
 const {
 draft, lineItems, province, country, saving, isLocked,
 } = state;
 const {
 totals, grandTotal, selCustomer, confidence, itemCount,
 } = derived;

 return (
 <div className="rq-builder-right">
 <Card padding="default" elevation={2} className="rq-totals-card pl-totals-stable" aria-label="Quote totals">
 <div className="pl-totals-stats motion-isolate">
 <Stat label="Subtotal" value={Math.round(totals.subtotal)} prefix="$" countUp={true} align="end" />
 <div className="pl-totals-stat-row rq-discount-row">
 <span className="pl-stat-label">Discount</span>
 <div className="qb-discount-input-wrap">
 <span className="qb-discount-prefix">−$</span>
 <input
 className="rq-discount-input tabular"
 type="number"
 min="0"
 value={draft.discount || ''}
 onChange={e => ud('discount', Number(e.target.value) || 0)}
 placeholder="0"
 aria-label="Discount amount"
 />
 </div>
 </div>
 <Stat label={`Tax (${province})`} value={Math.round(Math.max(0, totals.subtotal - (draft.discount || 0)) * totals.rate)} prefix="$" countUp={true} align="end" />
 <Stat label="Total" value={Math.round(grandTotal)} prefix="$" countUp={true} align="end" tone="brand" />
 </div>

 {showFinancing(grandTotal) && (() => {
 const mo = estimateMonthly(grandTotal);
 return (
 <div className="rq-financing-card rq-financing-prominent">
 <div className="rq-monthly-label">PAYMENT OPTIONS</div>
 <div className="rq-monthly-value tabular">as low as {currency(mo, country)}<span>/mo</span></div>
 <div className="rq-monthly-hint">Shown to your customer · Final rate set by Klarna/Affirm at checkout</div>
 </div>
 );
 })()}
 </Card>

 {/* Customer preview button */}
 <button
 className="btn btn-secondary full-width rq-preview-customer-btn"
 type="button"
 disabled={saving || isLocked || itemCount === 0}
 onClick={handlers.handlePreview}
 >
 See what {selCustomer?.name?.split(' ')[0] || 'your customer'} will see
 </button>

 {/* Confidence indicator — simplified for Phase 1 */}
 {lineItems.length > 0 && confidence && (
 confidence.readiness === 'ready' ? (
 <div className="rq-conf-inlirq-conf-top qb-s0-4378n>✓</span> Ready to send</div>
 ) : (
 <details className={`rq-confidence rq-conf-${confidence.readiness}`}>
 <summary className="rq-conf-top">
 <span className="rq-conf-badge">{confidence.score}%</span>
 <span className="rq-conf-label">
 {confidence.readiness === 'review' ? 'Almost ready ▸' : 'Commonly missed items ▸'}
 </span>
 </summary>
 <div className="rq-conf-checks">
 {(confidence.checks || []).filter(c => c.state !== 'good').map((c, i) => (
 <span key={i} className={`rq-conf-check ${c.state}`}>○ {c.label}</span>
 ))}
 </div>
 </details>
 )
 )}
 </div>
 );
}
