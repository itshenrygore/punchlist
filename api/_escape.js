// Minimal HTML / header / SMS escaping helpers for outbound messages.
//
// Why this exists: user-controlled fields (contractor name, customer
// name, quote title, feedback text, etc.) used to be concatenated raw
// into Resend HTML, Twilio SMS bodies, email `subject` headers, and
// the PDF render template. A contractor or customer could embed
// `<script>`, header-injection CRLF, or SMS-control characters and
// either break the message or (in the PDF / email case) execute
// arbitrary HTML.
//
// Use these wrappers any time you interpolate a value into a place
// where HTML or RFC822 headers are interpreted. JSON payloads to
// Resend / Twilio don't need it for transport — only the rendered
// HTML / header / SMS body does.

/** Escape the five HTML-sensitive characters. */
export function escapeHtml(input) {
  const s = input == null ? '' : String(input);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Convenience shorthand to keep template literals readable. */
export const h = escapeHtml;

/**
 * Strip CR/LF from a value before putting it into an email Subject /
 * header. Prevents header injection (e.g. setting an unintended Bcc).
 */
export function safeHeader(input) {
  const s = input == null ? '' : String(input);
  return s.replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
}

/**
 * Strip control chars + URLs from a user-supplied value before placing
 * it in an SMS body. The SMS body itself can include URLs that *we*
 * control (e.g. the share link), but never untrusted text.
 */
export function safeSmsSegment(input) {
  const s = input == null ? '' : String(input);
  // \x00-\x1F and \x7F are the C0 and DEL controls — strip them.
  return s
    .replace(new RegExp("[\\u0000-\\u001f\\u007f]", "g"), " ")
    .replace(/https?:\/\/\S+/gi, '[link removed]')
    .replace(/\s+/g, ' ')
    .trim();
}
