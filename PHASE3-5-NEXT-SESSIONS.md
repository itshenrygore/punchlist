# Phase 7 — Customer-surface tier parity assessment

**Question:** Does Kristine's experience (public-quote, public-invoice, project-portal) feel as premium as Henry's (dashboard, quote-detail, invoice-detail)?

**Method:** Side-by-side static comparison across the four taste axes from the V100 audit (Confidence, Calm, Delight, Reduction). Grounded in open findings that already quantify the gap.

---

## Verdict: **moderate gap, concentrated in two vectors**

The contractor surface has pulled ahead of the customer surface on two specific axes after Phase 1–6 work:

1. **Icon consistency** — contractor surfaces converted many emoji to lucide-react during Phases 1/6; customer surfaces still carry ~170 emoji across public-quote, project-portal, and the customer-facing conversation avatars.
2. **Loading/error recovery** — contractor surfaces got skeleton pass in Phase 2 (UX-020 resolved); some customer surfaces still use simpler loaders.

Everything else — typography discipline, token adoption, button density, empty states — is at rough parity or better on customer surfaces because Phase 2 specifically prioritized public-quote-page and public-invoice-page.

---

## Axis-by-axis comparison

### Confidence — customer -0.3 vs contractor

| Proof point | Contractor | Customer | Delta |
|---|---|---|---|
| Lucide icon adoption on primary actions | Dashboard ActionListRow, quote-builder photo-remove all converted (Phase 1, 6) | `conv-avatar.jsx` still 👤🔧 (UX-012); `project-portal-page.jsx` tabs still 📋📝💳💬 (UX-034); `quote-detail-page.jsx` contact buttons 📞💬✉ (UX-036) | **-1.0** |
| Inline-style leakage | Cleaned up in dashboard, quote-builder, invoice-detail | `project-portal-page.jsx` still has raw `#ea580c`, `#fef3c7`, `#f4f4f5` (UX-021); MessagesTab has 7+5 inline-style properties on compose+send (UX-035); TermsSection has 6-property inline cluster (UX-042) | **-1.0** |
| Primary CTA class discipline | Dashboard `btn-primary` + `btn-lg` correctly (Phase 1, UX-027 resolved) | Public-quote `Approve & Sign` overrides its own class's fontSize/padding/fontWeight inline (UX-014) | **-0.5** |

### Calm — customer +0.1 vs contractor

| Proof point | Contractor | Customer | Delta |
|---|---|---|---|
| Fold-line primary action | Dashboard job-form above fold on 375w (Phase 7 verified) | Public-quote "Approve & Sign" uses `public-shell-sticky-cta` — always reachable regardless of scroll (design win) | **+0.5** |
| Quietness of chrome | Mobile-nav 56px + app-shell header ~56px | `public-shell-header` is single-row with logo + contractor name only; no nav chrome; `.doc-shell` background is calm paper-like `--doc-bg` | **+0.2** |
| Skeleton coverage | Phase 2 raised from 7/25 to broader adoption | Public-quote skeleton added Phase 2 (UX-003 resolved); public-amendment copy-pasted spinner pattern still present (UX-032 **resolved** but similar pattern existed) | **-0.3** |

Net: customer surfaces are meaningfully calmer than contractor because they have less to show. The `doc-shell` paper aesthetic is deliberately quieter than the `app-shell` working surface.

### Delight — customer -0.5 vs contractor

| Proof point | Contractor | Customer | Delta |
|---|---|---|---|
| Voice quality | Dashboard empty state "You're all caught up / Next quote is a good one" is a signature line | Project-portal Updates empty state is flat "No updates yet" (UX-043 canon says port the dashboard style here) | **-0.5** |
| Micro-interactions | ActionListRow `:active` scale, toast undo on dismiss (UX-004 resolved) | Approve-sign modal has return-focus (Phase 2) but no celebratory feedback on approval beyond banner change | **-0.3** |
| Contractor identity | Dashboard branding stable (`conv-avatar` uses initials/logo where converted) | Public-quote contractor avatar still 🔧 emoji — Kristine sees a generic wrench glyph as Kira's face (UX-025 resolved for contractor card, **UX-012 open for conversation thread**) | **-0.3** |

### Reduction — customer +0.2 vs contractor

| Proof point | Contractor | Customer | Delta |
|---|---|---|---|
| Primary CTA count above fold | Phase 1 resolved UX-008 (two "New quote" CTAs → one) | Public-quote single Approve primary; public-invoice single Pay primary | **+0.3** |
| Route complexity | 23 internal app routes | 5 public routes (invoice, quote, additional-work, amendment, project) | **+0.5** |
| Code duplication | Dashboard code consolidated | `project-portal QuoteTab` duplicates ~500 lines of `public-quote-page.jsx` (UX-044); `UpdatesTab` cards duplicate standalone amendment/AW pages (UX-045) | **-0.5** |

Net: customer surfaces win on reduction at the UX level but lose significantly on code reduction — the parallel maintenance risk is real and is Phase 8 / structural refactor scope.

---

## Ranking

| Surface | Perceived tier | Top pull |
|---|---|---|
| `public-quote` | Top-1% candidate | Paper-like calm; single strong CTA; proof of trust via company name, avatar (emoji notwithstanding), contact link |
| `public-invoice` | Top-1% candidate | Same calm; payment options fragmentation (UX-039) is the one pull-down |
| `dashboard` | Top-1% candidate | ActionListRow quality; "Text Kristine" label specificity; empty state voice |
| `quote-detail` | Top-5% | Emoji contact buttons (UX-036) pull it below dashboard; content-density right |
| `quote-builder` | Top-5% | Review step is excellent; catalog overlay now Phase-7-cleaned; UX-022 one-line JSX still an eyesore in code but not user-visible |
| `invoice-detail` | Top-5% | Phase 6 `.input--dense` + `.btn--xs` work landed |
| `project-portal` | **Top-20%** | **The single weakest customer surface.** 4 emoji nav tabs (UX-034), parallel code with public-quote (UX-044), inline hex leakage (UX-021, UX-053), flat empty states. Kristine lives here after approval — this is her post-sale experience. |
| `settings` | Top-20% | Voice fracture UX-016, inline toggle UX-050, raw hex banners UX-047, UX-049, UX-052 |

**Most critical tier-parity finding:** `project-portal-page.jsx` is Kristine's ongoing home after approval — it receives payments, updates, messages, amendments — and it's the surface that has received the least Phase 1–6 attention. Phase 8 (voice) and the Session 1c emoji sweep together would close most of the gap, but **project-portal deserves its own pass** because of the parallel-code risk (UX-044, UX-045).

**Recommendation for Session 1f / next planning cycle:** Promote a dedicated "Project portal elevation" phase, scoped to:
- Extract shared QuoteTab from `public-quote-page.jsx` (closes UX-044)
- Extract shared AmendmentCard / AdditionalWorkCard from standalone pages (closes UX-045)
- Convert emoji nav tabs to lucide (closes UX-034)
- Token-sweep raw hex (closes UX-021, UX-053)
- Port dashboard empty-state voice to UpdatesTab, MessagesTab (aligns with Phase 8)

Estimated effort: 1 day code consolidation + 1 day visual polish + 0.5 day voice pass = **2.5 days** for a surface that's currently dragging the customer-journey tier down.

---

## One-line summary

**Kristine's quote-approval moment is top-1%; her post-approval life in the project portal is top-20%. Closing that gap is the single highest-leverage customer-surface investment remaining.**
