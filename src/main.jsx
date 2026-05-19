import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/auth-context';
import { ThemeProvider } from './contexts/theme-context';
import { ToastProvider } from './components/toast';
import { ForemanProvider } from './contexts/foreman-context';
import ErrorBoundary from './components/error-boundary';
import AppRouter from './app/router';
import './styles/index.css';
import './styles/dashboard-v2.css';
import './styles/compact-line-item.css';

// ── Deploy-drift recovery ─────────────────────────────────────────
// When a user has the app open and we deploy a new version, the old
// asset hashes (e.g. /assets/index-DgoftqRB-v97.js) no longer exist
// on Vercel. Any lazy import for a removed chunk falls back to
// index.html, the browser refuses to parse text/html as a module, and
// React unmounts the whole tree into the ErrorBoundary.
//
// We listen at the window for any chunk-shaped failure and trigger
// ONE hard reload (sessionStorage-gated). After the reload the user
// is on the fresh bundle; if it errors again we let the ErrorBoundary
// take over so we don't loop.
(function installChunkReloadGuard() {
  const KEY = 'pl_reloaded_for_chunk';
  function looksLikeChunkError(msg) {
    if (!msg) return false;
    return (
      msg.includes('is not a valid JavaScript MIME type') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('Loading chunk') ||
      msg.includes('ChunkLoadError')
    );
  }
  function handle(msg) {
    if (!looksLikeChunkError(msg)) return;
    try {
      if (sessionStorage.getItem(KEY)) return; // already reloaded — let boundary catch it
      sessionStorage.setItem(KEY, '1');
    } catch { /* private mode */ }
    // Tiny delay so concurrent in-flight errors batch up.
    setTimeout(() => window.location.reload(), 80);
  }
  window.addEventListener('error', (e) => handle(e?.message || e?.error?.message));
  window.addEventListener('unhandledrejection', (e) => handle(e?.reason?.message || String(e?.reason || '')));
  // Clear the gate on a successful full load so the next deploy
  // gets its own one-shot reload chance.
  if (document.readyState === 'complete') {
    try { sessionStorage.removeItem(KEY); } catch { /* */ }
  } else {
    window.addEventListener('load', () => { try { sessionStorage.removeItem(KEY); } catch { /* */ } });
  }
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <ForemanProvider>
                <AppRouter />
              </ForemanProvider>
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[Punchlist] SW registered, scope:', reg.scope);
    }).catch((err) => {
      console.warn('[Punchlist] SW registration failed:', err);
    });
  });
}
