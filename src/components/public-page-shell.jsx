const BANNER_STYLES = {
  info:    { background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.25)', color: '#60a5fa' },
  success: { background: 'rgba(34,197,94,.12)',  border: '1px solid rgba(34,197,94,.25)',  color: '#4ade80' },
  warning: { background: 'rgba(234,179,8,.12)',  border: '1px solid rgba(234,179,8,.25)',  color: '#facc15' },
  error:   { background: 'rgba(239,68,68,.12)',  border: '1px solid rgba(239,68,68,.25)',  color: '#f87171' },
};

export default function PublicPageShell({ contractorName, logoUrl, statusBanner, stickyCtaContent, children }) {
  return (
    <>
      <div className="public-shell-header">
        <div className="public-shell-header-inner">
          {logoUrl && <img src={logoUrl} alt="" className="public-shell-logo" />}
          {contractorName && <span className="public-shell-company">{contractorName}</span>}
        </div>
      </div>
      {statusBanner && (
        <div style={{
          padding: '10px 16px', textAlign: 'center', fontSize: 14, fontWeight: 600,
          borderRadius: 0, ...BANNER_STYLES[statusBanner.variant || 'info'],
        }}>
          {statusBanner.text}
        </div>
      )}
      {children}
      {stickyCtaContent && (
        <div className="public-shell-sticky-cta" style={{
          position: 'sticky', bottom: 0, zIndex: 50, padding: '12px 16px',
          background: 'var(--panel, #1a1a1b)', borderTop: '1px solid var(--line, #333)',
        }}>
          {stickyCtaContent}
        </div>
      )}
      <div className="public-shell-footer">
        Powered by <a href="https://punchlist.ca?ref=quote" target="_blank" rel="noreferrer">Punchlist</a> — quote-to-cash for trades
      </div>
    </>
  );
}
