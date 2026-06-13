alter table if exists public.food_beverage_forecasts
  add column if not exists jain_count integer not null default 0,
  add column if not exists vegan_count integer not null default 0,
  add column if not exists medical_count integer not null default 0,
  add column if not exists jain_split_count integer not null default 0,
  add column if not exists vegan_split_count integer not null default 0,
  add column if not exists medical_split_count integer not null default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'food_beverage_forecasts'
      and column_name = 'jain_split_count'
  ) then
    execute $sql$
      update public.food_beverage_forecasts
      set
        jain_count = greatest(coalesce(jain_count, 0), coalesce(jain_split_count, 0)),
        vegan_count = greatest(coalesce(vegan_count, 0), coalesce(vegan_split_count, 0)),
        medical_count = greatest(coalesce(medical_count, 0), coalesce(medical_split_count, 0))
    $sql$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'food_beverage_forecasts_dietary_non_negative'
      and conrelid = 'public.food_beverage_forecasts'::regclass
  ) then
    alter table public.food_beverage_forecasts
      add constraint food_beverage_forecasts_dietary_non_negative
      check (
        meal_count >= 0
        and expected_crew_count >= 0
        and veg_count >= 0
        and non_veg_count >= 0
        and egg_count >= 0
        and jain_count >= 0
        and vegan_count >= 0
        and medical_count >= 0
      );
  end if;
end $$;

create or replace function public.enforce_location_shoot_dates_within_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_start date;
  project_end date;
begin
  select start_date, end_date
    into project_start, project_end
  from public.projects
  where id = new.project_id;

  if project_start is not null and new.shoot_start_date is not null and new.shoot_start_date < project_start then
    raise exception using
      message = 'Shoot start date must be within the project schedule.',
      detail = format('Project starts on %s.', project_start);
  end if;

  if project_end is not null and new.shoot_end_date is not null and new.shoot_end_date > project_end then
    raise exception using
      message = 'Shoot end date must be within the project schedule.',
      detail = format('Project ends on %s.', project_end);
  end if;

  if new.shoot_start_date is not null and new.shoot_end_date is not null and new.shoot_end_date < new.shoot_start_date then
    raise exception using
      message = 'Shoot end date cannot be before shoot start date.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_locations_validate_shoot_dates on public.locations;
create trigger trg_locations_validate_shoot_dates
before insert or update on public.locations
for each row execute function public.enforce_location_shoot_dates_within_project();
