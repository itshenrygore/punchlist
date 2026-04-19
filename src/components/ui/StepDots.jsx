/**
 * StepDots — progress indicator for multi-step flows.
 *
 * Usage:
 *   <StepDots current={1} total={4} />
 *   <StepDots current={0} total={2} variant="bar" />
 *
 * Props:
 *   current  {number} 0-based index of the active step
 *   total    {number} total number of steps
 *   variant  "dot" | "bar"  default: "dot"
 */
export default function StepDots({ current, total, variant = 'dot' }) {
  return (
    <div
      className="step-dots">
      {Array.from({ length: total }, (_, i) => {
        const isActive  = i === current;
        const isPast    = i < current;
        const isFuture  = i > current;

        if (variant === 'bar') {
          return (
            <div
              key={i}
              style={{
                width: 24,
                height: 4,
                borderRadius: 2,
                background: 'var(--brand)',
                opacity: isFuture ? 0.2 : isPast ? 0.5 : 1,
                transition: 'opacity .25s var(--ease-standard, ease)',
              }}
            />
          );
        }

        // default: dot
        return (
          <div
            key={i}
            style={{
              width: isActive ? 24 : 8,
              height: 8,
              borderRadius: 99,
              background: isActive || isPast ? 'var(--brand)' : 'var(--line, #e2e4e8)',
              opacity: isPast ? 0.4 : 1,
              transition: 'width .3s var(--ease-spring, cubic-bezier(.34,1.56,.64,1)), opacity .2s',
            }}
          />
        );
      })}
    </div>
  );
}
