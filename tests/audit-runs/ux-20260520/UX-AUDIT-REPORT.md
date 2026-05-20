# Mobile + desktop UX audit — punchlist.ca

**Account:** test@test.ca (Test Electrical), 3 quotes, $422 won.
**Viewports:** desktop 1280×800, mobile 393×852 (iPhone 14 Pro).
**Harness:** `tests/ux-audit.mjs` — logs in, captures every primary route at both widths, plus quote-detail and invoice-detail.

## What I shipped in this push

| # | Area | Change |
|---|---|---|
| 1 | **Templates page** | Default tab is now **Job templates** (was Message templates). Contractors land on the workflow they actually configure first. |
| 2 | **Analytics — grammar** | "1 quote **need** a follow-up" → "1 quote **needs** a follow-up". |
| 3 | **Analytics — empty months** | The Monthly quote value card no longer renders a row of grey skeleton-looking pills next to "—" for months with zero sent quotes. Looked like broken data on phone. |
| 4 | **Analytics — Top jobs duplicates** | Two distinct titles like *"Relocate Kitchen Sink and Dishwasher to island"* and *"…and Dishwasher hookups"* were colliding at 6-token normalization and rendering as visually identical rows. Bumped to 10 tokens; removed the hard-coded trailing `…` (CSS truncates as needed). |
| 5 | **Customers — VALUE column truncation on mobile** | "1 quote" truncating to "1 quor" because the stats column was getting flex-shrunk. Added `flex-shrink:0` + `white-space:nowrap` to the labels. |
| 6 | **Quotes list — swipe-to-archive limited to terminal states** | Swiping a quote that's **sent / viewed / approved / revision_requested** no longer reveals the Archive button. Archive only enables for **declined / expired / paid / converted_to_invoice** (plus Delete for drafts). Matches the gut-check that you shouldn't be one-swipe away from filing a hot quote. |

All six changes ride on the same commit + deploy as the earlier H1/H2/M1/M2 fixes. After merge + deploy, `tests/ux-audit.mjs` can rerun and confirm.

## Bigger UX recommendations — need your call before I ship

### A. Quote detail on mobile is visually broken (IMG_2186)
- Big white gap between the **"Sent May 18"** pill and the **Resend to Marley** button. Two consecutive `qb-card` blocks on the "More" tab with collapsed/hidden content in between.
- Sticky bottom bar **"Text Marley" / "Link"** duplicates the in-card **"Resend to Marley" / "Copy link"** buttons three inches above.
- **Recommendation**: (1) on mobile, collapse Share into a single primary CTA and one overflow chevron; (2) drop the sticky bar entirely on the More tab — it's redundant. ~1 day of work to do cleanly with screenshots.

