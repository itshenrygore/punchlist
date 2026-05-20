# Punchlist — Full App Audit & Rating

**Date**: 2026-05-20
**Scope**: every major workflow and persona experience
**Method**: live screenshots of the deployed prod app (`punchlist.ca`)
**Criteria per flow**: Frictionless · Intuitive · Aesthetic · Premium · Complete

Grade scale: **A** = mass-market ready · **B** = solid but visible gaps · **C** = functional but rough · **D** = broken or missing

---

## Overall: **B+**

The product is closer to launch-ready than the dev-honest version suggests. The core quote flow is genuinely premium for a v1, the mobile experience is on-par with established competitors (Jobber, Houzz Pro), and the visual identity is consistent. The gaps to "A" are mostly polish, completeness in secondary surfaces (schedule, invoices), and a handful of conversion-path UX details.

Estimated work to reach **A** overall: ~2-3 focused weeks across 8-10 follow-up PRs.

---

## Workflow Ratings

### 1. Onboarding (signup → first quote) — **B**

*What I saw*: signup page (`01_signup-empty.png`) → trade picker → land in dashboard with no items.

**Strengths**
- Signup copy is tight ("Build professional quotes in minutes")
- Required terms checkbox blocks invalid submit (good)
- Trade picker on signup step 2 customizes downstream catalog (smart)
- "5 free quotes/month, no credit card" trust line below

**Gaps to A**
1. **No first-quote handhold.** After signup, user lands on empty dashboard with "What's the job?" input but no glove-on-hand walkthrough. Onboarding wizard exists in code (`onboarding-wizard.jsx`) but doesn't push the user toward their first quote with confidence.
2. **No "import existing customers" path.** A contractor switching tools wants to bring their address book.
3. **No sample quote / interactive demo** inside the app after signup — they sit on a blank dashboard until they describe a job.
4. **Email verification is invisible.** No "check your email" moment for the contractor — if they signed up with a typo'd email, they won't know until something fails.
5. **Logo upload + business profile** is buried in Settings — the first quote will go out with no branding unless they hunt for it.

**To reach A**: post-signup interactive 60-second tour: "describe a job → see scope → send to test phone → upload logo." Use the first-quote moment as the success metric.

---

### 2. Dashboard — **A−**

*What I saw*: `10_dashboard.png` — greeting, $1,293 in open quote, "What's the job?" + New quote, Needs attention with Send follow-up button, Recent quotes (6), Customers + Follow-up messages tiles, monthly-payment encouragement, sent-this-month progress bar.

**Strengths**
- The greeting + dollar anchor ($1,293 in open quote) lands. Real numbers, not vanity stats.
- "Needs attention" with the per-row quick-action button (Send follow-up) is genuinely premium — most competitors require drilling in.
- Sent-this-month progress bar nudges activation without nagging.
- One-tap quote start via the "What's the job?" inline input.

**Gaps to A**
1. **"Recent quotes" is a wall of identical drafts** (4× "50 Gallon Hot Water Tank Replac…" all No customer / Draft). Cluttered. Should auto-dedupe near-identical drafts or surface unique entries.
2. **No daily revenue chart at a glance** — Stripe-style mini sparkline of payouts this month would carry a lot.
3. **"Let customers pay monthly — you still get the full amount"** banner repeats the Foreman section's pitch. Could be a payments-setup CTA if the contractor isn't onboarded yet, otherwise hidden.
4. **No upcoming jobs surface** on the dashboard — the Schedule tab exists but contractors expect "what's today" at the top.

**To reach A**: collapse near-duplicate drafts, add a "Today" strip pulling from Schedule, add a payment-status mini chip near the greeting.

---

### 3. Quote Builder (Describe → Scope → Review) — **A**

*What I saw*: `22_quote-builder-described.png` (job step), `23_quote-builder-suggestions.png` (catalog suggestions), `24_quote-builder-after-add-all.png` (post-add).

