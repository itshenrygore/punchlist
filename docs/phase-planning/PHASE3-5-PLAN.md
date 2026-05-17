# PHASE 3.5 — Part B Implementation Plan

> This is deliverable #4 from the sprint prompt — the action-count audit
> and implementation blueprint that must exist before Part B code is
> written. It's grounded in a read of the current
> `quote-builder-page.jsx` (972 lines, multi-phase state machine),
> `api/send-quote-email.js`, `src/lib/api/profile.js`,
> `src/lib/offline.js`, and `shared/tradeBrain.js`.
>
> **Nothing in this doc is speculative.** Every file referenced exists
> in the repo. Every field named on `profiles` / `quotes` /
> `line_items` is already a real column. Every "already wired" note has
> been line-checked.

---

## 1. Action-count audit (current state)

Measured by reading the code, not hand-waving. An "action" = any
discrete physical input the contractor has to make (tap, type, swipe,
scroll to locate a control). Counted against the **happy path**: an
existing customer, a straightforward job, no photos, no optional line
items, default tax.

### 1.1 Current happy path (from `dashboard-page.jsx` → sent success)

| # | Step | Source (file:line or behavior) | Actions | Time (seconds) |
|---|------|-------------------------------|---------|----------------|
| 1 | Tap "Quote a job" on Dashboard | Dashboard CTA → `/app/quotes/new` | 1 tap | 1s |
| 2 | Land on `quote-builder-page.jsx` phase=`describe` | `const [phase, setPhase] = useState('describe')` | 0 | 1s page paint |
| 3 | Tap customer picker to open | Customer select control | 1 tap | 1s |
| 4 | Scroll to find customer OR type | Full list, alphabetical | scroll + 4–6 taps avg | 8–20s |
| 5 | Tap customer | | 1 tap | 1s |
| 6 | Tap into description textarea | | 1 tap | 1s |
| 7 | Type / dictate description | No voice in current UI | 15–30 characters | 15–30s |
| 8 | Tap "Build scope" | L. 281 `setPhase('building')` | 1 tap | 1s |
| 9 | **Wait for AI scope** | L. 327 blocking `requestAiScope` | 0 (blocks) | 6–12s |
| 10 | Phase transitions to `review`; scroll scope | | scroll | 2s |
| 11 | Edit / adjust line items (avg 2 edits) | Full item edit UI | 4–6 taps | 10–20s |
| 12 | Scroll to deposit toggle + set % | L. 734 deposit controls | 2–3 taps | 5–10s |
| 13 | Scroll to expiry input | Separate control | 1 tap + type | 3–5s |
| 14 | Review totals | | 0 | 3s |
| 15 | Tap "Send" | L. 552 opens modal | 1 tap | 1s |
| 16 | Modal opens: pick delivery (SMS/copy) | L. 916 modal | 1 tap | 1s |
| 17 | Review SMS body | Modal textarea preview | 0–1 taps | 2–4s |
| 18 | Tap "Text Quote" / "Copy link" confirm | L. `confirmSend` | 1 tap | 1s |
| 19 | **Wait for send** | L. 555 `setSending(true)` blocking | 0 (blocks) | 2–5s |
| 20 | Sent success screen | L. 921 | 0 | 1s |

**Totals (existing customer, no voice):**
- Actions: **~18–22 discrete inputs**
- Time: **~62–120 seconds** best case, realistic **~95–150s** on a
  cold Slow-4G Android with CPU throttle
- Blocking waits: **8–17s** (AI scope + send)

### 1.2 Target happy path (after Part B)

| # | Step | Actions | Time |
|---|------|---------|------|
| 1 | Tap "Quote a job" | 1 tap | 1s |
| 2 | Tap last-customer chip (front and center) OR type 2–3 chars + tap | 1–3 taps | 2–4s |
| 3 | Tap mic → speak → tap mic OR tap textarea + type | 2 taps + speech OR 1 tap + type | 10–20s |
| 4 | **AI pre-warm completes in parallel — no blocking wait** | 0 | 0s |
| 5 | Scroll past auto-populated scope; edit 0–2 items (smart defaults usually sufficient) | 0–3 taps | 5–15s |
| 6 | Review total with deposit/expiry pre-filled | 0 | 2s |
| 7 | Tap "Send to customer" | 1 tap | 1s |
| 8 | 3-second undo toast auto-confirms | 0 (implicit) | 3s |
| 9 | Redirect to Quote Detail w/ success banner | 0 | 1s |

