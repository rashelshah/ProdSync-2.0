-- ProdSync database architecture
-- Run order:
--   1. schema.sql
--   2. functions.sql
--   3. triggers.sql
--   4. views.sql
--   5. policies.sql

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.user_role as enum (
  'EP',
  'LINE_PRODUCER',
  'HOD',
  'SUPERVISOR',
  'CREW',
  'DRIVER',
  'DATA_WRANGLER'
);

create type public.department_code as enum (
  'production',
  'camera',
  'art',
  'transport',
  'wardrobe',
  'post'
);

create type public.project_status as enum (
  'pre_production',
  'shooting',
  'post'
);

create type public.membership_status as enum (
  'active',
  'invited',
  'suspended',
  'left'
);

create type public.project_member_role as enum (
  'executive_producer',
  'line_producer',
  'production_manager',
  'first_ad',
  'dop',
  'first_ac',
  'camera_operator',
  'art_director',
  'art_assistant',
  'transport_captain',
  'driver',
  'editor',
  'colorist',
  'costume_supervisor',
  'wardrobe_stylist',
  'crew_member',
  'data_wrangler'
);

create type public.join_request_status as enum (
  'pending',
  'approved',
  'rejected',
  'withdrawn'
);

create type public.approval_type as enum (
  'expense',
  'travel_auth',
  'catering',
  'props_rental',
  'camera_rental',
  'overtime_extension',
  'petty_cash',
  'vendor_payment',
  'batta',
  'wage',
  'rental',
  'fuel',
  'other'
);

