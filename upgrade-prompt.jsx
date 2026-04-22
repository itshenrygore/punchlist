/**
 * <Section> — Phase 0 primitive.
 *
 * Owns vertical rhythm between page-level blocks. Use in place of
 * ad-hoc margin-top / margin-bottom. Pick one `spacing` prop and let
 * the token system handle it.
 *
 * `bleed` = remove horizontal padding to let a child render edge-to-
 * edge (e.g. a mobile list on a narrow phone). Default is `false`.
 */
export default function Section({
  children,
  as: Tag = 'section',
  spacing = 'default',    // 'none' | 'tight' | 'default' | 'loose' | 'hero'
  bleed = false,
  className = '',
  style,
  ...rest
}) {
  const gapMap = {
    none:    '0',
    tight:   'var(--space-4)',
    default: 'var(--space-8)',
    loose:   'var(--space-12)',
    hero:    'var(--space-16)',
  };

  const merged = {
    paddingBlock: gapMap[spacing] ?? gapMap.default,
    paddingInline: bleed ? 0 : 'clamp(1rem, 4vw, 1.5rem)',
    position: 'relative',
    ...style,
  };

  return (
    <Tag className={`pl-section ${className}`} style={merged} {...rest}>
      {children}
    </Tag>
  );
}
