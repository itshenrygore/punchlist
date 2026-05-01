# Punchlist Rewrite — Combined Teardown & Implementation Guide

## What's in this package

```
rewrite/
├── IMPLEMENTATION-GUIDE.md           ← This file
├── src/
│   ├── components/
│   │   ├── app-shell.jsx             ← Side menu: icons + visible text + name color
│   │   ├── compact-line-item.jsx     ← Receipt-style rows (replaces chunky cards)
│   │   ├── dashboard/
│   │   │   └── headline-stat.jsx     ← Suppresses 0% close rate
│   │   └── quote-builder/            ← NEW: decomposed from 1,712-line monolith
│   │       ├── index.js              ← Barrel export
│   │       ├── describe-step.jsx     ← "What's the job?" input (185 lines)
│   │       ├── customer-picker.jsx   ← Search/select/create customer (175 lines)
│   │       ├── review-step.jsx       ← Items + scope + sticky footer (240 lines)
│   │       └── send-sheet.jsx        ← Bottom sheet: SMS + confirm (155 lines)
│   ├── pages/
│   │   ├── dashboard-page.jsx        ← Full rewrite
│   │   ├── quotes-list-page.jsx      ← Full rewrite
│   │   ├── quote-builder-page.jsx    ← Targeted fixes (CTA + placeholder)
│   │   ├── quote-detail-page.jsx     ← Title wrapping + Revise dedup + $0 fix
│   │   └── bookings-page.jsx         ← Copy (CSS fixes handle the rest)
│   └── styles/
│       ├── dashboard-fixes.css       ← Dashboard CSS patches
│       ├── quotes-list-fixes.css     ← Quote list theme fixes
│       ├── compact-line-item.css     ← Receipt-style item rows
│       ├── quote-builder-fixes.css   ← 11 targeted CSS fixes for existing builder
│       ├── quote-builder-components.css ← NEW: CustomerPicker + SendSheet styles
│       ├── review-step.css           ← NEW: ReviewStep layout + sticky footer
│       ├── schedule-fixes.css        ← Calendar empty state + button styling
│       └── quote-detail-and-menu-fixes.css ← Title, footer clip, menu ghost text
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
| 24 | Ghost text looks disabled | Fixed color to `var(--text)`, added inline style override | `app-shell.jsx` + `quote-detail-and-menu-fixes.css` |
| 25 | No icons next to menu items | Added SVG path icons matching bottom nav to navLinks array | `app-shell.jsx` |
| 26 | "Henry Gore" in nearly invisible red | Fixed company name to `var(--text)`, email to `var(--text-2)` | `app-shell.jsx` |

### Quote Detail (Declined)
| # | Issue | Fix | File |
|---|-------|-----|------|
| 27 | Title wraps 4 lines because "Revise →" is inline | Removed inline button, title gets full width, Edit link in meta | `quote-detail-page.jsx` + CSS |
| 28 | THREE "Revise" buttons visible | Removed inline title button, kept phase banner + footer | `quote-detail-page.jsx` |
| 29 | "WHAT DO YOU WANT TO DO?" clipped by sticky footer | Added `padding-bottom` for sticky footer clearance | `quote-detail-and-menu-fixes.css` |

### Schedule
| # | Issue | Fix | File |
|---|-------|-----|------|
| 30 | Calendar owns 65% of screen with no bookings | Reduced grid row height on mobile, compact day cells | `schedule-fixes.css` |
| 31 | Dashed "Schedule a job" button looks like wireframe | Replaced with solid brand-colored button | `schedule-fixes.css` |

---

## How to Apply

### Step 1: Drop-in replacements (immediate)
Copy these files directly over their existing counterparts:
- `src/components/dashboard/headline-stat.jsx`
- `src/components/app-shell.jsx` — icons + visible menu text
- `src/pages/dashboard-page.jsx`
- `src/pages/quotes-list-page.jsx`
- `src/pages/quote-builder-page.jsx` — CTA + placeholder fixes
- `src/pages/quote-detail-page.jsx` — title wrapping + $0 + deduped buttons

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
import './styles/schedule-fixes.css';
import './styles/quote-detail-and-menu-fixes.css';
```

