-- Transport live tracking upgrade
-- Safe to run multiple times.

create index if not exists idx_gps_logs_project_trip_vehicle_captured
  on public.gps_logs (project_id, trip_id, vehicle_id, captured_at desc);

create index if not exists idx_gps_logs_project_vehicle_trip_captured
  on public.gps_logs (project_id, vehicle_id, trip_id, captured_at desc);

create index if not exists idx_trips_project_status_driver_vehicle
  on public.trips (project_id, status, driver_user_id, vehicle_id);
