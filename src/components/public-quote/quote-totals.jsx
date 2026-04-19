import { usePublicQuote } from './public-quote-context';
import { estimateMonthly, showFinancing } from '../../lib/financing';

/* ═══════════════════════════════════════════════════════════
   QuoteTotals — Subtotal, tax, total, monthly option.

   Phase 5 change: monthly payment sits directly below the
   total with same visual weight — not as a separate
   "financing card" that looks like an ad.
   ═══════════════════════════════════════════════════════════ */

export default function QuoteTotals() {
  const { quote, currency, adjustedTotal } = usePublicQuote();

  const subtotal = Number(quote.subtotal || 0);
  const discount = Number(quote.discount || 0);
  const tax = Number(quote.tax || 0);
  const total = adjustedTotal;
  const mo = showFinancing(total) ? estimateMonthly(total) : null;

  return (
    <div className="doc-totals">
      <div className="doc-total-row"><span>Subtotal</span><strong className="tabular">{currency(subtotal)}</strong></div>
      {discount > 0 && <div className="doc-total-row"><span>Discount</span><strong className="tabular">−{currency(discount)}</strong></div>}
      {tax > 0 && <div className="doc-total-row"><span>Tax</span><strong className="tabular">{currency(tax)}</strong></div>}
      <div className="doc-total-row doc-total-row--grand">
        <span>Total</span>
        <strong className="tabular">{currency(total)}</strong>
      </div>
      {mo && (
        <div className="doc-total-row pqv-monthly-row">
          <span>Monthly option</span>
          <span className="pqv-monthly-value tabular">from {currency(mo)}/mo</span>
        </div>
      )}
    </div>
  );
}
