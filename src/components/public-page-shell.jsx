import { LogoMark } from './logo';

const BANNER_STYLES = {
  info:    { background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.25)', color: 'var(--blue-light, #60a5fa)' },
  success: { background: 'rgba(34,197,94,.12)',  border: '1px solid rgba(34,197,94,.25)',  color: 'var(--green-light, #4ade80)' },
  warning: { background: 'rgba(234,179,8,.12)',  border: '1px solid rgba(234,179,8,.25)',  color: 'var(--amber-light, #facc15)' },
  error:   { background: 'rgba(239,68,68,.12)',  border: '1px solid rgba(239,68,68,.25)',  color: 'var(--red-light, #f87171)' },
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
        <div className="public-shell-banner" style={{ ...BANNER_STYLES[statusBanner.variant || 'info'] }}>
          {statusBanner.text}
        </div>
      )}
      {children}
      {stickyCtaContent && (
        <div className="public-shell-sticky-cta">
          {stickyCtaContent}
        </div>
      )}
      <div className="public-shell-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <LogoMark size={14} />
        <span>Powered by <a href="https://punchlist.ca?ref=quote" target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Punchlist</a></span>
      </div>
    </>
  );
}
