// Client-side SMS helper — calls /api/send-sms (Twilio) server-side.
// Returns { ok: true } on success, { ok: false, reason } on failure.

async function send(body) {
  try {
    const r = await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    return r.ok ? { ok: true } : { ok: false, reason: d.reason || 'api_error' };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}

export const smsNotify = {
  invoiceReady({ to, contractorName, invoiceTitle, total, shareToken, country }) {
    const url = `${window.location.origin}/i/${shareToken}`;
    const body = `Hi, ${contractorName} sent you an invoice for ${invoiceTitle}: ${total}. View and pay here: ${url}`;
    return send({ to, body });
  },

  customMessage({ to, body }) {
    return send({ to, body });
  },

  contractorReply({ to, contractorName, quoteTitle, shareToken }) {
    const url = `${window.location.origin}/q/${shareToken}`;
    const body = `${contractorName} replied to your quote for ${quoteTitle}. View here: ${url}`;
    return send({ to, body });
  },
};
