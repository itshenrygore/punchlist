/**
 * WorkflowDepth
 *
 * Three cards, each showing a real product surface — not an icon grid.
 * The visuals are intentionally restrained DOM, not screenshots, so they
 * stay crisp at any size and don't bloat the bundle.
 */
export default function WorkflowDepth() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card
        title="Catch missing scope"
        body="AI reviews your description against hundreds of similar jobs and flags what's commonly forgotten — before it costs you a change order."
        visual={<CatchVisual />}
      />
      <Card
        title="Protect your margin"
        body="Markup is applied at the line-item level, hidden from the customer, and preserved across edits. You always know what you're making."
        visual={<MarginVisual />}
      />
      <Card
        title="Close without chasing"
        body="One link. Approve, ask, or pay deposit from a phone. You get a push notification the second it happens."
        visual={<CloseVisual />}
      />
    </div>
  );
}

function Card({ title, body, visual }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_0_rgba(15,23,42,0.02)] transition hover:shadow-[0_10px_30px_-15px_rgba(15,23,42,0.15)]">
      <div className="flex h-48 items-center justify-center border-b border-slate-100 bg-slate-50/60 p-5">
        {visual}
      </div>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
      </div>
    </div>
  );
}

function CatchVisual() {
  return (
    <div className="w-full max-w-[240px] space-y-1.5">
      <Line label="Demo & haul" included />
      <Line label="Install vanity" included />
      <Line label="Exhaust fan" added />
      <Line label="Plumbing rough-in" added />
      <Line label="Permit coordination" added />
    </div>
  );
}

function Line({ label, included, added }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${
        added
          ? "border-violet-200 bg-violet-50/70 text-violet-800"
          : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      {added ? (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 text-[9px] font-bold text-violet-700">
          +
        </span>
      ) : (
        <svg viewBox="0 0 16 16" className="h-4 w-4 text-emerald-500">
          <path
            d="M4 8.5l2.5 2.5L12 5.5"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      )}
      <span className="flex-1 truncate">{label}</span>
      {added && (
        <span className="text-[9px] font-medium uppercase tracking-wider text-violet-600">
          AI
        </span>
      )}
    </div>
  );
}

function MarginVisual() {
  return (
    <div className="w-full max-w-[240px] space-y-2">
      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px]">
        <span className="text-slate-500">Cost</span>
        <span className="font-mono text-slate-800">$4,820</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-slate-700 to-slate-900"
            style={{ width: "72%" }}
          />
        </div>
        <span className="text-[10px] font-medium text-slate-500">+28%</span>
      </div>
      <div className="flex items-center justify-between rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-[11px] text-white">
        <span className="opacity-70">Customer sees</span>
        <span className="font-mono">$6,170</span>
      </div>
      <div className="text-center text-[10px] text-slate-400">
        Markup stays invisible
      </div>
    </div>
  );
}

function CloseVisual() {
  return (
    <div className="w-full max-w-[240px] space-y-2">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-medium text-emerald-700">Just now</span>
        </div>
        <div className="text-[11px] font-semibold text-slate-900">Quote approved</div>
        <div className="text-[10px] text-slate-500">
          Sarah Chen · deposit $310 paid
        </div>
      </div>
      <div className="rounded-lg bg-slate-100 p-3 opacity-80">
        <div className="mb-1.5 text-[10px] font-medium text-slate-500">2 min ago</div>
        <div className="text-[11px] text-slate-700">Quote viewed from iPhone</div>
      </div>
      <div className="rounded-lg bg-slate-50 p-3 opacity-60">
        <div className="mb-1.5 text-[10px] font-medium text-slate-400">5 min ago</div>
        <div className="text-[11px] text-slate-600">Quote sent</div>
      </div>
    </div>
  );
}