**Strengths**
- The catalog-first architecture (R10) is the standout feature. **294ms** to suggestions is best-in-class for the category.
- "Suggested for this job · Review and add the ones you want — you're in control" sets the right expectation.
- Add-all (6) batches all suggestions with one tap.
- "58% Commonly missed items" callout invites scope review without nagging.
- Trade auto-detect (R10 followup) puts the right catalog in play.

**Gaps to A**
1. **"Build the scope →" button is below the fold on mobile** — visible only after the "Job: …" suggested title appears. Should be sticky at the bottom of the screen during the describe step.
2. **No mid-build save indicator** — after "Add all (6)" the toast is the only feedback. A persistent "Saved" timestamp near the total would build confidence.
3. **No price-range hint shown by default** on accepted items. Catalog has typical_low/high but those don't surface in the line item view.
4. **Scope summary / assumptions / exclusions** are accessible via "Scope, terms & notes" accordion but not surfaced until the contractor opens it. These are the items that make a quote look professional.
5. **No image-per-line-item.** A roofing quote with no photos feels generic. Optional image upload per line item would be a differentiator.

**To reach A**: sticky CTA on describe step, persistent save indicator, surface price ranges next to user-entered prices, default-open the scope summary box.

---

### 4. Quote Detail (Contractor view) — **B+**

*What I saw* (from earlier audit rounds): per-tab layout works, Send/Share dedup fixed, follow-up modal solid.

**Strengths**
- Tab structure (Details / Messages / More) is clean
- Phase banners adapt to status (Draft → Sent → Viewed → Approved) — well-thought-out
- Customer messaging right in the quote thread is a real differentiator vs sending emails
- Mobile sticky bottom bar gives one-tap Resend / Copy link
- Follow-up nudge modal pre-fills the message template

**Gaps to A**
1. **No quote PDF export.** Contractors and customers often want a PDF for records / loan docs / insurance. The codebase has `api/export-pdf.js` — but I haven't seen a download button surfaced in the UI.
2. **No "Mark won/lost manually"** — for the contractor who closed a quote via phone/email and just wants to record it. Currently only the customer can approve.
3. **No revision history.** "What did I change between v1 and v2?" — important when a customer requests changes.
4. **No estimated cost / margin field** for the contractor. They see what the customer pays. They don't see what THEIR margin is on this scope. Even a hidden internal field would help.

**To reach A**: PDF download button, manual mark-won, revision diff view, internal margin field.

---

### 5. Public Quote (Customer view) — **untested in this audit**

I wasn't able to capture this in the run (the test couldn't access a share token for an unsigned-in customer view). Based on code (`public-quote-page.jsx` is 64kB — bigger than the contractor-side quote-detail), the customer surface is substantial.

**Known good** (from code review)
- Monthly payment selector exists (Affirm-aligned)
- E-signature flow built in
- Question / change-request thread back to the contractor
- Photo upload from customer side

**Suspected gaps** (worth manually verifying)
1. Does the public quote show the contractor's logo prominently? (Premium feel)
2. Is the monthly option's APR disclosure clear? (Regulatory)
3. Can the customer save the quote as a PDF themselves?
4. Is there a clear "what happens after I sign" expectation set?

**Recommend**: Send a quote to your own phone and walk through as a customer. Take notes.

---

### 6. Invoice Flow — **C+**

*What I saw*: `40_invoices-list.png` (1 paid invoice for $422), `41_invoices-new.png` (basic form).

**Strengths**
- "Quote → Invoice" handoff exists in the workflow (we saw this surface on quote detail)
- Customer search + manual line items
- Due date defaults sensibly
- Subtotal / tax / total auto-compute

**Gaps to A** (the biggest of any workflow)
1. **The new-invoice form is visibly under-finished.** No customer auto-fill from a recent quote. No "create invoice from approved quote" prefilled CTA on the form itself.
2. **No partial payments / payment plans.** Real contractors break invoices into milestones (30% deposit, 50% midway, 20% completion). The current form is single-total.
3. **No recurring invoices** for maintenance contractors.
4. **No invoice-specific status flow** (Sent / Viewed / Overdue / Paid).
5. **No reminder automation** ("Send reminder after 7 days unpaid").
6. **No QuickBooks / Xero export** despite being promised on the landing page.
7. **No PDF for invoices** (same gap as quotes).
8. **Status pills in the invoice list** just say "Paid" — nothing about pending invoices or how long they've been outstanding.

