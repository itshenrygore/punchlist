import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import PublicLoadingState from '../components/public-loading-state';
import PublicErrorState from '../components/public-error-state';
import PublicQuoteView from '../components/public-quote';

/* ═══════════════════════════════════════════════════════════════════════════
   PublicQuotePage — thin data-fetching shell.
   All view logic lives in <PublicQuoteView> (shared with project-portal).
   ═══════════════════════════════════════════════════════════════════════════ */
export default function PublicQuotePage() {
  const { shareToken } = useParams();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';

  const [quote, setQuote]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    fetch(`/api/public-quote?token=${shareToken}`)
      .then(async r => {
        const text = await r.text();
        let j; try { j = JSON.parse(text); } catch { throw new Error('Server error'); }
        if (!r.ok) throw new Error(j.error || 'Quote not found');
        return j.quote;
      })
      .then(q => {
        setQuote(q);
        if (!isPreview) {
          const viewKey = `pl_viewed_${shareToken}`;
          if (!sessionStorage.getItem(viewKey)) {
            fetch('/api/public-quote-action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: shareToken, action: 'view' }),
            }).catch(e => console.warn('[PL]', e));
            try { sessionStorage.setItem(viewKey, '1'); } catch (e) { console.warn('[PL]', e); }
          }
        }
        if (searchParams.get('print') === '1') setTimeout(() => window.print(), 600);
      })
      .catch(e => setError(e.message || 'Could not load quote'))
      .finally(() => setLoading(false));
  }, [shareToken]);

  useEffect(() => {
    if (!quote) return;
    const contractor = quote.contractor_company || quote.contractor_name || 'Punchlist';
    document.title = `${quote.title || 'Quote'} — ${contractor}`;
    return () => { document.title = 'Punchlist'; };
  }, [quote?.id, quote?.title]);

  if (loading) return (
    <PublicLoadingState
      contractorName={quote?.contractor_company || quote?.contractor_name}
      logoUrl={quote?.contractor_logo}
    />
  );

  if (error && !quote) return (
    <PublicErrorState
      contractorName={quote?.contractor_company || quote?.contractor_name}
      contractorPhone={quote?.contractor_phone}
      contractorEmail={quote?.contractor_email}
      docType="quote"
      onRetry={() => window.location.reload()}
    />
  );

  return (
    <PublicQuoteView
      quote={quote}
      shareToken={shareToken}
      isPreview={isPreview}
      onQuoteUpdate={setQuote}
      mode="standalone"
    />
  );
}
