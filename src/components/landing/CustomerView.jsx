/**
 * CustomerView
 *
 * Split panel showing what you (the contractor) see in the app vs what the
 * homeowner sees on their phone. Proves the output is real, mobile-first,
 * and trust-signal strong (Stripe deposit, questions, approval).
 */
export default function CustomerView() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      {/* Your side */}
      <div>
        <div className="mb-5 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Your side
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_40px_-20px_rgba(15,23,42,0.15)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">Quote activity</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                Approved
              </span>
            </div>
            <span className="text-xs text-slate-500">Q-2418</span>
          </div>

          <ul className="divide-y divide-slate-100">
            <ActivityRow
              dot="emerald"
              title="Sarah approved the quote"
              meta="Today · 2:14 PM · deposit paid $1,240"
              primary
            />
            <ActivityRow
              dot="slate"
              title="Sarah viewed the quote"
              meta="Today · 11:02 AM · from iPhone"
            />
            <ActivityRow
              dot="slate"
              title="Sarah asked a question"
              meta="Yesterday · 6:48 PM"
              body="Can we do matte black fixtures instead of chrome?"
            />
            <ActivityRow
              dot="slate"
              title="You sent the quote"
              meta="Yesterday · 5:12 PM"
            />
          </ul>

          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
            No more "did you get my email?" No more chasing down signatures.
          </div>
        </div>
      </div>

      {/* Their side — phone */}
      <div>
        <div className="mb-5 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            What they see
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="flex justify-center">
          <PhoneFrame />
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ dot, title, meta, body, primary }) {
  const dotColor =
    dot === "emerald" ? "bg-emerald-500" : "bg-slate-300";
  return (
    <li className="flex gap-3 px-5 py-4">
      <div className="relative flex flex-col items-center">
        <span className={`mt-1.5 h-2 w-2 rounded-full ${dotColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${primary ? "font-semibold text-slate-900" : "text-slate-700"}`}>
          {title}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">{meta}</div>
        {body && (
          <div className="mt-2 rounded-md bg-slate-50 p-2.5 text-sm italic text-slate-600">
            "{body}"
          </div>
        )}
      </div>
    </li>
  );
}

function PhoneFrame() {
  return (
    <div className="relative">
      {/* Phone bezel */}
      <div className="relative rounded-[42px] border-[10px] border-slate-900 bg-slate-900 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.35)]">
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-xl bg-slate-900" />
        {/* Screen */}
        <div className="h-[560px] w-[280px] overflow-hidden rounded-[30px] bg-white">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pb-1 pt-3 text-[10px] font-semibold text-slate-900">
            <span>9:41</span>
            <span className="flex items-center gap-1.5">
              <span className="tracking-tighter">●●●●</span>
              <span className="inline-block h-2.5 w-4 rounded-sm border border-slate-900">
                <span className="block h-full w-[85%] rounded-[1px] bg-slate-900" />
              </span>
            </span>
          </div>

          {/* Header */}
          <div className="border-b border-slate-100 px-5 pb-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-[10px] font-bold text-white">
                  NR
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-900">
                    Northline Renovations
                  </div>
                  <div className="text-[9px] text-slate-500">Licensed · Insured</div>
                </div>
              </div>
              <div className="text-[9px] text-slate-400">Q-2418</div>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-3 px-5 py-4">
            <div>
              <div className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                Prepared for
              </div>
              <div className="text-sm font-semibold text-slate-900">Sarah Chen</div>
              <div className="text-[10px] text-slate-500">14 Pine St</div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                Project
              </div>
              <div className="text-xs text-slate-800">Kitchen backsplash install</div>
            </div>

            <div className="space-y-1.5">
              {[
                ["Demo existing tile", "$240"],
                ["Subway tile install · 30 sq ft", "$540"],
                ["Grout & finish", "$180"],
                ["Cleanup", "$120"],
              ].map(([l, v]) => (
                <div
                  key={l}
                  className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-[11px] last:border-b-0"
                >
                  <span className="text-slate-700">{l}</span>
                  <span className="tabular-nums text-slate-600">{v}</span>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-slate-900 p-3 text-white">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] opacity-80">Total</span>
                <span className="text-lg font-semibold tabular-nums">$1,240</span>
              </div>
              <div className="mt-0.5 text-[9px] opacity-60">incl. HST · deposit $310</div>
            </div>

            <button className="w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-semibold text-white">
              Approve & pay deposit
            </button>
            <button className="w-full rounded-lg border border-slate-200 py-2.5 text-xs font-medium text-slate-700">
              Ask a question
            </button>

            <div className="pt-1 text-center text-[9px] text-slate-400">
              Secured by Stripe
            </div>
          </div>
        </div>
      </div>

      {/* Side buttons */}
      <div className="absolute left-[-12px] top-24 h-8 w-1 rounded-l bg-slate-800" />
      <div className="absolute left-[-12px] top-36 h-12 w-1 rounded-l bg-slate-800" />
      <div className="absolute right-[-12px] top-28 h-16 w-1 rounded-r bg-slate-800" />
    </div>
  );
}
