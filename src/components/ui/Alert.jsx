/**
 * Alert — themed inline alert banner.
 * Replaces hardcoded rgba amber/green alert banners across settings and other pages.
 *
 * Usage:
 *   <Alert variant="warn">SMS is priced separately at ~$0.01 per text.</Alert>
 *   <Alert variant="success" icon={<Check size={14} />}>Preference saved.</Alert>
 *   <Alert variant="info">Add your phone number to receive notifications.</Alert>
 *
 * Variants: "warn" | "success" | "info" | "error"
 */

const STYLES = {
  warn:    { bg: 'var(--amber-bg, rgba(245,158,11,.06))',   border: 'var(--amber-line, rgba(245,158,11,.18))', color: 'var(--amber-text, #92400e)' },
  success: { bg: 'var(--green-bg, rgba(19,138,91,.04))',    border: 'var(--green-line, rgba(19,138,91,.12))',  color: 'var(--green)'               },
  info:    { bg: 'var(--brand-bg)',                         border: 'var(--brand-line)',                       color: 'var(--text-2)'               },
  error:   { bg: 'var(--red-bg, rgba(239,68,68,.06))',      border: 'var(--red-line, rgba(239,68,68,.15))',    color: 'var(--red)'                  },
};

export default function Alert({ variant = 'info', icon, children, style }) {
  const s = STYLES[variant] || STYLES.info;
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '10px 12px',
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 'var(--r-sm, 8px)',
        fontSize: 'var(--text-sm)',
        color: s.color,
        lineHeight: 1.5,
        ...style,
}}>
      {icon && <span style={{ flexShrink: 0, display: 'inline-flex', marginTop: 1 }}>{icon}</span>}
      <span>{children}</span>
    </div>
  );
}
