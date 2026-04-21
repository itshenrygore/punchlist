import { useEffect, useRef, useState } from "react";

/**
 * Hero-side product surface.
 * Cycles through four states to show the quote building itself:
 *  0 — empty / prompt
 *  1 — AI drafting scope (skeleton shimmer)
 *  2 — line items resolved with prices
 *  3 — sent to customer (stamp + approval glow)
 *
 * Pauses on hover. Loops cleanly.
 */
export default function HeroQuotePreview() {
  const [phase, setPhase] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    const tick = () => {
      if (!paused.current) setPhase((p) => (p + 1) % 4);
    };
    const timings = [2200, 2000, 3200, 2600];
    const id = setTimeout(tick, timings[phase]);
    return () => clearTimeout(id);
  }, [phase]);

  const lines = [
    { label: "Demo existing tile backsplash", qty: 1, price: 240 },
    { label: "Supply & install 30 sq ft subway tile", qty: 30, price: 18 },
    { label: "Grout, seal, and finish edges", qty: 1, price: 180 },
    { label: "Haul-away & site cleanup", qty: 1, price: 120 },
  ];
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const tax = Math.round(subtotal * 0.13);
  const total = subtotal + tax;

  return (
    <div
      className="relative"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      {/* Soft ambient shadow layer */}
      <div className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-br from-slate-200/60 via-transparent to-slate-100/40 blur-2xl" />

      {/* Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)]">
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          </div>
          <div className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            punchlist.ca/quotes/new
          </div>
          <div className="w-12" />
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-5">
          {/* Header row */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Quote #Q-2418
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                Kitchen backsplash — 14 Pine St
              </div>
              <div className="mt-0.5 text-xs text-slate-500">For: Sarah Chen</div>
            </div>
            <StatusPill phase={phase} />
          </div>

          {/* Prompt shown in phase 0 */}
          <div
            className={`mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 transition-all duration-500 ${
              phase === 0 ? "opacity-100" : "opacity-60"
            }`}
          >
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Job description
            </div>
            <TypingLine
              text="rip out old tile, install subway tile backsplash — maybe 30 sq ft, need to be out by friday"
              active={phase === 0}
            />
          </div>

          {/* Line items */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-slate-400">
              <span>Scope</span>
              {phase === 1 && (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 normal-case tracking-normal">
                  <Spinner /> drafting…
                </span>
              )}
              {phase >= 2 && (
                <span className="text-emerald-600 normal-case tracking-normal">
                  4 items · ready
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {lines.map((line, i) => (
                <LineRow key={i} line={line} phase={phase} index={i} />
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="mt-4 space-y-1.5 text-sm">
            <Row label="Subtotal" value={phase >= 2 ? fmt(subtotal) : "—"} muted />
            <Row label="Tax (HST)" value={phase >= 2 ? fmt(tax) : "—"} muted />
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm font-medium text-slate-900">Total</span>
              <span className="text-lg font-semibold tabular-nums text-slate-900">
                {phase >= 2 ? fmt(total) : "—"}
              </span>
            </div>
          </div>

          {/* Action button */}
          <button
            disabled={phase < 2}
            className={`mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-500 ${
              phase === 3
                ? "bg-emerald-600 text-white"
                : phase >= 2
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {phase === 3 ? "✓ Sent to Sarah · viewed 2 min ago" : "Send to customer"}
          </button>
        </div>

        {/* Approved stamp overlay */}
        {phase === 3 && (
          <div className="pointer-events-none absolute right-4 top-4 rotate-[8deg] rounded border-2 border-emerald-500/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600/80">
            Approved
          </div>
        )}
      </div>

      {/* Phase indicator */}
      <div className="mt-4 flex justify-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <button
            key={i}
            onClick={() => setPhase(i)}
            aria-label={`Show phase ${i + 1}`}
            className={`h-1 rounded-full transition-all ${
              phase === i ? "w-6 bg-slate-900" : "w-1.5 bg-slate-300 hover:bg-slate-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function LineRow({ line, phase, index }) {
  const showContent = phase >= 2;
  const shimmer = phase === 1;
  return (
    <div
      className="flex items-center justify-between px-3 py-2.5 text-sm"
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className={`h-4 w-4 flex-shrink-0 rounded border transition-all ${
            showContent
              ? "border-emerald-500 bg-emerald-500"
              : "border-slate-200 bg-white"
          }`}
        >
          {showContent && (
            <svg viewBox="0 0 16 16" className="h-full w-full text-white">
              <path
                d="M4 8.5l2.5 2.5L12 5.5"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        {showContent ? (
          <span className="truncate text-slate-700">{line.label}</span>
        ) : (
          <span
            className={`h-3 flex-1 rounded ${
              shimmer ? "animate-pulse bg-slate-200" : "bg-slate-100"
            }`}
            style={{ maxWidth: `${60 + (index % 3) * 15}%` }}
          />
        )}
      </div>
      <span className="ml-3 text-xs tabular-nums text-slate-500">
        {showContent ? (
          <>
            {line.qty} × {fmt(line.price)}
          </>
        ) : (
          <span
            className={`inline-block h-3 w-14 rounded ${
              shimmer ? "animate-pulse bg-slate-200" : "bg-slate-100"
            }`}
          />
        )}
      </span>
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${muted ? "text-slate-600" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}

function StatusPill({ phase }) {
  const map = [
    { label: "Draft", dot: "bg-slate-400", bg: "bg-slate-100 text-slate-600" },
    { label: "Drafting", dot: "bg-amber-400", bg: "bg-amber-50 text-amber-700" },
    { label: "Ready", dot: "bg-slate-900", bg: "bg-slate-100 text-slate-800" },
    { label: "Approved", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700" },
  ];
  const s = map[phase];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${s.bg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function TypingLine({ text, active }) {
  const [visible, setVisible] = useState(text);
  useEffect(() => {
    if (!active) {
      setVisible(text);
      return;
    }
    setVisible("");
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setVisible(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [active, text]);
  return (
    <span className="italic text-slate-600">
      {visible}
      {active && visible.length < text.length && (
        <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-slate-400 align-middle" />
      )}
    </span>
  );
}

function Spinner() {
  return (
    <svg className="h-3 w-3 animate-spin" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function fmt(n) {
  return `$${n.toLocaleString("en-CA", { minimumFractionDigits: 0 })}`;
}
