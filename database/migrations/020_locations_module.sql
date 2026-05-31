do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'alert_source'
      and e.enumlabel = 'locations'
  ) then
    alter type public.alert_source add value 'locations';
  end if;
exception
  when duplicate_object then
    null;
end $$;

create or replace function public.can_view_locations(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_manage_project(p_project_id, p_user_id)
    or public.get_user_project_role(p_project_id, p_user_id) = 'production_manager'::public.project_member_role
    or public.get_user_role(p_project_id, p_user_id) = 'HOD'::public.user_role
$$;

create or replace function public.can_manage_locations(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_manage_project(p_project_id, p_user_id)
    or public.get_user_project_role(p_project_id, p_user_id) = 'production_manager'::public.project_member_role
$$;

create or replace function public.can_contribute_location_media(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_locations(p_project_id, p_user_id)
$$;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  address text not null,
  latitude double precision,
  longitude double precision,
  location_type text not null default 'private',
  shoot_start_date date,
  shoot_end_date date,
  risk_level text not null default 'medium',
  status text not null default 'draft',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint locations_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint locations_type_check check (location_type in ('government', 'private', 'studio', 'outdoor', 'indoor')),
  constraint locations_risk_level_check check (risk_level in ('low', 'medium', 'high')),
  constraint locations_status_check check (status in ('draft', 'recce_complete', 'permissions_pending', 'shoot_ready', 'completed')),
  constraint locations_dates_valid check (shoot_end_date is null or shoot_start_date is null or shoot_end_date >= shoot_start_date)
);

alter table if exists public.locations add column if not exists project_id uuid references public.projects (id) on delete cascade;
alter table if exists public.locations add column if not exists name text;
alter table if exists public.locations add column if not exists address text;
alter table if exists public.locations add column if not exists latitude double precision;
alter table if exists public.locations add column if not exists longitude double precision;
alter table if exists public.locations add column if not exists location_type text not null default 'private';
alter table if exists public.locations add column if not exists shoot_start_date date;
alter table if exists public.locations add column if not exists shoot_end_date date;
alter table if exists public.locations add column if not exists risk_level text not null default 'medium';
alter table if exists public.locations add column if not exists status text not null default 'draft';
alter table if exists public.locations add column if not exists notes text;
alter table if exists public.locations add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.locations add column if not exists created_by uuid references public.users (id) on delete set null;
alter table if exists public.locations add column if not exists updated_by uuid references public.users (id) on delete set null;
alter table if exists public.locations add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table if exists public.locations add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.location_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  media_kind text not null,
  original_name text not null,
  stored_name text not null,
  storage_path text not null,
  mime_type text not null,
  file_ext text not null,
  file_size_bytes bigint not null default 0,
  file_signature text,
  latitude double precision,
  longitude double precision,
  upload_time timestamptz not null default timezone('utc', now()),
  notes text,
  uploaded_by uuid references public.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint location_media_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint location_media_kind_check check (media_kind in ('image', 'video')),
  constraint location_media_file_size_non_negative check (file_size_bytes >= 0)
);

alter table if exists public.location_media add column if not exists project_id uuid references public.projects (id) on delete cascade;
alter table if exists public.location_media add column if not exists location_id uuid references public.locations (id) on delete cascade;
alter table if exists public.location_media add column if not exists media_kind text not null default 'image';
alter table if exists public.location_media add column if not exists original_name text;
alter table if exists public.location_media add column if not exists stored_name text;
alter table if exists public.location_media add column if not exists storage_path text;
alter table if exists public.location_media add column if not exists mime_type text;
alter table if exists public.location_media add column if not exists file_ext text;
alter table if exists public.location_media add column if not exists file_size_bytes bigint not null default 0;
alter table if exists public.location_media add column if not exists file_signature text;
alter table if exists public.location_media add column if not exists latitude double precision;
alter table if exists public.location_media add column if not exists longitude double precision;
alter table if exists public.location_media add column if not exists upload_time timestamptz not null default timezone('utc', now());
alter table if exists public.location_media add column if not exists notes text;
alter table if exists public.location_media add column if not exists uploaded_by uuid references public.users (id) on delete set null;
alter table if exists public.location_media add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.location_media add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table if exists public.location_media add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.location_permissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  permission_type text not null,
  custom_label text,
  authority_name text,
  authority_contact text,
  status text not null default 'pending',
  issue_date date,
  expiry_date date,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint location_permissions_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint location_permissions_status_check check (status in ('pending', 'submitted', 'approved', 'rejected', 'expired')),
  constraint location_permissions_type_check check (
    permission_type in (
      'police_permission',
      'corporation_approval',
      'traffic_department',
      'fire_department',
      'private_owner_agreement',
      'environmental_clearance',
      'custom'
    )
  ),
  constraint location_permissions_dates_valid check (expiry_date is null or issue_date is null or expiry_date >= issue_date)
);

