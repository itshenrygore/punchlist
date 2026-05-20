/* Foreman identity glyph — hard-hat icon.
 *
 * Replaces the plain "F" text that used to live in the panel header,
 * message avatars, empty-state badge, and trigger FAB. The shape is a
 * stylised construction helmet; we keep it monochrome and inherit
 * `currentColor` so the same component can render on a brand-orange
 * surface (avatars) or as an inverted glyph on the trigger.
 *
 * size: pixel dimension (square)
 * stroke: when true, outline-style glyph (used inside light bubbles);
 *         when false, the badge fills with currentColor (used on the
 *         filled brand FAB).
 */
export default function ForemanLogo({ size = 16, stroke = true, className = '' }) {
  const s = Number(size);
  if (stroke) {
    return (
      <svg
        className={className}
        width={s} height={s} viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true" focusable="false"
      >
        {/* Brim */}
        <path d="M3 17h18" />
        {/* Helmet dome */}
        <path d="M5 17a7 7 0 0 1 14 0" />
        {/* Centre rib */}
        <path d="M12 5v5" />
        {/* Side vents */}
        <path d="M8.5 11.5l-.5 4" />
        <path d="M15.5 11.5l.5 4" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      width={s} height={s} viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true" focusable="false"
    >
      <path d="M2.5 17.25a1 1 0 0 1 1-1H4a8 8 0 0 1 4-6.92V6a1 1 0 0 1 2 0v2.55c.65-.18 1.32-.3 2-.34v-1.7a1 1 0 0 1 .94-1l.06-.01a1 1 0 0 1 1 1v1.75c.69.06 1.36.2 2 .4V6a1 1 0 0 1 2 0v3.4a8 8 0 0 1 3.5 6.85h.5a1 1 0 1 1 0 2H3.5a1 1 0 0 1-1-1z" />
    </svg>
  );
}
