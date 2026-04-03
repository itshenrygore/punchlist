import { createContext, useCallback, useContext, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'pl_theme';

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  return 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Update meta theme-color for mobile browser chrome
  const meta = document.getElementById('meta-theme-color');
  if (meta) meta.content = theme === 'dark' ? '#0F0F10' : '#F6F5F2';
}

// Apply immediately on module load (before React renders)
// This is the backup — index.html inline script handles the very first paint
const initialTheme = getInitialTheme();
applyTheme(initialTheme);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
    applyTheme(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

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
