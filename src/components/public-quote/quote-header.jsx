import { usePublicQuote } from './public-quote-context';
import { formatDate, formatQuoteNumber } from '../../lib/format';

export default function QuoteHeader() {
  const { quote, contractorDisplayName, isPreview, isExpired, isApproved } = usePublicQuote();

  return (
    <>
      {/* Preview banner */}
      {isPreview && (
        <div className="pq-preview-banner">
          <span className="pqv-preview-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </span>
          <div className="pqv-preview-body"><strong>Preview mode</strong> — this is what your customer will see. Actions are disabled.</div>
          <button type="button" onClick={() => window.close()} className="pqv-preview-close">✕ Close preview</button>
        </div>
      )}

      {/* Header */}
      <div className="doc-header">
        <div className="doc-brand">
          {quote.contractor_logo && <img src={quote.contractor_logo} alt="" className="doc-logo" />}
          <div className="doc-company">{contractorDisplayName}</div>
          {quote.contractor_name && quote.contractor_name !== quote.contractor_company && (
            <div className="doc-contractor-name">{quote.contractor_name}</div>
          )}
          <div className="doc-contact">
            {quote.contractor_phone && <a href={`tel:${quote.contractor_phone}`}>{quote.contractor_phone}</a>}
            {quote.contractor_email && <a href={`mailto:${quote.contractor_email}`}>{quote.contractor_email}</a>}
          </div>
        </div>
        <div className="doc-meta">
          <div className="doc-type">Proposal{quote.quote_number ? ` ${formatQuoteNumber(quote.quote_number)}` : ''}</div>
          <div className="doc-date">{formatDate(quote.created_at)}</div>
          {(quote.revision_number || 1) > 1 && <div className="doc-number">Revision {quote.revision_number}</div>}
        </div>
      </div>

      {/* Expired status */}
      {isExpired && (
        <div className="doc-status doc-status--warning">
          <span className="doc-status-icon">⏰</span>
          <span>This quote has expired. Contact {contractorDisplayName} for an updated quote.</span>
        </div>
      )}
    </>
  );
}