### B. Dashboard one-touch quote actions
You asked: *"from the dashboard there's no way to quickly one-touch action quotes, would that make sense to do."* **Yes — I'd ship it.**
- Each row in **Needs attention** has exactly one obvious thing to do (Resend, Send reminder, Open quote, Mark won/lost depending on `_reason`). Right now the whole row navigates to the detail.
- **Recommendation**: keep the row tap → detail, but add a single trailing icon-button per row whose action matches the `_reason`:
  - `Viewed — follow up` → **Resend** (re-fires `sendQuoteEmail` / SMS)
  - `Expires in Nd` → **Renew** (bumps expires_at +14d, no edit needed)
  - `Deposit pending` → **Copy link** (so they can DM the customer)
  - `Sent Nd ago — going cold` → **Send nudge** (text template #1)
- This is ~150 lines including the icon button, stopPropagation handling, and a confirmation toast. Want me to push it next?

### C. Quote archive timing
You flagged this — fixed in #6 above. Now archive only appears for declined/expired/paid/converted-to-invoice/draft. Recently-viewed quotes can't be one-swipe archived anymore.

### D. Analytics "Monthly quote value" — Sent vs Won legend is invisible
The "● Sent ● Won" legend dots are too low-contrast at mobile size. Recommend bumping dot size to 8px and using `--blue` / `--green` brand tokens. Cosmetic, ~10 lines.

### E. Templates page is a paywall ghost town for free users
Every body field shows a Pro-locked blurred preview. Even after clicking into a row, you get the same Upgrade-to-Pro CTA. For a free user the page is essentially a single Upgrade button stretched across three screens.
- **Recommendation**: show ONE preview row with a "Customise these messages with Pro" callout. Hide the rest. The current 8-card scroll teaches free users that the app is mostly locked off, which we don't want during onboarding.

### F. Foreman AI bottom sheet (IMG_2185) covers content
On mobile, opening Foreman from the star button slides up a sheet that covers ~60% of the viewport including the row you may have been about to tap. The sheet has no Close affordance visible above the keyboard.
- **Recommendation**: (1) drag handle at the top; (2) add an `X` in the top-right; (3) start at 40% height instead of 60% so the underlying dashboard is still glanceable.

### G. Quotes-list filter row scrolls horizontally on phone
The status pills (All / Needs follow-up / Draft / Sent / Viewed / Approved / Done) overflow off the right edge on iPhone widths. Currently scrolls horizontally — discoverable but easy to miss. Either compact the labels ("Follow-up" instead of "Needs follow-up") or move "Done" into a "More" menu.

### H. Settings has only 5 tabs but the page header reads as a wall of preferences
The Profile tab is dense — 9 input fields stacked. On mobile, the user scrolls past Trade / Province / Phone / Email / Quote Validity before reaching the Save button. Recommend grouping into 3 collapsible sections: **Business**, **Quote defaults**, **Notifications email**. Save bar pins to the bottom.

## Per-page sanity check (desktop + mobile, every screen)

| Page | Desktop | Mobile | Notes |
|---|---|---|---|
| Landing | ✓ | ✓ | Blank-bands bug fixed in last deploy. |
| Login | ✓ | ✓ | Solid. |
| Signup | ✓ | ✓ | Settles slowly (~25s for networkidle, perf only). |
| Dashboard | ✓ | ✓ | See recommendation **B** (one-touch actions). |
| Quotes list | ✓ | ✓ | See recommendation **G**; swipe behaviour now correct (#6). |
| Quote builder (new) | ✓ | ✓ | Stepper renders, trade/province defaults reasonable. |
| Quote detail | ✓ | ⚠ | See recommendation **A**. |
| Invoices list | ✓ | ✓ | One invoice in test data. |
| Invoice new | ✓ | ✓ | Form fields render. |
| Invoice detail | ✓ | ✓ | Clean. |
| Customers | ✓ | ✓ | VALUE truncation fixed (#5); header mismatch fixed in last deploy. |
| Schedule | ✓ | ✓ | This-week view, empty days collapse nicely. |
| Analytics | ⚠ | ⚠ | Three fixes shipped (#2, #3, #4); still see recommendation **D**. |
| Templates | ⚠ | ⚠ | Default-tab fix shipped (#1); see recommendation **E**. |
| Settings | ✓ | ⚠ | See recommendation **H**. |
| Billing | ✓ | ✓ | Clean. |
| Payments setup | ✓ | ✓ | Onboarding intro renders post-fix (was infinite spinner). |
| Public quote (bad token) | ✓ | ✓ | "Quote unavailable" UI works. |
| Public invoice (bad token) | ✓ | ✓ | "Invoice unavailable" UI works. |
| Foreman AI sheet | n/a | ⚠ | See recommendation **F**. |

## Verification

- `node tests/clickthrough-audit.mjs` → all 5 personas pass, no new console errors.
- `node tests/ux-audit.mjs` → 14 desktop + 13 mobile screenshots captured at `tests/audit-runs/ux-20260520/`.

## Open question for you

Of recommendations **A–H**, which do you want me to push next? My instinct is A → B → F → E in that order (highest user-pain to lowest, ignoring my obvious bias toward dashboard quick-actions). Confirm and I'll batch them into a follow-up PR.
