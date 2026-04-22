import { useEffect, useRef } from 'react';

/**
 * Warns the user before leaving a page with unsaved changes.
 * Handles:
 *   1. Browser tab close / refresh (beforeunload)
 *   2. Browser back/forward buttons (popstate)
 *   3. In-app React Router navigation (link click interception)
 *
 * Works with BrowserRouter — no data router required.
 *
 * @param {boolean} isDirty - whether the form has unsaved changes
 * @param {string} [message] - optional custom message for the confirm dialog
 */
export function useUnsavedChanges(isDirty, message) {
  const msg = message || 'You have unsaved changes. Leave anyway?';
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  // Track whether we pushed a history entry so we only push once
  const pushedRef = useRef(false);

  // 1. Block browser tab close / refresh
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // 2. Block browser back/forward button
  useEffect(() => {
    if (!isDirty) {
      pushedRef.current = false;
      return;
    }

    // Push a single duplicate entry so back-button triggers popstate
    if (!pushedRef.current) {
      window.history.pushState({ __unsavedGuard: true }, '', window.location.href);
      pushedRef.current = true;
    }

    const handlePop = () => {
      if (dirtyRef.current) {
        const leave = window.confirm(msg);
        if (!leave) {
          // User cancelled — re-push to stay on page
          window.history.pushState({ __unsavedGuard: true }, '', window.location.href);
        } else {
          pushedRef.current = false;
        }
      }
    };

    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [isDirty, msg]);

  // 3. Block in-app link clicks (React Router <Link>, <NavLink>, etc.)
  useEffect(() => {
    if (!isDirty) return;

    const handleClick = (e) => {
      if (!dirtyRef.current) return;

      // Walk up from target to find the nearest <a> element
      const anchor = e.target.closest('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Only intercept internal navigation (same-origin relative paths)
      // Skip external links, mailto:, sms:, tel:, etc.
      const isInternal = href.startsWith('/') && !href.startsWith('//');
      if (!isInternal) return;

      // Skip links to the current page
      if (href === window.location.pathname) return;

      const leave = window.confirm(msg);
      if (!leave) {
        e.preventDefault();
        e.stopPropagation();
      }
      // If confirmed, let the click through normally
    };

    // Use capture phase to intercept before React Router's handler
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isDirty, msg]);
}
