import { createClient } from './_supabase.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing database configuration');
  return createClient(url, key);
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabase();

  try {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .not('recurring_interval', 'is', null)
      .eq('status', 'paid')
      .lt('updated_at', new Date(Date.now() - 86400000).toISOString());

    if (error) throw error;
    if (!invoices?.length) return res.json({ processed: 0 });

    let created = 0;
    for (const inv of invoices) {
      const intervals = { weekly: 7, biweekly: 14, monthly: 30 };
      const days = intervals[inv.recurring_interval] || 30;
      const lastPaidAt = new Date(inv.paid_at || inv.updated_at);
      const nextDue = new Date(lastPaidAt.getTime() + days * 86400000);

      if (nextDue > new Date()) continue;

      // Compute the billing period anchor (day-precision) so we can
      // dedupe via the unique index uq_invoices_recurring_period.
      const billingPeriodStart = new Date(lastPaidAt.getTime() + days * 86400000)
        .toISOString()
        .slice(0, 10);

      // Best-effort cheap pre-check; the real safety net is the unique
      // index below catching the race.
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('user_id', inv.user_id)
        .eq('parent_invoice_id', inv.id)
        .eq('billing_period_start', billingPeriodStart)
        .limit(1);
      if (existing?.length) continue;

      const dueAt = new Date(Date.now() + days * 86400000).toISOString();
      const { data: newInv, error: createErr } = await supabase
        .from('invoices')
        .insert({
          user_id: inv.user_id,
          customer_id: inv.customer_id,
          title: inv.title,
          description: inv.description,
          status: 'draft',
          subtotal: inv.subtotal,
          tax: inv.tax,
          discount: inv.discount || 0,
          total: inv.total,
          province: inv.province,
          country: inv.country,
          due_at: dueAt,
          notes: inv.notes,
          recurring_interval: inv.recurring_interval,
          parent_invoice_id: inv.id,
          billing_period_start: billingPeriodStart,
        })
        .select()
        .single();

      if (createErr) {
        // 23505 = unique_violation. With uq_invoices_recurring_period in
        // place, two concurrent cron runs both passing the pre-check
        // will race here and only one wins. The loser is a no-op, not
        // a real error.
        if (createErr.code === '23505') continue;
        console.warn('[recurring]', createErr.message);
        continue;
      }

      if (newInv && inv.invoice_items?.length) {
        const items = inv.invoice_items.map((it, idx) => ({
          invoice_id: newInv.id,
          name: it.name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          notes: it.notes,
          category: it.category,
          sort_order: idx,
          included: true,
        }));
        await supabase.from('invoice_items').insert(items);
      }

      await supabase.from('notifications').insert({
        user_id: inv.user_id,
        type: 'recurring_invoice',
        title: `Recurring invoice created: ${inv.title || 'Invoice'}`,
        body: `A new draft invoice has been created from your recurring schedule.`,
        link: `/app/invoices/${newInv.id}`,
        read: false,
      });

      created++;
    }

    return res.json({ processed: created });
  } catch (err) {
    console.error('[process-recurring]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
