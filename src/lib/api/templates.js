// ═══════════════════════════════════════════
// PUNCHLIST — Message templates API
// v100 Workstream A Part 1 (M2). Spec: PHASE4-V100-PLAN.md §3.1, §3.2.
//
// Exports:
//   getSystemDefaults()                        → { initial_sms: '...', ... }
//   listTemplates(userId, locale='en')         → merged array of template rows
//   upsertTemplate(userId, key, body, locale)  → row (Pro-only; throws PRO_REQUIRED)
//   resetTemplate(userId, key, locale='en')    → void (always allowed)
//   renderTemplate(body, tokens)               → string (client-side token sub; used by M3)
//   TEMPLATE_KEYS                              → ordered list for the Settings UI
//   t(key)                                     → pass-through i18n wrapper (§9.3)
//
// Plan gating is enforced here on the client in addition to (not in
// place of) RLS on the server. The v100 DB migration ships a policy
// that permits any authenticated user to write their own template row
// — we guard Pro at the API layer so the Settings UI can catch the
// specific error code and pop the inline upsell. Server-side plan
// enforcement lives on the profile row itself (profiles.subscription_plan)
// so a forged client can't escalate without also tampering with their
// own plan column, which is protected by a separate admin-only policy.
// ═══════════════════════════════════════════
import { supabase, friendly } from './shared.js';
import { isPro } from '../billing.js';

// ── i18n pass-through (§9.3 — deferred, but future-proofed now) ──
export function t(key) { return key; }

// ── Static system defaults (single source of truth) ──
// Copy is load-bearing per §3.2 — do not reword without a psychology review.
const SYSTEM_DEFAULTS = Object.freeze({
  initial_sms:
    'Hi {firstName}, your quote from {senderName} is ready:\n\n{quoteTitle} — {total}\n\n{link}',
  followup_1_sms:
    'Hi {firstName} — any questions on the {quoteTitle} quote? Happy to walk through anything. {link}',
  followup_2_sms:
    "Hi {firstName}, wanted to make sure the {quoteTitle} quote didn't get buried. Still on the table if you want to move forward — just reply or tap the link. {link}",
  followup_3_sms:
    "Hi {firstName}, last nudge on the {quoteTitle} quote — totally understand if the timing isn't right, just let me know either way so I can close the file. {link}",
  approved_thanks_sms:
    "Thanks {firstName}! Really appreciate you trusting me with this. I'll be in touch shortly about next steps.",
  deposit_received_sms:
    "Thanks {firstName} — your {depositAmount} deposit came through. {nextStep} I'll take it from here.",
  invoice_ready_sms:
    'Hi {firstName}, invoice for {quoteTitle} is ready — {total}. Pay securely: {link}',
  job_complete_sms:
    'Hi {firstName}, all wrapped up at {quoteTitle}. Invoice coming your way — any last questions before I send it?',
});

// Ordered key list drives Settings UI rendering order.
export const TEMPLATE_KEYS = Object.freeze([
  'initial_sms',
  'followup_1_sms',
  'followup_2_sms',
  'followup_3_sms',
  'approved_thanks_sms',
  'deposit_received_sms',
  'invoice_ready_sms',
  'job_complete_sms',
]);

// Human-friendly labels for the Settings UI.
export const TEMPLATE_LABELS = Object.freeze({
  initial_sms:          'Initial send',
  followup_1_sms:       'First nudge',
  followup_2_sms:       'Second nudge',
  followup_3_sms:       'Last nudge',
  approved_thanks_sms:  'Thanks for approving',
  deposit_received_sms: 'Deposit received',
  invoice_ready_sms:    'Invoice ready',
  job_complete_sms:     'Job complete',
});

// Context blurbs shown under each template — make the psychology legible
// so contractors understand why they might NOT want to change it.
export const TEMPLATE_HINTS = Object.freeze({
  initial_sms:          'Sent when you first share the quote. Clear, direct, no friction.',
  followup_1_sms:       'Day 2 (by default). Asks a question instead of nagging — replies go up.',
  followup_2_sms:       "Day 4. Face-saving phrasing — \"didn't get buried\" opens the door without blame.",
  followup_3_sms:       'Day 7. Takeaway close — giving permission to say no paradoxically lifts yes rate.',
  approved_thanks_sms:  "Sent automatically when a customer approves. Gratitude + concrete next-step promise.",
  deposit_received_sms: 'Fires within seconds of the deposit clearing — turns anxiety into confidence.',
  invoice_ready_sms:    'Transactional moment. Clarity beats warmth here.',
  job_complete_sms:     'Wraps the job. Invites a final check-in before the invoice lands.',
});

