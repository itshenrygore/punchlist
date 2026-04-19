// ═══════════════════════════════════════════
// PUNCHLIST — Command palette action registry
// v100 Phase 9 (UX-006).
//
// Philosophy:
//   Linear-level cmd-K: actions compose with records. When Henry hits ⌘K
//   at his 40th quote of the week, he types "nudge kr" → Enter, not
//   "quotes" → click → scroll → click → click.
//
// Design:
//   - Actions are plain objects. No React, no hooks. Easy to test, easy
//     to extend.
//   - Each action has a `match` function that returns a relevance score
//     for a given query + ctx, or 0 to exclude. Higher is better.
//   - `run(ctx, helpers)` performs the action. Helpers are injected by
//     the palette (navigate, toast, signOut, toggleTheme, ...) so
//     actions stay testable.
//   - Contextual actions (Nudge X, Mark paid) are *generated* from
//     records — we don't hardcode "Nudge Kristine"; we expand
//     `buildContextualActions(ctx.quotes, ctx.invoices)` at query time.
//
// Voice (Phase 8):
//   Labels use specific verbs + objects. "Nudge Kristine" not "Send
//   follow-up". "Mark Invoice #1042 paid" not "Update status". First-
//   person warmth where the contractor is the sender.
// ═══════════════════════════════════════════

// ── Fuzzy match: token-subsequence scorer ────────────────────────────
// Returns 0 for no match, higher for tighter matches. We weight:
//   - exact substring in label:   1000
//   - all query tokens found:      500 + bonus per keyword hit
//   - keyword-only match:          100
// This is cheap and good-enough for < 500 actions. If we ever cross
// that, swap in fuse.js.
export function scoreMatch(query, haystack) {
  if (!query) return 0;
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const hay = (haystack.label + ' ' + (haystack.keywords || []).join(' ')).toLowerCase();

  // Exact substring in label → highest
  if (haystack.label.toLowerCase().includes(q)) return 1000 - haystack.label.length;

  // All tokens appear somewhere (label or keywords)
  const tokens = q.split(/\s+/).filter(Boolean);
  const allFound = tokens.every(t => hay.includes(t));
  if (allFound) {
    // Bonus if every token is in the label specifically
    const inLabel = tokens.every(t => haystack.label.toLowerCase().includes(t));
    return (inLabel ? 800 : 500) - haystack.label.length;
  }

  return 0;
}

