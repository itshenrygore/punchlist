# Phase 3.5 Slice 10 — B5 Voice Input Improvements + AI Pre-warm

**Status:** Shipped.
**Plan ref:** PHASE3-5-PLAN.md §B5 + §2.3
**Files changed:**
- `src/pages/quote-builder-page.jsx` — voice fix, SR gate, pre-warm debounce, prewarm consumption in handleBuildScope
- `src/lib/api/checkout.js` — `requestAiScope` accepts optional `signal` param
- `api/ai-scope.js` — verified only (no change needed; see audit)
- `src/styles/index.css` — 44×44px touch target for mic button on mobile

---

## Summary

Three targeted voice improvements (not a rewrite):
1. Mic button hidden entirely on browsers without SpeechRecognition support (was: error toast).
2. `onresult` accumulation bug fixed via a `useRef` — no more duplicated transcript segments.
3. Mic button guaranteed ≥ 44×44 px touch target on mobile.

Plus AI pre-warm: the scope request fires 600ms after the user stops typing. By the time they tap "Build Quote →", the result is frequently already resolved — perceived latency drops to near-zero.

---

## Changes — `src/lib/api/checkout.js`

### Before
```js
export async function requestAiScope(payload) {
  const r = await fetch('/api/ai-scope', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'AI request failed');
  return d;
}
```

### After
```js
export async function requestAiScope(payload) {
  const { signal, ...rest } = payload;
  const r = await fetch('/api/ai-scope', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rest),
    ...(signal ? { signal } : {}),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'AI request failed');
  return d;
}
```

`signal` is destructured out of `payload` before `JSON.stringify` so it is never sent in the request body. It is passed to `fetch` options only when present.

---

## Changes — `src/pages/quote-builder-page.jsx`

### 1. SR availability constant + finalRef (new)

**Before:**
```js
const recRef = useRef(null);
const recTimeoutRef = useRef(null);
const titleSuggested = useRef(false);
```

**After:**
```js
const recRef = useRef(null);
const recTimeoutRef = useRef(null);
const finalRef = useRef(''); // accumulate SR transcript without closure-mutation bug
const titleSuggested = useRef(false);
// Check SR availability once — hide mic button instead of showing error
const SR_AVAILABLE = typeof window !== 'undefined' &&
  !!(window.SpeechRecognition || window.webkitSpeechRecognition);
```

### 2. `toggleVoice` — fix onresult accumulation bug + silent SR guard

**Before:**
```js
function toggleVoice() {
  if (listening) { … return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { setError('Voice input not supported in this browser.'); return; }
  const rec = new SR(); … setListening(true);
  let finalText = '';
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t;
      else interim = t;
    }
    setDescription(prev =>
      [prev.replace(finalText, '').trim(), finalText, interim]
        .filter(Boolean).join(' ')
    );
  };
  rec.onerror = () => { … };
  rec.onend = () => { … if (finalText.trim()) toast('Got it', 'success'); };
  rec.start();
  …
}
```

**After:**
```js
function toggleVoice() {
  if (listening) { … return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return; // button hidden when unavailable — safety guard only
  const rec = new SR(); … setListening(true);
  finalRef.current = '';
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalRef.current += e.results[i][0].transcript;
      else interim = e.results[i][0].transcript;
    }
    setDescription(finalRef.current + (interim ? ' ' + interim : ''));
  };
  rec.onerror = () => { setListening(false); recRef.current = null; };
  rec.onend = () => {
    setListening(false); recRef.current = null;
    if (finalRef.current.trim()) toast('Got it', 'success');
  };
  rec.start();
  …
}
```

Why this fixes the bug: the old handler read `finalText` from the closure, but React's batched state updates meant subsequent `onresult` firings saw a stale `prev` inside `setDescription`. The ref is mutation-safe across all firings.

### 3. Mic button gated on `SR_AVAILABLE`

**Before:**
```jsx
<div className="jd-helpers" …>
  <button className="jd-helper-btn jd-helper-voice …" …>…</button>
  <span className="pl-voice-indicator" …>…</span>
  …
</div>
```

**After:**
```jsx
<div className="jd-helpers" …>
  {SR_AVAILABLE && (
    <>
      <button className="jd-helper-btn jd-helper-voice …" …>…</button>
      <span className="pl-voice-indicator" …>…</span>
    </>
  )}
  …
</div>
```

### 4. AI pre-warm ref (new)

```js
const aiPreWarmRef = useRef({ promise: null, controller: null, forDescription: '' });
```

### 5. Pre-warm debounce effect (new)

