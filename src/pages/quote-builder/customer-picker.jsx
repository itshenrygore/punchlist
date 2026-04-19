import { useQuoteBuilder } from './quote-builder-context';
import { actions } from './use-quote-draft';
import { searchCustomers } from '../../hooks/use-customers';
import { trackQuoteFlowCustomerSelected } from '../../lib/analytics';

/* ═══════════════════════════════════════════════════════════
   CustomerPicker — Search, select, or create a customer.

   Shows:
     • Selected customer row with "Change" button
     • Search input with fuzzy matching
     • Last-customer quick-chip
     • Inline new-customer form
   ═══════════════════════════════════════════════════════════ */

export default function CustomerPicker() {
  const { state, dispatch, ud, derived, handlers } = useQuoteBuilder();
  const {
    draft, customerSearch, showNewCust, newCust,
  } = state;
  const { selCustomer, allCustomers, customersLoading } = derived;

  function selectCustomer(id) {
    ud('customer_id', id);
    trackQuoteFlowCustomerSelected(id);
    dispatch(actions.setCustomerSearch(''));
  }

  return (
    <div className="rq-customer-section">
      {selCustomer ? (
        <div className="rq-cust-row">
          <div className="rq-cust-info">
            <span className="rq-cust-avatar">
              {selCustomer.name?.[0]?.toUpperCase() || '?'}
            </span>
            <div>
              <span className="rq-cust-name">{selCustomer.name}</span>
              {selCustomer.email && (
                <span className="rq-cust-detail"> · {selCustomer.email}</span>
              )}
            </div>
          </div>
          <button
            className="rq-cust-change"
            type="button"
            onClick={() => { ud('customer_id', ''); dispatch(actions.setCustomerSearch('')); }}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="rq-cust-select">
          {/* Loading skeleton */}
          {customersLoading && !allCustomers.length && (
            <div className="qb-cust-loading">Loading contacts…</div>
          )}

          {/* Last-customer quick-chip */}
          {(() => {
            const lastCustomer = allCustomers.length ? allCustomers[0] : null;
            return lastCustomer && !customerSearch ? (
              <button
                type="button"
                className="jd-cust-last-chip"
                onClick={() => selectCustomer(lastCustomer.id)}
              >
                ↩ {lastCustomer.name}
              </button>
            ) : null;
          })()}

          {/* Search input */}
          <input
            className="jd-input"
            value={customerSearch}
            onChange={e => dispatch(actions.setCustomerSearch(e.target.value))}
            placeholder="Search or add customer…"
            autoComplete="off"
          />

          {/* Search results / new customer button */}
          {customerSearch.trim() && (() => {
            const matches = searchCustomers(allCustomers, customerSearch, 6);
            return matches.length > 0 ? (
              <div className="jd-cust-list">
                {matches.map(c => (
                  <button
                    key={c.id}
                    className="jd-cust-pill"
                    type="button"
                    onClick={() => selectCustomer(c.id)}
                  >
                    <span>{c.name}</span>
                    {c.phone && (
                      <span className="qb-cust-phone">{c.phone}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <button
                className="jd-cust-pill jd-cust-new"
                type="button"
                onClick={() => {
                  dispatch(actions.setNewCust(p => ({ ...p, name: customerSearch })));
                  dispatch(actions.setShowNewCust(true));
>
                + New: "{customerSearch}"
              </button>
            );
          })()}

          {/* New customer form */}
          {showNewCust && (
            <div className="jd-new-cust">
              <input
                className="jd-input"
                value={newCust.name}
                onChange={e => dispatch(actions.setNewCust(p => ({ ...p, name: e.target.value })))}
                placeholder="Full name *"
              />
              <div className="jd-row">
                <input
                  className="jd-input"
                  value={newCust.phone}
                  onChange={e => dispatch(actions.setNewCust(p => ({ ...p, phone: e.target.value })))}
                  placeholder="Phone *"
                  type="tel"
                />
                <input
                  className="jd-input"
                  value={newCust.email}
                  onChange={e => dispatch(actions.setNewCust(p => ({ ...p, email: e.target.value })))}
                  placeholder="Email (optional)"
                />
              </div>
              <div className="qb-new-cust-actions">
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={handlers.handleQuickCreateCustomer}
                >
                  Save
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={() => dispatch(actions.setShowNewCust(false))}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