// ── Global actions: available everywhere ─────────────────────────────
// Shortcut strings are for display only. The palette itself does not
// bind them — shortcuts are registered in a separate keymap so users
// can trigger actions WITHOUT opening the palette.
const GLOBAL_ACTIONS = [
  {
    id: 'nav.dashboard',
    label: 'Open dashboard',
    group: 'Go to',
    keywords: ['home', 'dashboard', 'today'],
    shortcut: 'g d',
    icon: '🏠',
    run: (_ctx, { navigate }) => navigate('/app'),
  },
  {
    id: 'nav.quotes',
    label: 'Open quotes',
    group: 'Go to',
    keywords: ['quotes', 'list', 'all quotes'],
    shortcut: 'g q',
    icon: '📄',
    run: (_ctx, { navigate }) => navigate('/app/quotes'),
  },
  {
    id: 'nav.invoices',
    label: 'Open invoices',
    group: 'Go to',
    keywords: ['invoices', 'billing', 'money', 'paid'],
    shortcut: 'g i',
    icon: '💸',
    run: (_ctx, { navigate }) => navigate('/app/invoices'),
  },
  {
    id: 'nav.contacts',
    label: 'Open contacts',
    group: 'Go to',
    keywords: ['contacts', 'customers', 'people', 'clients'],
    shortcut: 'g c',
    icon: '👥',
    run: (_ctx, { navigate }) => navigate('/app/contacts'),
  },
  {
    id: 'nav.bookings',
    label: 'Open bookings',
    group: 'Go to',
    keywords: ['bookings', 'schedule', 'calendar', 'jobs'],
    shortcut: 'g b',
    icon: '📅',
    run: (_ctx, { navigate }) => navigate('/app/bookings'),
  },
  {
    id: 'nav.analytics',
    label: 'Open analytics',
    group: 'Go to',
    keywords: ['analytics', 'stats', 'numbers', 'close rate', 'revenue'],
    shortcut: 'g a',
    icon: '📊',
    run: (_ctx, { navigate }) => navigate('/app/analytics'),
  },
  {
    id: 'nav.settings',
    label: 'Open settings',
    group: 'Go to',
    keywords: ['settings', 'preferences', 'profile', 'templates'],
    shortcut: 'g s',
    icon: '⚙️',
    run: (_ctx, { navigate }) => navigate('/app/settings'),
  },
  {
    id: 'nav.billing',
    label: 'Open billing & plan',
    group: 'Go to',
    keywords: ['billing', 'subscription', 'pro', 'upgrade', 'plan'],
    icon: '💳',
    run: (_ctx, { navigate }) => navigate('/app/billing'),
  },

  // ── Create ────────────────────────────────────────────────────────
  {
    id: 'create.quote',
    label: 'New quote',
    group: 'Create',
    keywords: ['new', 'create', 'quote', 'estimate', 'bid'],
    shortcut: '⌘ N',
    icon: '＋',
    run: (_ctx, { navigate }) => navigate('/app/quotes/new'),
  },

  // ── Settings ──────────────────────────────────────────────────────
  {
    id: 'theme.toggle',
    label: 'Toggle light / dark theme',
    group: 'Preferences',
    keywords: ['theme', 'dark', 'light', 'mode', 'appearance'],
    icon: '🌓',
    run: (_ctx, { toggleTheme }) => { toggleTheme(); },
  },
  {
    id: 'help.shortcuts',
    label: 'Show keyboard shortcuts',
    group: 'Help',
    keywords: ['shortcuts', 'keys', 'keyboard', 'help', '?'],
    shortcut: '?',
    icon: '⌨️',
    run: (_ctx, { openShortcutsHelp }) => openShortcutsHelp(),
  },

  // ── Session ───────────────────────────────────────────────────────
  {
    id: 'session.signout',
    label: 'Sign out',
    group: 'Account',
    keywords: ['logout', 'sign out', 'exit'],
    icon: '↪',
    run: async (_ctx, { signOut, navigate }) => {
      try { await signOut(); } catch (e) { console.warn('[PL]', e); }
      navigate('/login');
    },
  },
];

// ── Contextual actions ───────────────────────────────────────────────
// Generated from records so labels are specific ("Nudge Kristine" not
// "Nudge customer"). Actions only surface when they make sense — a
// "Mark paid" action doesn't appear for a paid invoice.
//
// The handoff for actions that require a modal (nudge flow) uses
// sessionStorage.pl_cmdk_intent. The target page reads + clears it on
// mount and opens the modal. This avoids URL pollution and keeps the
// action self-contained to the palette.

export const CMDK_INTENT_KEY = 'pl_cmdk_intent';

