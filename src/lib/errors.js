import { friendly } from './format';

/* ═══════════════════════════════════════════════════════════
   Error handling — Phase 4 standardization.

   Every error falls into one of 3 categories:

   1. BLOCKING — user can't complete their task
      → toast(friendly(e), 'error') + optional setError() inline
      Use: save failures, send failures, load failures

   2. DEGRADED — feature unavailable but task continues
      → toast(message, 'warning')
      Use: photo upload failed, template fetch failed, push sub failed

   3. BACKGROUND — analytics, pre-warm, sync
      → console.warn('[PL]', e) only
      Use: tracking, offline sync, pre-warm cache

   No more bare `catch {}`. No more swallowed errors.

   Usage:
     import { handleError } from '../lib/errors';

     try { await save(); }
     catch (e) { handleError.blocking(e, toast, setError); }

     try { await uploadPhoto(); }
     catch (e) { handleError.degraded('Photo upload failed — you can re-add it later', toast); }

     try { trackEvent(); }
     catch (e) { handleError.background(e); }
   ═══════════════════════════════════════════════════════════ */

export const handleError = {
  /**
   * User-blocking error — they can't complete their task.
   * Shows a toast AND optionally sets inline error state.
   */
  blocking(error, toast, setError) {
    const msg = friendly(error);
    if (toast) toast(msg, 'error');
    if (setError) setError(msg);
    console.warn('[PL] blocking:', error);
  },

  /**
   * Degraded — feature unavailable but the user's main task continues.
   * Shows a warning toast with a human-friendly message.
   */
  degraded(message, toast) {
    if (toast) toast(message, 'warning');
    console.warn('[PL] degraded:', message);
  },

  /**
   * Background — analytics, pre-warm, sync, or other non-user-facing ops.
   * Console only. Never shows UI.
   */
  background(error) {
    console.warn('[PL]', error);
  },
};

export default handleError;