**To reach A**: this is the biggest single area of work. Treat the invoice flow like a Stripe-level deliverable, not a quote-builder add-on.

---

### 7. Customer Management — **B**

*What I saw*: `50_customers.png` (empty state).

**Strengths**
- Empty state copy "Customers are added automatically when you create a quote" sets the right expectation — no friction
- Export / Import CSV / + Add controls at the right level
- Search bar
- The earlier audit showed individual customer drawers with stats (won revenue, win rate, tenure) — premium feature

**Gaps to A**
1. **No tags** beyond what's hidden in the drawer. "VIP", "Referral source", "Trade contact" tags would help quickly filter.
2. **No customer-quote history view** at a glance — clicking a customer should show every quote ever sent to them, including won/lost.
3. **No bulk operations** (send a "we miss you" message to dormant customers, etc.)
4. **No customer-side review/rating** capture — contractors lose social proof currency by not asking.
5. **Import CSV** is great in principle — but what's the column format expected? No example shown.

**To reach A**: full customer detail page with history + tags + bulk ops + an "ask for review" button.

---

### 8. Schedule — **C**

*What I saw*: `60_schedule.png` — This week, Sun May 17 through Sat May 23, all days empty with "+ Open" placeholders.

**Strengths**
- Clean week view
- Today highlighted in brand color (good visual anchor)
- Previous / next week chevrons

**Gaps to A**
1. **Day-level only.** No hour-level scheduling. A contractor with 3 jobs on Tuesday needs to know which is morning / afternoon.
2. **No "scheduled vs unscheduled approved jobs" view.** Approved quotes that haven't been booked should surface here.
3. **No customer reminder / SMS** for upcoming appointments.
4. **No team scheduling** (if the contractor has helpers).
5. **No integration with Google Calendar / Apple Calendar.**
6. **"+ Open" placeholders feel passive.** Should be "+ Add a job" with clearer affordance.

**To reach A**: hour-level day view, approved-but-unscheduled queue, calendar export (.ics), customer reminder SMS the day before.

---

### 9. Analytics — **B+**

*What I saw*: `70_analytics.png` — Revenue tracked $422, 50% close rate, $1,293 open pipeline, $422 avg job value, 16d avg days to close, 1 needs follow-up, Monthly quote value chart, Revenue by trade, Top job types (5 listed), 1 quote needs follow-up CTA.

**Strengths**
- The metric cards lead with real numbers (Revenue tracked $422), not pseudo-metrics like "engagement"
- Close rate is the *right* hero metric for a contractor
- Top job types is genuinely useful — "I make most of my money on water heaters"
- Range chips (3 / 6 / 12 / All time)
- "1 quote needs a follow-up · Review →" CTA

**Gaps to A**
1. **Top job types includes near-duplicates** (rows 3 + 4 are "Relocate Kitchen Sink and Dishwasher" with one word difference). Same dedup issue from R3 — the 10-token slice still allows similar titles to coexist.
2. **No trend chart** for revenue over time (just totals).
3. **No "this month vs last month" comparison.**
4. **No customer-level analytics** (top customers by lifetime value).
5. **"Sent vs Won" monthly chart** doesn't have a legend in the screenshot — both are dots but the colors aren't explained on first glance.
6. **No CSV export.**

**To reach A**: trend lines, period-over-period deltas, top-customers card, exportable.

---

### 10. Templates — **B**

*What I saw*: `80_templates.png` — Job templates default tab (R5 fix worked), empty state with "Create blank template" + "Build a quote first" CTAs.

**Strengths**
- Defaults to Job templates (R5 fix)
- Empty state copy is task-oriented ("Build a quote first" is smart — it gets them to value sooner)
- Pro-only feature with clear paywall

