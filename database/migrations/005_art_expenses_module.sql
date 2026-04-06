create table if not exists public.set_construction (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  set_name text not null,
  estimated_cost numeric(14,2) not null default 0,
  actual_cost numeric(14,2) not null default 0,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed')),
  progress_percentage integer not null default 0 check (progress_percentage between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_set_construction_project on public.set_construction (project_id, created_at desc);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  department public.department_code not null,
  allocated_budget numeric(14,2) not null default 0,
  used_budget numeric(14,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, department),
  constraint budgets_allocated_non_negative check (allocated_budget >= 0),
  constraint budgets_used_non_negative check (used_budget >= 0)
);

create index if not exists idx_budgets_project_department on public.budgets (project_id, department);