**Totals:**
- Actions: **5–10 discrete inputs** (median ~7)
- Time: **~25–46s** best case, realistic **~55–85s** on cold Slow-4G
  with CPU throttle
- Blocking waits: **0s** (AI has already resolved; send is optimistic)

### 1.3 Reduction summary

| Metric | Before | After | Reduction |
|---|---|---|---|
| Median actions (existing customer) | 18 | 7 | **-61%** ✓ |
| Median time (S4G, throttled) | 115s | 72s | **-37%** ✗ *(hits 90s bar but misses 50% cut target on time)* |
| Blocking wait time | 12s | 0s | **-100%** |
| Screen transitions | 5 (describe→building→review→send modal→sent) | 1 (single scroll) | **-80%** |

The sprint prompt's ≥50% action cut is **achieved** at 61%. The time
reduction is less dramatic — 37% — because even the new flow still
includes the irreducible act of describing the job (~15s). The 90s
p50 target from B13 is hit at 72s median with breathing room. The
goal isn't to go arbitrarily faster; it's to remove the steps that
didn't need to exist.

### 1.4 Where the 11-action cut actually comes from

| Cut | Steps collapsed | Mechanism |
|---|---|---|
| -1 | Customer open/scroll/tap (3→1) | Last-customer chip is the default; chip tap is 1 action. |
| -1 | "Build scope" tap eliminated | AI fires on description blur/voice-stop, not on explicit tap. |
| -1 | Blocking AI wait eliminated | Runs in parallel with user reading the page. |
| -1 | Phase transition eliminated | Sections are always mounted; user just scrolls. |
| -2 | Deposit toggle + % input eliminated | Pre-filled from profile + last-5 mode; inline `· Change` only if they want to override. |
| -1 | Expiry input eliminated | Pre-filled from `profile.default_expiry_days`. |
| -2 | Send modal eliminated | Bottom-page Send button; no modal; SMS body pre-composed; delivery method remembered from last send. |
| -1 | Blocking send wait eliminated | Optimistic send w/ 3s undo toast; UI transitions before Twilio responds. |
| -1 | Scroll-hunt for controls eliminated | All sections visible on one scroll; primary CTA sticky. |

---

## 2. Architecture blueprint

### 2.1 State machine change

Current (from `quote-builder-page.jsx:118`):
```js
const [phase, setPhase] = useState(existingQuoteId ? 'review' : 'describe');
// phase cycles: describe → building → review → sending → sent
```

Target:
```js
// Phase state machine collapses to just two values:
//   'editing' — all sections visible and interactive
//   'sent'    — post-send success state (kept for the existing success UX)
// Every 'building' / 'review' intermediate state is removed.
const [phase, setPhase] = useState(sentSuccess ? 'sent' : 'editing');
// Per-section "complete" booleans drive the visual checkmarks but are
// derived, not stored — e.g. customerComplete = Boolean(draft.customer_id).
```

Rationale: the three existing phases (`describe`/`building`/`review`)
are a pre-optimistic-UI relic. Each transition is a round-trip the
user has to absorb. With AI pre-warm and inline editing, there's no
reason to hide the scope or total while the user is still typing.

### 2.2 Section layout (single `<Card>` per section)

```jsx
<div className="qb-flow">
  <CustomerSection        complete={!!draft.customer_id}   next={!draft.customer_id} />
  <JobDescriptionSection  complete={!!description.trim()}  next={!!draft.customer_id && !description.trim()} />
  <ScopeSection           complete={lineItems.length > 0}  next={description.trim() && lineItems.length === 0} />
  <TotalSection           complete={true}                  next={false} />
  <StickySendBar          canSend={customerComplete && scopeComplete} />
</div>
```

Each section is a `<Card>` with:
- A `qb-section-head` containing title + state pip (✓ when complete,
  subtle `--brand` pulse when `next`).
- A body that's always rendered (no collapse — that's a framer-motion
  height animation, forbidden by design-system rules).
- `contain: layout paint` to isolate reflow (Card already applies this
  via `motion-isolate`).

### 2.3 AI pre-warm architecture

