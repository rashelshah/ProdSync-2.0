alter table if exists public.call_sheets
  alter column actor_name drop not null;

alter table if exists public.call_sheets
  add column if not exists location_id uuid references public.locations (id) on delete set null,
  add column if not exists call_type text,
  add column if not exists time_in time,
  add column if not exists time_out time;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'call_sheets_call_type_check'
  ) then
    alter table public.call_sheets
      add constraint call_sheets_call_type_check
      check (call_type is null or call_type in ('standard', 'one_and_half', 'double', 'custom'));
  end if;
end $$;

create index if not exists idx_call_sheets_project_location
  on public.call_sheets (project_id, location_id, shoot_date asc);

create table if not exists public.call_sheet_assignments (
  id uuid primary key default gen_random_uuid(),
  call_sheet_id uuid not null references public.call_sheets (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  assignment_type text not null,
  actor_name text,
  character_name text,
  crew_member_id uuid references public.crew_members (id) on delete set null,
  crew_name text,
  department text,
  designation text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint call_sheet_assignments_type_check check (assignment_type in ('actor', 'crew')),
  constraint call_sheet_assignments_actor_payload_check check (
    assignment_type <> 'actor'
    or actor_name is not null
  ),
  constraint call_sheet_assignments_crew_payload_check check (
    assignment_type <> 'crew'
    or (
      coalesce(crew_name, '') <> ''
      and coalesce(department, '') <> ''
      and coalesce(designation, '') <> ''
    )
  )
);

create index if not exists idx_call_sheet_assignments_call_sheet
  on public.call_sheet_assignments (call_sheet_id, assignment_type, created_at asc);

create index if not exists idx_call_sheet_assignments_project
  on public.call_sheet_assignments (project_id, assignment_type, created_at desc);

drop trigger if exists trg_call_sheet_assignments_set_updated_at on public.call_sheet_assignments;
create trigger trg_call_sheet_assignments_set_updated_at
before update on public.call_sheet_assignments
for each row execute function public.set_updated_at();

alter table public.call_sheet_assignments enable row level security;
alter table public.call_sheet_assignments force row level security;

drop policy if exists call_sheet_assignments_select_scoped on public.call_sheet_assignments;
create policy call_sheet_assignments_select_scoped
on public.call_sheet_assignments
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'actors')
  )
);

drop policy if exists call_sheet_assignments_manage_scoped on public.call_sheet_assignments;
create policy call_sheet_assignments_manage_scoped
on public.call_sheet_assignments
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'actors')
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'actors')
);

insert into public.call_sheet_assignments (
  call_sheet_id,
  project_id,
  assignment_type,
  actor_name,
  character_name
)
select
  cs.id,
  cs.project_id,
  'actor',
  cs.actor_name,
  cs.character_name
from public.call_sheets cs
where cs.actor_name is not null
  and not exists (
    select 1
    from public.call_sheet_assignments csa
    where csa.call_sheet_id = cs.id
  );

update public.call_sheets
set
  call_type = coalesce(call_type, 'custom'),
  time_in = coalesce(time_in, call_time),
  time_out = coalesce(time_out, call_time)
where call_time is not null
  and (call_type is null or time_in is null or time_out is null);

update public.call_sheets cs
set location_id = matched.id
from lateral (
  select l.id
  from public.locations l
  where l.project_id = cs.project_id
    and lower(l.name) = lower(cs.location)
  order by l.created_at asc
  limit 1
) as matched
where cs.location_id is null;

create or replace function public.validate_actor_call_sheet_schedule()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  project_start date;
  project_end date;
  location_project uuid;
begin
  select start_date, end_date
    into project_start, project_end
  from public.projects
  where id = new.project_id;

  if project_start is not null and new.shoot_date < project_start then
    raise exception 'Call sheet date must be within project timeline.';
  end if;

  if project_end is not null and new.shoot_date > project_end then
    raise exception 'Call sheet date must be within project timeline.';
  end if;

  if new.location_id is null then
    raise exception 'Missing location.';
  end if;

  select project_id
    into location_project
  from public.locations
  where id = new.location_id;

  if location_project is null or location_project <> new.project_id then
    raise exception 'Location must belong to the selected project.';
  end if;

  if new.time_in is null or new.time_out is null or new.time_in = new.time_out then
    raise exception 'Invalid time range.';
  end if;

  if new.call_type = 'standard' and not (
    (new.time_in = time '09:00' and new.time_out = time '18:00')
    or (new.time_in = time '14:00' and new.time_out = time '22:00')
    or (new.time_in = time '18:00' and new.time_out = time '02:00')
  ) then
    raise exception 'Selected call sheet timing does not match the call sheet type.';
  end if;

  if new.call_type = 'one_and_half' and not (
    (new.time_in = time '09:00' and new.time_out = time '21:00')
    or (new.time_in = time '14:00' and new.time_out = time '02:00')
  ) then
    raise exception 'Selected call sheet timing does not match the call sheet type.';
  end if;

  if new.call_type = 'double' and not (
    (new.time_in = time '09:00' and new.time_out = time '02:00')
    or (new.time_in = time '14:00' and new.time_out = time '06:00')
  ) then
    raise exception 'Selected call sheet timing does not match the call sheet type.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_call_sheets_validate_schedule on public.call_sheets;
create trigger trg_call_sheets_validate_schedule
before insert or update on public.call_sheets
for each row execute function public.validate_actor_call_sheet_schedule();
