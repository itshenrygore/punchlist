# Punchlist Rewrite — Combined Teardown & Implementation Guide

## What's in this package

```
rewrite/
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   └── headline-stat.jsx     ← Suppresses 0% close rate
│   │   └── compact-line-item.jsx     ← Receipt-style rows (replaces chunky cards)
│   ├── pages/
│   │   ├── dashboard-page.jsx        ← Full rewrite
│   │   └── quotes-list-page.jsx      ← Full rewrite
│   └── styles/
│       ├── dashboard-fixes.css       ← Dashboard CSS patches
│       ├── quotes-list-fixes.css     ← Quote list theme fixes
│       ├── compact-line-item.css     ← New component styles
│       └── quote-builder-fixes.css   ← 11 targeted CSS fixes
```

---

## Issues Fixed (Combined from both teardowns)

### Dashboard
| # | Issue | Fix | File |
|---|-------|-----|------|
| 1 | "0% close rate" chip demoralizes new users | HeadlineStat returns null when value is 0 | `headline-stat.jsx` |
| 2 | "$0 THIS MONTH / $0 THIS WEEK" showing two zeros | RevenueCard returns null when both values are 0 | `dashboard-page.jsx` |
| 3 | "What's the job? e.g. Poly B r..." truncates | Shortened placeholder to "What's the job?" | `dashboard-page.jsx` |
| 4 | Pipeline bar is single gray rectangle with 1 draft | PipelineBar returns null when ≤1 item in 1 status | `dashboard-page.jsx` |
| 5 | "Next quote is a good one" empty state is weird | Changed to "Build your next quote when you're ready." | `dashboard-page.jsx` |
| 6 | 300px dead space below last section | Reduced `padding-bottom` from `--space-12` to `--space-6` | `dashboard-fixes.css` |
| 7 | Demo preview A/B test below fold, never seen | Removed entirely | `dashboard-page.jsx` |

### Quotes List
| # | Issue | Fix | File |
|---|-------|-----|------|
| 8 | "0 of 1 approved (0%)" as page header | Only show close rate when >0% and ≥2 quotes sent | `quotes-list-page.jsx` |
| 9 | "No contact" in gray italic looks like error | Changed to "Draft" in neutral text | `quotes-list-page.jsx` |
| 10 | "$0" shown prominently on declined quote | Shows "—" when total is $0 | `quotes-list-page.jsx` |
| 11 | White cards on dark background | Added `.ql-panel-themed` + dark mode overrides | `quotes-list-fixes.css` |
| 12 | "View..." filter pill clipped | Reduced to 9 pills (merged completed/invoiced/paid into "Done") | `quotes-list-page.jsx` |
| 13 | Filter pills have no scroll indicator | Added fade mask on right edge | `quotes-list-fixes.css` |

### Quote Builder (CSS patches — apply to existing file)
| # | Issue | Fix | File |
|---|-------|-----|------|
| 14 | "DESCRI..." stepper truncated | Hidden on mobile (`display: none`), full labels on desktop | `quote-builder-fixes.css` |
| 15 | "...to islan" breadcrumb clips mid-word | `text-overflow: ellipsis` + `max-width: 100%` | `quote-builder-fixes.css` |
| 16 | Kristine foreman pill bleeds off-screen | `max-width: 100%` + `overflow: hidden` on pill | `quote-builder-fixes.css` |
| 17 | Coachmark tooltip off-screen, "Ne..." button clipped | Centered with `max-width: calc(100vw - 32px)` | `quote-builder-fixes.css` |
| 18 | "Ask Fore..." button truncated | Stack buttons vertically on narrow screens | `quote-builder-fixes.css` |
| 19 | "Copy Quote Link" as primary CTA | JSX change: show "Send Quote" when customer attached | `quote-builder-fixes.css` (instructions) |
| 20 | Quantity controls 56px tall each | Reduced to 32px height | `quote-builder-fixes.css` |
| 21 | Overall line item cards too tall | Reduced padding, CompactLineItem for full replacement | `compact-line-item.jsx` |
| 22 | Fake progress bar (0→85% in 15s) | Replaced with honest indeterminate animation | `quote-builder-fixes.css` |
| 23 | Describe placeholder too long, truncates | JSX change: use short placeholder | `quote-builder-fixes.css` (instructions) |

### Side Menu
| # | Issue | Fix | File |
|---|-------|-----|------|
| 24 | Ghost text looks disabled | Needs color fix in app-shell CSS: use `var(--text)` not `var(--text-3)` | Manual fix |
| 25 | No icons next to menu items | Add Lucide icons matching bottom nav | Manual fix |
| 26 | "Henry Gore" in nearly invisible red | Use `var(--text)` for user name, `var(--text-2)` for email | Manual fix |

