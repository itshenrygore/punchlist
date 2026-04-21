import { useEffect } from 'react';
import useScrollLock from '../../hooks/use-scroll-lock';
import { GLOBAL_SHORTCUTS } from './actions';

/**
 * Keyboard shortcuts reference overlay.
 *
 * Opens on `?` (bound globally by app-shell) or from the palette's
 * "Show keyboard shortcuts" action. Reuses the same overlay vocabulary
 * as the command palette so the visual language stays consistent.
 */
export default function KeyboardShortcutsOverlay({ open, onClose }) {
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Group shortcuts by their group field for display
  const grouped = GLOBAL_SHORTCUTS.reduce((acc, s) => {
    (acc[s.group] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="search-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="kbd-shortcuts-title">
      <div className="search-modal pl-kbd-modal" onClick={e => e.stopPropagation()}>
        <div className="search-input-row">
          <span className="search-icon" aria-hidden="true">⌨️</span>
          <div id="kbd-shortcuts-title" style={{ flex: 1, fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
            Keyboard shortcuts
          </div>
          <button className="search-esc" type="button" onClick={onClose} aria-label="Close">Esc</button>
        </div>

        <div className="search-results pl-kbd-body">
          {Object.entries(grouped).map(([group, rows]) => (
            <div className="search-section" key={group}>
              <div className="search-section-label">{group}</div>
              {rows.map(s => (
                <div className="pl-kbd-row" key={s.keys + s.label}>
                  <span className="pl-kbd-label">{s.label}</span>
                  <span className="pl-kbd-keys">
                    {s.keys.split(' ').map((k, i) => (
                      <kbd className="pl-kbd" key={i}>{k}</kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div className="pl-kbd-footer">
            Tip: press <kbd className="pl-kbd">⌘</kbd><kbd className="pl-kbd">K</kbd> anywhere to jump to an action.
          </div>
        </div>
      </div>
    </div>
  );
}
