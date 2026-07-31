alter table if exists public.hotels
  add column if not exists project_id uuid references public.projects (id) on delete cascade;

create index if not exists idx_hotels_project_id_hotel_name
  on public.hotels(project_id, hotel_name);

alter table if exists public.location_permissions
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users (id) on delete set null;

create index if not exists idx_location_permissions_deleted_lookup
  on public.location_permissions(project_id, location_id, deleted_at);
