# Phase 3.5 Slice 6 — M8 Keyboard-Safe Send Button

**Status:** Shipped (code). Real-device verification pending.
**Plan ref:** PHASE3-5-PLAN.md §2.13
**Files changed:**
- `src/styles/index.css` — `.rq-footer` padding includes `env(keyboard-inset-height, 0px)`

See `PHASE3-5-AUDIT-SLICE-6.md` for the plan deviation on which file was edited.

---

## Problem

On iOS Safari and Chrome Android, when a user focuses an input in the quote
builder, the on-screen keyboard appears. The fixed-position `.rq-footer`
(containing the Send button) stays anchored to the layout viewport, so the
keyboard covers it. Users have to dismiss the keyboard to tap Send, which
is friction-heavy on the primary action.

## Fix

iOS Safari 15+ and modern Chromium expose
[`env(keyboard-inset-height)`](https://developer.mozilla.org/en-US/docs/Web/CSS/env),
which is the height of the software keyboard when visible, and 0 otherwise.
Adding it to `padding-bottom` lifts the Send button above the keyboard by
the exact keyboard height, automatically.

**Before (`src/styles/index.css` ~L3005):**

```css
/* Footer */
.rq-footer{position:fixed;bottom:0;left:0;right:0;z-index:50; /* … */
  padding:12px 20px env(safe-area-inset-bottom,0); /* … */ }

/* … */

@media(max-width:768px){
  .rq-footer{bottom:62px; padding:10px 68px calc(env(safe-area-inset-bottom,0px) + 4px) 16px}
  /* … */
}
```

**After:**

```css
/* Footer */
/* M8: keyboard-safe. iOS 15+ exposes env(keyboard-inset-height) which is the
   height of the software keyboard when visible, 0 otherwise. Adding it to
   the padding-bottom lifts the Send button above the keyboard instead of
   being covered by it. Graceful fallback on browsers that don't know the
   token (they treat it as 0px). */
.rq-footer{position:fixed;bottom:0;left:0;right:0;z-index:50; /* … */
  padding:12px 20px calc(env(safe-area-inset-bottom,0px) + env(keyboard-inset-height,0px)); /* … */ }

/* … */

@media(max-width:768px){
  .rq-footer{bottom:62px; padding:10px 68px calc(env(safe-area-inset-bottom,0px) + env(keyboard-inset-height,0px) + 4px) 16px}
  /* … */
}
```

## Browser support

| Browser | `env(keyboard-inset-height)` | Fallback |
|---------|------------------------------|----------|
| iOS Safari 15+ | ✅ | — |
| iOS Safari <15 | ❌ | treats as `0px`, footer behaves as before (keyboard still covers) |
| Chrome Android (recent) | ✅ | — |
| Chrome Android (older) | ❌ | treats as `0px`, unchanged behavior |
| Desktop browsers | irrelevant (no OS keyboard) | `0px` |

The fallback is safe: unsupported browsers treat unknown `env()` values as
0, so they render identically to before the change.

## Testing

Needs a real device or emulator.

1. **iOS Safari, iPhone SE.** Open builder. Tap the description textarea. Keyboard appears. Send button should remain visible above the keyboard.
2. **iOS Safari, any model with home indicator.** Same test — `safe-area-inset-bottom` and `keyboard-inset-height` should sum correctly.
3. **Chrome Android.** Same test. On devices/versions that don't support the token, footer will still be covered (pre-existing behavior, acceptable fallback).
4. **Desktop browsers.** No change expected.
5. **Landscape orientation, iOS.** Keyboard takes most of the viewport. Send button should still be above it.

Record results in `PHASE3-5-TIMING.md` (which also covers the broader timing validation pass).

## Revert

```
git checkout HEAD -- src/styles/index.css
```

Or revert the two `padding` expressions back to the pre-change form:
- Base rule: `padding:12px 20px env(safe-area-inset-bottom,0)`
- Mobile override: `padding:10px 68px calc(env(safe-area-inset-bottom,0px) + 4px) 16px`