### Step 4: CompactLineItem integration (optional, for full line item redesign)
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

1. **CSS consolidation** — the 504K `index.css` needs to be split into page-scoped modules. The patches in this package are additive (loaded after existing styles).

2. **Schedule page agenda view** — adding a list/agenda view option on mobile as an alternative to the month grid. The calendar is improved but not fundamentally restructured.

---

## Quote Builder Decomposition (NEW)

The 1,712-line `quote-builder-page.jsx` monolith has been broken into focused components. These are in `src/components/quote-builder/`:

```
quote-builder/
├── index.js             ← Barrel export
├── describe-step.jsx    ← "What's the job?" textarea + voice + photo (185 lines)
├── customer-picker.jsx  ← Search/select/create customer (175 lines)
├── review-step.jsx      ← Customer + items + scope + footer (240 lines)
└── send-sheet.jsx       ← Delivery method + SMS composer + confirm (155 lines)
```

Plus supporting CSS:
```
styles/
├── compact-line-item.css         ← Receipt-style item rows
├── quote-builder-components.css  ← CustomerPicker + SendSheet styles
└── review-step.css               ← ReviewStep layout + sticky footer
```

### Architecture

The existing `quote-builder-page.jsx` remains the **orchestrator** — it owns all the state, data fetching, save logic, and phase transitions. The extracted components are **presentational** — they receive props and emit events.

To integrate, import the new components in the existing orchestrator:

```jsx
import { DescribeStep, ReviewStep, SendSheet } from '../components/quote-builder';

// In the render, replace the describe phase JSX:
{phase === 'describe' && (
  <DescribeStep
    description={description}
    onDescriptionChange={setDescription}
    title={title}
    trade={trade}
    onTradeChange={setTrade}
    province={province}
    onProvinceChange={setProvince}
    country={country}
    photo={photo}
    onPhotoChange={setPhoto}
    photoSaved={photoSaved}
    error={error}
    onBuildScope={handleBuildScope}
    onManualAdd={() => setPhase('review')}
    isFirstTime={isFirstTime}
  />
)}

// Replace the review phase JSX:
{phase === 'review' && (
  <ReviewStep
    draft={draft}
    onDraftChange={ud}
    lineItems={lineItems}
    onLineItemsChange={setLineItems}
    customers={allCustomers}
    customersLoading={customersLoading}
    onCustomerSelect={handleCustomerSelect}
    onCustomerCreate={handleCustomerCreate}
    selectedCustomer={selCustomer}
    scopeMeta={scopeMeta}
    country={country}
    grandTotal={grandTotal}
    onSend={handleSend}
    onSave={() => save()}
    saving={saving}
    saveState={saveState}
    lastSavedAt={lastSavedAt}
    isLocked={isLocked}
    sending={sending}
    error={error}
    onAddCatalogItem={() => setAddMode('catalog')}
    onAddCustomItem={() => {
      setLineItems(p => [...p, { id: genLineItemId(), name: '', quantity: 1, unit_price: 0, notes: '' }]);
      markDirty();
    }}
  />
)}

// Replace the send modal:
<SendSheet
  open={showSend}
  onClose={() => setShowSend(false)}
  onConfirmSend={handleConfirmSend}
  customer={selCustomer}
  lineItems={lineItems}
  grandTotal={grandTotal}
  country={country}
  smsBody={smsBody}
  onSmsBodyChange={setSmsBody}
  sending={sending}
  saving={saving}
/>
```

### What this achieves

| Before | After |
|--------|-------|
| 1,712 lines, 1 file | ~750 lines orchestrator + 4 focused components |
| 200+ state variables in one render | State in orchestrator, components are pure |
| Describe phase is 100 lines of inline JSX | `DescribeStep` is a standalone 185-line file |
| Review zone is 400+ lines of inline JSX | `ReviewStep` + `CompactLineItem` + `CustomerPicker` |
| Send modal is 200 lines of inline JSX | `SendSheet` is 155 lines, slides up from bottom |
| Every keystroke re-renders 1,712 lines | Components memo-isolate, only re-render what changed |

### New CSS to import

```js
import './styles/quote-builder-components.css';
import './styles/review-step.css';
```

