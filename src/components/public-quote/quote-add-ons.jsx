import { usePublicQuote } from './public-quote-context';

/* ═══════════════════════════════════════════════════════════
   QuoteAddOns — Optional items with toggles.

   Phase 5 change: separated from required items. Appears
   BELOW the totals section so the customer's first impression
   is the clean total. Add-ons feel like bonus options, not
   required decisions.
   ═══════════════════════════════════════════════════════════ */

function OptionalItemRow({ item, selected, onToggle, currency }) {
  const price = Number(item.quantity || 1) * Number(item.unit_price || 0);
  return (
    <div className={`pq-optional-item pl-opt-row ${selected ? 'pq-optional-item--on' : ''}`}>
      <div className="pqv-toggle-cell">
        <button type="button" onClick={() => onToggle(item.id)}
          className={`pq-toggle ${selected ? 'pq-toggle--on' : ''}`}
          aria-label={selected ? 'Remove this add-on' : 'Add this add-on'}>
          <span className="pq-toggle-knob" />
        </button>
      </div>
      <div className="pqv-item-body">
        <div className={`doc-item-name ${selected ? 'pqv-item-name--on' : 'pqv-item-name--off'}`}>{item.name}</div>
        {item.notes && <div className="doc-item-note">{item.notes}</div>}
        {Number(item.quantity) > 1 && <div className="doc-item-qty">{item.quantity} × {currency(item.unit_price)}</div>}
      </div>
      <div className="pqv-price-cell">
        {selected ? <span className="pqv-price--on">+{currency(price)}</span> : <span className="pqv-price--off">{currency(price)}</span>}
      </div>
    </div>
  );
}

export default function QuoteAddOns() {
  const { optionalItems, selectedOptionals, toggleOptional, currency, selectedOptionalsTotal } = usePublicQuote();

  if (!optionalItems || optionalItems.length === 0) return null;

  return (
    <div className="doc-items pqv-addons-section">
      <div className="doc-group-header">
        <span className="doc-group-label">Optional Add-ons</span>
      </div>
      {optionalItems.map(item => (
        <OptionalItemRow
          key={item.id}
          item={item}
          selected={selectedOptionals.has(item.id)}
          onToggle={toggleOptional}
          currency={currency}
        />
      ))}
      {selectedOptionalsTotal > 0 && (
        <div className="doc-total-row pqv-addons-total">
          <span>Selected add-ons</span>
          <strong className="tabular">+{currency(selectedOptionalsTotal)}</strong>
        </div>
      )}
    </div>
  );
}