create type public.approval_status as enum (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

create type public.approval_action_type as enum (
  'submitted',
  'approved',
  'rejected',
  'cancelled'
);

create type public.approval_priority as enum (
  'emergency',
  'high',
  'normal'
);

create type public.vehicle_status as enum (
  'active',
  'idle',
  'maintenance',
  'exception'
);

create type public.trip_status as enum (
  'planned',
  'active',
  'completed',
  'flagged',
  'cancelled'
);

create type public.fuel_audit_status as enum (
  'verified',
  'mismatch',
  'pending'
);

create type public.attendance_verification as enum (
  'gps',
  'manual',
  'biometric'
);

create type public.crew_presence_status as enum (
  'active',
  'ot',
  'offduty'
);

create type public.payment_status as enum (
  'requested',
  'approved',
  'paid',
  'rejected',
  'cancelled'
);

create type public.payment_method as enum (
  'upi',
  'cash',
  'bank'
);

create type public.alert_severity as enum (
  'critical',
  'warning',
  'info'
);

create type public.alert_source as enum (
  'transport',
  'crew',
  'camera',
  'expenses',
  'wardrobe',
  'approvals',
  'system'
);

create type public.alert_status as enum (
  'open',
  'acknowledged',
  'resolved'
);

create type public.asset_status as enum (
  'available',
  'checked_out',
  'maintenance',
  'rented',
  'lost'
);

create type public.rental_status as enum (
  'draft',
  'active',
  'returned',
  'closed',
  'cancelled'
);

create type public.receipt_status as enum (
  'uploaded',
  'validated',
  'rejected'
);

create type public.expense_status as enum (
  'draft',
  'submitted',
  'approved',
  'rejected',
  'paid',
  'reimbursed',
  'cancelled'
);

create type public.costume_status as enum (
  'available',
  'fitted',
  'on_set',
  'laundry',
  'repair',
  'in_storage',
  'in_laundry',
  'missing'
);

create type public.laundry_status as enum (
  'queued',
  'washing',
  'drying',
  'ready',
  'delivered',
  'sent',
  'in_cleaning',
  'returned',
  'delayed'
);

create type public.report_type as enum (
  'dashboard_snapshot',
  'financial_overview',
  'approval_summary',
  'attendance_summary',
  'custom'
);

create type public.metric_period as enum (
  'daily',
  'weekly',
  'monthly',
  'custom'
);

create type public.integration_status as enum (
  'connected',
  'pending',
  'disconnected'
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email citext not null unique,
  phone text unique,
  role public.user_role not null default 'CREW',
  department public.department_code,
  avatar_url text,
  auth_provider varchar not null default 'email',
  supabase_user_id uuid references auth.users (id) on delete set null,
  is_google_linked boolean not null default false,
  onboarding_completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint users_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete restrict,
  name text not null,
  slug text unique,
  status public.project_status not null default 'pre_production',
  description text,
  location text,
  budget numeric(14,2) not null default 0,
  currency_code text not null default 'USD',
  progress_percent numeric(5,2) not null default 0,
  start_date date,
  end_date date,
  is_archived boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint projects_budget_non_negative check (budget >= 0),
  constraint projects_progress_range check (progress_percent between 0 and 100),
  constraint projects_dates_valid check (end_date is null or start_date is null or end_date >= start_date),
  constraint projects_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

alter table public.users
  add column last_active_project_id uuid references public.projects (id) on delete set null;

create table public.project_settings (
  project_id uuid primary key references public.projects (id) on delete cascade,
  base_location text,
  standard_shift_hours numeric(5,2) not null default 10,
  overtime_multiplier numeric(6,2) not null default 1.5,
  daily_batta_budget numeric(14,2) not null default 0,
  fuel_allowance_per_km numeric(10,4) not null default 0.12,
  outstation_threshold_km numeric(10,2) not null default 80,
  night_shift_premium_percent numeric(5,2) not null default 25,
  ot_rules_label text,
  alert_thresholds jsonb not null default jsonb_build_object(
    'fuel_mismatch_pct', 15,
    'ot_trigger_hours', 10,
    'budget_warning_pct', 85,
    'budget_critical_pct', 100
  ),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_settings_standard_shift_positive check (standard_shift_hours > 0),
  constraint project_settings_ot_multiplier_positive check (overtime_multiplier > 0),
  constraint project_settings_batta_non_negative check (daily_batta_budget >= 0),
  constraint project_settings_fuel_allowance_non_negative check (fuel_allowance_per_km >= 0),
  constraint project_settings_outstation_non_negative check (outstation_threshold_km >= 0),
  constraint project_settings_night_premium_non_negative check (night_shift_premium_percent >= 0),
  constraint project_settings_alert_thresholds_object check (jsonb_typeof(alert_thresholds) = 'object'),
  constraint project_settings_config_object check (jsonb_typeof(config) = 'object')
);

create table public.project_departments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  department public.department_code not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, department),
  constraint project_departments_config_object check (jsonb_typeof(config) = 'object')
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  role public.project_member_role not null,
  access_role public.user_role not null,
  department public.department_code not null,
  status public.membership_status not null default 'active',
  permissions jsonb not null default '[]'::jsonb,
  is_owner boolean not null default false,
  joined_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  approved_by uuid references public.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, project_id),
  constraint project_members_permissions_is_array check (jsonb_typeof(permissions) = 'array'),
  constraint project_members_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.project_join_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  department public.department_code not null,
  role_requested public.project_member_role not null,
  access_role_requested public.user_role not null,
  status public.join_request_status not null default 'pending',
  message text,
  review_note text,
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  registration_number text,
  name text not null,
  vehicle_type text not null,
  status public.vehicle_status not null default 'active',
  capacity integer,
  assigned_driver_user_id uuid references public.users (id) on delete set null,
  gps_device_id text,
  base_location text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, registration_number),
  constraint vehicles_capacity_positive check (capacity is null or capacity >= 0),
  constraint vehicles_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  driver_user_id uuid references public.users (id) on delete set null,
  department public.department_code not null default 'transport',
  origin text,
  destination text,
  start_time timestamptz not null,
  end_time timestamptz,
  distance_km numeric(10,2) not null default 0,
  purpose text,
  call_sheet_reference text,
  status public.trip_status not null default 'planned',
  outstation boolean not null default false,
  created_by uuid references public.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint trips_distance_non_negative check (distance_km >= 0),
  constraint trips_dates_valid check (end_time is null or end_time >= start_time),
  constraint trips_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  trip_id uuid references public.trips (id) on delete set null,
  logged_by uuid not null references public.users (id) on delete restrict,
  log_date date not null,
  fuel_type text not null default 'diesel',
  litres numeric(10,2) not null,
  odometer_km numeric(10,2),
  expected_mileage numeric(10,2),
  actual_mileage numeric(10,2),
  cost_amount numeric(14,2),
  currency_code text not null default 'USD',
  audit_status public.fuel_audit_status not null default 'pending',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fuel_logs_litres_positive check (litres > 0),
  constraint fuel_logs_odometer_non_negative check (odometer_km is null or odometer_km >= 0),
  constraint fuel_logs_expected_mileage_non_negative check (expected_mileage is null or expected_mileage >= 0),
  constraint fuel_logs_actual_mileage_non_negative check (actual_mileage is null or actual_mileage >= 0),
  constraint fuel_logs_cost_non_negative check (cost_amount is null or cost_amount >= 0),
  constraint fuel_logs_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.gps_logs (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  captured_at timestamptz not null default timezone('utc', now()),
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  speed_kph numeric(8,2),
  heading numeric(6,2),
  geofence_status text,
  metadata jsonb not null default '{}'::jsonb,
  constraint gps_logs_latitude_range check (latitude between -90 and 90),
  constraint gps_logs_longitude_range check (longitude between -180 and 180),
  constraint gps_logs_speed_non_negative check (speed_kph is null or speed_kph >= 0),
  constraint gps_logs_heading_range check (heading is null or heading between 0 and 360),
  constraint gps_logs_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.transport_alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  trip_id uuid references public.trips (id) on delete set null,
  fuel_log_id uuid references public.fuel_logs (id) on delete set null,
  severity public.alert_severity not null,
  alert_type text not null,
  title text not null,
  message text not null,
  status public.alert_status not null default 'open',
  triggered_at timestamptz not null default timezone('utc', now()),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.users (id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references public.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  constraint transport_alerts_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  department public.department_code not null default 'camera',
  asset_code text not null,
  name text not null,
  category text not null,
  brand text,
  serial_number text,
  owner_vendor text,
  status public.asset_status not null default 'available',
  replacement_value numeric(14,2),
  daily_rate numeric(14,2),
  purchase_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, asset_code),
  unique (project_id, serial_number),
  constraint assets_replacement_value_non_negative check (replacement_value is null or replacement_value >= 0),
  constraint assets_daily_rate_non_negative check (daily_rate is null or daily_rate >= 0),
  constraint assets_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.rentals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  department public.department_code not null default 'camera',
  vendor_name text not null,
  rental_number text,
  status public.rental_status not null default 'draft',
  starts_on date not null,
  ends_on date,
  daily_rate numeric(14,2),
  total_amount numeric(14,2),
  currency_code text not null default 'USD',
  notes text,
  created_by uuid references public.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rentals_dates_valid check (ends_on is null or ends_on >= starts_on),
  constraint rentals_daily_rate_non_negative check (daily_rate is null or daily_rate >= 0),
  constraint rentals_total_amount_non_negative check (total_amount is null or total_amount >= 0),
  constraint rentals_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.rental_items (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  asset_id uuid references public.assets (id) on delete set null,
  quantity integer not null default 1,
  daily_rate numeric(14,2),
  total_amount numeric(14,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rental_items_quantity_positive check (quantity > 0),
  constraint rental_items_daily_rate_non_negative check (daily_rate is null or daily_rate >= 0),
  constraint rental_items_total_amount_non_negative check (total_amount is null or total_amount >= 0),
  constraint rental_items_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.asset_checkouts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  checkout_to_user_id uuid references public.users (id) on delete set null,
  trip_id uuid references public.trips (id) on delete set null,
  checked_out_by uuid references public.users (id) on delete set null,
  checked_out_at timestamptz not null default timezone('utc', now()),
  expected_return_at timestamptz,
  checked_in_at timestamptz,
  checked_in_by uuid references public.users (id) on delete set null,
  condition_out text,
  condition_in text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint asset_checkouts_return_after_checkout check (expected_return_at is null or expected_return_at >= checked_out_at),
  constraint asset_checkouts_checkin_after_checkout check (checked_in_at is null or checked_in_at >= checked_out_at),
  constraint asset_checkouts_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.asset_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  checkout_id uuid references public.asset_checkouts (id) on delete set null,
  actor_user_id uuid references public.users (id) on delete set null,
  event_type text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint asset_logs_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.crew_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  project_member_id uuid references public.project_members (id) on delete set null,
  user_id uuid not null references public.users (id) on delete cascade,
  department public.department_code not null,
  role_title text not null,
  employee_code text,
  union_name text,
  wage_type text,
  day_rate numeric(14,2),
  currency_code text not null default 'USD',
  shift_hours_planned numeric(5,2) not null default 10,
  batta_eligible boolean not null default true,
  payment_method public.payment_method not null default 'bank',
  bank_details jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, user_id),
  unique (project_member_id),
  constraint crew_members_day_rate_non_negative check (day_rate is null or day_rate >= 0),
  constraint crew_members_shift_hours_positive check (shift_hours_planned > 0),
  constraint crew_members_bank_details_is_object check (jsonb_typeof(bank_details) = 'object'),
  constraint crew_members_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  crew_member_id uuid not null references public.crew_members (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  work_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  verification public.attendance_verification not null,
  verification_payload jsonb not null default '{}'::jsonb,
  location text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  status public.crew_presence_status not null default 'active',
  shift_hours numeric(6,2),
  overtime_minutes integer not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (crew_member_id, work_date),
  constraint attendance_logs_times_valid check (check_out_at is null or check_in_at is null or check_out_at >= check_in_at),
  constraint attendance_logs_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint attendance_logs_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint attendance_logs_shift_hours_non_negative check (shift_hours is null or shift_hours >= 0),
  constraint attendance_logs_overtime_non_negative check (overtime_minutes >= 0),
  constraint attendance_logs_verification_payload_is_object check (jsonb_typeof(verification_payload) = 'object')
);

create table public.overtime_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  crew_member_id uuid references public.crew_members (id) on delete set null,
  attendance_log_id uuid references public.attendance_logs (id) on delete set null,
  department public.department_code not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  hours numeric(6,2) not null default 0,
  estimated_cost numeric(14,2),
  authorized boolean not null default false,
  approved_by uuid references public.users (id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint overtime_logs_times_valid check (ended_at is null or ended_at >= started_at),
  constraint overtime_logs_hours_non_negative check (hours >= 0),
  constraint overtime_logs_estimated_cost_non_negative check (estimated_cost is null or estimated_cost >= 0),
  constraint overtime_logs_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.wage_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  crew_member_id uuid not null references public.crew_members (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  wage_type text not null,
  amount numeric(14,2) not null,
  currency_code text not null default 'USD',
  method public.payment_method not null default 'bank',
  status public.payment_status not null default 'requested',
  attendance_days integer,
  overtime_hours numeric(8,2),
  processed_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint wage_records_period_valid check (period_end >= period_start),
  constraint wage_records_amount_non_negative check (amount >= 0),
  constraint wage_records_attendance_days_non_negative check (attendance_days is null or attendance_days >= 0),
  constraint wage_records_overtime_non_negative check (overtime_hours is null or overtime_hours >= 0),
  constraint wage_records_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.batta_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  crew_member_id uuid not null references public.crew_members (id) on delete cascade,
  requested_by uuid not null references public.users (id) on delete cascade,
  requested_for_date date not null,
  amount numeric(14,2) not null,
  currency_code text not null default 'USD',
  reason text,
  status public.payment_status not null default 'requested',
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint batta_requests_amount_non_negative check (amount >= 0),
  constraint batta_requests_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  department public.department_code not null,
  category text not null,
  title text not null,
  description text,
  vendor_name text,
  incurred_on date not null,
  amount numeric(14,2) not null,
  currency_code text not null default 'USD',
  requested_by uuid not null references public.users (id) on delete cascade,
  status public.expense_status not null default 'draft',
  receipt_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint expenses_amount_non_negative check (amount >= 0),
  constraint expenses_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.petty_cash (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  department public.department_code not null,
  custodian_user_id uuid references public.users (id) on delete set null,
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  currency_code text not null default 'USD',
  effective_date date not null default current_date,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint petty_cash_opening_balance_non_negative check (opening_balance >= 0),
  constraint petty_cash_current_balance_non_negative check (current_balance >= 0),
  constraint petty_cash_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  expense_id uuid references public.expenses (id) on delete cascade,
  fuel_log_id uuid references public.fuel_logs (id) on delete cascade,
  uploaded_by uuid not null references public.users (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_mime text,
  file_size_bytes bigint,
  status public.receipt_status not null default 'uploaded',
  vendor_name text,
  receipt_number text,
  receipt_date date,
  subtotal_amount numeric(14,2),
  tax_amount numeric(14,2),
  total_amount numeric(14,2),
  extracted_data jsonb not null default '{}'::jsonb,
  validated_by uuid references public.users (id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint receipts_file_size_non_negative check (file_size_bytes is null or file_size_bytes >= 0),
  constraint receipts_subtotal_non_negative check (subtotal_amount is null or subtotal_amount >= 0),
  constraint receipts_tax_non_negative check (tax_amount is null or tax_amount >= 0),
  constraint receipts_total_non_negative check (total_amount is null or total_amount >= 0),
  constraint receipts_extracted_data_is_object check (jsonb_typeof(extracted_data) = 'object'),
  constraint receipts_has_parent check (expense_id is not null or fuel_log_id is not null)
);

create table public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  department public.department_code not null,
  vendor_name text not null,
  vendor_contact jsonb not null default '{}'::jsonb,
  expense_id uuid references public.expenses (id) on delete set null,
  payment_reference text,
  amount numeric(14,2) not null,
  currency_code text not null default 'USD',
  due_date date,
  paid_at timestamptz,
  status public.payment_status not null default 'requested',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint vendor_payments_amount_non_negative check (amount >= 0),
  constraint vendor_payments_vendor_contact_is_object check (jsonb_typeof(vendor_contact) = 'object'),
  constraint vendor_payments_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.costumes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  character_name text,
  costume_code text not null,
  title text not null,
  size_label text,
  actor_name text,
  status public.costume_status not null default 'available',
  last_used_scene text,
  continuity_notes text,
  storage_location text,
  last_cleaned_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, costume_code),
  constraint costumes_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.laundry_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  costume_id uuid not null references public.costumes (id) on delete cascade,
  logged_by uuid references public.users (id) on delete set null,
  batch_number text,
  status public.laundry_status not null default 'queued',
  sent_at timestamptz,
  expected_return_date date,
  returned_at timestamptz,
  vendor_name text,
  cleaning_notes text,
  damage_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint laundry_logs_dates_valid check (returned_at is null or sent_at is null or returned_at >= sent_at),
  constraint laundry_logs_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.continuity_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  costume_id uuid references public.costumes (id) on delete set null,
  character_name text,
  actor_name text,
  scene_number text not null,
  shot_number text,
  look_description text,
  reference_image_path text,
  logged_by uuid references public.users (id) on delete set null,
  log_time timestamptz not null default timezone('utc', now()),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint continuity_logs_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.accessory_inventory (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  item_name text not null,
  category text not null check (category in ('jewellery', 'accessory')),
  assigned_character text,
  status text not null default 'in_safe' check (status in ('on_set', 'in_safe', 'in_use', 'missing')),
  last_checkin_time timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  type public.approval_type not null,
  department public.department_code not null,
  requested_by uuid not null references public.users (id) on delete cascade,
  request_title text not null,
  request_description text,
  amount numeric(14,2),
  currency_code text not null default 'USD',
  priority public.approval_priority not null default 'normal',
  status public.approval_status not null default 'pending',
  approvable_table text,
  approvable_id uuid,
  submitted_at timestamptz not null default timezone('utc', now()),
  approved_by uuid references public.users (id) on delete set null,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint approvals_amount_non_negative check (amount is null or amount >= 0),
  constraint approvals_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.approval_actions (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.approvals (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  action public.approval_action_type not null,
  actor_id uuid references public.users (id) on delete set null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  report_type public.report_type not null,
  generated_by uuid references public.users (id) on delete set null,
  title text not null,
  period_start date,
  period_end date,
  snapshot jsonb not null default '{}'::jsonb,
  exported_file_path text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint report_snapshots_period_valid check (period_end is null or period_start is null or period_end >= period_start),
  constraint report_snapshots_snapshot_is_object check (jsonb_typeof(snapshot) = 'object')
);

create table public.financial_metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  department public.department_code,
  metric_date date not null,
  period public.metric_period not null default 'daily',
  budget_amount numeric(14,2) not null default 0,
  actual_spend_amount numeric(14,2) not null default 0,
  committed_amount numeric(14,2) not null default 0,
  pending_approval_amount numeric(14,2) not null default 0,
  overtime_cost_amount numeric(14,2) not null default 0,
  variance_amount numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, department, metric_date, period),
  constraint financial_metrics_budget_non_negative check (budget_amount >= 0),
  constraint financial_metrics_actual_non_negative check (actual_spend_amount >= 0),
  constraint financial_metrics_committed_non_negative check (committed_amount >= 0),
  constraint financial_metrics_pending_non_negative check (pending_approval_amount >= 0),
  constraint financial_metrics_ot_non_negative check (overtime_cost_amount >= 0),
  constraint financial_metrics_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source public.alert_source not null,
  severity public.alert_severity not null,
  title text not null,
  message text not null,
  status public.alert_status not null default 'open',
  entity_table text,
  entity_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.users (id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references public.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  constraint alerts_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.alert_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  acknowledged_at timestamptz not null default timezone('utc', now()),
  unique (alert_id, user_id)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  entity_label text,
  old_data jsonb,
  new_data jsonb,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint activity_logs_context_is_object check (jsonb_typeof(context) = 'object')
);

create table public.user_notification_preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  critical_alerts boolean not null default true,
  approval_requests boolean not null default true,
  crew_updates boolean not null default false,
  daily_summary boolean not null default true,
  fleet_exceptions boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  created_by uuid not null references public.users (id) on delete cascade,
  provider text not null,
  status public.integration_status not null default 'pending',
  config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, provider),
  constraint integration_connections_config_is_object check (jsonb_typeof(config) = 'object')
);

alter table public.overtime_logs
  add column approval_id uuid references public.approvals (id) on delete set null;

alter table public.wage_records
  add column approval_id uuid references public.approvals (id) on delete set null;

alter table public.batta_requests
  add column approval_id uuid references public.approvals (id) on delete set null;

alter table public.expenses
  add column approval_id uuid references public.approvals (id) on delete set null;

alter table public.vendor_payments
  add column approval_id uuid references public.approvals (id) on delete set null;

create index idx_users_role on public.users (role);
create index idx_users_department on public.users (department);

create index idx_projects_owner_id on public.projects (owner_id);
create index idx_projects_status on public.projects (status);
create index idx_projects_dates on public.projects (start_date, end_date);

create index idx_project_departments_project on public.project_departments (project_id);
create index idx_project_members_user on public.project_members (user_id);
create index idx_project_members_project on public.project_members (project_id);
create index idx_project_members_project_status on public.project_members (project_id, status);
create index idx_project_members_project_department on public.project_members (project_id, department);
create index idx_project_members_project_access_role on public.project_members (project_id, access_role);
create index idx_project_members_permissions_gin on public.project_members using gin (permissions);

create index idx_project_join_requests_user on public.project_join_requests (user_id);
create index idx_project_join_requests_project on public.project_join_requests (project_id);
create index idx_project_join_requests_status on public.project_join_requests (status);
create unique index idx_project_join_requests_one_pending
  on public.project_join_requests (user_id, project_id)
  where status = 'pending';

create index idx_vehicles_project on public.vehicles (project_id);
create index idx_vehicles_status on public.vehicles (status);
create index idx_vehicles_assigned_driver on public.vehicles (assigned_driver_user_id);

create index idx_trips_project on public.trips (project_id);
create index idx_trips_vehicle on public.trips (vehicle_id);
create index idx_trips_driver on public.trips (driver_user_id);
create index idx_trips_status on public.trips (status);
create index idx_trips_start_time on public.trips (start_time desc);

create index idx_fuel_logs_project on public.fuel_logs (project_id);
create index idx_fuel_logs_vehicle on public.fuel_logs (vehicle_id);
create index idx_fuel_logs_trip on public.fuel_logs (trip_id);
create index idx_fuel_logs_logged_by on public.fuel_logs (logged_by);
create index idx_fuel_logs_date on public.fuel_logs (log_date desc);
create index idx_fuel_logs_status on public.fuel_logs (audit_status);

create index idx_gps_logs_project on public.gps_logs (project_id);
create index idx_gps_logs_vehicle on public.gps_logs (vehicle_id, captured_at desc);
create index idx_gps_logs_trip on public.gps_logs (trip_id, captured_at desc);

create index idx_transport_alerts_project on public.transport_alerts (project_id);
create index idx_transport_alerts_status on public.transport_alerts (status);
create index idx_transport_alerts_triggered_at on public.transport_alerts (triggered_at desc);

create index idx_assets_project on public.assets (project_id);
create index idx_assets_department on public.assets (project_id, department);
create index idx_assets_status on public.assets (status);
create index idx_assets_category on public.assets (category);

create index idx_rentals_project on public.rentals (project_id);
create index idx_rentals_status on public.rentals (status);
create index idx_rental_items_rental on public.rental_items (rental_id);
create index idx_asset_checkouts_project on public.asset_checkouts (project_id);
create index idx_asset_checkouts_asset on public.asset_checkouts (asset_id);
create index idx_asset_checkouts_checkout_to on public.asset_checkouts (checkout_to_user_id);
create index idx_asset_logs_project on public.asset_logs (project_id, created_at desc);
create index idx_asset_logs_asset on public.asset_logs (asset_id, created_at desc);

create index idx_crew_members_project on public.crew_members (project_id);
create index idx_crew_members_user on public.crew_members (user_id);
create index idx_crew_members_department on public.crew_members (project_id, department);

create index idx_attendance_logs_project on public.attendance_logs (project_id);
create index idx_attendance_logs_user on public.attendance_logs (user_id);
create index idx_attendance_logs_crew_member on public.attendance_logs (crew_member_id);
create index idx_attendance_logs_date on public.attendance_logs (work_date desc);
create index idx_attendance_logs_status on public.attendance_logs (status);

create index idx_overtime_logs_project on public.overtime_logs (project_id);
create index idx_overtime_logs_department on public.overtime_logs (project_id, department);
create index idx_overtime_logs_authorized on public.overtime_logs (authorized);
create index idx_overtime_logs_started_at on public.overtime_logs (started_at desc);

create index idx_wage_records_project on public.wage_records (project_id);
create index idx_wage_records_crew_member on public.wage_records (crew_member_id);
create index idx_wage_records_status on public.wage_records (status);
create index idx_wage_records_period on public.wage_records (period_start, period_end);

create index idx_batta_requests_project on public.batta_requests (project_id);
create index idx_batta_requests_crew_member on public.batta_requests (crew_member_id);
create index idx_batta_requests_requested_by on public.batta_requests (requested_by);
create index idx_batta_requests_status on public.batta_requests (status);
create index idx_batta_requests_date on public.batta_requests (requested_for_date desc);

create index idx_expenses_project on public.expenses (project_id);
create index idx_expenses_department on public.expenses (project_id, department);
create index idx_expenses_requested_by on public.expenses (requested_by);
create index idx_expenses_status on public.expenses (status);
create index idx_expenses_incurred_on on public.expenses (incurred_on desc);

create index idx_petty_cash_project on public.petty_cash (project_id);
create index idx_petty_cash_department on public.petty_cash (project_id, department);

create index idx_receipts_project on public.receipts (project_id);
create index idx_receipts_expense on public.receipts (expense_id);
create index idx_receipts_fuel_log on public.receipts (fuel_log_id);
create index idx_receipts_status on public.receipts (status);

create index idx_vendor_payments_project on public.vendor_payments (project_id);
create index idx_vendor_payments_department on public.vendor_payments (project_id, department);
create index idx_vendor_payments_status on public.vendor_payments (status);
create index idx_vendor_payments_due_date on public.vendor_payments (due_date);

create index idx_costumes_project on public.costumes (project_id);
create index idx_costumes_status on public.costumes (status);
create index idx_costumes_character on public.costumes (project_id, character_name);

create index idx_laundry_logs_project on public.laundry_logs (project_id);
create index idx_laundry_logs_costume on public.laundry_logs (costume_id);
create index idx_laundry_logs_status on public.laundry_logs (status);

create index idx_continuity_logs_project on public.continuity_logs (project_id);
create index idx_continuity_logs_costume on public.continuity_logs (costume_id);
create index idx_continuity_logs_scene on public.continuity_logs (scene_number, shot_number);
create index idx_continuity_logs_time on public.continuity_logs (log_time desc);

create index idx_approvals_project on public.approvals (project_id);
create index idx_approvals_requested_by on public.approvals (requested_by);
create index idx_approvals_department on public.approvals (project_id, department);
create index idx_approvals_status on public.approvals (status);
create index idx_approvals_type on public.approvals (type);
create index idx_approvals_priority on public.approvals (priority);
create index idx_approvals_approvable on public.approvals (approvable_table, approvable_id);
create index idx_approvals_created_at on public.approvals (created_at desc);

create index idx_approval_actions_approval on public.approval_actions (approval_id, created_at desc);
create index idx_approval_actions_project on public.approval_actions (project_id, created_at desc);

create index idx_report_snapshots_project on public.report_snapshots (project_id, created_at desc);
create index idx_report_snapshots_type on public.report_snapshots (report_type, created_at desc);
create index idx_report_snapshots_snapshot_gin on public.report_snapshots using gin (snapshot);

create index idx_financial_metrics_project on public.financial_metrics (project_id);
create index idx_financial_metrics_project_date on public.financial_metrics (project_id, metric_date desc);
create index idx_financial_metrics_department on public.financial_metrics (project_id, department, metric_date desc);

create index idx_alerts_project on public.alerts (project_id, created_at desc);
create index idx_alerts_source on public.alerts (source, created_at desc);
create index idx_alerts_status on public.alerts (status);
create index idx_alerts_entity on public.alerts (entity_table, entity_id);
create unique index idx_alerts_unique_entity
  on public.alerts (entity_table, entity_id)
  where entity_id is not null;
create index idx_alerts_metadata_gin on public.alerts using gin (metadata);

create index idx_activity_logs_project on public.activity_logs (project_id, created_at desc);
create index idx_activity_logs_user on public.activity_logs (user_id, created_at desc);
create index idx_activity_logs_entity on public.activity_logs (entity, entity_id);
create index idx_activity_logs_context_gin on public.activity_logs using gin (context);

create index idx_integration_connections_project on public.integration_connections (project_id);
create index idx_integration_connections_status on public.integration_connections (status);

alter table public.approvals replica identity full;
alter table public.alerts replica identity full;
alter table public.attendance_logs replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'approvals'
  ) then
    execute 'alter publication supabase_realtime add table public.approvals';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'alerts'
  ) then
    execute 'alter publication supabase_realtime add table public.alerts';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendance_logs'
  ) then
    execute 'alter publication supabase_realtime add table public.attendance_logs';
  end if;
end $$;
