/* ═══════════════════════════════════════════════════════════
 SwipeableRow — swipe left to reveal action (archive/delete)
 
 Usage:
 <SwipeableRow onSwipe={() => archiveItem(id)} label="Archive" color="var(--amber)">
 <YourListItemContent />
 </SwipeableRow>
 ═══════════════════════════════════════════════════════════ */

import { useRef, useState, useCallback, useEffect } from 'react';
import { haptic } from '../hooks/use-mobile-ux';

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;
const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

let peekShownThisSession = false;

export default function SwipeableRow({ children, onSwipe, label = 'Archive', color = 'var(--amber)', disabled }) {
 const rowRef = useRef(null);
 const contentRef = useRef(null);
 const startX = useRef(0);
 const currentX = useRef(0);
 const swiping = useRef(false);
 const [offset, setOffset] = useState(0);
 const [revealed, setRevealed] = useState(false);
 const triggered = useRef(false);

 // One-time peek animation to teach swipe gesture
 useEffect(() => {
 if (disabled || !IS_TOUCH || peekShownThisSession) return;
 if (sessionStorage.getItem('pl_swipe_taught')) return;
 peekShownThisSession = true;
 const timer = setTimeout(() => {
 const el = contentRef.current;
 if (!el) return;
 el.style.transition = 'transform .3s ease';
 el.style.transform = 'translateX(-24px)';
 setTimeout(() => {
 el.style.transform = 'translateX(0)';
 setTimeout(() => { el.style.transition = ''; }, 300);
 }, 400);
 try { sessionStorage.setItem('pl_swipe_taught', '1'); } catch (e) { console.warn('[PL]', e); }
 }, 1200);
 return () => clearTimeout(timer);
 }, [disabled]);

 const onTouchStart = useCallback((e) => {
 if (disabled) return;
 startX.current = e.touches[0].clientX;
 currentX.current = startX.current;
 swiping.current = true;
 triggered.current = false;
 }, [disabled]);

 const onTouchMove = useCallback((e) => {
 if (!swiping.current) return;
 currentX.current = e.touches[0].clientX;
 const dx = currentX.current - startX.current;
 // Only allow left swipe
 if (dx > 10) { swiping.current = false; setOffset(0); return; }
 if (dx < -5) {
 const clamped = Math.max(-MAX_SWIPE, dx);
 setOffset(clamped);
 if (Math.abs(clamped) >= SWIPE_THRESHOLD && !triggered.current) {
 triggered.current = true;
 haptic('selection');
 }
 }
 }, []);

 const onTouchEnd = useCallback(() => {
 swiping.current = false;
 if (Math.abs(offset) >= SWIPE_THRESHOLD) {
 setRevealed(true);
 setOffset(-SWIPE_THRESHOLD);
 } else {
 setOffset(0);
 setRevealed(false);
 }
 }, [offset]);

 const handleAction = useCallback(() => {
 haptic('medium');
 // Animate out
 if (rowRef.current) {
 rowRef.current.style.transition = 'transform .25s ease, opacity .25s ease, max-height .3s ease .05s';
 rowRef.current.style.transform = 'translateX(-100%)';
 rowRef.current.style.opacity = '0';
 rowRef.current.style.maxHeight = '0';
 rowRef.current.style.overflow = 'hidden';
 }
 setTimeout(() => onSwipe?.(), 280);
 }, [onSwipe]);

 consswipeable-row swr-s0-ed3cCallback(() => {
 setOffset(0);
 setRevealed(false);
 }, []);

 return (
 <div
 ref={rowRef}
 className="swipeable-row">
 {/* Background action */}
 <div
 className="swipeable-action"
 style={{
 position: 'absolute', top: 0, right: 0, bottom: 0,
 width: MAX_SWIPE,
 background: color,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 color: 'var(--always-white, #fff)', fontSize: 'var(--text-xs)', fontWeight: 700,
 opacity: Math.min(1, Math.abs(offset) / SWIPE_THRESHOLD),
 }}
 onClick={handleAction}
 >
 {label}
 </div>
 {/* Swipe hint — subtle edge indicator */}
 {!disabled && !revealed && offset === 0 && (
 <div className="swipeable-hint" style={{
 position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
 width: 3, height: 20, borderRadius: 2,
 background: color, opacity: 0.25, zIndex: 2,
 pointerEvents: 'none', transition: 'opacity .2s',
 }} />
 )}
 {/* Content */}
 <div
 ref={contentRef}
 className="swipeable-content"
 style={{
 transform: `translateX(${offset}px)`,
 transition: swiping.current ? 'none' : 'transform .2s ease',
 position: 'relative',
 zIndex: 1,
 background: 'var(--panel)',
 }}
 onTouchStart={onTouchStart}
 onTouchMove={onTouchMove}
 onTouchEnd={onTouchEnd}
 onClick={() => { if (revealed) reset(); }}
 >
 {children}
 </div>
 </div>
 );
}