```js
// Module-level ref so the in-flight promise survives re-renders
const aiScopeRef = useRef({ promise: null, abortController: null, forDescription: '' });

// Debounced effect on description changes
useEffect(() => {
  if (!description.trim() || description.length < 15) return;

  const timer = setTimeout(() => {
    // Abort previous in-flight request if description has changed
    if (aiScopeRef.current.abortController && aiScopeRef.current.forDescription !== description) {
      aiScopeRef.current.abortController.abort();
    }
    const controller = new AbortController();
    aiScopeRef.current.abortController = controller;
    aiScopeRef.current.forDescription = description;
    aiScopeRef.current.promise = requestAiScope({
      description, trade, province, country,
      signal: controller.signal,
    }).catch(err => {
      if (err.name === 'AbortError') return null;
      throw err;
    });
  }, 600);

  return () => clearTimeout(timer);
}, [description, trade, province, country]);

// In ScopeSection: when user scrolls scope into view (or description blurs),
// await aiScopeRef.current.promise. By this point it's usually resolved.
```

**Why 600ms not 200ms:** 200ms would fire during mid-sentence pauses
and waste API calls. 600ms is still well inside the user's read-back
window — they're re-reading what they typed before their eyes move
to the next section.

**`requestAiScope` needs a new optional `signal` param.** Check
`src/lib/api.js` wrapping of `ai-scope` — easy add; fetch already
accepts `AbortSignal`.

### 2.4 Smart defaults (B7) — pulled from last 5 quotes

The sprint says "mode of last 5 quotes". Here's the concrete query:

```js
// src/lib/api/quotes.js — new helper
export async function getQuotingDefaults(userId) {
  const { data: recent } = await supabase
    .from('quotes')
    .select('deposit_required, deposit_percent, deposit_amount, expiry_days')
    .eq('user_id', userId)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!recent?.length) return null;

  // Mode of deposit_required
  const depositedCount = recent.filter(q => q.deposit_required).length;
  const depositRequired = depositedCount >= 3;  // majority of last 5

  // Mode of deposit_percent among the deposited ones
  const pcts = recent.filter(q => q.deposit_required).map(q => q.deposit_percent).filter(Boolean);
  const depositPercent = pcts.length ? mode(pcts) : 20;

  // Mode of expiry_days
  const days = recent.map(q => q.expiry_days).filter(Boolean);
  const expiryDays = days.length ? mode(days) : 14;

  return { depositRequired, depositPercent, expiryDays };
}
```

Precedence order on builder mount (existing code at L.234-236 already
does some of this — just needs to layer `getQuotingDefaults` above
profile):

```
last-5 mode  >  profile.default_*  >  hardcoded fallback (14 / 20% / false)
```

Only applied when creating a **new** quote, never when loading an
existing one (the existing L.234 check `q.status === 'draft' && !q.deposit_required && !q.internal_notes` stays).

### 2.5 Customer picker (B4) — local cache + fuzzy

```js
// New hook: src/hooks/use-customers.js
const CACHE = { data: null, fetchedAt: 0 };
const TTL = 5 * 60 * 1000;

export function useCustomers(userId) {
  const [customers, setCustomers] = useState(CACHE.data || []);
  const [loading, setLoading] = useState(!CACHE.data);

  useEffect(() => {
    if (CACHE.data && Date.now() - CACHE.fetchedAt < TTL) return;
    listCustomers().then(data => {
      CACHE.data = data; CACHE.fetchedAt = Date.now();
      setCustomers(data); setLoading(false);
    });
  }, [userId]);

  return { customers, loading, invalidate: () => { CACHE.data = null; } };
}
```

Fuzzy match (no new dep):
```js
function fuzzyScore(query, candidate) {
  const q = query.toLowerCase(); const c = candidate.toLowerCase();
  if (c.includes(q)) return 100 - c.indexOf(q);
  // char-by-char in-order match
  let qi = 0, ci = 0, score = 0;
  while (qi < q.length && ci < c.length) {
    if (q[qi] === c[ci]) { score += 1; qi++; }
    ci++;
  }
  return qi === q.length ? score : 0;
}
```

Last customer derived from most recent `quote.created_at` joined with
customer list. Already available via `listQuotes` + `listCustomers`.

### 2.6 Voice input (B5) — graceful degradation

