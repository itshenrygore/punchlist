/**
 * Punchlist Product Analytics
 *
 * Lightweight event tracking for activation metrics, A/B testing, and funnel analysis.
 * Events are stored in a Supabase 'events' table (create it).
 * No third-party dependencies — just fetch to Supabase.
 *
 * Usage:
 *   import { track, identify, getVariant, trackTiming } from '../lib/analytics';
 *   track('quote_sent', { total: 2400, trade: 'Plumber' });
 *   const variant = getVariant('demo_card'); // 'a' or 'b'
 *   trackTiming('signup_to_first_send'); // auto-measures from identify() call
 */

import { supabase } from './supabase';

// ── Core event tracking ──

let _userId = null;
let _userProps = {};

export function identify(userId, props = {}) {
  _userId = userId;
  _userProps = props;
  // Store identify timestamp for timing measurements
  try {
    if (!sessionStorage.getItem('pl_identify_at')) {
      sessionStorage.setItem('pl_identify_at', Date.now().toString());
    }
  } catch (e) { console.warn('[PL]', e); }
}

export async function track(event, properties = {}) {
  if (!event) return;

  const payload = {
    event,
    user_id: _userId || null,
    properties: {
      ...properties,
      ..._userProps,
      url: window.location.pathname,
      referrer: document.referrer || null,
      screen_width: window.innerWidth,
      timestamp: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  };

  // Fire and forget — never block the UI
  try {
    supabase.from('events').insert(payload).then(() => {}).catch(e => console.warn('[PL]', e));
  } catch (e) { console.warn('[PL]', e); }
}

// ── B13: Quote-flow telemetry ──────────────────────────────────────────────
//
// Six events share a single session_id generated when the flow starts. The
// session state lives at module scope so it survives React re-renders, but
// is keyed to sessionStorage so it does NOT cross tabs.
//
// Design constraints:
//  • All helpers are no-ops when no session is active — never block the UI.
//  • Each event (except abandoned) fires at most once per session, enforced
//    by _firedInSession (a Set reset on each new flow start).
//  • quote_flow_abandoned uses sendBeacon / fetch-keepalive for reliable
//    delivery during page unload; called from the pagehide listener in
//    quote-builder-page.jsx.

// ── Internal session state ──

/** @type {string|null} */
let _qfSessionId = null;
/** @type {string|null} */
let _qfQuoteId = null;
/** @type {Set<string>} */
let _firedInSession = new Set();

/** UUID v4 — crypto.randomUUID when available, Math.random fallback. */
function _uuid() {
  try { return crypto.randomUUID(); } catch { /* fallback below */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Write current session to sessionStorage keyed by quoteId. */
function _persistSession(quoteId) {
  try {
    sessionStorage.setItem(
      `pl_qf_session_${quoteId}`,
      JSON.stringify({ session_id: _qfSessionId, started_at: Date.now() }),
    );
  } catch { /* private-mode browsers may block sessionStorage */ }
}

/**
 * Attempt to restore a persisted session for quoteId.
 * Returns true on success (session vars repopulated), false otherwise.
 */
function _restoreSession(quoteId) {
  try {
    const raw = sessionStorage.getItem(`pl_qf_session_${quoteId}`);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed?.session_id) {
      _qfSessionId = parsed.session_id;
      _qfQuoteId = quoteId;
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

/** Reset all session state and clean up sessionStorage. */
function _clearSession() {
  try { if (_qfQuoteId) sessionStorage.removeItem(`pl_qf_session_${_qfQuoteId}`); } catch { /* ignore */ }
  _qfSessionId = null;
  _qfQuoteId = null;
  _firedInSession = new Set();
}

/**
 * Fire a quote_flow_* event at most once per session.
 * No-op when no session is active or when the event was already fired.
 */
function _trackQF(event, extra = {}) {
  if (!_qfSessionId) return;
  if (_firedInSession.has(event)) return;
  _firedInSession.add(event);
  track(event, { session_id: _qfSessionId, quote_id: _qfQuoteId || null, ...extra });
}

// ── Public session helpers ──

/**
 * Returns true when a quote-flow session is currently active.
 * Used by quote-builder-page to decide whether to start a fallback session.
 */
export function hasActiveFlowSession() {
  return !!_qfSessionId;
}

/**
 * Attempt to restore a persisted flow session for quoteId.
 * Returns true on success. Used by quote-builder-page on edit-path mount.
 */
export function restoreFlowSession(quoteId) {
  if (!quoteId) return false;
  return _restoreSession(quoteId);
}

/**
 * Associate a newly-created DB quote id with the running session.
 * Called in handleBuildScope after createQuote() resolves.
 */
export function setQuoteFlowQuoteId(quoteId) {
  if (!_qfSessionId || !quoteId || _qfQuoteId === quoteId) return;
  _qfQuoteId = quoteId;
  _persistSession(quoteId);
}

// ── The six public event helpers ──

/**
 * quote_flow_started — fires when the contractor clicks "Quote a job" / "New
 * quote" on the dashboard, or when the builder mounts without a prior session.
 *
 * @param {object} opts
 * @param {string|null} opts.quoteId  Quote DB id, if already known (edit path).
 * @param {string}      opts.source   Entry point label ('dashboard_header',
 *                                    'dashboard_job_input', 'builder_direct', …).
 */
export function trackQuoteFlowStarted({ quoteId = null, source = 'dashboard' } = {}) {
  // If an active session already exists for this exact quote, don't re-fire.
  if (quoteId && _qfQuoteId === quoteId && _qfSessionId) return;
  _clearSession();
  _qfSessionId = _uuid();
  _qfQuoteId = quoteId;
  _firedInSession = new Set();
  if (quoteId) _persistSession(quoteId);
  // Bypass _trackQF so the event always fires even though session was just set.
  track('quote_flow_started', {
    session_id: _qfSessionId,
    quote_id: quoteId,
    source,
  });
  _firedInSession.add('quote_flow_started');
}

/**
 * quote_flow_customer_selected — fires when customer_id is first set.
 * Deduped: fires at most once per session regardless of how many customers
 * the user cycles through (e.g. Change → pick another).
 */
export function trackQuoteFlowCustomerSelected(customerId) {
  if (!customerId) return;
  _trackQF('quote_flow_customer_selected', { customer_id: customerId });
}

/**
 * quote_flow_description_committed — fires when the description textarea
 * blurs with content for the first time in this session.
 * The caller (quote-builder-page) uses descCommittedRef as an additional
 * guard, making double-fire impossible even across re-renders.
 */
export function trackQuoteFlowDescriptionCommitted(descriptionLength) {
  _trackQF('quote_flow_description_committed', { description_length: descriptionLength });
}

/**
 * quote_flow_scope_ready — fires when AI scope generation completes and
 * line items are populated.
 */
export function trackQuoteFlowScopeReady(itemCount) {
  _trackQF('quote_flow_scope_ready', { item_count: itemCount });
}

/**
 * quote_flow_sent — fires inside _markSent() after the quote is definitively
 * sent via any delivery method. Clears the session so the pagehide handler
 * does not also fire quote_flow_abandoned.
 */
export function trackQuoteFlowSent({ deliveryMethod = 'unknown', total = 0 } = {}) {
  _trackQF('quote_flow_sent', { delivery_method: deliveryMethod, total });
  _clearSession();
}

/**
 * quote_flow_abandoned — fires on pagehide (or SPA unmount) when the quote
 * was never sent in this session. Bypasses the normal async track() path and
 * uses sendBeacon / fetch-keepalive directly for reliable delivery during
 * page unload. Also called by endQuoteFlowSession() on React unmount.
 */
export function trackQuoteFlowAbandoned() {
  if (!_qfSessionId) return;
  // Don't fire if the flow already completed with a send.
  if (_firedInSession.has('quote_flow_sent')) return;
  if (_firedInSession.has('quote_flow_abandoned')) return;
  _firedInSession.add('quote_flow_abandoned');

  const payload = JSON.stringify({
    event: 'quote_flow_abandoned',
    user_id: _userId || null,
    properties: {
      session_id: _qfSessionId,
      quote_id: _qfQuoteId || null,
      url: typeof window !== 'undefined' ? window.location.pathname : '',
      timestamp: new Date().toISOString(),
      ..._userProps,
    },
    created_at: new Date().toISOString(),
  });

  // Read Supabase config from the already-imported client so we don't need
  // to re-read import.meta.env here (avoids ordering issues with Vite's env
  // injection). The supabase-js client exposes .supabaseUrl and .supabaseKey
  // as public properties; they are safe to read at any time after init.
  try {
    /* eslint-disable no-underscore-dangle */
    const sbUrl = supabase.supabaseUrl
               || supabase._url
               || null;
    const sbKey = supabase.supabaseKey
               || supabase._headers?.apikey
               || supabase._headers?.Authorization?.replace('Bearer ', '')
               || null;
    /* eslint-enable no-underscore-dangle */

    if (!sbUrl || !sbKey) {
      // Supabase not yet initialised — silently skip rather than error.
      _clearSession();
      return;
    }

    const endpoint = `${sbUrl}/rest/v1/events`;
    const headers = {
      'Content-Type': 'application/json',
      apikey: sbKey,
      Authorization: `Bearer ${sbKey}`,
      Prefer: 'return=minimal',
    };

    let beaconSent = false;
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // sendBeacon cannot send custom headers; pass apikey as a query param,
      // which PostgREST accepts as an alternative to the Authorization header.
      const beaconUrl = `${endpoint}?apikey=${encodeURIComponent(sbKey)}`;
      const blob = new Blob([payload], { type: 'application/json' });
      beaconSent = navigator.sendBeacon(beaconUrl, blob);
    }

    if (!beaconSent) {
      // Fallback: fetch with keepalive survives short navigation events.
      fetch(endpoint, {
        method: 'POST',
        headers,
        body: payload,
        keepalive: true,
      }).catch(e => console.warn('[PL]', e)); // never throw
    }
  } catch (e) {
    console.warn('[PL] abandoned beacon failed', e);
  }

  _clearSession();
}

/**
 * endQuoteFlowSession — called from the React cleanup function (useEffect
 * return) on component unmount. Delegates to trackQuoteFlowAbandoned; if
 * the flow already sent, that function is a no-op so there's no double-fire.
 */
export function endQuoteFlowSession() {
  trackQuoteFlowAbandoned();
}

// ── Activation funnel events ──────────────────────────────────────────────
// These are the key moments that define whether a user will convert.

export function trackSignup(userId, trade) {
  identify(userId, { trade });
  track('signup_complete', { trade });
  try { localStorage.setItem('pl_signup_at', Date.now().toString()); } catch (e) { console.warn('[PL]', e); }
}

// eslint-disable-next-line no-unused-vars
export function trackOnboardingComplete(userId) {
  track('onboarding_complete');
}

export function trackFirstDescribe() {
  track('first_describe');
  try {
    if (!localStorage.getItem('pl_first_describe_at')) {
      localStorage.setItem('pl_first_describe_at', Date.now().toString());
    }
  } catch (e) { console.warn('[PL]', e); }
}

export function trackFirstBuild() {
  track('first_build_scope');
  try {
    if (!localStorage.getItem('pl_first_build_at')) {
      localStorage.setItem('pl_first_build_at', Date.now().toString());
    }
  } catch (e) { console.warn('[PL]', e); }
}

export function trackFirstSend(quoteTotal, trade) {
  track('first_quote_sent', { total: quoteTotal, trade });
  try {
    if (!localStorage.getItem('pl_first_send_at')) {
      localStorage.setItem('pl_first_send_at', Date.now().toString());
    }
  } catch (e) { console.warn('[PL]', e); }
  // Compute time-to-first-send
  trackTiming('signup_to_first_send');
}

export function trackQuoteSent(quoteTotal, trade, isFirst = false) {
  track('quote_sent', { total: quoteTotal, trade, is_first: isFirst });
}

export function trackQuoteViewed(quoteId) {
  track('quote_viewed_by_customer', { quote_id: quoteId });
}

export function trackQuoteApproved(quoteId, total) {
  track('quote_approved', { quote_id: quoteId, total });
}

export function trackUpgrade(plan) {
  track('upgraded_to_pro', { plan });
}

export function trackStripeConnect() {
  track('stripe_connect_completed');
}

export function trackPushEnabled() {
  track('push_notifications_enabled');
}

// ── Timing measurements ───────────────────────────────────────────────────
// Measures elapsed time between key activation moments.

export function trackTiming(metric) {
  try {
    const signupAt = Number(localStorage.getItem('pl_signup_at') || 0);
    if (!signupAt) return;

    let endAt = Date.now();

    if (metric === 'signup_to_first_send') {
      endAt = Number(localStorage.getItem('pl_first_send_at') || Date.now());
    } else if (metric === 'signup_to_first_build') {
      endAt = Number(localStorage.getItem('pl_first_build_at') || Date.now());
    }

    const seconds = Math.round((endAt - signupAt) / 1000);
    track('timing', { metric, seconds });
  } catch (e) { console.warn('[PL]', e); }
}

// ── A/B Testing ───────────────────────────────────────────────────────────
// Simple deterministic variant assignment stored in localStorage.
// Usage: const variant = getVariant('demo_card'); // returns 'a' or 'b'

export function getVariant(experimentName, variants = ['a', 'b']) {
  const key = `pl_ab_${experimentName}`;
  try {
    const stored = localStorage.getItem(key);
    if (stored && variants.includes(stored)) return stored;

    // Deterministic assignment based on user ID or random
    const seed = _userId || Math.random().toString();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % variants.length;
    const variant = variants[idx];
    localStorage.setItem(key, variant);

    // Track assignment
    track('experiment_assigned', { experiment: experimentName, variant });
    return variant;
  } catch {
    return variants[0];
  }
}

// ── Get activation funnel data (for analytics page) ──────────────────────

export function getActivationTimings() {
  try {
    const signupAt = Number(localStorage.getItem('pl_signup_at') || 0);
    const firstDescribeAt = Number(localStorage.getItem('pl_first_describe_at') || 0);
    const firstBuildAt = Number(localStorage.getItem('pl_first_build_at') || 0);
    const firstSendAt = Number(localStorage.getItem('pl_first_send_at') || 0);

    return {
      signupAt,
      firstDescribeAt,
      firstBuildAt,
      firstSendAt,
      signupToDescribe: firstDescribeAt && signupAt ? Math.round((firstDescribeAt - signupAt) / 1000) : null,
      signupToBuild: firstBuildAt && signupAt ? Math.round((firstBuildAt - signupAt) / 1000) : null,
      signupToSend: firstSendAt && signupAt ? Math.round((firstSendAt - signupAt) / 1000) : null,
    };
  } catch {
    return {};
  }
}
