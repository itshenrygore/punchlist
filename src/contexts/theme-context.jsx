import { createContext, useContext } from 'react';

// ─────────────────────────────────────────────────────────────────────
// Punchlist is LIGHT-ONLY.
// The dark theme was never finished, so the toggle, the OS
// (prefers-color-scheme) detection, and the persisted preference were all
// removed — dark mode is no longer an option anywhere. We still pin
// data-theme="light" + the mobile chrome meta colors here as the
// React-side backup (index.html sets it pre-paint). If a real dark theme
// is built later, reintroduce a theme switch in this file.
// ─────────────────────────────────────────────────────────────────────

const ThemeContext = createContext({ theme: 'light' });

function applyLight() {
  document.documentElement.setAttribute('data-theme', 'light');
  const meta = document.getElementById('meta-theme-color');
  if (meta) meta.content = '#F6F5F2';
  const cs = document.getElementById('meta-color-scheme');
  if (cs) cs.content = 'light';
}

// Apply immediately on module load (before React renders).
applyLight();

export function ThemeProvider({ children }) {
  return <ThemeContext.Provider value={{ theme: 'light' }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
