create table if not exists public.project_phase_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  previous_phase text,
  new_phase text not null,
  changed_by uuid references public.users (id) on delete set null,
  changed_at timestamptz not null default timezone('utc', now()),
  notes text,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  constraint project_phase_history_previous_check check (
    previous_phase is null
    or previous_phase in ('planning', 'pre_production', 'production', 'post_production', 'completed')
  ),
  constraint project_phase_history_new_check check (
    new_phase in ('planning', 'pre_production', 'production', 'post_production', 'completed')
  ),
  constraint project_phase_history_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_project_phase_history_project_changed
  on public.project_phase_history (project_id, changed_at desc);

create index if not exists idx_project_phase_history_actor_changed
  on public.project_phase_history (changed_by, changed_at desc);
