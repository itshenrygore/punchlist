import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  // For undo toasts: track the remaining countdown (ms) for the progress bar.
  const [undoMs, setUndoMs] = useState(0);
  const undoIntervalRef = useRef(null);
  const undoTimerRef = useRef(null);

  const clearUndo = useCallback(() => {
    clearInterval(undoIntervalRef.current);
    clearTimeout(undoTimerRef.current);
    undoIntervalRef.current = null;
    undoTimerRef.current = null;
    setUndoMs(0);
  }, []);

  const clear = useCallback(() => {
    clearUndo();
    setToast(null);
  }, [clearUndo]);

  // Show a standard toast. type: 'success' | 'error' | 'info'
  const show = useCallback((message, type = 'success', action = null) => {
    clearUndo();
    setToast({ message, type, action, id: Date.now(), exiting: false, undo: false });
    const duration = action ? 6000 : type === 'success' ? 3000 : 3500;
    setTimeout(() => setToast(prev => prev ? { ...prev, exiting: true } : null), duration - 300);
    setTimeout(() => setToast(null), duration);
  }, [clearUndo]);

  /**
   * Show an "undo" toast with a countdown bar.
   * @param {string}   message      — e.g. "Sending quote…"
   * @param {number}   durationMs   — countdown window, e.g. 3000
   * @param {Function} onCommit     — called when timer fires (send proceeds)
   * @param {Function} onUndo       — called when user taps Undo (send cancelled)
   * @returns {Function}            — call to imperatively cancel (e.g. on unmount)
   */
  const showUndo = useCallback((message, durationMs, onCommit, onUndo) => {
    clearUndo();
    const id = Date.now();
    setUndoMs(durationMs);
    setToast({ message, type: 'undo', action: null, id, exiting: false, undo: true, onUndo });

    const TICK = 50;
    let remaining = durationMs;
    undoIntervalRef.current = setInterval(() => {
      remaining -= TICK;
      setUndoMs(Math.max(0, remaining));
    }, TICK);

    undoTimerRef.current = setTimeout(() => {
      clearInterval(undoIntervalRef.current);
      setToast(prev => prev?.id === id ? { ...prev, exiting: true } : prev);
      setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 300);
      setUndoMs(0);
      onCommit();
    }, durationMs);

    // Return an imperative cancel (used by component unmount)
    return () => {
      clearUndo();
      setToast(prev => prev?.id === id ? null : prev);
    };
  }, [clearUndo]);

  const handleUndo = useCallback((onUndo) => {
    clearUndo();
    setToast(prev => prev ? { ...prev, exiting: true } : null);
    setTimeout(() => setToast(null), 300);
    onUndo?.();
  }, [clearUndo]);
  // Clean up on unmount
  useEffect(() => () => { clearInterval(undoIntervalRef.current); clearTimeout(undoTimerRef.current); }, []);

  return (
    <ToastContext.Provider value={{ show, showUndo, clear }}>
      {children}
      {toast && (
        <div
          className={`toast toast-${toast.type}${toast.exiting ? ' toast-exit' : ''}`}
          key={toast.id}
          role={toast.undo ? 'alert' : 'status'}
          aria-live={toast.undo ? 'assertive' : 'polite'}
          data-testid="toast"
        >
          {/* Countdown progress bar for undo toasts */}
          {toast.undo && (
            <div
              className="toast-undo-bar"
              style={{ width: `${(undoMs / 3000) * 100}%` }}
              aria-hidden="true"
            />
          )}
          <span className="toast-icon">
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : toast.type === 'undo' ? '⏱' : 'ℹ'}
          </span>
          <span className="toast-msg" data-testid="toast-msg">{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              className="toast-action toast-undo-btn"
              onClick={() => handleUndo(toast.onUndo)}
              data-testid="toast-undo"
            >
              Undo
            </button>
          )}
          {!toast.undo && toast.action && (
            <button type="button" className="toast-action" onClick={() => { toast.action.onClick(); clear(); }}>
              {toast.action.label}
            </button>
          )}
          {!toast.undo && (
            <button type="button" className="toast-close" onClick={clear} aria-label="Dismiss">×</button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { show: (msg) => console.log(msg), showUndo: () => () => {}, clear: () => {} };
  return ctx;
}
