import { useEffect, useRef, useState } from 'react';
import { isReducedMotion } from '../../lib/motion';

/**
 * <RevealOnView> — Phase 0 primitive.
 *
 * Fades child content up once when it enters the viewport.
 *
 * Why not framer-motion here: Phase 0 keeps zero runtime animation
 * deps. IntersectionObserver + a CSS transition is lighter on iPhone 8,
 * doesn't re-trigger on scroll-back, and can't remount-restart because
 * we only move from `hidden` → `visible`, never the other way.
 *
 * Respects prefers-reduced-motion automatically (snaps to visible).
 *
 *   <RevealOnView>
 *     <Card>…</Card>
 *   </RevealOnView>
 *
 *   <RevealOnView as="li" delay={120}>
 *     <LineItem />
 *   </RevealOnView>
 */
export default function RevealOnView({
  children,
  as: Tag = 'div',
  delay = 0,
  distance = 12,
  className = '',
  style,
  ...rest
}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(() => isReducedMotion());

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;

    // Safari/iOS 11 (iPhone 8) supports IntersectionObserver.
    if (!('IntersectionObserver' in window)) {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: '0px 0px -80px 0px', threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  const merged = {
    opacity: shown ? 1 : 0,
    transform: shown ? 'translate3d(0,0,0)' : `translate3d(0,${distance}px,0)`,
    transition:
      `opacity var(--dur-slow) var(--ease-emphasis) ${delay}ms, ` +
      `transform var(--dur-slow) var(--ease-emphasis) ${delay}ms`,
    willChange: shown ? 'auto' : 'transform, opacity',
    ...style,
  };

  return (
    <Tag ref={ref} className={className} style={merged} {...rest}>
      {children}
    </Tag>
  );
}
