create table if not exists public.camera_wishlist (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  item_name text not null,
  category text not null check (category in ('camera', 'lighting', 'grip')),
  vendor_name text,
  estimated_rate numeric(14,2),
  quantity integer not null default 1 check (quantity > 0),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.camera_wishlist
  add column if not exists project_id uuid references public.projects (id) on delete cascade,
  add column if not exists item_name text,
  add column if not exists category text,
  add column if not exists vendor_name text,
  add column if not exists estimated_rate numeric(14,2),
  add column if not exists quantity integer default 1,
  add column if not exists created_by uuid references public.users (id) on delete set null,
  add column if not exists created_at timestamptz default timezone('utc', now()),
  add column if not exists updated_at timestamptz default timezone('utc', now());

create table if not exists public.camera_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  requested_by uuid references public.users (id) on delete set null,
  department text not null default 'camera',
  status text not null default 'pending_dop' check (status in ('pending_dop', 'pending_producer', 'approved', 'rejected')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.camera_requests
  add column if not exists project_id uuid references public.projects (id) on delete cascade,
  add column if not exists item_name text,
  add column if not exists quantity integer default 1,
  add column if not exists requested_by uuid references public.users (id) on delete set null,
  add column if not exists department text default 'camera',
  add column if not exists status text default 'pending_dop',
  add column if not exists notes text,
  add column if not exists created_at timestamptz default timezone('utc', now()),
  add column if not exists updated_at timestamptz default timezone('utc', now());

create table if not exists public.damage_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  asset_name text not null,
  asset_id uuid references public.assets (id) on delete set null,
  issue_type text not null check (issue_type in ('damaged', 'lost', 'received_damaged')),
  reported_by uuid references public.users (id) on delete set null,
  image_url text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.damage_reports
  add column if not exists project_id uuid references public.projects (id) on delete cascade,
  add column if not exists asset_name text,
  add column if not exists asset_id uuid references public.assets (id) on delete set null,
  add column if not exists issue_type text,
  add column if not exists reported_by uuid references public.users (id) on delete set null,
  add column if not exists image_url text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default timezone('utc', now());

alter table if exists public.asset_logs
  add column if not exists asset_name text,
  add column if not exists check_in_time timestamptz,
  add column if not exists check_out_time timestamptz,
  add column if not exists scanned_by uuid references public.users (id) on delete set null,
  add column if not exists status text;

create index if not exists idx_camera_wishlist_project on public.camera_wishlist (project_id, created_at desc);
create index if not exists idx_camera_requests_project on public.camera_requests (project_id, created_at desc);
create index if not exists idx_camera_requests_status on public.camera_requests (project_id, status);
create index if not exists idx_damage_reports_project on public.damage_reports (project_id, created_at desc);
create index if not exists idx_damage_reports_issue_type on public.damage_reports (project_id, issue_type, created_at desc);
create index if not exists idx_asset_logs_camera_status on public.asset_logs (project_id, status, created_at desc);
