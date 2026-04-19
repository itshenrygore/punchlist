/**
 * <Badge> — Phase 2 primitive.
 *
 * Replaces the dozens of inline-styled status chips scattered
 * across quote-detail, invoices, dashboard, contacts, etc.
 *
 * Tones map to the existing Punchlist color tokens:
 *   default  → neutral gray
 *   success  → green (approved, paid, won)
 *   warning  → amber (pending, review)
 *   danger   → red (overdue, declined, lost)
 *   brand    → orange (active, featured)
 *   info     → blue (draft, scheduled)
 *
 * Usage:
 *   <Badge tone="success">Approved</Badge>
 *   <Badge tone="danger" size="sm">Overdue</Badge>
 *   <Badge dot>3 new</Badge>
 */
export default function Badge({
  children,
  tone = 'default',    // 'default' | 'success' | 'warning' | 'danger' | 'brand' | 'info'
  size = 'md',         // 'sm' | 'md' | 'lg'
  dot = false,         // show a pulsing dot before the text
  className = '',
  style,
  ...rest
}) {
  const classes = [
    'pl-badge',
    `pl-badge--${tone}`,
    size !== 'md' ? `pl-badge--${size}` : '',
    dot ? 'pl-badge--dot' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} style={style} {...rest}>
      {dot && <span className="pl-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
