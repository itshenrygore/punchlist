const KEY   = 'pl_demo_v2';
const LIMIT = 3;

function today() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function getState() {
  if (typeof window === 'undefined') return { count: 0, date: today() };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { count: 0, date: today() };
    const parsed = JSON.parse(raw);
    // Reset if it's a new day
    if (parsed.date !== today()) return { count: 0, date: today() };
    return parsed;
  } catch {
    return { count: 0, date: today() };
  }
}

function saveState(state) {
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export function getRemainingDemoRuns() {
  const s = getState();
  return Math.max(0, LIMIT - s.count);
}

export function consumeDemoRun() {
  const s = getState();
  const next = { count: s.count + 1, date: today() };
  saveState(next);
  return Math.max(0, LIMIT - next.count);
}