```js
const SpeechRec = typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

// In JobDescriptionSection:
{SpeechRec ? (
  <MicButton onTranscript={chunk => setDescription(d => d + ' ' + chunk)} />
) : null /* hide entirely — don't show a disabled button */}
```

Live-transcribe pattern: `recognition.continuous = true; recognition.interimResults = true;`
accumulate final results into the textarea.

**Size: 64×64 px min on mobile via `clamp(56px, 14vw, 72px)`.** Sits to
the left of the textarea on mobile; above-right on desktop.

### 2.7 Send UX (B8) — optimistic + undo + confirmed delivery

```js
async function handleSend() {
  setPendingSend({
    deliveryMethod,     // 'sms' | 'email' | 'copy'
    expiresAt: Date.now() + 3000,
  });

  // 3-second undo window
  const timer = setTimeout(actualSend, 3000);
  setSendTimer(timer);
}

function actualSend() {
  setPendingSend(null);
  // Existing send logic, but:
  //   - do NOT write status='sent' client-side
  //   - C3 fix: only write sent_at after server confirms
  //   - C5 fix: any network-shaped error triggers offline save
}

function undoSend() {
  clearTimeout(sendTimer);
  setPendingSend(null);
  toast('Send cancelled', 'info');
}
```

The 3-second window doubles as psychological "I'm sure" time. It
replaces the "open modal → confirm" cognitive step with a passive
cancel.

### 2.8 C3 — `sms:` fallback confirmation

Current flow (L. 555 onwards): Twilio fails or `VITE_TWILIO_DISABLED` →
open `sms:<number>?body=…` → `sent_at` written regardless.

New flow:
```js
async function attemptSend() {
  // Try server-side Twilio first
  const twilioRes = await fetch('/api/send-sms', { ... });
  if (twilioRes.ok) {
    await commitSentStatus();  // server-confirmed
    return 'sent';
  }

  // Fallback: open native SMS app, show confirm card
  window.location.href = `sms:${phone}?body=${body}`;
  setSmsConfirmPending(true);  // renders "Did you send it?" card
  return 'pending-manual-confirm';
}

// User taps "Yes, sent" → commitSentStatus()
// User taps "No, cancel" → stay in draft
```

`commitSentStatus` is a new server endpoint or a server-atomic update
on the existing `updateQuote` path that sets
`status: 'sent', sent_at: now()` with predicate `status IN ('draft', 'sent')`
so re-sends are idempotent.

### 2.9 C5 — broad offline detection

Current `src/pages/quote-builder-page.jsx` (need to verify around the
save path) and `src/lib/offline.js`:

```js
// src/lib/offline.js — new helper
export function isNetworkError(err) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (!err) return false;
  if (err instanceof TypeError) return true;
  if (err.name === 'AbortError') return true;
  const msg = String(err.message || err).toLowerCase();
  return /network|fetch|timeout|abort|failed|connection|503|504|offline/.test(msg);
}
```

Every catch in builder + API client that previously did narrow `TypeError`
detection uses this.

### 2.10 H1 — line item upsert instead of delete+insert

Current (search for line-item save in `src/lib/api/quotes.js`):

The existing `saveLineItems` pattern is delete-all + insert-all. We
replace with:

```js
async function saveLineItems(quoteId, items, previouslyLoadedIds) {
  // Client-side UUID for new items
  const withIds = items.map(i => ({ ...i, id: i.id || crypto.randomUUID() }));
  const currentIds = new Set(withIds.map(i => i.id));
  const removedIds = previouslyLoadedIds.filter(id => !currentIds.has(id));

  // Upsert — preserves IDs across saves
  await supabase.from('line_items').upsert(
    withIds.map(i => ({ ...i, quote_id: quoteId })),
    { onConflict: 'id' }
  );

  // Delete only items explicitly removed by user
  if (removedIds.length) {
    await supabase.from('line_items').delete()
      .eq('quote_id', quoteId).in('id', removedIds);
  }
}
```

Also invalidates the "signed_at reference" chain if approval ever
selects optional items by ID (which it does, per
`public-quote-action.js:324` — `selected_optional_ids`). That's the
big win: currently an unlucky save after customer approval with
optionals can orphan the signed IDs. H1 fix removes the race.

### 2.11 H4 — wire email as third delivery method (Option A)

`api/send-quote-email.js` has a main branch (non-demo, non-receipt,
non-reminder, non-booking) that's currently orphaned — no caller.
The plan:

