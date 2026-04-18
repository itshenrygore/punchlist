/* ═══════════════════════════════════════════════════════════════════════════
   Punchlist — SMS Notification Helper
   
   Fire-and-forget SMS notifications. Every email send path calls the
   parallel SMS function. Failures are silent — SMS is additive, not critical.
   
   Usage:
     import { smsNotify } from '../lib/sms';
     smsNotify.quoteReady({ to: customer.phone, contractorName, quoteTitle, total, shareToken });
   ═══════════════════════════════════════════════════════════════════════════ */

import { supabase } from './supabase';

async function getAuthHeader() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : '';
  } catch {
    return '';
  }
}

async function sendSMS(action, to, data) {
  if (!to) return { ok: false, reason: 'no_phone' };
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
      body: JSON.stringify({ action, to, data }),
    });
    const result = await res.json().catch(() => ({}));
    return result;
  } catch {
    // SMS is fire-and-forget — never block the main flow
    return { ok: false, reason: 'network_error' };
  }
}

export const smsNotify = {
  // ── Customer-facing ──
  quoteReady: ({ to, contractorName, quoteTitle, total, shareToken, country }) =>
    sendSMS('quote_ready', to, { contractorName, quoteTitle, total, shareToken, country }),

  bookingConfirmation: ({ to, contractorName, date, time }) =>
    sendSMS('booking_confirmation', to, { contractorName, date, time }),

  bookingReschedule: ({ to, contractorName, date, time }) =>
    sendSMS('booking_reschedule', to, { contractorName, date, time }),

  bookingCancel: ({ to, contractorName, date }) =>
    sendSMS('booking_cancel', to, { contractorName, date }),

  invoiceReady: ({ to, contractorName, invoiceTitle, total, shareToken, country }) =>
    sendSMS('invoice_ready', to, { contractorName, invoiceTitle, total, shareToken, country }),

  paymentReminder: ({ to, contractorName, invoiceNumber, balance, daysPastDue, shareToken, country }) =>
    sendSMS('payment_reminder', to, { contractorName, invoiceNumber, balance, daysPastDue, shareToken, country }),

  paymentReceipt: ({ to, contractorName, amount, country }) =>
    sendSMS('payment_receipt', to, { contractorName, amount, country }),

  contractorReply: ({ to, contractorName, quoteTitle, shareToken }) =>
    sendSMS('contractor_reply', to, { contractorName, quoteTitle, shareToken }),

  additionalWork: ({ to, contractorName, title, total, shareToken, country }) =>
    sendSMS('additional_work', to, { contractorName, title, total, shareToken, country }),

  amendment: ({ to, contractorName, title, shareToken }) =>
    sendSMS('amendment', to, { contractorName, title, shareToken }),

  signedConfirmation: ({ to, contractorName, quoteTitle, shareToken }) =>
    sendSMS('signed_confirmation', to, { contractorName, quoteTitle, shareToken }),

  /** Send a contractor-edited custom message via Twilio */
  customMessage: ({ to, body }) =>
    sendSMS('custom', to, { body }),

  // ── Contractor-facing ──
  customerApproved: ({ to, customerName, quoteTitle, total, quoteId, country, contractorUserId }) =>
    sendSMS('customer_approved', to, { customerName, quoteTitle, total, quoteId, country, contractorUserId }),

  customerQuestion: ({ to, customerName, quoteTitle, question, quoteId, contractorUserId }) =>
    sendSMS('customer_question', to, { customerName, quoteTitle, question, quoteId, contractorUserId }),

  customerRevision: ({ to, customerName, quoteTitle, quoteId, contractorUserId }) =>
    sendSMS('customer_revision', to, { customerName, quoteTitle, quoteId, contractorUserId }),

  customerDeclined: ({ to, customerName, quoteTitle, quoteId, contractorUserId }) =>
    sendSMS('customer_declined', to, { customerName, quoteTitle, quoteId, contractorUserId }),

  quoteViewed: ({ to, customerName, quoteTitle, viewCount, quoteId, contractorUserId }) =>
    sendSMS('quote_viewed', to, { customerName, quoteTitle, viewCount, quoteId, contractorUserId }),
};
