create table if not exists public.budget_allocations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  department varchar(32) not null,
  allocated_amount numeric(14,2) not null default 0,
  allocated_percentage numeric(7,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint budget_allocations_department_check check (
    department in ('transport', 'crew', 'camera', 'art', 'wardrobe', 'post', 'production')
  ),
  constraint budget_allocations_amount_non_negative check (allocated_amount >= 0),
  constraint budget_allocations_percentage_range check (allocated_percentage >= 0 and allocated_percentage <= 100),
  unique (project_id, department)
);

create index if not exists idx_budget_allocations_project_department
  on public.budget_allocations (project_id, department);

drop trigger if exists trg_budget_allocations_set_updated_at on public.budget_allocations;
create trigger trg_budget_allocations_set_updated_at
before update on public.budget_allocations
for each row execute function public.set_updated_at();

create index if not exists idx_daily_attendance_project_check_in
  on public.daily_attendance (project_id, check_in_time desc);

create index if not exists idx_daily_attendance_project_user_check_in
  on public.daily_attendance (project_id, user_id, check_in_time desc);
