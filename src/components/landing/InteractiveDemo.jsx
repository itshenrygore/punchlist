import { useMemo, useState } from "react";

/**
 * InteractiveDemo
 *
 * Three panes, left to right:
 *   1. Job description (editable textarea + preset prompts)
 *   2. AI-suggested scope (tokenized parsing, add/remove, live markup)
 *   3. Polished quote output (what the customer will receive)
 *
 * The "AI" is rule-based — it tokenizes the description against a library of
 * trade patterns (bathroom, kitchen, drywall, flooring, etc). This keeps the
 * demo self-contained, fast, and honest: in production this is where your
 * actual scope model plugs in. The interface contract (description -> items)
 * is the same.
 *
 * Why rule-based here: the landing page is the one surface that cannot fail
 * or stall. Network round-trip to an LLM for every keystroke would be slow,
 * brittle, and expensive. The demo's job is to communicate the *shape* of
 * the workflow — which this does faithfully.
 */
export default function InteractiveDemo() {
  const [description, setDescription] = useState(PRESETS[0].text);
  const [activePreset, setActivePreset] = useState(0);
  const [markup, setMarkup] = useState(25); // %
  const [removed, setRemoved] = useState(new Set());

  const suggested = useMemo(() => suggestScope(description), [description]);
  const items = useMemo(
    () => suggested.filter((s) => !removed.has(s.id)),
    [suggested, removed]
  );

  const subtotal = items.reduce((s, it) => s + it.qty * it.unitCost, 0);
  const marked = Math.round(subtotal * (1 + markup / 100));
  const tax = Math.round(marked * 0.13);
  const total = marked + tax;

  const handlePreset = (i) => {
    setActivePreset(i);
    setDescription(PRESETS[i].text);
    setRemoved(new Set());
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60 shadow-[0_10px_40px_-15px_rgba(15,23,42,0.15)]">
      {/* Preset row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-5 py-3">
        <span className="mr-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          Try
        </span>
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => handlePreset(i)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              activePreset === i
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_1.1fr_1.2fr]">
        {/* PANE 1 — Job description */}
        <div className="border-b border-slate-200 bg-white p-6 lg:border-b-0 lg:border-r">
          <PaneHeader step="01" title="Describe the job" />
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setActivePreset(-1);
              setRemoved(new Set());
            }}
            rows={9}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
            placeholder="Describe the job like you'd text a buddy…"
          />
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <KeywordHint description={description} />
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Your markup
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="50"
                step="5"
                value={markup}
                onChange={(e) => setMarkup(Number(e.target.value))}
                className="flex-1 accent-slate-900"
              />
              <span className="w-10 text-right text-sm font-semibold tabular-nums text-slate-900">
                {markup}%
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Applied to subtotal. Never shown to the customer.
            </p>
          </div>
        </div>

        {/* PANE 2 — Scope */}
        <div className="border-b border-slate-200 bg-white p-6 lg:border-b-0 lg:border-r">
          <PaneHeader
            step="02"
            title="Review the scope"
            right={
              <span className="text-xs text-slate-500">
                {items.length} items · drag to reorder
              </span>
            }
          />

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              Add a description to see suggested scope.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {items.map((it) => (
                <ScopeItem
                  key={it.id}
                  item={it}
                  onRemove={() =>
                    setRemoved((prev) => {
                      const next = new Set(prev);
                      next.add(it.id);
                      return next;
                    })
                  }
                />
              ))}
            </ul>
          )}

          {removed.size > 0 && (
            <button
              onClick={() => setRemoved(new Set())}
              className="mt-3 text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            >
              Restore {removed.size} removed item{removed.size > 1 ? "s" : ""}
            </button>
          )}

          {/* The "caught" card — this is the AI-is-useful proof */}
          <CaughtCard items={suggested} />
        </div>

        {/* PANE 3 — Quote output */}
        <div className="bg-slate-50/80 p-6">
          <PaneHeader
            step="03"
            title="Customer view"
            right={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live preview
              </span>
            }
          />

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    From
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    Northline Renovations
                  </div>
                </div>
                <div className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-bold text-white">
                  NR
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs text-slate-500">Quote for</div>
              <div className="mt-0.5 font-medium text-slate-900">
                {PRESETS[activePreset]?.customer ?? "Your customer"}
              </div>

              <div className="mt-4 space-y-2">
                {items.slice(0, 5).map((it) => (
                  <div
                    key={it.id}
                    className="flex items-start justify-between gap-3 border-b border-slate-50 pb-2 text-sm last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="text-slate-800">{it.label}</div>
                      <div className="text-xs text-slate-500">
                        {it.qty} {it.unit}
                      </div>
                    </div>
                    <div className="shrink-0 tabular-nums text-slate-700">
                      {fmt(
                        Math.round(
                          it.qty * it.unitCost * (1 + markup / 100)
                        )
                      )}
                    </div>
                  </div>
                ))}
                {items.length > 5 && (
                  <div className="pt-1 text-xs text-slate-500">
                    + {items.length - 5} more items
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-1 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{fmt(marked)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tax (HST 13%)</span>
                  <span className="tabular-nums">{fmt(tax)}</span>
                </div>
                <div className="flex items-baseline justify-between pt-2">
                  <span className="text-sm font-medium text-slate-900">Total</span>
                  <span className="text-2xl font-semibold tabular-nums text-slate-900">
                    {fmt(total)}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
                  Approve & pay deposit
                </button>
                <button className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300">
                  Ask a question
                </button>
              </div>
              <div className="mt-3 text-center text-[11px] text-slate-400">
                Secured by Stripe · Valid for 30 days
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Subcomponents ---------------- */

function PaneHeader({ step, title, right }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          {step}
        </div>
        <div className="mt-0.5 text-base font-semibold text-slate-900">{title}</div>
      </div>
      {right}
    </div>
  );
}

function ScopeItem({ item, onRemove }) {
  return (
    <li className="group flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2.5 transition hover:border-slate-200 hover:shadow-sm">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold uppercase ${
            item.ai
              ? "bg-violet-50 text-violet-600 ring-1 ring-violet-100"
              : "bg-slate-100 text-slate-500"
          }`}
          title={item.ai ? "Suggested by AI" : "From your description"}
        >
          {item.ai ? "AI" : "✓"}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm text-slate-800">{item.label}</div>
          <div className="text-[11px] text-slate-500">
            {item.qty} {item.unit} · {fmt(item.unitCost)}/unit
          </div>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600"
        aria-label="Remove"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

function KeywordHint({ description }) {
  const tags = detectTags(description);
  if (tags.length === 0) {
    return <span className="text-slate-400">Tip: mention trade, rough quantity, deadline.</span>;
  }
  return (
    <>
      <span className="text-slate-400">Detected:</span>
      {tags.map((t) => (
        <span
          key={t}
          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
        >
          {t}
        </span>
      ))}
    </>
  );
}

function CaughtCard({ items }) {
  const aiItems = items.filter((i) => i.ai);
  if (aiItems.length === 0) return null;
  return (
    <div className="mt-5 rounded-lg border border-violet-100 bg-violet-50/60 p-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
          +
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-violet-900">
            Caught {aiItems.length} item{aiItems.length > 1 ? "s" : ""} you almost missed
          </div>
          <div className="mt-1 text-xs text-violet-800/80">
            {aiItems.slice(0, 3).map((i) => i.label.toLowerCase()).join(", ")}
            {aiItems.length > 3 ? `, +${aiItems.length - 3} more` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Scope engine ---------------- */

const PRESETS = [
  {
    label: "Bathroom reno",
    customer: "Sarah Chen — 14 Pine St",
    text: "Full bathroom gut reno. Remove old tub, vanity, and tile. Install new 60\" vanity, tiled walk-in shower (about 40 sq ft of tile), new toilet. Homeowner is supplying fixtures. Need to be done in 3 weeks.",
  },
  {
    label: "Deck rebuild",
    customer: "Mike Torres — 88 Lakeshore",
    text: "Tear down existing 12x16 deck, frame and build new deck same footprint with pressure treated, composite decking on top, new railings. Stairs to side yard.",
  },
  {
    label: "Kitchen backsplash",
    customer: "Jen Park — 220 Willow",
    text: "Remove existing tile backsplash, install new subway tile about 30 sq ft, grout, caulk, done by friday",
  },
  {
    label: "Basement drywall",
    customer: "Dan O'Neill — 47 Rosehill",
    text: "Frame and drywall basement, approx 600 sq ft of wall, include insulation, tape and mud, prime ready for paint. No electrical.",
  },
];

// Library of trade patterns. Each pattern contributes line items.
// `base` = items extracted from the description.
// `commonlyMissed` = AI-surfaced items users forget.
const PATTERNS = [
  {
    match: /tile|backsplash|shower.*tile|tiled/i,
    base: ({ sqft }) => [
      sqft &&
        item("Supply & install tile", sqft, "sq ft", 14, false),
      item("Grout, seal, and finish edges", 1, "lot", 180, false),
    ],
    commonlyMissed: () => [
      item("Underlayment / backer board", 1, "lot", 95, true),
      item("Edge profiles & trim", 1, "lot", 65, true),
    ],
  },
  {
    match: /bath(room)?|tub|toilet|vanity|shower/i,
    base: ({ text }) => [
      /remov|gut|tear|demo|rip/i.test(text) &&
        item("Demo & haul existing fixtures", 1, "lot", 420, false),
      /vanity/i.test(text) && item("Install vanity", 1, "ea", 220, false),
      /toilet/i.test(text) && item("Install toilet", 1, "ea", 180, false),
      /tub/i.test(text) && item("Install tub / surround", 1, "ea", 540, false),
    ],
    commonlyMissed: () => [
      item("Plumbing rough-in connections", 1, "lot", 380, true),
      item("Exhaust fan vented to exterior", 1, "ea", 220, true),
      item("Permit & inspection coordination", 1, "lot", 150, true),
    ],
  },
  {
    match: /deck|decking|railing|composite|pressure treated|pt\b/i,
    base: ({ dims, text }) => [
      /tear|remov|demo/i.test(text) &&
        item(
          "Demo existing deck",
          dims ? Math.round(dims.w * dims.l) : 180,
          "sq ft",
          4,
          false
        ),
      item(
        "Frame new deck (PT lumber, joists, ledger)",
        dims ? Math.round(dims.w * dims.l) : 180,
        "sq ft",
        11,
        false
      ),
      /composite/i.test(text) &&
        item(
          "Composite decking install",
          dims ? Math.round(dims.w * dims.l) : 180,
          "sq ft",
          9,
          false
        ),
      /rail/i.test(text) &&
        item("Railings install", dims ? Math.round((dims.w + dims.l) * 2) : 50, "lin ft", 38, false),
      /stair/i.test(text) && item("Stairs (3–4 risers)", 1, "set", 620, false),
    ],
    commonlyMissed: () => [
      item("Footings & post anchors", 6, "ea", 85, true),
      item("Flashing at ledger", 1, "lot", 120, true),
      item("Building permit", 1, "ea", 180, true),
    ],
  },
  {
    match: /drywall|frame|framing|insulat|mud|tape|basement/i,
    base: ({ sqft, text }) => [
      /frame|framing/i.test(text) &&
        item("Frame walls (2x4, plates, studs 16\" oc)", sqft || 600, "sq ft", 5.5, false),
      /insulat/i.test(text) &&
        item("Insulation (R14 batt)", sqft || 600, "sq ft", 2.2, false),
      /drywall|tape|mud/i.test(text) &&
        item("Drywall, tape, mud, sand, prime", sqft || 600, "sq ft", 4.8, false),
    ],
    commonlyMissed: () => [
      item("Vapor barrier", 1, "lot", 160, true),
      item("Corner bead & outside corners", 1, "lot", 110, true),
      item("Dust protection & daily cleanup", 1, "lot", 180, true),
    ],
  },
];

function item(label, qty, unit, unitCost, ai) {
  return {
    id: `${label}-${qty}`.toLowerCase().replace(/\s+/g, "-"),
    label,
    qty,
    unit,
    unitCost,
    ai,
  };
}

function suggestScope(text) {
  if (!text || text.trim().length < 10) return [];
  const ctx = parseContext(text);
  const out = [];
  const seen = new Set();

  for (const p of PATTERNS) {
    if (!p.match.test(text)) continue;
    for (const it of p.base(ctx)) {
      if (!it) continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
    for (const it of p.commonlyMissed(ctx)) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
  }

  // Fallback so the demo never looks empty
  if (out.length === 0) {
    out.push(
      item("Labor — general scope", 8, "hrs", 75, false),
      item("Materials (to be itemized)", 1, "lot", 400, false),
      item("Site cleanup & disposal", 1, "lot", 120, true)
    );
  }

  return out;
}

function parseContext(text) {
  const sqftMatch = text.match(/(\d+)\s*(sq\.?\s*ft|square feet|sf)/i);
  const dimMatch = text.match(/(\d+)\s*[x×]\s*(\d+)/);
  return {
    text,
    sqft: sqftMatch ? Number(sqftMatch[1]) : null,
    dims: dimMatch ? { w: Number(dimMatch[1]), l: Number(dimMatch[2]) } : null,
  };
}

function detectTags(text) {
  const tags = [];
  if (/bath|tub|toilet|vanity|shower/i.test(text)) tags.push("bathroom");
  if (/kitchen|backsplash|cabinet|counter/i.test(text)) tags.push("kitchen");
  if (/deck|railing|composite|pt\b/i.test(text)) tags.push("deck");
  if (/drywall|frame|insulat|basement/i.test(text)) tags.push("drywall");
  if (/tile|grout/i.test(text)) tags.push("tile");
  const sqft = text.match(/(\d+)\s*(sq\.?\s*ft|sf|square feet)/i);
  if (sqft) tags.push(`${sqft[1]} sq ft`);
  const dim = text.match(/(\d+)\s*[x×]\s*(\d+)/);
  if (dim) tags.push(`${dim[1]}×${dim[2]}`);
  const days = text.match(/(friday|monday|tuesday|wednesday|thursday|saturday|sunday|\d+\s*weeks?|\d+\s*days?)/i);
  if (days) tags.push(`due: ${days[1]}`);
  return tags;
}

function fmt(n) {
  return `$${Number(n).toLocaleString("en-CA")}`;
}
