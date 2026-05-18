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