**Gaps to A**
1. **No preview of what a template looks like** — empty state is text-only.
2. **No "save current quote as template"** prominent button after sending a quote.
3. **No template categories** ("HVAC", "Plumbing"...) — would help as users build 10+ templates.
4. **No public template library** (community-shared) — could be a moat for trade-specific contractor onboarding.

**To reach A**: visual preview of a template, "save as template" button at the end of a successful quote, community starter templates for each trade.

---

### 11. Settings — **B+**

*What I saw*: `90_settings.png` — Profile tab (open), Payments / Messages / Notifications tabs, business profile fields with sample data, collapsibles for Quote defaults & Quote tracking.

**Strengths**
- 5 clearly-labeled tabs
- Collapsibles (R3 fix) keep the Profile tab from being a 9-field wall
- Save button is sticky bottom
- "Auto-applied to labour line items" hint is helpful

**Gaps to A**
1. **No team management tab** — what about adding a second user?
2. **No data export** ("Download all my data") in Account tab — currently it's a single button with limited UX.
3. **No notification frequency controls** (daily digest vs real-time).
4. **No theme / dark mode toggle** (already hidden per code comment, but contractors on phones in bright sun would benefit).
5. **The logo URL field** asks contractors to paste a URL. Most don't know what that means. Upload-only would be cleaner.

**To reach A**: team tab, contractor-friendly logo upload (no URL paste fallback), notification preference granularity.

---

### 12. Payments Setup — **A−**

*What I saw*: `91_payments-setup.png` — "Get paid faster" intro, 3 benefit cards, "Set up payments" CTA + "Maybe later", Stripe + no-fee trust marks.

**Strengths**
- Premium-feel intro screen (R1 fix landed this perfectly)
- 3 benefit cards are concrete (zero monthly fees, $6K → $250/mo example, 2 business days payout)
- "Maybe later" preserves contractor autonomy
- Trust marks at the bottom

**Gaps to A**
1. **No "current status" view** for contractors who started setup but didn't finish — they'd land here and see the intro again instead of the resume screen.
2. **No payout schedule controls** (daily vs weekly).
3. **No "test mode"** for new contractors who want to send a fake payment to see the flow.

**To reach A**: granular status surfaces, payout-frequency control, test-payment mode.

---

### 13. Foreman AI — **A**

*What I saw*: `99_foreman-open.png` — Foreman panel open from bottom nav, hard-hat logo, greeting + first-time intro card, 2 quick-action prompts visible, "Ask anything" input focused.

**Strengths**
- Hard-hat logo identity (R4) is unique and memorable
- First-time intro card succinctly explains capability
- Quick prompts (What should I focus on today? / Jobs at risk) are high-value, in-the-moment
- 50vh sheet height leaves dashboard glanceable underneath
- Bottom-nav placement makes it a coequal action

**Gaps to A**
1. **The default behavior on AI failure isn't gracefully communicated** — silent failure is right, but a contractor who's never had Foreman respond might wonder if it's working.
2. **No persistent conversation history** — every open is a fresh session. Sometimes you want to revisit yesterday's pricing question.
3. **Photo upload via the icon button** in the input bar is unclear in label. A small "Snap a photo" label below the input would help.
4. **Voice input** is shown but might not work on all phones — needs fallback.

**To reach A**: session continuity, clearer photo affordance, transparent AI-status (small "thinking" or "working" indicator).

---

### 14. Mobile Nav / Information Architecture — **A−**

*What I saw*: across all screenshots — Home · Quotes · + (centered create) · Customers · Foreman bottom nav consistent.

**Strengths**
- 5 slots, all reachable by thumb
- Centered "+" emphasizes the primary creation action
- Active state clear (icon + label tint)
- Foreman as a peer (R5 fix)

**Gaps to A**
1. **Search / global command palette** isn't bottom-nav surfaced — the top bar has a magnifying glass but it's small on mobile.
2. **Notifications bell in top bar** is fine but contractors expect a badge count, which we don't display prominently.
3. **No quick-switcher** for multiple businesses / accounts (future need).

**To reach A**: badge counts on the bell, future-proof for multi-account.

---

## Persona Ratings

### Persona A: New contractor (first 5 minutes) — **B**

