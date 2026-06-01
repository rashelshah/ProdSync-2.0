alter table if exists public.food_beverage_forecasts
  add column if not exists expected_crew_count integer not null default 0,
  add column if not exists veg_count integer not null default 0,
  add column if not exists non_veg_count integer not null default 0,
  add column if not exists egg_count integer not null default 0,
  add column if not exists jain_split_count integer not null default 0,
  add column if not exists vegan_split_count integer not null default 0,
  add column if not exists medical_split_count integer not null default 0,
  add column if not exists vendor_name text,
  add column if not exists vendor_contact_number text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'food_beverage_forecasts'
      and column_name = 'meal_count'
  ) then
    execute 'update public.food_beverage_forecasts set expected_crew_count = coalesce(expected_crew_count, meal_count), meal_count = coalesce(meal_count, expected_crew_count)';
  end if;
end $$;

alter table if exists public.food_beverage_meal_logs
  add column if not exists forecast_id uuid references public.food_beverage_forecasts (id) on delete set null,
  add column if not exists forecast_count integer not null default 0,
  add column if not exists actual_people_served integer not null default 0,
  add column if not exists unused_plates integer not null default 0,
  add column if not exists wasted_meals integer not null default 0,
  add column if not exists plate_cost numeric(14,2) not null default 0,
  add column if not exists extra_expense numeric(14,2) not null default 0,
  add column if not exists food_cost numeric(14,2) not null default 0,
  add column if not exists extra_cost numeric(14,2) not null default 0,
  add column if not exists total_meal_cost numeric(14,2) not null default 0,
  add column if not exists variance_count integer not null default 0,
  add column if not exists waste_percent numeric(10,2) not null default 0,
  add column if not exists vendor_name text,
  add column if not exists vendor_contact_number text,
  add column if not exists expense_notes text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'food_beverage_meal_logs'
      and column_name = 'meals_served'
  ) then
    execute 'update public.food_beverage_meal_logs set actual_people_served = coalesce(actual_people_served, meals_served), forecast_count = coalesce(forecast_count, meals_served), wasted_meals = coalesce(wasted_meals, waste_count)';
  end if;
end $$;

alter table if exists public.food_beverage_invoices
  add column if not exists meal_log_id uuid references public.food_beverage_meal_logs (id) on delete set null,
  add column if not exists forecast_id uuid references public.food_beverage_forecasts (id) on delete set null,
  add column if not exists generated_from_meal_log boolean not null default false,
  add column if not exists department text,
  add column if not exists meal_period text,
  add column if not exists forecast_count integer not null default 0,
  add column if not exists actual_people_served integer not null default 0,
  add column if not exists plate_cost numeric(14,2) not null default 0,
  add column if not exists extra_cost numeric(14,2) not null default 0,
  add column if not exists total_cost numeric(14,2) not null default 0,
  add column if not exists variance_count integer not null default 0,
  add column if not exists vendor_name text,
  add column if not exists vendor_contact_number text,
  add column if not exists expense_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'uq_food_beverage_invoices_meal_log'
  ) then
    create unique index uq_food_beverage_invoices_meal_log
      on public.food_beverage_invoices (meal_log_id)
      where meal_log_id is not null;
  end if;
end $$;

create index if not exists idx_food_beverage_forecasts_project_department_date
  on public.food_beverage_forecasts (project_id, forecast_date, department);

create index if not exists idx_food_beverage_meal_logs_project_department_date
  on public.food_beverage_meal_logs (project_id, meal_date, department);

create index if not exists idx_food_beverage_invoices_project_department_date
  on public.food_beverage_invoices (project_id, department, invoice_date);
