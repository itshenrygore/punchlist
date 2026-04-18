// ─────────────────────────────────────────────────────────────
// PublicErrorState — Phase 1, UX-011 / UX-032 / UX-041
// Replaces copy-pasted 🔗 emoji error blocks on all public pages.
// - Lucide icon instead of emoji (UX-011)
// - Tappable SMS/email CTAs when contractor contact info is known
// - Never surfaces raw error strings (UX-041)
// - Closing the gap to Stripe's link-expired page experience
// ─────────────────────────────────────────────────────────────
import React from 'react';
import { Link2 } from 'lucide-react';

const DOC_TYPE_LABELS = {
  quote: 'quote',
  invoice: 'invoice',
  amendment: 'amendment',
  'additional-work': 'request',
  project: 'project',
};

/**
 * @param {Object}   props
 * @param {string}   [props.docType]            — 'quote' | 'invoice' | 'amendment' | 'additional-work' | 'project'
 * @param {string}   [props.contractorName]     — display name for the contractor
 * @param {string}   [props.contractorPhone]    — E.164 or formatted phone (optional)
 * @param {string}   [props.contractorEmail]    — email address (optional)
 * @param {Function} [props.onRetry]            — called when user taps "Try again"
 */
export default function PublicErrorState({
  docType = 'quote',
  contractorName,
  contractorPhone,
  contractorEmail,
  onRetry,
}) {
  const label = DOC_TYPE_LABELS[docType] ?? docType;
  const firstName = contractorName?.split(' ')[0] || contractorName || null;
  const displayName = contractorName || 'your contractor';
  const hasContact = contractorPhone || contractorEmail;

  return (
    <div className="doc-shell">
      <div
        className="doc-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 340 }}>
          {/* Icon — Lucide replaces 🔗 emoji */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--panel-2, rgba(0,0,0,0.06))',
              marginBottom: 20,
            }}
            aria-hidden="true"
          >
            <Link2
              size={24}
              strokeWidth={1.75}
              style={{ color: 'var(--doc-muted, #999)' }}
            />
          </div>

          <h2
            style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 800,
              margin: '0 0 8px',
              color: 'var(--doc-text)',
              lineHeight: 1.2,
            }}
          >
            {label.charAt(0).toUpperCase() + label.slice(1)} unavailable
          </h2>

          <p
            style={{
              fontSize: 'var(--text-base)',
              color: 'var(--doc-muted)',
              lineHeight: 1.6,
              margin: '0 0 24px',
            }}
          >
            {hasContact
              ? `This link may have expired. Reach out to ${displayName} directly.`
              : `This link may have expired. Contact your contractor for a new link.`}
          </p>

          {/* Contact CTAs — only rendered when we have real contact info */}
          {hasContact && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginBottom: 20,
              }}
            >
              {contractorPhone && (
                <a
                  href={`sms:${contractorPhone}`}
                  className="doc-cta-primary"
                  style={{ display: 'block', textDecoration: 'none' }}
                >
                  Text {firstName || displayName}
                </a>
              )}
              {contractorEmail && (
                <a
                  href={`mailto:${contractorEmail}`}
                  className="doc-cta-secondary"
                  style={{ display: 'block', textDecoration: 'none' }}
                >
                  Email {firstName || displayName}
                </a>
              )}
            </div>
          )}

          {onRetry && (
            <button
              className="doc-cta-secondary"
              onClick={onRetry}
              style={hasContact ? { marginTop: 4 } : {}}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
