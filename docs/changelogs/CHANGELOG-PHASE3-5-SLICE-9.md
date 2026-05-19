# Phase 3.5 Slice 9 — B11 Coachmarks + B12 Keyboard Shortcuts

**Status:** Shipped.
**Plan ref:** PHASE3-5-PLAN.md §B11 + §B12
**Files changed:**
- `src/components/qb-coachmarks.jsx` — new file
- `src/pages/quote-builder-page.jsx` — coachmarks mount + keyboard shortcut wiring
- `src/styles/index.css` — coachmark + keyboard overlay CSS

---

## Summary

**B11:** A 3-step dismissible spotlight overlay guides first-time users through Describe → Review items → Send. Gated on two localStorage keys so experienced users never see it. Respects `prefers-reduced-motion`.

**B12:** Six keyboard shortcuts wired into the quote builder via a `useEffect` on `document`. All disabled on mobile/touch devices. A `?`-triggered help overlay lists the shortcuts.

---

## Changes — `src/components/qb-coachmarks.jsx` (new file)

### Before
File did not exist.

### After
```jsx
// Key exports / behaviour:
export default function QbCoachmarks()
```

**Gate logic:**
```js
// Never show to users who have already sent a quote
const alreadySent = !!localStorage.getItem('pl_has_sent_quote');
// Never show again once dismissed
const dismissed = !!localStorage.getItem('pl_coachmarks_dismissed');
if (!alreadySent && !dismissed) setShow(true);
```

**Three steps** (spotlighted by element ID):
| Step | Target ID | Copy |
|---|---|---|
| 1 | `#qb-desc` | "Type or speak the job — AI builds the scope for you." |
| 2 | `#qb-line-items` | "Add, edit, or remove items. Prices are editable." |
| 3 | `#qb-send-btn` | "Send as a text, email, or shareable link." |

**Spotlight:** A `position: absolute` box with `box-shadow: 0 0 0 9999px rgba(0,0,0,0.45)` cuts the spotlight. The backdrop `div` captures clicks and calls `dismiss()`.

**Tooltip positioning:** Prefers below the target; falls back to above when insufficient viewport space. Horizontally clamped to viewport edges with 12px margin.

**Dismiss paths:**
- "Skip" button → sets `pl_coachmarks_dismissed = '1'` immediately
- "Next →" on step 3 (final) → same
- Backdrop click → same

**`prefers-reduced-motion`:** Checked once at mount via `window.matchMedia`. When set, the `qb-cm-fade-in` animation class is omitted.

**isMounted guard:** Component renders `null` until a `useEffect` sets `isMounted = true`, preventing SSR/hydration mismatches and localStorage access before mount.

---

## Changes — `src/pages/quote-builder-page.jsx`

### Import added
```js
import QbCoachmarks from '../components/qb-coachmarks';
```

### New state
```js
const [showKbdHelp, setShowKbdHelp] = useState(false);
```

### Element IDs added (coachmark targets)

**Before:**
```jsx
<div className="rq-items-section pl-items-motion pl-items-stable">
// ...
<div className="rq-footer-right">
```

**After:**
```jsx
<div id="qb-line-items" className="rq-items-section pl-items-motion pl-items-stable">
// ...
<div id="qb-send-btn" className="rq-footer-right">
```

(`#qb-desc` was already on the description textarea from a prior slice.)

### Keyboard shortcuts `useEffect` (new)

```js
useEffect(() => {
  if (!window.matchMedia('(pointer:fine)').matches) return; // desktop only

  function onKeyDown(e) {
    const tag = e.target?.tagName?.toLowerCase();
    const inInput = tag === 'input' || tag === 'textarea' || tag === 'select';
    const meta = e.metaKey || e.ctrlKey;

    if (meta && e.key === 'k') {
      e.preventDefault();
      document.querySelector('.rq-customer-section input, .jd-input[placeholder*="Search or add customer"]')?.focus();
      return;
    }
    if (meta && e.key === 'Enter') {
      e.preventDefault();
      if (phase === 'describe' && description.trim()) handleBuildScope();
      else if (phase === 'review') handleSend();
      return;
    }
    if (e.key === '?' && !inInput && !meta) {
      e.preventDefault();
      setShowKbdHelp(p => !p);
      return;
    }
    if (e.key === 'Escape' && showKbdHelp) {
      setShowKbdHelp(false);
      return;
    }
  }

  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}, [phase, description, showKbdHelp]);
```

### Enter-on-last-item (B12)

**Before:**
```jsx
<input className="rq-card-name" value={item.name}
  onChange={e => updateItem(item.id, { name: e.target.value })}
  placeholder="Item name" aria-label="Item name"
  onFocus={() => setEditingItemId(item.id)} />
```

**After:**
```jsx
<input className="rq-card-name" value={item.name}
  onChange={e => updateItem(item.id, { name: e.target.value })}
  placeholder="Item name" aria-label="Item name"
  data-item-idx={idx}
  onFocus={() => setEditingItemId(item.id)}
  onKeyDown={e => {
    if (e.key === 'Enter' && !e.shiftKey && idx === lineItems.length - 1) {
      e.preventDefault();
      setLineItems(p => [...p, { id: 'new_' + Date.now(), name: '', quantity: 1,
        unit_price: 0, notes: '', included: true, category: '' }]);
      markDirty();
    }
  }} />
```

