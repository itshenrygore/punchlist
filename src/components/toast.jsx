import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = 'success', action = null) => {
    setToast({ message, type, action, id: Date.now() });
    setTimeout(() => setToast(null), action ? 6000 : 3500);
  }, []);
  const clear = useCallback(() => setToast(null), []);
  return (
    <ToastContext.Provider value={{ show, clear }}>
      {children}
      {toast && (
        <div className={`toast toast-${toast.type}`} key={toast.id} role="status" aria-live="polite" data-testid="toast">
          <span className="toast-msg" data-testid="toast-msg">{toast.message}</span>
          {toast.action && (
            <button type="button" className="toast-action" onClick={() => { toast.action.onClick(); clear(); }}>
              {toast.action.label}
            </button>
          )}
          <button type="button" className="toast-close" onClick={clear} aria-label="Dismiss">×</button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { show: (msg) => console.log(msg), clear: () => {} };
  return ctx;
}