What they want: "Show me what this is and let me send my first quote."

Where they win: catalog speed (294ms), monthly-payment pitch, clear pricing.

Where they stumble:
- Empty dashboard with no clear next-step "do this first"
- Settings → Profile is buried — first quote sends with no business name unless they go hunting
- No interactive demo / sample quote to play with

**To reach A**: post-signup wizard that walks them through one full quote → preview → ship.

---

### Persona B: Working contractor (daily user) — **A−**

What they want: "Get me from job-site description to sent-quote in <3 minutes."

Where they win: catalog suggestions, quick-action buttons on dashboard, mobile bottom nav, share link + customer messaging, Foreman in pocket.

Where they stumble:
- Schedule is too thin to rely on
- No PDF download for the quote → customers asking for one
- Invoice flow doesn't match the quality of the quote flow

**To reach A**: PDF export, invoice flow rebuild, hour-level scheduling.

---

### Persona C: Customer (receives + signs the quote) — **untested**

What they want: "Understand what I'm buying, see what it costs me monthly, sign it from my phone."

Suspected wins (code review): monthly selector, photo gallery, e-signature, messaging back to the contractor.

Recommended action: **walk through the public quote flow yourself end-to-end, take notes**, then we audit.

---

### Persona D: Pro contractor (power user) — **B**

What they want: "Reduce my admin time. Make my business look premium."

Where they win: templates, Foreman, analytics dashboard, deposit collection.

Where they stumble:
- No team management
- No QuickBooks export despite the landing promising it
- No revision history on quotes
- No bulk customer ops

**To reach A**: team accounts (Pro tier perk), QuickBooks export (CSV → mapped), bulk customer operations.

---

## Cross-cutting opportunities

These don't belong to one flow but lift everything:

1. **Visual hierarchy of "draft" quotes.** The dashboard shows 4 identical drafts because the test account has them. Real contractors will too. Group / collapse / dedupe near-identical drafts to keep the dashboard readable.

2. **Toast verbosity.** Several flows over-toast ("Added: X", "Saved", "1 item added"). Consider a tighter rule: only toast when the action could plausibly fail or has a non-obvious result.

3. **Empty-state CTAs across the app are inconsistent.**
   - Customers: "Add your first customer" (action-oriented ✓)
   - Schedule: "+ Open" (passive ✗)
   - Templates: "Create blank template" + "Build a quote first" (good — gives a path)
   Make every empty state a doorway, not a wall.

4. **PDF export is missing from 3 surfaces** (quote detail, public quote, invoice detail). This is the single most-requested feature for paper-trail businesses.

5. **No global search** for quotes / customers. Top-bar search opens a command palette which is great in theory but unmemorable. A persistent search box on Quotes + Customers lists would help.

6. **The "Foreman AI" name should never appear as "AI" in user-facing copy** — already fixed in landing (R10) but worth a sweep through the app too.

7. **Onboarding wizard / tour** is the single biggest activation lever. A 60-second guided first-quote would lift new-user conversion meaningfully.

---

## Prioritized roadmap to overall **A**

If we shipped these 8 in 2-3 weeks, the app would feel A-grade for mass-market onboarding:

| # | Item | Impact | Effort |
|---|---|---|---|
| 1 | **Invoice flow rebuild** (partials, status, reminders, QB export) | High | High |
| 2 | **PDF export** on quote detail, public quote, invoice detail | High | Med |
| 3 | **Post-signup interactive tour** (first-quote handhold) | High | Med |
| 4 | **Hour-level scheduling** + approved-but-unscheduled queue | Med | Med |
| 5 | **Dashboard draft-dedup** + "Today" strip | Med | Low |
| 6 | **Customer detail page** (quote history + tags + bulk ops) | Med | Med |
| 7 | **Manual mark-won/lost** + revision diff on quote detail | Med | Low |
| 8 | **Customer-side audit + tightening** (walk it yourself first) | High | Low |

After these 8, the only B-grade flows remaining are Templates and Settings, both of which are good-enough-for-launch and can polish in a second pass.