### JSX mount — coachmarks + keyboard overlay

**Before (end of AppShell):**
```jsx
<ConfirmModal … />
</AppShell>
```

**After:**
```jsx
<ConfirmModal … />

{phase === 'review' && <QbCoachmarks />}

{showKbdHelp && (
  <div className="qb-kbd-overlay-bg" onClick={() => setShowKbdHelp(false)}>
    <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"
      className="qb-kbd-overlay" onClick={e => e.stopPropagation()}>
      <div className="qb-kbd-overlay-head">
        <span className="qb-kbd-overlay-title">Keyboard shortcuts</span>
        <button type="button" className="qb-kbd-overlay-close"
          onClick={() => setShowKbdHelp(false)} aria-label="Close">×</button>
      </div>
      <table className="qb-kbd-table">
        <tbody>
          <tr><td>⌘K / Ctrl+K</td><td>Focus customer search</td></tr>
          <tr><td>⌘↵ / Ctrl+Enter</td><td>Build quote (describe) or Send (review)</td></tr>
          <tr><td>?</td><td>Toggle this help overlay</td></tr>
        </tbody>
      </table>
    </div>
  </div>
)}
</AppShell>
```

---

## Changes — `src/styles/index.css`

New CSS blocks appended:
- `.qb-cm-backdrop`, `.qb-cm-tooltip`, `.qb-cm-step-label`, `.qb-cm-title`, `.qb-cm-body`, `.qb-cm-actions`, `.qb-cm-skip`, `.qb-cm-next` — coachmark overlay
- `@keyframes qbCmFadeIn` + `.qb-cm-fade-in` — fade-in animation (suppressed by `prefers-reduced-motion`)
- `.qb-kbd-overlay-bg`, `.qb-kbd-overlay`, `.qb-kbd-overlay-head`, `.qb-kbd-overlay-title`, `.qb-kbd-overlay-close`, `.qb-kbd-table` — keyboard help modal

---

## Testing guidance

### Coachmarks (B11)

1. Clear `pl_coachmarks_dismissed` and `pl_has_sent_quote` from localStorage (DevTools → Application → Local storage → delete both keys).
2. Navigate to the builder, build a quote, reach the **Review** phase.
3. Confirm the semi-transparent backdrop appears with spotlight on the description textarea and step 1 tooltip.
4. Click **Next →** → spotlight moves to the line-items list (step 2).
5. Click **Next →** → spotlight moves to the Send footer button (step 3).
6. Click **Got it ✓** → overlay dismissed; `pl_coachmarks_dismissed = '1'` set in localStorage.
7. Refresh → coachmarks do **not** appear again.
8. **Skip test:** Clear both keys again, reach Review phase, click **Skip** → overlay dismissed immediately, `pl_coachmarks_dismissed` set.
9. **Experienced user test:** Set `pl_has_sent_quote = '1'` in localStorage, reload → coachmarks never appear even after clearing `pl_coachmarks_dismissed`.
10. **Reduced motion:** DevTools → Rendering → Enable "Emulate CSS media feature prefers-reduced-motion" → confirm no fade-in animation on the tooltip.

### Keyboard shortcuts (B12)

1. On desktop (pointer: fine), reach the **Describe** phase.
2. Press `⌘K` (Mac) or `Ctrl+K` (Windows) → customer search input gains focus.
3. Type a job description (non-empty), press `⌘↵` / `Ctrl+Enter` → `handleBuildScope()` fires.
4. Reach **Review** phase, press `⌘↵` / `Ctrl+Enter` → send modal opens (same as clicking Send).
5. Press `?` → keyboard shortcut help overlay appears.
6. Press `?` again → overlay closes.
7. Press `Escape` while overlay is open → overlay closes.
8. Click inside a text `<input>`, press `?` → overlay does **not** open.
9. In the line-items list, add at least one item. Focus the **last** item's name field, press `Enter` → a new blank item is added below.
10. **Mobile:** On a 375px-wide viewport (Chrome DevTools device mode), confirm none of the above keyboard shortcuts are registered (no focus hijack on Ctrl+K, etc.).

---

## Revert instructions

```bash
# Remove new component
rm src/components/qb-coachmarks.jsx

# Revert page and styles
git checkout HEAD -- src/pages/quote-builder-page.jsx
git checkout HEAD -- src/styles/index.css
```

Surgical revert of page only:
- Remove `import QbCoachmarks` line
- Remove `const [showKbdHelp, setShowKbdHelp] = useState(false);`
- Remove the keyboard shortcuts `useEffect` block
- Remove `id="qb-line-items"` from items section div
- Remove `id="qb-send-btn"` from footer-right div
- Remove `data-item-idx` and `onKeyDown` from item name inputs
- Remove `{phase === 'review' && <QbCoachmarks />}` from JSX
- Remove the `showKbdHelp &&` overlay block from JSX