export function buildContextualActions(ctx) {
  const out = [];
  const quotes = ctx.quotes || [];
  const invoices = ctx.invoices || [];

  // Nudge — only for sent/viewed quotes with a phone number on file
  for (const q of quotes) {
    const firstName = (q.customer?.name || '').split(' ')[0] || q.customer?.name;
    if (!firstName) continue;
    if (!['sent', 'viewed'].includes(q.status)) continue;
    if (!q.customer?.phone) continue;
    out.push({
      id: `nudge.${q.id}`,
      label: `Nudge ${firstName}`,
      sublabel: q.title || 'Untitled quote',
      group: 'Act on a quote',
      keywords: ['nudge', 'followup', 'follow up', 'remind', firstName, q.title].filter(Boolean),
      icon: '📣',
      run: (_c, { navigate }) => {
        try {
          sessionStorage.setItem(CMDK_INTENT_KEY, JSON.stringify({
            kind: 'nudge',
            quoteId: q.id,
            at: Date.now(),
          }));
        } catch (e) { console.warn('[PL]', e); }
        navigate(`/app/quotes/${q.id}`);
      },
    });
  }

  // Send draft quote — navigate to detail, which is where the Send flow lives
  for (const q of quotes) {
    if (q.status !== 'draft') continue;
    const firstName = (q.customer?.name || '').split(' ')[0] || 'customer';
    out.push({
      id: `send.${q.id}`,
      label: `Send quote to ${firstName}`,
      sublabel: q.title || 'Untitled quote',
      group: 'Act on a quote',
      keywords: ['send', firstName, q.title].filter(Boolean),
      icon: '→',
      run: (_c, { navigate }) => navigate(`/app/quotes/${q.id}`),
    });
  }

  // Mark invoice paid — only for unpaid invoices, direct API call
  for (const inv of invoices) {
    if (inv.status === 'paid') continue;
    const label = inv.invoice_number
      ? `Mark ${inv.invoice_number} paid`
      : `Mark ${inv.customer?.name || 'invoice'} paid`;
    out.push({
      id: `markpaid.${inv.id}`,
      label,
      sublabel: inv.customer?.name || inv.title || '',
      group: 'Act on an invoice',
      keywords: ['mark paid', 'paid', 'paid up', inv.invoice_number, inv.customer?.name].filter(Boolean),
      icon: '✓',
      run: async (_c, { markInvoicePaid, toast, refreshContext }) => {
        try {
          await markInvoicePaid(inv.id, null);
          toast(`${inv.invoice_number || 'Invoice'} marked paid`, 'success');
          refreshContext?.();
        } catch (e) {
          toast(e?.message || 'Couldn\u2019t mark as paid. Try again.', 'error');
        }
      },
    });
  }

  return out;
}

// ── Build the full list of actions for a given ctx ───────────────────
export function buildAllActions(ctx) {
  return [...GLOBAL_ACTIONS, ...buildContextualActions(ctx)];
}

// ── Rank + filter for a query ────────────────────────────────────────
// When query is empty, return the global actions grouped naturally (no
// contextual ones — they'd flood with "Nudge X" rows).
// When query is non-empty, score every action and sort desc.
export function rankActions(query, actions, limit = 8) {
  const q = (query || '').trim();
  if (!q) {
    // Empty: show a curated top-of-list
    return actions
      .filter(a => !a.id.startsWith('nudge.') && !a.id.startsWith('send.') && !a.id.startsWith('markpaid.'))
      .slice(0, limit);
  }
  return actions
    .map(a => ({ a, s: scoreMatch(q, a) }))
    .filter(x => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .slice(0, limit)
    .map(x => x.a);
}

// ── Keyboard shortcut definitions (for the Help overlay + the handler) ─
// Two families: global (always bound) and palette-only (bound while the
// palette is open). The palette-only ones live inside the palette
// component; this list is the global set.
export const GLOBAL_SHORTCUTS = [
  { keys: '⌘ K', label: 'Open the command palette', group: 'Everywhere' },
  { keys: '/',   label: 'Open the command palette (quick)', group: 'Everywhere' },
  { keys: '?',   label: 'Show this shortcuts reference', group: 'Everywhere' },
  { keys: '⌘ N', label: 'New quote', group: 'Create' },
  { keys: 'g d', label: 'Go to dashboard', group: 'Navigate' },
  { keys: 'g q', label: 'Go to quotes', group: 'Navigate' },
  { keys: 'g i', label: 'Go to invoices', group: 'Navigate' },
  { keys: 'g c', label: 'Go to contacts', group: 'Navigate' },
  { keys: 'g b', label: 'Go to bookings', group: 'Navigate' },
  { keys: 'g a', label: 'Go to analytics', group: 'Navigate' },
  { keys: 'g s', label: 'Go to settings', group: 'Navigate' },
  { keys: 'Esc', label: 'Close any open modal or palette', group: 'Everywhere' },
];
