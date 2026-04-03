export async function createCheckout(priceKey) {
  const r = await fetch('/api/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceKey }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Checkout failed');
  window.location.href = d.url;
}

export async function requestAiScope(payload) {
  const r = await fetch('/api/ai-scope', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'AI request failed');
  return d;
}

export async function openBillingPortal(stripeCustomerId) {
  const r = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'billing_portal', customerId: stripeCustomerId }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Could not open billing portal');
  window.location.href = d.url;
}