### Quote Detail (Declined)
| # | Issue | Fix | File |
|---|-------|-----|------|
| 27 | Title wraps 4 lines because "Revise →" is inline | Move Revise button below title, full width | Manual fix |
| 28 | THREE "Revise" buttons visible | Keep only the footer CTA, remove header + inline card buttons | Manual fix |
| 29 | "WHAT DO YOU WANT TO DO?" clipped by sticky footer | Add `padding-bottom` equal to sticky footer height | Manual fix |

### Schedule
| # | Issue | Fix | File |
|---|-------|-----|------|
| 30 | Calendar owns 65% of screen with no bookings | Collapse calendar on mobile when no bookings, show list view | Manual fix |
| 31 | Dashed "Schedule a job" button looks like wireframe | Use solid button style with `btn btn-secondary` | Manual fix |

---

## How to Apply

### Step 1: Drop-in replacements (immediate)
Copy these files directly over their existing counterparts:
- `src/components/dashboard/headline-stat.jsx`
- `src/pages/dashboard-page.jsx`
- `src/pages/quotes-list-page.jsx`

### Step 2: Add new files
- `src/components/compact-line-item.jsx` (new component)
- `src/styles/compact-line-item.css` (new styles)

### Step 3: Import CSS patches
Add these imports to `main.jsx` or wherever CSS is loaded, **after** existing styles:
```js
import './styles/dashboard-fixes.css';
import './styles/quotes-list-fixes.css';
import './styles/quote-builder-fixes.css';
import './styles/compact-line-item.css';
```

### Step 4: Quote Builder JSX changes (manual)
These changes are in the existing `quote-builder-page.jsx` and require manual edits:

**4a. Fix the sticky footer CTA** (around line 1540-1560):
```jsx
// BEFORE:
<button className="..." onClick={...}>Copy Quote Link</button>

// AFTER:
{draft.customer_id ? (
  <button className="btn btn-primary qb-send-btn" type="button" onClick={handleSend}>
    Send Quote →
  </button>
) : (
  <button className="btn btn-secondary qb-send-btn" type="button" onClick={...}>
    Copy Link
  </button>
)}
```

**4b. Fix the describe placeholder** (around line 1080):
```jsx
// BEFORE:
placeholder={DESC_PLACEHOLDERS[trade] || DESC_PLACEHOLDERS['Other']}

// AFTER:
placeholder="e.g. Replace hot water tank, install new faucet"
```

**4c. Integrate CompactLineItem** (optional, for full line item redesign):
Replace the `lineItems.map(...)` block (around line 1292) with:
```jsx
import CompactLineItem from '../components/compact-line-item';

// In the render:
{lineItems.map((item, idx) => (
  <CompactLineItem
    key={item.id}
    item={item}
    index={idx}
    onUpdate={updateItem}
    onRemove={removeItem}
    onReorder={(from, to) => {
      setLineItems(p => {
        const n = [...p];
        const [m] = n.splice(from, 1);
        n.splice(to, 0, m);
        return n;
      });
      markDirty();
    }}
    isLast={idx === lineItems.length - 1}
    onAddNew={() => {
      setLineItems(p => [...p, { id: genLineItemId(), name: '', quantity: 1, unit_price: 0, notes: '' }]);
      markDirty();
    }}
    country={country}
    isLeaving={leavingItemIds.has(item.id)}
  />
))}
```

### Step 5: Side menu fixes (manual CSS)
In `app-shell.jsx` or the relevant CSS, fix the menu text color:
```css
.sidebar-nav-link {
  color: var(--text);
  font-weight: 500;
}

.sidebar-user-name {
  color: var(--text);
  font-weight: 600;
}
```

---

## What's NOT in this package (needs separate work)

1. **Full quote builder decomposition** — splitting the 1,712-line monolith into `QuoteFlow.jsx`, `DescribeStep.jsx`, `ReviewStep.jsx`, `SendSheet.jsx`. The CSS patches fix the visual issues; the architectural cleanup is a separate sprint.

2. **CSS consolidation** — the 504K `index.css` needs to be split into page-scoped modules. The patches in this package are additive (loaded after existing styles).

3. **Schedule page redesign** — replacing the month-grid-first view with an agenda/list view on mobile.

4. **Quote detail page** — removing duplicate Revise buttons, fixing the title/button collision.

5. **Side menu icon integration** — adding Lucide icons to match bottom nav.
