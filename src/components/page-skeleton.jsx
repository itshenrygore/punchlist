/**
 * PageSkeleton — reusable loading placeholder with layout variants.
 * Uses existing skel-card, skel-card-top, skel-line, skel-block CSS classes.
 */
export default function PageSkeleton({ variant = 'cards' }) {
 if (variant === 'list') {
 return (
 <div className="psk-flex-8e4f"', gap: 8 }}>
 {Array.from({ length: 5 }).map((_, i) => (
 <div key={i} className="skel-line" />
 ))}
 </div>
 );
 }

 if (variant === 'form') {
 return (
 <div className="psk-flex-7012", gap: 20 }}>
 {Array.from({ length: 3skel-line psk-s4-2eb7_, i) => (
 <div key={i} className="skel-block">
 <div className="skel-line" />
 <div className="skel-line" />
 </div>
 ))}
 </div>
 );
 }

 // Default: variant="cards"
 return (
 <div className="psk-flex-1adb" psk-s3-ee0d>
 {Array.from({ length: 3 }).map((_, i) => (
 <div key={iskel-line psk-s2-6fe4me="skel-card">
 <div className="skel-card-top">
 <div className=skel-line psk-s1-f12ee" />
 <div className=skel-line psk-s0-9f03e" />
 </div>
 <div className="skel-line" />
 <div className="skel-line" />
 </div>
 ))}
 </div>
 );
}
