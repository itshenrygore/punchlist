-- ════════════════════════════════════════════════════════════════
-- Punchlist — job_templates table
--
-- Job templates let a contractor save a quote as a reusable starting
-- point (line items, trade, description, province). This was only ever
-- documented in a code comment — if it was never run, saving a template
-- silently failed and the Templates tab showed nothing.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.job_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  trade text,
  description text,
  scope_summary text,
  province text,
  line_items jsonb default '[]'::jsonb,
  use_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_job_templates_user on public.job_templates(user_id, use_count desc);

alter table public.job_templates enable row level security;

drop policy if exists "Users manage own job templates" on public.job_templates;
create policy "Users manage own job templates"
  on public.job_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