alter table if exists public.location_permissions add column if not exists project_id uuid references public.projects (id) on delete cascade;
alter table if exists public.location_permissions add column if not exists location_id uuid references public.locations (id) on delete cascade;
alter table if exists public.location_permissions add column if not exists permission_type text not null default 'custom';
alter table if exists public.location_permissions add column if not exists custom_label text;
alter table if exists public.location_permissions add column if not exists authority_name text;
alter table if exists public.location_permissions add column if not exists authority_contact text;
alter table if exists public.location_permissions add column if not exists status text not null default 'pending';
alter table if exists public.location_permissions add column if not exists issue_date date;
alter table if exists public.location_permissions add column if not exists expiry_date date;
alter table if exists public.location_permissions add column if not exists notes text;
alter table if exists public.location_permissions add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.location_permissions add column if not exists created_by uuid references public.users (id) on delete set null;
alter table if exists public.location_permissions add column if not exists updated_by uuid references public.users (id) on delete set null;
alter table if exists public.location_permissions add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table if exists public.location_permissions add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.location_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  permission_id uuid references public.location_permissions (id) on delete set null,
  document_category text not null default 'other',
  original_name text not null,
  stored_name text not null,
  storage_path text not null,
  mime_type text not null,
  file_ext text not null,
  file_size_bytes bigint not null default 0,
  notes text,
  uploaded_by uuid references public.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint location_documents_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint location_documents_file_size_non_negative check (file_size_bytes >= 0)
);

alter table if exists public.location_documents add column if not exists project_id uuid references public.projects (id) on delete cascade;
alter table if exists public.location_documents add column if not exists location_id uuid references public.locations (id) on delete cascade;
alter table if exists public.location_documents add column if not exists permission_id uuid references public.location_permissions (id) on delete set null;
alter table if exists public.location_documents add column if not exists document_category text not null default 'other';
alter table if exists public.location_documents add column if not exists original_name text;
alter table if exists public.location_documents add column if not exists stored_name text;
alter table if exists public.location_documents add column if not exists storage_path text;
alter table if exists public.location_documents add column if not exists mime_type text;
alter table if exists public.location_documents add column if not exists file_ext text;
alter table if exists public.location_documents add column if not exists file_size_bytes bigint not null default 0;
alter table if exists public.location_documents add column if not exists notes text;
alter table if exists public.location_documents add column if not exists uploaded_by uuid references public.users (id) on delete set null;
alter table if exists public.location_documents add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.location_documents add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table if exists public.location_documents add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.location_amenities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  amenity_type text not null,
  name text,
  address text,
  phone_number text,
  distance_km numeric(10,2),
  latitude double precision,
  longitude double precision,
  map_link text,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint location_amenities_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint location_amenities_type_check check (amenity_type in ('hospital', 'police_station', 'petrol_bunk')),
  constraint location_amenities_source_check check (source in ('manual', 'mapbox')),
  constraint location_amenities_distance_non_negative check (distance_km is null or distance_km >= 0)
);