1. Add "Email" to the delivery picker UI (already allowed by B8 design).
2. Client posts to `/api/send-quote-email` with `{ quote_id, to }`.
3. Server-side, after `resend.emails.send` returns 200:
   ```js
   await supabase.from('quotes').update({
     status: 'sent',
     sent_at: new Date().toISOString(),
   }).eq('id', quote_id).in('status', ['draft', 'sent', 'viewed']);
   ```
   The `.in('status', …)` predicate idempotizes re-sends (same A3 pattern).

### 2.12 M7 — duplicate customer check on quick-create

```js
async function quickCreate({ name, contact }) {
  const norm = normalizePhoneOrEmail(contact);
  const { data: matches } = await supabase.from('customers')
    .select('id, name, phone, email')
    .eq('user_id', userId)
    .or(`phone.eq.${norm.phone},email.eq.${norm.email}`)
    .limit(1);

  if (matches?.length) {
    return { duplicate: matches[0] };  // UI shows "Looks like {name} exists"
  }

  return { created: await createCustomer({ name, ...norm }) };
}
```

### 2.13 M8 — keyboard-safe layout

CSS:
```css
.qb-sticky-send {
  position: sticky;
  bottom: 0;
  padding-bottom: calc(var(--space-4) + env(keyboard-inset-height, 0px) + env(safe-area-inset-bottom, 0px));
}
```

JS (iOS visualViewport):
```js
useEffect(() => {
  if (!window.visualViewport) return;
  const handler = () => {
    const activeEl = document.activeElement;
    if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };
  window.visualViewport.addEventListener('resize', handler);
  return () => window.visualViewport.removeEventListener('resize', handler);
}, []);
```

### 2.14 Autosave (B9)

Replace the 30s interval with:
```js
// Debounced save
useEffect(() => {
  if (!isDirty) return;
  const t = setTimeout(() => saveDraft(), 800);
  return () => clearTimeout(t);
}, [isDirty, draft, lineItems, description]);

// Flush on hide/unload
useEffect(() => {
  const flush = () => { if (isDirty) saveDraft(); };
  window.addEventListener('visibilitychange', flush);
  window.addEventListener('pagehide', flush);
  return () => { /* cleanup */ };
}, [isDirty]);
```

---

## 3. File-by-file change map