export function getSystemDefaults() {
  // Return a fresh shallow copy so callers can mutate safely.
  return { ...SYSTEM_DEFAULTS };
}

// ── Public error code the UI listens for to trigger upsell ──
export const PRO_REQUIRED_CODE = 'PRO_REQUIRED';

function proRequiredError(templateKey) {
  const err = new Error('Customizing templates is a Pro feature.');
  err.code = PRO_REQUIRED_CODE;
  err.templateKey = templateKey;
  return err;
}

// ── Build a synthetic default row (for UIs that want one entry per key) ──
function synthDefault(userId, key, locale) {
  return {
    id: null,                    // null signals "not persisted yet"
    user_id: userId,
    template_key: key,
    locale,
    body: SYSTEM_DEFAULTS[key] ?? '',
    is_custom: false,
    updated_at: null,
    _isDefault: true,            // convenience flag for the UI
  };
}

// ── listTemplates ──
// Returns one row per TEMPLATE_KEYS entry. Custom rows come from DB;
// missing ones are synthesized from SYSTEM_DEFAULTS so the UI always
// has something to render (including offline).
export async function listTemplates(userId, locale = 'en') {
  if (!userId) throw new Error('listTemplates requires userId');

  let rows = [];
  try {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('user_id', userId)
      .eq('locale', locale);
    if (error) throw error;
    rows = Array.isArray(data) ? data : [];
  } catch (err) {
    // Soft failure (offline / RLS hiccup): still return defaults so UI renders.
    console.warn('[templates] listTemplates fell back to defaults:', err?.message || err);
    rows = [];
  }

  const byKey = new Map(rows.map(r => [r.template_key, r]));
  return TEMPLATE_KEYS.map(key => byKey.get(key) || synthDefault(userId, key, locale));
}

// ── upsertTemplate ──
// Writes a custom body. Free-plan users get PRO_REQUIRED — the UI
// catches the code and opens an inline upsell.
export async function upsertTemplate(userId, key, body, locale = 'en') {
  if (!userId) throw new Error('upsertTemplate requires userId');
  if (!TEMPLATE_KEYS.includes(key)) throw new Error(`Unknown template key: ${key}`);
  if (typeof body !== 'string') throw new Error('body must be a string');

  // Load the profile to check plan. We do this here (not at call sites)
  // so every caller is covered.
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('subscription_plan')
    .eq('id', userId)
    .maybeSingle();
  if (profileErr) throw new Error(friendly(profileErr));
  if (!isPro(profile)) throw proRequiredError(key);

  const payload = {
    user_id:      userId,
    template_key: key,
    locale,
    body,
    is_custom:    true,
    updated_at:   new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('message_templates')
    .upsert(payload, { onConflict: 'user_id,template_key,locale' })
    .select()
    .single();

  if (error) throw new Error(friendly(error));
  return data;
}

// ── resetTemplate ──
// Always allowed, even on free plan — we never trap a downgraded user
// inside a custom template they can't fix. We delete the row rather
// than flipping is_custom, so listTemplates falls back to the seeded
// default cleanly.
export async function resetTemplate(userId, key, locale = 'en') {
  if (!userId) throw new Error('resetTemplate requires userId');
  if (!TEMPLATE_KEYS.includes(key)) throw new Error(`Unknown template key: ${key}`);

  const { error } = await supabase
    .from('message_templates')
    .delete()
    .eq('user_id', userId)
    .eq('template_key', key)
    .eq('locale', locale);

  if (error) throw new Error(friendly(error));
  return { ok: true };
}

// ── renderTemplate ──
// Client-side token substitution. Missing tokens resolve to '' so we
// never render literal '{firstName}' in a customer-facing message.
// Shared with M3 (builder + follow-up modal) and the Settings preview.
const TOKEN_RE = /\{(\w+)\}/g;
export function renderTemplate(body, tokens = {}) {
  if (!body) return '';
  return String(body).replace(TOKEN_RE, (_, name) => {
    const v = tokens[name];
    return v === undefined || v === null ? '' : String(v);
  });
}

// ── getFollowupBody ──
// Convenience for M3: picks the right follow-up tier based on count.
// 0 → initial_sms, 1 → followup_1_sms, 2 → followup_2_sms, 3+ → followup_3_sms.
// (Initial is included so "first send" uses the same helper shape.)
export function getFollowupKeyByCount(followupCount) {
  const n = Math.max(0, Number(followupCount) || 0);
  if (n === 0) return 'initial_sms';
  if (n === 1) return 'followup_1_sms';
  if (n === 2) return 'followup_2_sms';
  return 'followup_3_sms';
}
