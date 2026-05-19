import { supabase } from '../supabase';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function createCheckout(priceKey) {
  const headers = await authHeaders();
  const r = await fetch('/api/create-checkout-session', { method: 'POST', headers, body: JSON.stringify({ priceKey }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Checkout failed');
  window.location.href = d.url;
}

export async function requestAiScope(payload) {
  const { signal, ...rest } = payload;
  const headers = await authHeaders();
  const r = await fetch('/api/ai-scope', {
    method: 'POST',
    headers,
    body: JSON.stringify(rest),
    ...(signal ? { signal } : {}),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'AI request failed');
  return d;
}

export async function openBillingPortal(stripeCustomerId) {
  const headers = await authHeaders();
  const r = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'billing_portal', customerId: stripeCustomerId }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Could not open billing portal');
  window.location.href = d.url;
}