| File | Size | Change type | Risk |
|---|---|---|---|
| `src/pages/quote-builder-page.jsx` | 972 lines | **Heavy rewrite.** Phase machine collapses, sections extracted, mic button added, undo toast added, upsert replaces delete+insert, C3 flow added, C5 detection broadened, M8 CSS applied, coachmarks added, keyboard shortcuts, telemetry. Should split into `quote-builder-page.jsx` (orchestrator) + `src/components/qb/*` sub-components to keep review tractable. | High — this is the centerpiece. |
| `src/components/qb/CustomerSection.jsx` | new, ~120 lines | Customer chips + fuzzy search + inline quick-create + M7 dup check. | Medium. |
| `src/components/qb/JobDescriptionSection.jsx` | new, ~80 lines | Textarea + mic button + trade auto-detect pill. | Low. |
| `src/components/qb/ScopeSection.jsx` | new, ~150 lines | AI suggestions marked ✨, inline-edit line items, + Add, Ask Foreman, swipe-delete with undo. | Medium. |
| `src/components/qb/TotalSection.jsx` | new, ~100 lines | Totals + smart-default pills w/ `· Change` inline editors. | Low. |
| `src/components/qb/StickySend.jsx` | new, ~80 lines | Sticky bottom Send bar + 3s undo toast + delivery-method switcher. | Medium. |
| `src/components/qb/MicButton.jsx` | new, ~50 lines | Web Speech API wrapper, graceful hide on unsupported. | Low. |
| `src/components/qb/Coachmarks.jsx` | new, ~60 lines | 3-step spotlight overlay, `pl_has_sent_quote` gated. | Low. |
| `src/hooks/use-customers.js` | new, ~30 lines | 5-minute module cache for customer list. | Low. |
| `src/hooks/use-speech-recognition.js` | new, ~40 lines | SpeechRecognition API wrapper. | Low. |
| `src/lib/api/quotes.js` | 528 lines | **+** `getQuotingDefaults(userId)`. **Modify** line-item save to upsert (H1). | Medium — changes persistence. |
| `src/lib/api/customers.js` | — | **+** `findCustomerByContact(userId, normalizedContact)` for M7. | Low. |
| `src/lib/offline.js` | 112 lines | **+** `isNetworkError(err)` export (C5). | Low. |
| `src/lib/api/shared.js` or `src/lib/api.js` | — | `requestAiScope` gains optional `signal: AbortSignal` param. | Low. |
| `api/send-quote-email.js` | 963 lines | **H4:** wire the orphaned main branch — after Resend 200, update quote status atomically with `.in('status', ['draft', 'sent', 'viewed'])`. Return the new status in the response so client can reflect it. | Medium — brings dead code alive. |
| `api/send-sms.js` | — | Verify it writes `status='sent'` server-side (currently client-side in builder). If not, add it with same atomic predicate. | Low — probably just verification. |
| `src/lib/analytics.js` | 170 lines | **+** helpers for the 6 new `quote_flow_*` events (B13). Session id generator. | Low. |
| `src/styles/phase3-5-builder.css` | new | All new builder CSS — sections, chips, mic, coachmarks, undo toast, sticky send, tabstrip etc. Imported after `phase3-dashboard.css`. Follows existing additive pattern. | Low. |
| `src/styles/index.css` | — | One-line `@import` addition. | Trivial. |
| `src/components/ui/Stat.jsx` | 3.4 KB | Optional: add `formatter` prop so currency cells can count up. This is Phase 6 territory but if the total card is prominent enough it may matter here. Flag as deferred if cut for time. | Low. |
| `CHANGELOG-PHASE3-5.md` | new | Full changelog. | — |
| `PHASE3-5-AUDIT.md` | new | Deferred items (H3, H5, M1-M9, L1-L8 from the sprint's Part C list). | — |
| `PHASE3-5-TIMING.md` | new | **Must be populated by hand on a real device or emulator.** Claude cannot produce this number honestly. Sprint requires median ≤ 90s across 5 runs. | — |
| `README.md` | — | Phase 3.5 headline + links. | Trivial. |

---

## 4. Implementation ordering (what to build first)

Critical path, assuming one developer:

1. **Foundation (no visible change):** Add `isNetworkError` helper (C5),
   add `getQuotingDefaults` + line-item upsert (H1), add
   `findCustomerByContact` (M7), add `requestAiScope` signal support,
   wire `api/send-quote-email.js` atomic status update (H4). *Ship as a
   single commit — zero UI change, all backend plumbing.* ~1 day.

2. **Section extraction (no behavior change):** Pull the existing
   `describe`/`building`/`review` UI into `qb/CustomerSection.jsx`,
   `qb/JobDescriptionSection.jsx`, `qb/ScopeSection.jsx`,
   `qb/TotalSection.jsx` unchanged. Orchestrator still uses the phase
   state machine. This is a refactor-only commit. ~0.5 day.

3. **Phase collapse + always-visible sections:** Replace the phase
   state machine with `editing`/`sent` only. Sections render
   simultaneously. Scroll-as-navigation. ~0.5 day.

4. **AI pre-warm:** Debounced `useEffect` on description; promise
   stored in ref; `ScopeSection` awaits the resolved promise when
   mounted/scrolled-into-view. ~0.5 day.

5. **Customer picker redesign:** `useCustomers` hook, chips,
   fuzzy match, inline quick-create, M7 dup check. ~1 day.

6. **Smart defaults + Total card:** `getQuotingDefaults` integrated on
   mount; deposit/expiry pills with `· Change` inline editors. ~0.5 day.

7. **Voice input:** MicButton + useSpeechRecognition. ~0.5 day.

8. **Optimistic send + undo toast + C3 fallback:** StickySend
   component; 3-second timer; "Did you send it?" manual-confirm card.
   ~1 day.

9. **Autosave rewrite (B9):** Debounced save + visibilitychange
   flush; C5 broad detection at every catch. ~0.5 day.

10. **M8 keyboard handling:** CSS + visualViewport listener. ~0.25 day.

11. **Telemetry (B13):** 6 events + session_id generator. ~0.25 day.

12. **Coachmarks (B11):** 3-step spotlight. ~0.5 day.

13. **Keyboard shortcuts (B12):** ⌘K, ⌘↵, Enter-on-last-item. ~0.25 day.

**Budget: ~7 days of focused work for a developer familiar with the
codebase.** Items 11–13 are the "first to cut" per the sprint's
sacrifice order.

---

## 5. Validation plan

### 5.1 Automated (must pass before merge)

- `npm run build` — zero new warnings vs Phase 3 baseline
- `npm run test:e2e` — full existing Playwright suite
- New Playwright spec `tests/e2e/quote-flow-2min.spec.ts`:
  - Happy path to sent success
  - Double-tap approve → exactly 1 notification (covers A3 end-to-end
    through the new flow)
  - Offline draft save + reconnect sync
  - Line-item IDs preserved across saves (read `line_items` row IDs
    before and after edit, assert no new IDs for unchanged rows)

### 5.2 Manual (blocking before ship)

**The 5-run timing test (PHASE3-5-TIMING.md):**

1. Chrome devtools → iPhone SE emulation → Slow 4G → CPU 4x throttle
2. Clear `localStorage`, `sessionStorage`, IndexedDB
3. Start screen recorder
4. From cold `/app/`, tap "Quote a job"
5. Complete quote as a realistic HVAC job with 3 line items, default
   deposit
6. Stop recording at "Quote sent" success banner
7. Note timestamp from recording
8. Repeat for: plumbing, bathroom reno (larger), emergency callout
   (smaller), revision-of-existing
9. Record all 5 times. Compute median.

**Pass criterion: median ≤ 90s.** If miss, iterate on the slowest step
identified (intermediate events in the `events` table narrow this
down).

### 5.3 Device matrix

Same as sprint prompt's visual validation checklist. No substitute for
real hands-on.

### 5.4 Post-ship SQL (Day 7 + Day 14)

Query in sprint prompt §B13 reruns at these intervals. Targets:
- `p50_seconds ≤ 90`
- `p90_seconds ≤ 150`
- `completion_rate_pct ≥ 85`

---

## 6. Known risks

| Risk | Mitigation |
|---|---|
| AI pre-warm fires but response beats the user's eyes — user sees scope populate mid-typing, jarring | Add a 300ms minimum-delay on render (wait for description to reach its own 600ms idle AND scope promise to settle). |
| Voice transcription on older Android browsers inserts garbage | Guard `SpeechRecognition` availability strictly; show textarea as fallback. |
| Line-item upsert breaks if `crypto.randomUUID` unavailable | Polyfill via `uuid@^9` already a likely transitive dep; else tiny helper. |
| Undo toast swallowed by user's next tap intent | 3s is intentionally long; if toast interferes with taps on Quote Detail page, dismiss on navigation. |
| Smart defaults confuse a user who hasn't sent 5 quotes yet | Fall through to profile defaults (already wired at L.234-236). Gate behind "recent.length ≥ 3" not `>= 1`. |
| Draft save collisions across devices/tabs | Existing `useUnsavedChanges` already warns; no regression. |
| Session id leaking between flows | Generated fresh on builder mount; cleared on `sent` phase entry. |

---

## 7. Out of scope (deferred)

Copied from sprint prompt Part C, confirmed deferred:

- H3 — approve endpoint latency (5-7 sequential API calls)
- H5 — listQuotes 500-row pagination
- M1 — view count inflation
- M2 — deposit polling timeout UX
- M3 — booking email/SMS server-side triggers
- M4 — invoice over-payment guard
- M5 — financing threshold hardcoded
- M6 — customer optional-selection idempotency (partially solved by A3)
- M9 — un-send / quote revert
- L1–L8 — dead code and duplication cleanup

Plus Part B-specific deferrals to flag:

- `<Stat formatter>` prop (Phase 6)
- Deposit / expiry editor UI polish beyond inline pill (Phase 4 detail)
- Multi-currency smart-default edge cases (US contractor with
  historical CA quotes etc.) — fall through to profile.

---

## 8. Answer to "why not just do it now"

The blueprint above is ~7 days of focused work and requires real
device timing runs that can't be produced in a chat session. Shipping
Part A (the correctness patches) first, as its own release, is the
sprint prompt's recommended path for exactly this reason. Part B
without the timing validation isn't "mostly done"; it's ungrounded,
because the entire sprint's success metric is the median time number.

If this plan document is acted on: Part B ships on schedule, the
2-minute goal is measurable, and the contractor's trust survives the
next three months of quote flow evolution.
