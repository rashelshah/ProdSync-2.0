do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'alert_source'
      and e.enumlabel = 'food_beverages'
  ) then
    alter type public.alert_source add value 'food_beverages';
  end if;
exception
  when duplicate_object then
    null;
end $$;

create table if not exists public.food_beverage_vendors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  category text,
  contact_name text,
  email text,
  phone text,
  payment_terms text,
  active boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint food_beverage_vendors_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_food_beverage_vendors_project on public.food_beverage_vendors (project_id, active, name);

create table if not exists public.food_beverage_forecasts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  forecast_date date not null,
  department text not null,
  meal_count integer not null default 0,
  meal_period text,
  is_estimated boolean not null default false,
  status text not null default 'submitted',
  submitted_by uuid references public.users (id) on delete set null,
  submitted_at timestamptz not null default timezone('utc', now()),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint food_beverage_forecasts_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint food_beverage_forecasts_status_check check (status in ('submitted', 'estimated')),
  constraint food_beverage_forecasts_meal_count_non_negative check (meal_count >= 0)
);

create unique index if not exists uq_food_beverage_forecasts_target
  on public.food_beverage_forecasts (project_id, forecast_date, department);

create index if not exists idx_food_beverage_forecasts_project_date
  on public.food_beverage_forecasts (project_id, forecast_date);

create table if not exists public.food_beverage_meal_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  meal_date date not null,
  department text not null,
  meal_period text not null,
  meals_served integer not null default 0,
  waste_count integer not null default 0,
  vendor_id uuid references public.food_beverage_vendors (id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint food_beverage_meal_logs_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint food_beverage_meal_logs_meal_period_check check (meal_period in ('breakfast', 'lunch', 'dinner', 'snacks')),
  constraint food_beverage_meal_logs_counts_non_negative check (meals_served >= 0 and waste_count >= 0)
);

create index if not exists idx_food_beverage_meal_logs_project_date
  on public.food_beverage_meal_logs (project_id, meal_date, department);

create table if not exists public.food_beverage_dietary_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  department text not null,
  vegetarian_count integer not null default 0,
  vegan_count integer not null default 0,
  jain_count integer not null default 0,
  gluten_free_count integer not null default 0,
  allergen_notes text,
  contact_name text,
  contact_phone text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint food_beverage_dietary_profiles_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint food_beverage_dietary_profiles_counts_non_negative check (
    vegetarian_count >= 0 and vegan_count >= 0 and jain_count >= 0 and gluten_free_count >= 0
  )
);

create unique index if not exists uq_food_beverage_dietary_profiles_project_department
  on public.food_beverage_dietary_profiles (project_id, department);

create table if not exists public.food_beverage_invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  vendor_id uuid references public.food_beverage_vendors (id) on delete set null,
  invoice_number text not null,
  invoice_date date not null,
  amount numeric(14,2) not null default 0,
  currency_code text not null default 'INR',
  status text not null default 'submitted',
  approval_requested boolean not null default false,
  approval_id uuid references public.approvals (id) on delete set null,
  file_url text,
  storage_path text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint food_beverage_invoices_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint food_beverage_invoices_status_check check (status in ('draft', 'submitted', 'approved', 'rejected', 'paid')),
  constraint food_beverage_invoices_amount_non_negative check (amount >= 0)
);

create unique index if not exists uq_food_beverage_invoices_project_number
  on public.food_beverage_invoices (project_id, invoice_number);

create index if not exists idx_food_beverage_invoices_project_date
  on public.food_beverage_invoices (project_id, invoice_date, status);

create table if not exists public.food_beverage_variance_alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  alert_date date not null,
  department text not null,
  vendor_name text,
  forecast_count integer not null default 0,
  served_count integer not null default 0,
  variance_count integer not null default 0,
  variance_percent numeric(10,2) not null default 0,
  severity text not null default 'info',
  message text not null,
  acknowledged_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint food_beverage_variance_alerts_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint food_beverage_variance_alerts_severity_check check (severity in ('critical', 'warning', 'info')),
  constraint food_beverage_variance_alerts_counts_non_negative check (forecast_count >= 0 and served_count >= 0)
);

create unique index if not exists uq_food_beverage_variance_alerts_target
  on public.food_beverage_variance_alerts (project_id, alert_date, department);

create index if not exists idx_food_beverage_variance_alerts_project_date
  on public.food_beverage_variance_alerts (project_id, alert_date, severity);

create table if not exists public.food_beverage_activity_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  actor_user_id uuid references public.users (id) on delete set null,
  actor_user_name text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint food_beverage_activity_logs_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_food_beverage_activity_logs_project_created
  on public.food_beverage_activity_logs (project_id, created_at desc);
