// ═══════════════════════════════════════════════════════
// PUNCHLIST — Job Templates API
//
// Job templates let contractors save a quote as a reusable
// starting point: line items, trade, description, province.
// Creating a quote from a template pre-fills everything so
// they only need to pick a customer and adjust pricing.
//
// REQUIRED DB MIGRATION (run once in Supabase SQL editor):
// ─────────────────────────────────────────────────────────
// create table if not exists job_templates (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid references auth.users(id) on delete cascade not null,
//   name text not null,
//   trade text,
//   description text,
//   scope_summary text,
//   province text,
//   line_items jsonb default '[]'::jsonb,
//   use_count integer default 0,
//   created_at timestamptz default now(),
//   updated_at timestamptz default now()
// );
// alter table job_templates enable row level security;
// create policy "Users manage own job templates"
//   on job_templates for all
//   using (auth.uid() = user_id)
//   with check (auth.uid() = user_id);
// ═══════════════════════════════════════════════════════

import { supabase, friendly } from './shared.js';

const TABLE = 'job_templates';

export async function listJobTemplates(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('use_count', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) {
    // Table may not exist yet — degrade gracefully
    if (error.message?.includes('does not exist') || error.code === '42P01') return [];
    throw new Error(friendly(error));
  }
  return data || [];
}

export async function saveJobTemplate(userId, template) {
  if (!userId) throw new Error('saveJobTemplate requires userId');
  const payload = {
    user_id:       userId,
    name:          template.name?.trim() || 'Unnamed template',
    trade:         template.trade || null,
    description:   template.description || null,
    scope_summary: template.scope_summary || null,
    province:      template.province || null,
    line_items:    (template.line_items || []).map(li => ({
      name:       li.name || '',
      quantity:   li.quantity || 1,
      unit_price: li.unit_price || 0,
      notes:      li.notes || '',
      category:   li.category || '',
    })),
    updated_at: new Date().toISOString(),
  };

  if (template.id) {
    // Update existing
    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq('id', template.id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new Error(friendly(error));
    return data;
  } else {
    // Create new
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ ...payload, use_count: 0 })
      .select()
      .single();
    if (error) throw new Error(friendly(error));
    return data;
  }
}

export async function deleteJobTemplate(userId, templateId) {
  if (!userId || !templateId) throw new Error('deleteJobTemplate requires userId and templateId');
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', templateId)
    .eq('user_id', userId);
  if (error) throw new Error(friendly(error));
  return { ok: true };
}

export async function incrementTemplateUseCount(templateId) {
  if (!templateId) return;
  try {
    const { data } = await supabase.from(TABLE).select('use_count').eq('id', templateId).maybeSingle();
    const current = data?.use_count || 0;
    await supabase.from(TABLE).update({ use_count: current + 1 }).eq('id', templateId);
  } catch { /* non-critical */ }
}
