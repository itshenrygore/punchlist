# Punchlist Voice Guide

**v100 · Phase 8 · canonical reference**

This is the one-pager you read before you write anything that a user will
see. Toasts, error messages, buttons, empty states, modals, disclosures,
email/SMS bodies — everything.

The canon is already in the repo: the 8 system-default SMS templates at
`src/lib/api/templates.js:31-85` and their `TEMPLATE_HINTS` at 76-85.
When you're in doubt, re-read those 16 strings. They are the voice.

---

## The one-sentence version

**Punchlist sounds like a calm, specific tradesperson who respects the
reader's time and doesn't apologize for doing their job.**

---

## The six principles

### 1. Active voice. Always.

The subject does the thing. No hiding behind passives.

    NO   "An error occurred while saving"
    YES  "Couldn't save — try again?"

    NO   "A reminder will be sent"
    YES  "I'll nudge Kristine on Day 2."

### 2. Specific nouns, specific numbers

Vague words are insurance against being wrong. Punchlist is confident;
it doesn't need insurance.

    NO   "Some issues were detected"
    YES  "Password needs 8+ characters"

    NO   "Your changes have been saved"
    YES  "Nudge schedule saved"

When the object is knowable, name it. When the person is knowable, name
them. `ActionListRow` already does this — "Send quote to Kristine" beats
"Send."

### 3. Calm authority — never apologize for normal behavior

Saving a form isn't an apology-worthy act. Neither is loading a page.
If something genuinely went wrong, state it once, offer the next move,
and stop.

    NO   "Sorry, we're having trouble loading your settings"
    YES  "Couldn't load settings. Refresh?"

    NO   "Oops! Something went wrong."
    YES  "Something broke. Try again or contact support."

The apology budget is tiny. Spend it on things that actually harmed the
reader (a lost draft, a missed send), not on the app doing app things.

### 4. No SaaS jargon

If the word would appear unironically in a LinkedIn post, it's out.

**Banned:** leverage, utilize, seamless, empower, synergy, streamline,
unlock, unleash, supercharge, robust, best-in-class, world-class.

**Simpler replacements:** use, make easier, clean, faster.

Also out: "we" when you mean "Punchlist the software." The contractor is
the sender; Punchlist is the plumbing. When a customer gets a message,
it goes out as the contractor's message, not from Punchlist — that
principle shapes the copy too.

### 5. Psychology-aware phrasing

The 8 SMS templates are load-bearing because the wording changes outcomes.
Carry that care into the rest of the app.

- **Face-saving:** "didn't get buried" (not "you never replied").
- **Takeaway close:** "totally understand if the timing isn't right"
  (permission to say no paradoxically lifts the yes rate).
- **Concrete ownership:** "I'll take it from here" (not "We've received
  your deposit and will be in touch").
- **Question instead of nag:** "any questions on the quote?" (not
  "just following up").

### 6. Em-dash is `—`, not `--`

One glyph. Always. The `--` substitute is a tell that the writer didn't
care enough to reach for the correct punctuation. Punchlist cares.

On macOS: `⌥ + ⇧ + -`. On Windows: `Alt + 0151`.

---

## Patterns that work

### Reflective summaries on toggles

When a user flips a setting, confirm back what's now true in concrete
language. `settings-page.jsx` already does this with the `pl-reflective-summary`
block:

    Currently: SMS alerts are on — texts go to +1 403 555 0100.
    Currently: Invoice is sent automatically when you complete a job.

The word "Currently" does real work — it anchors the user in the present
state instead of the abstract toggle.

### First-person warmth for sender-facing messages

Anything that will go out to a customer as the contractor's voice uses
first-person singular:

    "I'll be in touch shortly about next steps."
    "I'll take it from here."
    "any questions? Happy to walk through anything."

And remind the contractor of that framing where relevant. The
followup-modal footer is the model:

> You're the sender — this goes out as your message, not from Punchlist.

### Specific verbs + objects on primary actions

    NO   "Send"          →  YES  "Send quote to Kristine"
    NO   "Save"          →  YES  "Save nudge schedule"
    NO   "Confirm"       →  YES  "Approve quote · $4,280"

If the object or person is knowable, name them. If they aren't, keep the
verb terse — don't pad.

### Errors: friendly surface, technical behind a disclosure

UI layer: one sentence, specific, next step if there is one.

    Couldn't load this amendment. The link may have expired —
    ask your contractor to resend.

Technical layer: behind `<details><summary>Technical details</summary>`
or hidden in a dev console. Never dump a raw error string next to
human-facing copy.

### Empty states: the dashboard "caught up" pattern is the reference

    Icon: check
    Title: You're all caught up
    Sub:   Next quote is a good one.
    CTA:   Build your next quote →

Three lines. Earned optimism (not forced cheer). A concrete next move.
Port this shape wherever an empty state is reachable by a well-used account.

For a brand-new account, shift the sub to orient instead of reassure:

    Title: No invoices yet
    Sub:   Complete a job and invoice with one tap. Your customer pays
           online — you get the money in 2 days.
    CTA:   (none needed — the path is elsewhere)

---

## The "did one person write this" test

Pick any 10 user-facing strings at random. Read them aloud in sequence.
Ask:

1. Could any of these have come from a different product?
2. Does the tone shift between strings (breezy here, corporate there)?
3. Does one string apologize where another is blunt?

If yes to any, you've found a voice fracture. Fix it or file it.

(Phase 8 ran this test — see `CHANGELOG-v100-UX-PHASE-8.md` §Random sample
audit for the results.)

---

## Quick reference card

| Context          | Do                                      | Don't                         |
|------------------|-----------------------------------------|-------------------------------|
| Success toast    | "Nudge schedule saved"                  | "Your changes have been saved"|
| Error toast      | "Couldn't connect to Stripe. Try again."| "An error occurred."          |
| Button label     | "Send quote to Kristine"                | "Submit"                      |
| Empty state      | 3 lines: title, orient, action          | One word ("Empty.")           |
| Disclosure       | "SMS is priced separately at ~$0.01/text." | "Standard messaging rates apply." |
| Toggle summary   | "Currently: X is on — …"                | (silence)                     |
| Punctuation      | `—`                                     | `--`                          |
| Outbound-to-customer | "I'll take it from here."           | "We have received your deposit." |

---

## When to break these rules

Legal copy, accessibility labels (`aria-*` strings), and transactional
receipts may need to be more formal or more terse. That's fine. The
principles are defaults, not laws.

But if you're reaching for "leverage" or "--" or "Sorry, something went
wrong," you're not breaking the rules for a reason — you're just writing
SaaS. Stop and rewrite.
