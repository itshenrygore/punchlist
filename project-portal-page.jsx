import { forwardRef } from 'react';

/**
 * <Card> — Phase 0 primitive.
 *
 * Responsibilities:
 *   • Consistent radius, padding, border, and warm-tint elevation.
 *   • Optional hover-lift + subtle brand glow (opt-in via `interactive`).
 *   • Animation isolation — any animated child reflows only within
 *     this container (`contain: layout paint`), never outward.
 *   • Stable min-height when content is dynamic (pass `minH` prop).
 *
 * Intentionally NOT themed via its own class — inherits all colour
 * tokens from the parent theme (data-theme on <html>). This keeps
 * dark-mode rugged + light-mode warm without duplicated CSS.
 */
const Card = forwardRef(function Card(
  {
    as: Tag = 'div',
    children,
    className = '',
    interactive = false,
    padding = 'default',   // 'none' | 'tight' | 'default' | 'loose'
    elevation = 1,         // 0 | 1 | 2 | 3 | 4
    minH,
    style,
    ...rest
  },
  ref
) {
  const padMap = {
    none:    '0',
    tight:   'var(--space-3)',
    default: 'var(--space-5)',
    loose:   'var(--space-8)',
  };
  const elevVar = `var(--elev-${elevation})`;

  const mergedStyle = {
    background: 'var(--panel, #fff)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-lg, 18px)',
    padding: padMap[padding] ?? padMap.default,
    boxShadow: elevVar,
    transition:
      'transform var(--dur-base) var(--ease-standard), ' +
      'box-shadow var(--dur-base) var(--ease-standard), ' +
      'border-color var(--dur-fast) var(--ease-standard)',
    position: 'relative',
    contain: 'layout paint',
    transform: 'translateZ(0)',
    minHeight: minH,
    ...style,
  };

  const classes = [
    'pl-card',
    interactive ? 'pl-card--interactive' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Tag ref={ref} className={classes} style={mergedStyle} {...rest}>
      {children}
    </Tag>
  );
});

export default Card;
