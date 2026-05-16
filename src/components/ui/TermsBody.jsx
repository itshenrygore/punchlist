/**
 * TermsBody — canonical styled container for terms & conditions text.
 * Eliminates the 6+ duplicated inline-style pre blocks across public pages.
 *
 * Usage:
 *   <TermsBody id="pl-terms-text">{quote.terms_conditions}</TermsBody>
 *
 * Props:
 *   children  string  the terms text
 *   id        string  optional id for aria-describedby linkage
 *   compact   bool    tighter padding/sizing for inline contexts (default false)
 */
export default function TermsBody({ children, id, compact = false }) {
  return (
    <pre
      id={id}
      style={{
        fontFamily: 'inherit',
        fontSize: compact ? 'var(--text-xs)' : 'var(--text-sm)',
        lineHeight: compact ? 1.6 : 1.7,
        color: 'var(--doc-text-2, var(--text-2))',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        margin: compact ? '8px 0 0' : '12px 0',
        padding: compact ? '12px' : '0',
        background: compact ? 'var(--doc-line-soft, var(--panel-2))' : 'transparent',
        borderRadius: compact ? 8 : 0,
        border: 'none',
      }}
    >
      {children}
    </pre>
  );
}
