alter table if exists public.projects
  add column if not exists project_phase text not null default 'planning';

alter table if exists public.projects
  add column if not exists project_type text;

alter table if exists public.projects
  add column if not exists production_house text;

alter table if exists public.projects
  add column if not exists client_name text;

alter table if exists public.projects
  add column if not exists director_name text;

alter table if exists public.projects
  add column if not exists language text;

do $$
begin
  alter table public.projects
    drop constraint if exists projects_project_phase_check;

  alter table public.projects
    add constraint projects_project_phase_check
    check (project_phase in ('planning', 'pre_production', 'production', 'post_production', 'completed'));
exception
  when undefined_table then null;
end $$;

create table if not exists public.project_planning_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  section_type text not null,
  payload jsonb not null default '{}'::jsonb,
  is_completed boolean not null default false,
  is_skipped boolean not null default false,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_planning_sections_type_check check (
    section_type in ('project_information', 'crew_planning', 'cast_planning', 'expense_planning', 'budget_review')
  ),
  constraint project_planning_sections_payload_object check (jsonb_typeof(payload) = 'object'),
  unique (project_id, section_type)
);

create index if not exists idx_project_planning_sections_project
  on public.project_planning_sections (project_id, section_type);

drop trigger if exists trg_project_planning_sections_set_updated_at on public.project_planning_sections;
create trigger trg_project_planning_sections_set_updated_at
before update on public.project_planning_sections
for each row execute function public.set_updated_at();
