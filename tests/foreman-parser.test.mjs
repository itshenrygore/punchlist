// Parser tolerance test for Foreman's Add-to-Quote suggestions. The function
// lives inside the component file, so we duplicate it here to test in
// isolation — keep this implementation in sync with foreman-panel.jsx.
function parseAddToQuote(text) {
  const items = [];
  const seen = new Set();
  const lines = String(text || '').split(/\r?\n/);
  const rx = /^\s*(?:[-*•·]|\d+[.)])\s+(.{2,80}?)\s*[:–—-]?\s*~?\$\s?([\d,]+)(?:\s*(?:[–—-]|to)\s*\$?\s?([\d,]+))?\s*$/;
  for (const raw of lines) {
    const m = raw.match(rx);
    if (!m) continue;
    const lo = Number(m[2].replace(/,/g, ''));
    const hi = m[3] ? Number(m[3].replace(/,/g, '')) : lo;
    if (!Number.isFinite(lo) || lo <= 0) continue;
    const high = Math.max(lo, hi);
    const mid = Math.round(lo + (high - lo) * 0.55);
    const name = m[1].replace(/[*_`]/g, '').replace(/[.,;]$/, '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name, unit_price: mid, lo, hi: high });
  }
  return items;
}

const CASES = [
  // [label, input, expected item count, expected first name (if any)]
  ['hyphen + en-dash + colon (old format)',
   '- Install kitchen faucet: $180–$320\n- Faucet supply lines: $15–$40', 2, 'Install kitchen faucet'],
  ['asterisk bullets, no colon',
   '* Permit fee $120\n* Inspection $80', 2, 'Permit fee'],
  ['numbered list, "to" separator',
   '1. Replace P-trap $85 to $150\n2. Shutoff valves $85 to $160', 2, 'Replace P-trap'],
  ['bold markdown name',
   '- **Vent boot replacement**: $120–$200', 1, 'Vent boot replacement'],
  ['single price (no range)',
   '- Smoke detector replacement: $90', 1, 'Smoke detector replacement'],
  ['approximate price ~$',
   '- Whole-home rewire: ~$8,500', 1, 'Whole-home rewire'],
  ['em-dash separator',
   '- Panel upgrade $2,800—$3,400', 1, 'Panel upgrade'],
  ['dedup repeats',
   '- Faucet supply lines: $15–$40\n- Faucet supply lines: $15–$40', 1, 'Faucet supply lines'],
  // Negative cases — must NOT pick up
  ['inline price in prose (no bullet)',
   'Faucet jobs typically run $180 to $320. Pretty standard.', 0, null],
  ['heading line',
   'Likely missing items:\n- Vent boot $120', 1, 'Vent boot'],
  ['junk line',
   '- Just a comment with no money', 0, null],
];

let pass = 0, fail = 0;
for (const [label, input, want, firstName] of CASES) {
  const out = parseAddToQuote(input);
  const ok = out.length === want && (firstName === null || out[0]?.name === firstName);
  if (ok) { pass++; }
  else {
    fail++;
    console.log(`✗ ${label}\n   want ${want} (${firstName ?? '—'}); got ${out.length} (${out[0]?.name ?? '—'})`);
  }
}
console.log(`\n${pass}/${CASES.length} parser cases passed${fail ? ` — ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
