/**
 * <PageHeader> — Phase 0 primitive.
 *
 * Consistent page-title / kicker / subtitle / actions row.
 * Use at the top of every page body. Renders a stable-height
 * block so no matter how long the subtitle is, the actions row
 * doesn't shift around.
 *
 *   <PageHeader
 *     kicker="Dashboard"
 *     title="Good morning, Mike"
 *     subtitle="3 quotes waiting on follow-up"
 *     actions={<button className="btn btn-primary">New quote</button>}
 *   />
 */
export default function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  align = 'start',           // 'start' | 'between'
  compact = false,           // tighter bottom margin (Phase 3)
  className = '',
  style,
}) {
  const wrap = {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: align === 'between' ? 'space-between' : 'flex-start',
    gap: 'var(--space-6)',
    flexWrap: 'wrap',
    marginBottom: compact ? 'var(--space-4)' : 'var(--space-6)',
    ...style,
  };

  const titleWrap = { minWidth: 0, flex: '1 1 auto' };

  return (
    <header className={`pl-page-header ${className}`} style={wrap}>
      <div style={titleWrap}>
        {kicker && (
          <div
            style={{
              fontSize: 'var(--text-xs)',
              letterSpacing: 'var(--tracking-loose)',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginBottom: 'var(--space-2)',
              fontWeight: 600,
            }}
          >
            {kicker}
          </div>
        )}
        {title && (
          <h1
            className="font-display"
            style={{
              margin: 0,
              fontSize: 'clamp(1.5rem, 3.2vw, 2.25rem)',
              lineHeight: 'var(--lh-tight)',
              letterSpacing: 'var(--tracking-tight)',
              fontWeight: 600,
              color: 'var(--text)',
              overflowWrap: 'anywhere',
            }}
          >
            {title}
          </h1>
        )}
        {subtitle && (
          <p
            style={{
              margin: 'var(--space-2) 0 0',
              fontSize: 'var(--text-md)',
              lineHeight: 'var(--lh-normal)',
              color: 'var(--text-2)',
              maxWidth: '60ch',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div
          className="pl-page-header__actions"
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            flex: '0 0 auto',
            flexWrap: 'wrap',
          }}
        >
          {actions}
        </div>
      )}
    </header>
  );
}
