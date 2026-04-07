create table if not exists public.daily_attendance (
  attendance_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_location jsonb,
  check_out_location jsonb,
  geo_verified boolean not null default false,
  shift_status varchar(20) not null default 'Standard',
  ot_minutes integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint daily_attendance_times_valid check (check_out_time is null or check_in_time is null or check_out_time >= check_in_time),
  constraint daily_attendance_ot_non_negative check (ot_minutes >= 0),
  constraint daily_attendance_check_in_location_object check (check_in_location is null or jsonb_typeof(check_in_location) = 'object'),
  constraint daily_attendance_check_out_location_object check (check_out_location is null or jsonb_typeof(check_out_location) = 'object')
);

create unique index if not exists idx_daily_attendance_project_user_local_day
  on public.daily_attendance (
    user_id,
    project_id,
    (date(timezone('Asia/Kolkata', coalesce(check_in_time, created_at))))
  );

create index if not exists idx_daily_attendance_project_created
  on public.daily_attendance (project_id, created_at desc);

create index if not exists idx_daily_attendance_user_open_shift
  on public.daily_attendance (user_id, project_id, created_at desc)
  where check_out_time is null;

create table if not exists public.wage_payouts (
  payout_id uuid primary key default gen_random_uuid(),
  attendance_id uuid references public.daily_attendance (attendance_id) on delete cascade,
  amount numeric(14,2) not null,
  type varchar(20) not null default 'Batta',
  status varchar(30) not null default 'Requested',
  payment_method varchar(20),
  requested_by uuid references public.users (id) on delete set null,
  approved_by uuid references public.users (id) on delete set null,
  paid_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint wage_payouts_amount_positive check (amount > 0)
);

create unique index if not exists idx_wage_payouts_unique_attendance_type
  on public.wage_payouts (attendance_id, type);

create index if not exists idx_wage_payouts_status_created
  on public.wage_payouts (status, created_at desc);

create table if not exists public.project_locations (
  location_id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name varchar(100),
  latitude numeric(10,7),
  longitude numeric(10,7),
  radius_meters integer not null default 200,
  is_active boolean not null default true,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint project_locations_latitude_range check (latitude between -90 and 90),
  constraint project_locations_longitude_range check (longitude between -180 and 180),
  constraint project_locations_radius_range check (radius_meters between 50 and 1000)
);

create unique index if not exists idx_project_locations_one_active
  on public.project_locations (project_id)
  where is_active = true;

create index if not exists idx_project_locations_project_created
  on public.project_locations (project_id, created_at desc);

drop trigger if exists trg_daily_attendance_set_updated_at on public.daily_attendance;
create trigger trg_daily_attendance_set_updated_at
before update on public.daily_attendance
for each row execute function public.set_updated_at();

drop trigger if exists trg_wage_payouts_set_updated_at on public.wage_payouts;
create trigger trg_wage_payouts_set_updated_at
before update on public.wage_payouts
for each row execute function public.set_updated_at();

insert into public.project_locations (project_id, name, latitude, longitude, radius_meters, is_active)
select
  projects.id,
  'Abode Valley',
  12.8218120,
  80.0449880,
  200,
  true
from public.projects
where not exists (
  select 1
  from public.project_locations
  where project_locations.project_id = projects.id
    and project_locations.is_active = true
);
