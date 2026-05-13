import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'pl_theme';

function getSystemPreference() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch (e) { console.warn("[PL]", e); }
  // No stored preference — follow system
  return getSystemPreference();
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

  // Listen for system theme changes — only follow if user hasn't manually chosen
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    function handleChange(e) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        // If user has explicitly picked a theme, don't override
        if (stored === 'dark' || stored === 'light') return;
      } catch { /* noop */ }
      const next = e.matches ? 'dark' : 'light';
      setThemeState(next);
      applyTheme(next);
    }
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

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
