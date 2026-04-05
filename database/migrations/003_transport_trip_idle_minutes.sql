-- Transport trip idle-time support and GPS query helpers.
-- Safe to run repeatedly.

alter table public.trips
  add column if not exists idle_minutes integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_idle_minutes_non_negative'
  ) then
    alter table public.trips
      add constraint trips_idle_minutes_non_negative
      check (idle_minutes is null or idle_minutes >= 0);
  end if;
end $$;

create index if not exists idx_trips_project_vehicle_start_time_desc
  on public.trips (project_id, vehicle_id, start_time desc);

create index if not exists idx_gps_logs_project_trip_captured_at_desc
  on public.gps_logs (project_id, trip_id, captured_at desc);

create index if not exists idx_gps_logs_project_vehicle_captured_at_desc
  on public.gps_logs (project_id, vehicle_id, captured_at desc);
