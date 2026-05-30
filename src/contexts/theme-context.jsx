import { createContext, useCallback, useContext, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'pl_theme';

function getSystemPreference() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialTheme() {
  return 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Update meta theme-color for mobile browser chrome
  const meta = document.getElementById('meta-theme-color');
  if (meta) meta.content = theme === 'dark' ? '#0F0F10' : '#F6F5F2';
  // Update color-scheme for native form controls, scrollbars, selection highlights
  const cs = document.getElementById('meta-color-scheme');
  if (cs) cs.content = theme === 'dark' ? 'dark' : 'light';
}

// Apply immediately on module load (before React renders)
// This is the backup — index.html inline script handles the very first paint
const initialTheme = getInitialTheme();
applyTheme(initialTheme);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch (e) { console.warn("[PL]", e); }
    applyTheme(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // Light-only for now: the dark theme is unfinished and its toggle is
  // hidden. We intentionally do NOT follow the OS prefers-color-scheme —
  // doing so flipped sessions into the half-baked dark theme mid-use.
  // Re-enable this listener when dark mode is finished + the toggle returns.

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
