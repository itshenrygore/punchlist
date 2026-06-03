# Foreman — Contractor Perspective Evaluation

What works, what's missing, and what would push it from "useful assistant"
to "first thing the contractor reaches for when they're holding a phone in
a customer's kitchen".

Verified offline:
- `node tests/foreman-scenarios.mjs` — 42/42 checks pass against a mock
  Supabase. Every tool path produces useful output, every safety guard
  fires (refuses non-draft edits, masks contacts by default, clamps bad
  inputs, never auto-sends), and the 11 most common contractor scenarios
  all have tool coverage.
- `node tests/foreman-parser.test.mjs` — 11/11 message-bubble parser
  shapes pass (handles hyphen/asterisk/numbered bullets, en/em-dash and
  "to" range separators, single prices, ~$ approximate prices, bold-
  markdown names, dedups repeats).
- Live LLM behavior is not verified here — no API key in this sandbox.

The findings below come from walking through realistic flows in the
actual code paths and asking, at each step, "if I were the contractor,
what would feel slow / confusing / impossible?"

---

## Where Foreman is already strong

1. **Architecture is real.** ForemanContext is a clean pattern: any page
   can call `setQuoteContext` to give the assistant scope visibility and
   `setAddItemHandler` to receive items it suggests. Builder + detail
   page both wire it; the prompts stop lying about "this quote."

2. **The toolbox is the right shape.** 8 tools — three read tools
   (`read_quotes`, `read_contacts`, `read_quote_detail`), three write
   tools (`update_quote`, `create_quote`, `start_new_quote`), one
   draft tool (`draft_followup`), one reference tool (`lookup_pricing`)
   — cover the bulk of "what the contractor would ask in the moment."

3. **Safety guards are real, not theatre.**
   - `update_quote` is hard-gated to `status='draft'` — a sent or
     approved quote can never be silently rewritten. Confirmed by test.
   - `read_contacts` masks full email + phone by default and only
     reveals on explicit `include_contact_details: true`, which isn't
     in the public tool schema — the model can't unmask on its own.
   - `draft_followup` returns context but never sends. The UI send
     button requires a contractor tap. Confirmed: zero side effects
     during draft_followup execution.
   - String/number clamping on every `update_quote` and `create_quote`
     input. Bad inputs are skipped with a reason, never crash.

4. **Permits know about cities.** With `default_city` set, Foreman
   answers for that municipality by default and only asks "which city"
   when THIS job is somewhere else. AHJ fallback when it doesn't know
   the local rule.

5. **Conversation hygiene.** 4-hour auto-archive boundary cuts stale
   context out of the wire payload while keeping it visible to the
   contractor as "Earlier conversation". Token bill stays predictable.

6. **Streaming is real.** Anthropic SSE pipes through with mid-stream
   tool-use detection. First-token latency drops to the model's first
   delta instead of the full round-trip.

---

## Gaps, ranked by what they'd unlock in the field

### Tier 1 — would change daily behavior

#### 1. No "start a revision" path for sent quotes

The most common in-field moment Foreman can't handle:

> "While you're here, can you also fix the bathroom fan?"

The original quote has been sent and signed. `update_quote` refuses
(correctly — that's customer-visible work). The contractor has to
exit Foreman, find the quote, hit "Send revision," edit, resend.

**Fix:** add a `start_revision(quote_search, changes)` tool that opens
the in-app revision flow with the changes pre-staged. Doesn't auto-send
— surfaces the new draft for the contractor to review and ship to the
customer. Roughly mirrors `update_quote` but routes through the
revision pipeline instead of writing to the live quote.

#### 2. No "mark approved" / "request deposit" from chat

In the kitchen, customer says yes:

> "Great, I'll do it." → contractor wants to lock it in NOW.

Foreman can't change status or trigger a deposit request. Contractor
exits chat, navigates to the quote, taps Approve, taps Request
Deposit. By then the customer is making coffee, the moment's gone.

**Fix:** add `update_quote_status(quote_search, status)` tool, gated
to transitions that make sense for the contractor side (sent → approved,
approved → deposit_requested, etc.), with a confirm-via-UI affordance
in the message bubble (same pattern as the SMS send button).

#### 3. Photo diagnosis doesn't attach to anything

Contractor snaps a photo of a furnace nameplate. Foreman correctly
identifies the model + age + likely issues. The photo is then thrown
away — not attached to the quote, not stored as evidence, not saved
to the customer's history. If the contractor wants to send the photo
to the customer or reference it on the invoice, they have to take it
again.

**Fix:** when a photo accompanies a Foreman turn that resolves on an
active quote, offer "Save photo to this quote" — wires into the
existing `uploadQuotePhoto` API. Optional: a checkbox in the panel
("Auto-save diagnostic photos to the active quote").

#### 4. Photo diagnosis → quote line items is broken

After "what's wrong with this furnace?", Foreman's answer might be:

> "Looks like a cracked heat exchanger on a 1998 Lennox G24M.
> Furnace age makes a full replacement more cost-effective than
> the repair. Replace with a 96% AFUE unit, ~$4,800. Want me to
> scope it?"

The "Want me to scope it?" is great prose but doesn't wire to
`create_quote`. The contractor still has to say yes, then watch the
model re-derive scope. And the photo-derived facts (model, age,
estimated cost) don't ride along into the new quote.

**Fix:** when Foreman ends a photo-diagnosis with "Want me to scope
it?", make the YES path call `create_quote` with the diagnosis facts
pre-filled. Show a "Scope it" inline button so the contractor doesn't
have to type at all.

#### 5. No undo on `update_quote`

Foreman: "Raised vanity to $480. New total: $8,660."
Contractor: "Wait, I meant $280."

Today the contractor has to either tell Foreman to set it back (works
but feels slow) or open the quote and edit by hand. There's no one-tap
"Undo last change."

**Fix:** `update_quote` already knows the old price (it logs the
diff). Return it in the tool result so the model can include "(reply
'undo' to revert)" and the UI can render a quick Undo chip in the
message bubble.

