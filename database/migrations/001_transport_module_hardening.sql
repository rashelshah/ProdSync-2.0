-- Transport module hardening for production workflows.
-- Safe to run against an existing ProdSync database.

alter table public.project_settings
  add column if not exists geofence_center_latitude numeric(10,7),
  add column if not exists geofence_center_longitude numeric(10,7),
  add column if not exists geofence_radius_km numeric(10,2);

alter table public.trips
  add column if not exists start_location jsonb,
  add column if not exists end_location jsonb,
  add column if not exists start_odometer_km numeric(10,2),
  add column if not exists end_odometer_km numeric(10,2),
  add column if not exists duration_minutes integer,
  add column if not exists abnormality_score numeric(5,2) not null default 0;

alter table public.fuel_logs
  add column if not exists receipt_file_path text,
  add column if not exists odometer_image_path text,
  add column if not exists reviewed_by uuid references public.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approval_note text,
  add column if not exists fraud_status text not null default 'NORMAL',
  add column if not exists fraud_score numeric(5,2) not null default 0,
  add column if not exists fraud_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_settings_geofence_latitude_range'
  ) then
    alter table public.project_settings
      add constraint project_settings_geofence_latitude_range
      check (geofence_center_latitude is null or geofence_center_latitude between -90 and 90);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_settings_geofence_longitude_range'
  ) then
    alter table public.project_settings
      add constraint project_settings_geofence_longitude_range
      check (geofence_center_longitude is null or geofence_center_longitude between -180 and 180);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_settings_geofence_radius_non_negative'
  ) then
    alter table public.project_settings
      add constraint project_settings_geofence_radius_non_negative
      check (geofence_radius_km is null or geofence_radius_km >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_start_location_is_object'
  ) then
    alter table public.trips
      add constraint trips_start_location_is_object
      check (start_location is null or jsonb_typeof(start_location) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_end_location_is_object'
  ) then
    alter table public.trips
      add constraint trips_end_location_is_object
      check (end_location is null or jsonb_typeof(end_location) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_start_odometer_non_negative'
  ) then
    alter table public.trips
      add constraint trips_start_odometer_non_negative
      check (start_odometer_km is null or start_odometer_km >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_end_odometer_non_negative'
  ) then
    alter table public.trips
      add constraint trips_end_odometer_non_negative
      check (end_odometer_km is null or end_odometer_km >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_duration_minutes_non_negative'
  ) then
    alter table public.trips
      add constraint trips_duration_minutes_non_negative
      check (duration_minutes is null or duration_minutes >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_abnormality_score_non_negative'
  ) then
    alter table public.trips
      add constraint trips_abnormality_score_non_negative
      check (abnormality_score >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fuel_logs_reviewed_at_requires_reviewer'
  ) then
    alter table public.fuel_logs
      add constraint fuel_logs_reviewed_at_requires_reviewer
      check (reviewed_at is null or reviewed_by is not null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fuel_logs_fraud_score_non_negative'
  ) then
    alter table public.fuel_logs
      add constraint fuel_logs_fraud_score_non_negative
      check (fraud_score >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fuel_logs_fraud_status_valid'
  ) then
    alter table public.fuel_logs
      add constraint fuel_logs_fraud_status_valid
      check (fraud_status in ('NORMAL', 'SUSPICIOUS', 'FRAUD'));
  end if;
end $$;

create unique index if not exists idx_trips_one_active_vehicle
  on public.trips (vehicle_id)
  where status = 'active';

create unique index if not exists idx_trips_one_active_driver
  on public.trips (driver_user_id)
  where status = 'active' and driver_user_id is not null;

create index if not exists idx_trips_project_status_start_time_desc
  on public.trips (project_id, status, start_time desc);

create index if not exists idx_trips_project_driver_status
  on public.trips (project_id, driver_user_id, status);

create index if not exists idx_fuel_logs_project_vehicle_created_at_desc
  on public.fuel_logs (project_id, vehicle_id, created_at desc);

create index if not exists idx_fuel_logs_project_fraud_status_created_at_desc
  on public.fuel_logs (project_id, fraud_status, created_at desc);

create index if not exists idx_transport_alerts_project_status_triggered_at_desc
  on public.transport_alerts (project_id, status, triggered_at desc);