```js
useEffect(() => {
  if (!description.trim() || description.length < 15) return;
  const timer = setTimeout(() => {
    if (
      aiPreWarmRef.current.controller &&
      aiPreWarmRef.current.forDescription !== description
    ) {
      aiPreWarmRef.current.controller.abort();
    }
    // Don't re-fire if description unchanged
    if (aiPreWarmRef.current.forDescription === description &&
        aiPreWarmRef.current.promise) return;
    const controller = new AbortController();
    aiPreWarmRef.current.controller = controller;
    aiPreWarmRef.current.forDescription = description;
    aiPreWarmRef.current.promise = requestAiScope({
      description, trade, province, country,
      estimatorRoute: 'balanced',
      signal: controller.signal,
    }).catch(err => {
      if (err.name === 'AbortError') return null;
      return null; // silently discard pre-warm errors
    });
  }, 600);
  return () => clearTimeout(timer);
}, [description, trade, province, country]);

// Cancel pre-warm on unmount
useEffect(() => () => { aiPreWarmRef.current.controller?.abort(); }, []);
```

### 6. Pre-warm consumption in `handleBuildScope`

**Before:**
```js
const r = await requestAiScope({
  description, trade, estimatorRoute: 'balanced',
  province, country, photo: photoBase64,
  wonQuotes: wonContext, labourRate,
});
```

**After:**
```js
// Use pre-warm result if available for this description
let scopePromise;
if (
  aiPreWarmRef.current.promise &&
  aiPreWarmRef.current.forDescription === description
) {
  scopePromise = aiPreWarmRef.current.promise;
} else {
  aiPreWarmRef.current.controller?.abort();
  scopePromise = requestAiScope({
    description, trade, estimatorRoute: 'balanced',
    province, country, photo: photoBase64,
    wonQuotes: wonContext, labourRate,
  });
}
// Reset prewarm state after consuming
aiPreWarmRef.current = { promise: null, controller: null, forDescription: '' };

const r = await scopePromise;
```

---

## Changes — `src/styles/index.css`

### Before
```css
@media (max-width: 768px) {
  .jd-helper-btn { min-height: 40px; padding: 8px 14px; font-size: 13px }
}
```
(existing rule — gave 40px, not the required 44px)

### After (appended new rule, higher specificity via media query)
```css
@media (max-width: 768px) {
  .jd-helper-btn {
    min-height: 44px;
    min-width: 44px;
  }
}
```

The new rule overrides the existing 40px min-height. Both rules coexist; the later one wins.

---

## `api/ai-scope.js` — no change (verified)

Vercel serverless functions do not automatically propagate client-side `AbortController` aborts to the server. When the client disconnects mid-request, the server handler continues running until it completes or times out naturally. This is expected and safe — it wastes a small amount of Anthropic API tokens on aborted pre-warm requests, but it does not throw, crash, or produce data corruption. See `PHASE3-5-AUDIT-SLICE-10.md` for the deferred risk entry.

---

## Testing guidance

### Voice (B5)

1. **Supported browser (Chrome/Safari):** Open the describe phase. Mic button is visible. Tap → browser asks for mic permission → grant → speak a sentence → transcript appears in the textarea in real time; no duplicate words after multiple `onresult` firings.
2. **Unsupported browser (Firefox):** Open the describe phase. Mic button is **not rendered** at all — no error message, no empty space where it was.
3. **Accumulation test:** In Chrome, dictate a multi-word sentence slowly. Confirm the textarea shows the transcript once, cleanly, with no duplicated segments.
4. **Touch target:** On a 375px-wide viewport in Chrome DevTools, inspect the mic button: computed `min-height` ≥ 44px, `min-width` ≥ 44px.

### AI pre-warm (§2.3)

5. Open the builder (new quote). Open DevTools → Network → filter by `/ai-scope`.
6. Type 15+ characters in the description textarea. **Stop typing.** After ~600ms, confirm a POST to `/api/ai-scope` fires automatically.
7. Edit the description (change text). Confirm the previous request shows as **cancelled** in Network, and a new one fires 600ms after the new text stabilises.
8. Type a description (15+ chars), wait for pre-warm to fire, then immediately click **"Build Quote →"**. Confirm **no second** `/api/ai-scope` request fires — the pre-warm result is reused.
9. Navigate away from the builder mid-pre-warm (before 600ms, or while a request is in flight). Confirm the request is cancelled in Network (status: cancelled).
10. Unmount test: Start a pre-warm, navigate to Dashboard before it resolves → no dangling promise warnings in the console.

---

## Revert instructions

```bash
git checkout HEAD -- src/pages/quote-builder-page.jsx \
                     src/lib/api/checkout.js \
                     src/styles/index.css
```

Surgical revert of `checkout.js`: restore the single-arg `requestAiScope(payload)` with no signal destructuring.

Surgical revert of `quote-builder-page.jsx`:
- Remove `finalRef` and `SR_AVAILABLE` declarations
- Restore original `toggleVoice` (re-add `let finalText = ''` closure pattern and `setError(…)` on SR unavailable)
- Unwrap `{SR_AVAILABLE && <> … </>}` around mic button
- Remove `aiPreWarmRef` declaration
- Remove pre-warm debounce `useEffect` and unmount cleanup `useEffect`
- Restore `const r = await requestAiScope(…)` directly in `handleBuildScope`
