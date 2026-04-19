import { usePublicQuote } from './public-quote-context';

/* ═══════════════════════════════════════════════════════════
   QuoteLineItems — Required items only (non-interactive).

   Phase 5 change: optional items are separated into QuoteAddOns
   below the total. The customer's first impression is the
   clean total without decision fatigue from toggles.
   ═══════════════════════════════════════════════════════════ */

export default function QuoteLineItems() {
  const { quote, currency, requiredItems, sortedGroupKeys, showGroupHeaders } = usePublicQuote();

  if (!requiredItems || requiredItems.length === 0) return null;

  return (
    <div className="doc-items">
      {sortedGroupKeys.map(group => {
        const groupItems = requiredItems.filter(i => (i.category || 'Other') === group);
        if (groupItems.length === 0) return null;
        return (
          <div key={group}>
            {showGroupHeaders && (
              <div className="doc-group-header">
                <span className="doc-group-label">{group}</span>
              </div>
            )}
            {groupItems.map(item => {
              const lineTotal = Number(item.quantity || 1) * Number(item.unit_price || 0);
              return (
                <div key={item.id} className="doc-item">
                  <div className="doc-item-main">
                    <div className="doc-item-name">{item.name}</div>
                    {item.notes && <div className="doc-item-note">{item.notes}</div>}
                    {Number(item.quantity) > 1 && (
                      <div className="doc-item-qty">{item.quantity} × {currency(item.unit_price)}</div>
                    )}
                  </div>
                  <div className="doc-item-price tabular">{currency(lineTotal)}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
