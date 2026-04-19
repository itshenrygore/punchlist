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
 * @param {Object} props
 * @param {string} [props.docType] — 'quote' | 'invoice' | 'amendment' | 'additional-work' | 'project'
 * @param {string} [props.contractorName] — display name for the contractor
 * @param {string} [props.contractorPhone] — E.164 or formatted phone (optional)
 * @param {string} [props.contractorEmail] — email address (optional)
 * @param {Function} [props.onRetry] — called when user taps "Try again"
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
 const displayName = contractorNamedoc-container pes-flex-d0e5tractor';
 const hasContact = contractorPhone || contractorEmail;

 return (
 <div className="doc-shell">
 <div
 className="doc-container"
 
 >
 <div className="pes-ta-center-fdd7">
 {/* Icon — Lucide replaces 🔗 emoji */}
 <div
 className="pes-inline-flex-4940"
 aria-hidden="true"
 >
 <Link2
 size={24}
 strokeWidth={1.75}
 className="pes-s0-d354"
 />
 </div>

 <h2
 className="pes-fs-2xl-e363"
 >
 {label.charAt(0).toUpperCase() + label.slice(1)} unavailable
 </h2>

 <p
 className="pes-fs-base-c13f"
 >
 {hasContact
 ? `This link may have expired. Reach out to ${displayName} directly.`
 : `This link may have expired. Contact your contractor for a new link.`}
 </p>

 {/* Contact CTAs — only rendered when we have real contact info */}
 {hasContact && (
 <div
 className="pes-flex-6561"
 >
 {contractorPhone && (
 doc-cta-primary pes-block-f24a href={`sms:${contractorPhone}`}
 className="doc-cta-primary"
 
 >
 Text {firstName || displayName}
 </a>
 )}
 {contractorEmail && (
 <a
 doc-cta-secondary pes-block-f24aef={`mailto:${contractorEmail}`}
 className="doc-cta-secondary"
 
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
