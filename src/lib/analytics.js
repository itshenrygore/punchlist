/* ═══════════════════════════════════════════════════════════════
   Punchlist 2.0 — Minimal analytics
   
   Event tracking only. No UI components. No funnel charts.
   No A/B test variants. Just track what matters:
   quote_created, quote_sent, quote_viewed, quote_approved, quote_paid.
   ═══════════════════════════════════════════════════════════════ */

const DEBUG = false;

function log(event, props) {
  if (DEBUG) console.log('[PL Analytics]', event, props);
}

/**
 * Identify the current user for analytics.
 */
export function identify(userId, traits = {}) {
  log('identify', { userId, ...traits });
  // TODO: wire to PostHog / Mixpanel / Segment when ready
}

/**
 * Track a named event with optional properties.
 */
export function track(event, props = {}) {
  log(event, props);
  // TODO: wire to PostHog / Mixpanel / Segment when ready
}

// ── Convenience wrappers for core funnel ────────────────────

export function trackQuoteFlowStarted(props) {
  track('quote_flow_started', props);
}

export function trackQuoteFlowCustomerSelected(customerId) {
  track('quote_flow_customer_selected', { customer_id: customerId });
}

export function trackQuoteFlowDescriptionCommitted(charCount) {
  track('quote_flow_description_committed', { char_count: charCount });
}

export function trackQuoteFlowScopeReady(itemCount) {
  track('quote_flow_scope_ready', { item_count: itemCount });
}

export function trackQuoteFlowSent(quoteId, method) {
  track('quote_flow_sent', { quote_id: quoteId, method });
}

export function trackQuoteFlowAbandoned(step) {
  track('quote_flow_abandoned', { step });
}

// Legacy stubs — these were called from the old builder and can be
// gradually removed as the builder is refactored. They no-op safely.
export function trackFirstDescribe() {}
export function trackFirstBuild() {}
export function trackFirstSend() {}
export function trackQuoteSent() {}
export function trackPushEnabled() {}
export function setQuoteFlowQuoteId() {}
export function endQuoteFlowSession() {}
export function hasActiveFlowSession() { return false; }
export function restoreFlowSession() {}
export function getVariant() { return null; }
export function recordUpgradeShown() {}