alter table if exists public.location_amenities add column if not exists project_id uuid references public.projects (id) on delete cascade;
alter table if exists public.location_amenities add column if not exists location_id uuid references public.locations (id) on delete cascade;
alter table if exists public.location_amenities add column if not exists amenity_type text not null default 'hospital';
alter table if exists public.location_amenities add column if not exists name text;
alter table if exists public.location_amenities add column if not exists address text;
alter table if exists public.location_amenities add column if not exists phone_number text;
alter table if exists public.location_amenities add column if not exists distance_km numeric(10,2);
alter table if exists public.location_amenities add column if not exists latitude double precision;
alter table if exists public.location_amenities add column if not exists longitude double precision;
alter table if exists public.location_amenities add column if not exists map_link text;
alter table if exists public.location_amenities add column if not exists source text not null default 'manual';
alter table if exists public.location_amenities add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.location_amenities add column if not exists created_by uuid references public.users (id) on delete set null;
alter table if exists public.location_amenities add column if not exists updated_by uuid references public.users (id) on delete set null;
alter table if exists public.location_amenities add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table if exists public.location_amenities add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.location_timeline (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  event_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint location_timeline_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

alter table if exists public.location_timeline add column if not exists project_id uuid references public.projects (id) on delete cascade;
alter table if exists public.location_timeline add column if not exists location_id uuid references public.locations (id) on delete cascade;
alter table if exists public.location_timeline add column if not exists event_type text not null default 'custom';
alter table if exists public.location_timeline add column if not exists title text;
alter table if exists public.location_timeline add column if not exists description text;
alter table if exists public.location_timeline add column if not exists event_at timestamptz not null default timezone('utc', now());
alter table if exists public.location_timeline add column if not exists created_by uuid references public.users (id) on delete set null;
alter table if exists public.location_timeline add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.location_timeline add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table if exists public.location_timeline add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.location_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint location_comments_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

alter table if exists public.location_comments add column if not exists project_id uuid references public.projects (id) on delete cascade;
alter table if exists public.location_comments add column if not exists location_id uuid references public.locations (id) on delete cascade;
alter table if exists public.location_comments add column if not exists user_id uuid references public.users (id) on delete set null;
alter table if exists public.location_comments add column if not exists message text;
alter table if exists public.location_comments add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.location_comments add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table if exists public.location_comments add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.location_audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  actor_user_id uuid references public.users (id) on delete set null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint location_audit_logs_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

alter table if exists public.location_audit_logs add column if not exists project_id uuid references public.projects (id) on delete cascade;
alter table if exists public.location_audit_logs add column if not exists location_id uuid references public.locations (id) on delete set null;
alter table if exists public.location_audit_logs add column if not exists action text;
alter table if exists public.location_audit_logs add column if not exists entity_type text;
alter table if exists public.location_audit_logs add column if not exists entity_id text;
alter table if exists public.location_audit_logs add column if not exists actor_user_id uuid references public.users (id) on delete set null;
alter table if exists public.location_audit_logs add column if not exists before_state jsonb;
alter table if exists public.location_audit_logs add column if not exists after_state jsonb;
alter table if exists public.location_audit_logs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.location_audit_logs add column if not exists created_at timestamptz not null default timezone('utc', now());

create table if not exists public.location_shoot_readiness (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  recce_complete boolean not null default false,
  permissions_complete boolean not null default false,
  amenities_added boolean not null default false,
  documents_uploaded boolean not null default false,
  readiness_score integer not null default 0,
  readiness_status text not null default 'not_ready',
  summary text,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint location_shoot_readiness_status_check check (readiness_status in ('not_ready', 'almost_ready', 'ready')),
  constraint location_shoot_readiness_score_range check (readiness_score between 0 and 4)
);

alter table if exists public.location_shoot_readiness add column if not exists project_id uuid references public.projects (id) on delete cascade;
alter table if exists public.location_shoot_readiness add column if not exists location_id uuid references public.locations (id) on delete cascade;
alter table if exists public.location_shoot_readiness add column if not exists recce_complete boolean not null default false;
alter table if exists public.location_shoot_readiness add column if not exists permissions_complete boolean not null default false;
alter table if exists public.location_shoot_readiness add column if not exists amenities_added boolean not null default false;
alter table if exists public.location_shoot_readiness add column if not exists documents_uploaded boolean not null default false;
alter table if exists public.location_shoot_readiness add column if not exists readiness_score integer not null default 0;
alter table if exists public.location_shoot_readiness add column if not exists readiness_status text not null default 'not_ready';
alter table if exists public.location_shoot_readiness add column if not exists summary text;
alter table if exists public.location_shoot_readiness add column if not exists created_by uuid references public.users (id) on delete set null;
alter table if exists public.location_shoot_readiness add column if not exists updated_by uuid references public.users (id) on delete set null;
alter table if exists public.location_shoot_readiness add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table if exists public.location_shoot_readiness add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.location_costs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  cost_type text not null,
  label text,
  amount numeric(14,2) not null default 0,
  currency_code text not null default 'INR',
  approval_requested boolean not null default false,
  approval_id uuid references public.approvals (id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint location_costs_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint location_costs_type_check check (cost_type in ('rent', 'permit_fee', 'security_fee', 'other')),
  constraint location_costs_amount_non_negative check (amount >= 0)
);

alter table if exists public.location_costs add column if not exists project_id uuid references public.projects (id) on delete cascade;
alter table if exists public.location_costs add column if not exists location_id uuid references public.locations (id) on delete cascade;
alter table if exists public.location_costs add column if not exists cost_type text not null default 'other';
alter table if exists public.location_costs add column if not exists label text;
alter table if exists public.location_costs add column if not exists amount numeric(14,2) not null default 0;
alter table if exists public.location_costs add column if not exists currency_code text not null default 'INR';
alter table if exists public.location_costs add column if not exists approval_requested boolean not null default false;
alter table if exists public.location_costs add column if not exists approval_id uuid references public.approvals (id) on delete set null;
alter table if exists public.location_costs add column if not exists notes text;
alter table if exists public.location_costs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.location_costs add column if not exists created_by uuid references public.users (id) on delete set null;
alter table if exists public.location_costs add column if not exists updated_by uuid references public.users (id) on delete set null;
alter table if exists public.location_costs add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table if exists public.location_costs add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.location_geo_cache (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  cache_key text not null,
  cache_kind text not null,
  latitude double precision,
  longitude double precision,
  provider text not null default 'osm',
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint location_geo_cache_payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint location_geo_cache_kind_check check (cache_kind in ('reverse_geocode', 'amenity_lookup', 'location_metadata'))
);

alter table if exists public.location_geo_cache add column if not exists project_id uuid references public.projects (id) on delete cascade;
alter table if exists public.location_geo_cache add column if not exists cache_key text;
alter table if exists public.location_geo_cache add column if not exists cache_kind text not null default 'reverse_geocode';
alter table if exists public.location_geo_cache add column if not exists latitude double precision;
alter table if exists public.location_geo_cache add column if not exists longitude double precision;
alter table if exists public.location_geo_cache add column if not exists provider text not null default 'osm';
alter table if exists public.location_geo_cache add column if not exists payload jsonb not null default '{}'::jsonb;
alter table if exists public.location_geo_cache add column if not exists expires_at timestamptz;
alter table if exists public.location_geo_cache add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table if exists public.location_geo_cache add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists idx_locations_project_status
  on public.locations (project_id, status, shoot_start_date desc, created_at desc);

create index if not exists idx_locations_project_type
  on public.locations (project_id, location_type, risk_level);

create index if not exists idx_location_media_location_created
  on public.location_media (location_id, created_at desc);

create index if not exists idx_location_documents_location_created
  on public.location_documents (location_id, created_at desc);

create index if not exists idx_location_permissions_location_status
  on public.location_permissions (location_id, status, expiry_date asc);

create unique index if not exists idx_location_amenities_location_type
  on public.location_amenities (location_id, amenity_type);

create index if not exists idx_location_timeline_location_event
  on public.location_timeline (location_id, event_at desc);

create index if not exists idx_location_comments_location_created
  on public.location_comments (location_id, created_at desc);

create index if not exists idx_location_audit_logs_project_created
  on public.location_audit_logs (project_id, created_at desc);

create unique index if not exists idx_location_readiness_location_unique
  on public.location_shoot_readiness (location_id);

create index if not exists idx_location_costs_location_created
  on public.location_costs (location_id, created_at desc);

create unique index if not exists idx_location_geo_cache_key_unique
  on public.location_geo_cache (cache_key);

drop trigger if exists trg_locations_set_updated_at on public.locations;
create trigger trg_locations_set_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

drop trigger if exists trg_location_media_set_updated_at on public.location_media;
create trigger trg_location_media_set_updated_at
before update on public.location_media
for each row execute function public.set_updated_at();

drop trigger if exists trg_location_permissions_set_updated_at on public.location_permissions;
create trigger trg_location_permissions_set_updated_at
before update on public.location_permissions
for each row execute function public.set_updated_at();

drop trigger if exists trg_location_documents_set_updated_at on public.location_documents;
create trigger trg_location_documents_set_updated_at
before update on public.location_documents
for each row execute function public.set_updated_at();

drop trigger if exists trg_location_amenities_set_updated_at on public.location_amenities;
create trigger trg_location_amenities_set_updated_at
before update on public.location_amenities
for each row execute function public.set_updated_at();

drop trigger if exists trg_location_timeline_set_updated_at on public.location_timeline;
create trigger trg_location_timeline_set_updated_at
before update on public.location_timeline
for each row execute function public.set_updated_at();

drop trigger if exists trg_location_comments_set_updated_at on public.location_comments;
create trigger trg_location_comments_set_updated_at
before update on public.location_comments
for each row execute function public.set_updated_at();

drop trigger if exists trg_location_shoot_readiness_set_updated_at on public.location_shoot_readiness;
create trigger trg_location_shoot_readiness_set_updated_at
before update on public.location_shoot_readiness
for each row execute function public.set_updated_at();

drop trigger if exists trg_location_costs_set_updated_at on public.location_costs;
create trigger trg_location_costs_set_updated_at
before update on public.location_costs
for each row execute function public.set_updated_at();

drop trigger if exists trg_location_geo_cache_set_updated_at on public.location_geo_cache;
create trigger trg_location_geo_cache_set_updated_at
before update on public.location_geo_cache
for each row execute function public.set_updated_at();

alter table if exists public.locations enable row level security;
alter table if exists public.location_media enable row level security;
alter table if exists public.location_permissions enable row level security;
alter table if exists public.location_documents enable row level security;
alter table if exists public.location_amenities enable row level security;
alter table if exists public.location_timeline enable row level security;
alter table if exists public.location_comments enable row level security;
alter table if exists public.location_audit_logs enable row level security;
alter table if exists public.location_shoot_readiness enable row level security;
alter table if exists public.location_costs enable row level security;
alter table if exists public.location_geo_cache enable row level security;

alter table if exists public.locations force row level security;
alter table if exists public.location_media force row level security;
alter table if exists public.location_permissions force row level security;
alter table if exists public.location_documents force row level security;
alter table if exists public.location_amenities force row level security;
alter table if exists public.location_timeline force row level security;
alter table if exists public.location_comments force row level security;
alter table if exists public.location_audit_logs force row level security;
alter table if exists public.location_shoot_readiness force row level security;
alter table if exists public.location_costs force row level security;
alter table if exists public.location_geo_cache force row level security;

drop policy if exists locations_select_scoped on public.locations;
create policy locations_select_scoped
on public.locations
for select
using (public.can_view_locations(project_id));

drop policy if exists locations_manage_scoped on public.locations;
create policy locations_manage_scoped
on public.locations
for all
using (public.can_manage_locations(project_id))
with check (public.can_manage_locations(project_id));

drop policy if exists location_media_select_scoped on public.location_media;
create policy location_media_select_scoped
on public.location_media
for select
using (public.can_view_locations(project_id));

drop policy if exists location_media_insert_scoped on public.location_media;
create policy location_media_insert_scoped
on public.location_media
for insert
with check (public.can_contribute_location_media(project_id));

drop policy if exists location_media_update_scoped on public.location_media;
create policy location_media_update_scoped
on public.location_media
for update
using (public.can_manage_locations(project_id))
with check (public.can_manage_locations(project_id));

drop policy if exists location_media_delete_scoped on public.location_media;
create policy location_media_delete_scoped
on public.location_media
for delete
using (public.can_manage_locations(project_id));

drop policy if exists location_permissions_select_scoped on public.location_permissions;
create policy location_permissions_select_scoped
on public.location_permissions
for select
using (public.can_view_locations(project_id));

drop policy if exists location_permissions_manage_scoped on public.location_permissions;
create policy location_permissions_manage_scoped
on public.location_permissions
for all
using (public.can_manage_locations(project_id))
with check (public.can_manage_locations(project_id));

drop policy if exists location_documents_select_scoped on public.location_documents;
create policy location_documents_select_scoped
on public.location_documents
for select
using (public.can_view_locations(project_id));

drop policy if exists location_documents_manage_scoped on public.location_documents;
create policy location_documents_manage_scoped
on public.location_documents
for all
using (public.can_manage_locations(project_id))
with check (public.can_manage_locations(project_id));

drop policy if exists location_amenities_select_scoped on public.location_amenities;
create policy location_amenities_select_scoped
on public.location_amenities
for select
using (public.can_view_locations(project_id));

drop policy if exists location_amenities_manage_scoped on public.location_amenities;
create policy location_amenities_manage_scoped
on public.location_amenities
for all
using (public.can_manage_locations(project_id))
with check (public.can_manage_locations(project_id));

drop policy if exists location_timeline_select_scoped on public.location_timeline;
create policy location_timeline_select_scoped
on public.location_timeline
for select
using (public.can_view_locations(project_id));

drop policy if exists location_timeline_manage_scoped on public.location_timeline;
create policy location_timeline_manage_scoped
on public.location_timeline
for all
using (public.can_manage_locations(project_id))
with check (public.can_manage_locations(project_id));

drop policy if exists location_comments_select_scoped on public.location_comments;
create policy location_comments_select_scoped
on public.location_comments
for select
using (public.can_view_locations(project_id));

drop policy if exists location_comments_insert_scoped on public.location_comments;
create policy location_comments_insert_scoped
on public.location_comments
for insert
with check (public.can_view_locations(project_id));

drop policy if exists location_comments_update_scoped on public.location_comments;
create policy location_comments_update_scoped
on public.location_comments
for update
using (public.can_manage_locations(project_id))
with check (public.can_manage_locations(project_id));

drop policy if exists location_comments_delete_scoped on public.location_comments;
create policy location_comments_delete_scoped
on public.location_comments
for delete
using (public.can_manage_locations(project_id));

drop policy if exists location_audit_logs_select_scoped on public.location_audit_logs;
create policy location_audit_logs_select_scoped
on public.location_audit_logs
for select
using (public.can_manage_locations(project_id));

drop policy if exists location_audit_logs_manage_scoped on public.location_audit_logs;
create policy location_audit_logs_manage_scoped
on public.location_audit_logs
for all
using (public.can_manage_locations(project_id))
with check (public.can_manage_locations(project_id));

drop policy if exists location_shoot_readiness_select_scoped on public.location_shoot_readiness;
create policy location_shoot_readiness_select_scoped
on public.location_shoot_readiness
for select
using (public.can_view_locations(project_id));

drop policy if exists location_shoot_readiness_manage_scoped on public.location_shoot_readiness;
create policy location_shoot_readiness_manage_scoped
on public.location_shoot_readiness
for all
using (public.can_manage_locations(project_id))
with check (public.can_manage_locations(project_id));

drop policy if exists location_costs_select_scoped on public.location_costs;
create policy location_costs_select_scoped
on public.location_costs
for select
using (public.can_view_locations(project_id));

drop policy if exists location_costs_manage_scoped on public.location_costs;
create policy location_costs_manage_scoped
on public.location_costs
for all
using (public.can_manage_locations(project_id))
with check (public.can_manage_locations(project_id));

drop policy if exists location_geo_cache_select_scoped on public.location_geo_cache;
create policy location_geo_cache_select_scoped
on public.location_geo_cache
for select
using (project_id is null or public.can_view_locations(project_id));

drop policy if exists location_geo_cache_manage_scoped on public.location_geo_cache;
create policy location_geo_cache_manage_scoped
on public.location_geo_cache
for all
using (project_id is null or public.can_manage_locations(project_id))
with check (project_id is null or public.can_manage_locations(project_id));