### Tier 2 — would feel premium

#### 6. Active quote context can go stale mid-conversation

Contractor is on the Smith bathroom quote, asks "what's missing?" —
Foreman answers about the Smith bathroom. Then they navigate to the
Kevin water heater quote without closing Foreman. They ask "what
about the expansion tank?". The context bar updates but the
conversation continues — Foreman might still answer about Smith
because the previous turns are about that quote.

**Fix:** when ACTIVE QUOTE changes during an open Foreman session,
inject a system note into the next user turn: "(now editing: Kevin's
50 gal gas water heater)". Cheap, prevents 90% of the confusion.

#### 7. Voice in but no voice out

Speech input via Web Speech API works (contractor can dictate). But
Foreman never speaks back. On a job site with both hands on a wrench,
reading a five-line answer means putting the tool down. Text-to-speech
on the assistant message — opt-in, with a small play button on each
bubble — would be a significant on-site quality-of-life improvement.

**Fix:** Web Speech API `speechSynthesis` is available in every modern
browser. Add a small "play" icon to each assistant bubble; one tap
reads it. Persistence on whether to auto-play.

#### 8. No "remind me later"

> "Got it. Remind me to follow up with Kevin on Tuesday afternoon."

Foreman has no notification scheduler. The contractor has to set a
phone reminder themselves.

**Fix:** lightweight `schedule_reminder(quote_search, when, message)`
tool that drops a row into a new `foreman_reminders` table. Cron picks
it up and sends an in-app notification or SMS. Mid-effort — needs a
table + cron, not huge.

#### 9. "Save this quote as a template" not available

The contractor knows they'll quote the same kind of bathroom reno
again. Templates exist as a Punchlist feature, but Foreman can't
trigger it.

**Fix:** `save_as_template(quote_search, name)` tool that calls
`saveJobTemplate` (already exists, used by the templates page). One
sentence, one tool definition, three lines of executor.

#### 10. Historical pricing query is limited

> "What did I charge Bob for a similar bathroom last year?"

`read_quotes` returns 10 recent quotes. `lookup_pricing` returns
catalog prices. Neither answers "what did I actually charge in the
past?" Foreman has access to historical context only via the
business-snapshot string in the system prompt (close rate, recent
won quotes) — that's not enough to answer a "compare to my last X"
question.

**Fix:** `read_historical_quotes(item_or_customer, lookback_days)` —
queries past quotes filtered by line-item name or customer, returns
averaged prices. Useful for "what did I charge last time" and
"how does my faucet pricing compare to my own history".

### Tier 3 — polish, won't make-or-break

11. **Trade mismatch isn't surfaced inside Foreman** (only in the
    builder toast). If the contractor asks Foreman "scope this for me
    — it's plumbing" when the description is electrical, Foreman
    doesn't push back. Same `tradeMismatch` payload from the
    suggestion engine could ride along into the active-quote context.

12. **Ask-Foreman starter is verbose.** The current starter from a
    line-item tap is *"About this line item: 'Install kitchen faucet'
    ($220). Is this priced right for my province, is anything typically
    bundled with it that I'm missing, and would you change it?"* — too
    long for the input field on mobile. Could shorten to *"About 'Install
    kitchen faucet' ($220) — pricing OK? Anything missing?"* and rely on
    the active quote context for the rest.

13. **No batch "draft follow-ups for all viewed quotes."** Today the
    contractor has to ask one at a time. `draft_followup` takes a single
    `quote_search`. A small change: accept an array, or let the model
    chain. The chained-tool UX is awkward because each draft gets its
    own bubble with its own send button — the contractor would have to
    tap Send three times. Worth thinking about.

14. **No cost-discipline ceiling.** Foreman is rate-limited to 20
    req/min/IP. No per-user spend cap. A misbehaving model loop could
    rack up tokens. Not a contractor problem but worth a hard ceiling.

15. **No "open this customer in maps"** action. There's an `openMaps`
    helper but no Foreman tool surface. Field contractor often wants
    "directions to the next stop."

---

## Things to be careful with as Foreman grows

- **Don't let the tool list bloat past ~12.** Anthropic's tool-selection
  gets noisier at large surfaces. Beyond a dozen tools, the model starts
  picking wrong ones more often. Today's 8 is fine. The Tier 1 additions
  would push to 12-13.

- **Don't let `update_quote` extend to fields the contractor wouldn't
  expect.** Today it's name + price + quantity. If we add "change
  customer" or "change trade", the model could be steered (via
  customer-pasted descriptions) into account-takeover-adjacent
  behavior. Keep the schema narrow.

- **`schedule_reminder` and any future SMS-sending tool need explicit
  per-message confirm.** Sending things to customers without a tap is
  the fastest way to break the trust contractors give Foreman.

- **Don't auto-attach customer photos to the model without explicit
  trigger.** Today photos are only sent when the contractor opens the
  camera. Don't add a feature that silently includes the last quote
  photo in every Foreman turn.

---

## Quick-win priority order (if I were picking)

1. **#1 start_revision** — the most common "Foreman can't help me right
   now" moment for an active contractor. Low complexity, big leverage.
2. **#3 + #4 photo-to-quote bridge** — closes the loop on what's
   already the most magical-feeling interaction (snap → diagnose).
3. **#2 update_quote_status** — the kitchen-table close moment.
4. **#5 undo** — costs almost nothing once `update_quote` records the
   old price; massive trust signal.
5. **#7 voice out** — pure browser API, no backend, big on-site win.

Everything else can come later without it feeling broken.
